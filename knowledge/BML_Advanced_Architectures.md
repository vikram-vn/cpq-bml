# Oracle CPQ BML Advanced Architectures & Subsystems

Comprehensive technical architecture reference for the advanced subsystems introduced in CPQ-BML: Multi-AI MCP integration, local logic evaluation, offline BMQL validation, AST security diagnostics, call hierarchy, safe synchronization, and CI/CD automation.

---

## Table of Contents
1. [Multi-Client MCP & Native Resource Architecture](#1-multi-client-mcp--native-resource-architecture)
2. [Local BML Pure Logic Evaluator & Sandbox](#2-local-bml-pure-logic-evaluator--sandbox)
3. [Offline BMQL Query Validator & Explainer Pipeline](#3-offline-bmql-query-validator--explainer-pipeline)
4. [Real-Time AST Security Diagnostics & Quick-Fix Engine](#4-real-time-ast-security-diagnostics--quick-fix-engine)
5. [Semantic Call Hierarchy & Dependency Graph Provider](#5-semantic-call-hierarchy--dependency-graph-provider)
6. [Safe Synchronization & 3-Way Diff Architecture](#6-safe-synchronization--3-way-diff-architecture)
7. [Automated BML Function & Sidecar Scaffolding](#7-automated-bml-function--sidecar-scaffolding)
8. [Standalone CI/CD Quality Gate CLI](#8-standalone-cicd-quality-gate-cli)

---

## 1. Multi-Client MCP & Native Resource Architecture

The CPQ-BML MCP Server provides an HTTP SSE and Streamable HTTP JSON-RPC transport (`127.0.0.1:<port>`) supporting multi-client auto-registration across desktop AI applications.

```mermaid
graph TD
    subgraph AI Client Ecosystem
        CUR["Cursor IDE<br/>(~/.cursor/mcp.json)"]
        COP["GitHub Copilot<br/>(.vscode/mcp.json)"]
        AGY["Google Antigravity<br/>(~/.gemini/config/mcp_config.json)"]
        CLA["Claude Desktop<br/>(claude_desktop_config.json)"]
        GPT["ChatGPT Desktop<br/>(chatgpt_desktop_config.json)"]
    end

    subgraph MCP Server Engine
        HTTP["HTTP / SSE Server<br/>server.js"]
        PORT["Auto Port Recovery<br/>(EADDRINUSE Probe)"]
        TRAFFIC["Ring Buffer Inspector<br/>traffic.js (50 Calls)"]
    end

    subgraph Resources & Protocols
        R_COMM["cpq://attributes/commerce"]
        R_CONF["cpq://attributes/configuration"]
        R_DT["cpq://datatables/list"]
        R_SKILLS["skill://{skillName}"]
    end

    CUR & COP & AGY & CLA & GPT -->|"JSON-RPC (Streamable HTTP)"| HTTP
    HTTP --> PORT
    HTTP --> TRAFFIC
    HTTP --> R_COMM & R_CONF & R_DT & R_SKILLS
```

### Architectural Highlights
- **Dynamic Port Synchronization**: The active port is read directly from `cpqBml.mcp.port`. If modified in Settings, registered AI clients receive updated endpoints automatically.
- **Port Collision Recovery**: On `EADDRINUSE`, the server automatically probes the next available port, updates the configuration, notifies the user, and synchronizes client config files.
- **Safe Path Discovery**: AI configs are only written if the target AI application exists on the developer's system, avoiding directory pollution in clean workspaces.
- **Native MCP Resources**: Implements `resources/list` and `resources/read` handlers for read-only metadata browsing.

---

## 2. Local BML Pure Logic Evaluator & Sandbox

The Local Evaluator provides an offline JavaScript VM sandbox pre-configured with Oracle CPQ BML built-in runtime functions:

```mermaid
flowchart TD
    RawCode["Raw BML Source Code"] --> Preprocess["AST Preprocessor<br/>(elif -> else if, types -> let, IIFE wrap)"]
    Preprocess --> VMScript["Compile to Node.js vm.Script"]
    VMScript --> SandboxCtx["Inject CPQ Built-in Sandbox Context"]
    
    subgraph Sandbox Scope
        PRINT["print() Log Collector"]
        STR["String Functions (lower, upper, split, len, replace)"]
        MATH["Math Functions (round, abs, min, max, sqrt)"]
        DICT["BML Dict (dict, put, get, containskey)"]
        JSON_F["JSON Utilities (json, jsonarray, jsonget, jsonput)"]
        DATE_F["Date Arithmetic (getdate, datetostr, adddays)"]
    end
    
    SandboxCtx --> SandboxScope
    SandboxScope --> Execution["Execute with Timeout Guard (default: 3000ms)"]
    Execution --> Result["Return { success, output, returnValue, durationMs }"]
```

### Key Integrations
- **BML Scratchpad Webview (`cpqBml.openScratchpad`)**: Interactive dual-panel sandbox editor with live `print()` logs, return value inspection, and runtime latency measurements.
- **Editor Selection Runner (`cpqBml.runBmlLocally`)**: Instantly executes highlighted BML code and prints outputs directly to the `BML Scratchpad` output channel.
- **MCP Tool `evaluate_bml_logic`**: Enables AI models to test and verify BML algorithms offline before proposing code modifications.

---

## 3. Offline BMQL Query Validator & Explainer Pipeline

Validates BMQL queries against Oracle CPQ database engine standards without requiring a live server connection:

```mermaid
flowchart LR
    Query["BMQL Query String"] --> Parser["BMQL Syntax Parser"]
    
    Parser --> DisallowedKW{"Contains SQL Joins, Aggregates, or DML?"}
    DisallowedKW -->|"Yes (JOIN, GROUP BY, INSERT)"| ErrorResult["Reject with CPQ Restriction Reason"]
    
    DisallowedKW -->|"No"| InjectionCheck{"Dynamic String Concatenation Detected?"}
    InjectionCheck -->|"Yes (' + var + ')"| CriticalInjection["Flag Critical Injection Risk"]
    
    InjectionCheck -->|"No"| Clauses["Extract Table, Columns & $Parameters"]
    Clauses --> Advisories{"SELECT * or Missing WHERE?"}
    Advisories -->|"Yes"| PerformanceWarning["Generate Performance Advisory"]
    Advisories -->|"No"| ValidReport["Generate Explanation & Output Schema"]
```

### Enforced CPQ BMQL Restrictions
- Rejects SQL table `JOIN` operations (BMQL queries single Data Tables).
- Rejects SQL aggregate functions (`COUNT`, `SUM`, `AVG`, `GROUP BY`, `HAVING`).
- Rejects SQL sorting clauses (`ORDER BY` is not supported in standard BMQL; sorting must occur in BML arrays/recordsets).
- Rejects DML statements (`INSERT`, `UPDATE`, `DELETE`; Data Tables are modified via REST or bulk feeds).
- Enforces parameterized variables (`$varName`) over dynamic string concatenation.

---

## 4. Real-Time AST Security Diagnostics & Quick-Fix Engine

Provides instantaneous editor squiggles and lightbulb quick-fixes (`Alt+Enter`) as code is edited:

```mermaid
flowchart TD
    DocChange["BML Document Edit Event"] --> Debounce["Debounce Timer (400ms)"]
    Debounce --> SecurityAudit["Run AST & Pattern Security Auditor"]
    
    SecurityAudit --> RulesCheck{"Rules Evaluated"}
    RulesCheck --> Injection["BMQL Injection Risk"]
    RulesCheck --> NPlusOne["Query in Loop (N+1)"]
    RulesCheck --> UnboundedLoop["Unbounded While Loop"]
    RulesCheck --> Memory["Repeated String Concatenation"]
    
    RulesCheck --> DiagCollection["Set vscode.DiagnosticCollection ('bml-security')"]
    DiagCollection --> EditorUI["Render Red/Yellow Editor Squiggles"]
    
    EditorUI --> CodeActions["User presses Alt+Enter / Lightbulb"]
    CodeActions --> ParameterizeFix["Quick-Fix: Replace Concatenation with $var"]
    CodeActions --> LoopCounterFix["Quick-Fix: Insert Loop Safety Counter & Break"]
```

---

## 5. Semantic Call Hierarchy & Dependency Graph Provider

Implements `vscode.CallHierarchyProvider` for workspace-wide function navigation (`Shift+Alt+H`):

- **Incoming Calls**: Traverses all `.bml` files in the workspace index to identify every call site referencing `util.<functionName>` or `commerce.<functionName>`.
- **Outgoing Calls**: Parses the active function body using symbol extraction to resolve all downstream library functions and Data Tables called by the function.
- **Go to Definition (`F12`) & References (`Shift+F12`)**: Resolves both workspace library scripts and in-file local variables, function parameters, and docHeader signatures.

---

## 6. Safe Synchronization & 3-Way Diff Architecture

Guards against accidental loss of uncommitted local code during REST pulls:

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Pull as Pull Command
    participant Safe as SafeSync Engine
    participant VS as VS Code Diff Window
    participant Disk as Local File System

    Pull->>Safe: confirmAndWriteBmlFile(bmlPath, incomingText)
    Safe->>Disk: Read existing local file
    alt Content is Identical
        Safe->>Disk: Update Metadata sidecar
    else Local Modifications Exist
        Safe->>Dev: Show Conflict Dialog (Diff / Overwrite / Skip)
        alt Choose 'Compare (Diff)'
            Safe->>VS: vscode.diff(localFile, tempRemoteFile)
            Dev->>Safe: Post-diff review decision
        end
        alt Choose 'Overwrite'
            Safe->>Disk: Write remote script to disk
        else Choose 'Keep Local'
            Safe->>Disk: Skip file write, retain local edits
        end
    end
```

---

## 7. Automated BML Function & Sidecar Scaffolding

Guarantees dual-file integrity when creating new CPQ library functions:
- Prompts for function name, description, return type (CPQ type dropdown), and typed parameters (`name:Type`).
- Automatically generates:
  1. `<name>/<name>.bml` with standardized docHeader block comments and stubbed return value.
  2. `<name>/<name>-meta.json` with synchronous parameter schemas and return types.
- Auto-opens the scaffolded `.bml` file and positions cursor directly inside the function body.

---

## 8. Standalone CI/CD Quality Gate CLI

The extension ships with a standalone Node.js CLI executable located at `bin/cpq-bml.js`:

```bash
# Scan workspace or directory for security violations in CI
npx cpq-bml audit . --min-score=75 --format=pretty

# Output JSON report for CI dashboard integration
npx cpq-bml audit . --format=json

# Offline BMQL query validation in scripts
npx cpq-bml validate "SELECT partNumber FROM Parts WHERE active = $isActive"
```

- **Exit Code 0**: Clean audit, all files pass threshold.
- **Exit Code 1**: Critical security risks, BMQL injections, or failing audit scores detected.
