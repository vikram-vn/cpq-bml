# Oracle CPQ BML MCP Server: Architecture, Tools & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [MCP Server Request & Tool Dispatch Lifecycle (CFG 1)](#2-mcp-server-request--tool-dispatch-lifecycle-cfg-1)
3. [5-Stage BML Function Lifecycle Flow (CFG 2)](#3-5-stage-bml-function-lifecycle-flow-cfg-2)
4. [Remote Debug Execution & Output Extraction (CFG 3)](#4-remote-debug-execution--output-extraction-cfg-3)
5. [Working Copy & Local Override State Machine (CFG 4)](#5-working-copy--local-override-state-machine-cfg-4)
6. [Static Analysis & Code Quality Pipeline (CFG 5)](#6-static-analysis--code-quality-pipeline-cfg-5)
7. [Regression Testing & Snapshot Verification (CFG 6)](#7-regression-testing--snapshot-verification-cfg-6)
8. [Comprehensive MCP Tool Catalog (24 Tools)](#8-comprehensive-mcp-tool-catalog-24-tools)

---

## 1. Overview & High-Level Architecture

The **CPQ-BML MCP Server** exposes the full lifecycle of Oracle CPQ BML development as Model Context Protocol (MCP) tools via JSON-RPC over `stdio`. It connects AI coding agents directly to the local workspace, BML AST compiler, and remote Oracle CPQ instances:

```mermaid
graph LR
    subgraph AI Client
        AGENT["AI Agent / Cursor / Antigravity"]
    end

    subgraph MCP Server Engine
        STDIO["JSON-RPC Stdio Transport<br/>server.js"]
        REGISTRY["Tool Registry & Validation<br/>tool-defs/*.js"]
        PROXY["REST / SOAP CPQ Proxy<br/>proxy.js"]
    end

    subgraph Workspace & Local Core
        WORKING["AI Working Copy Manager<br/>locate.js"]
        LINTER["BML Linter & Beautifier<br/>lint/ & beautify/"]
        METRICS["Complexity & Halstead Metrics<br/>metrics/"]
    end

    subgraph Remote Target
        CPQ["Oracle CPQ Cloud Instance<br/>(REST & SOAP APIs)"]
    end

    AGENT -->|"JSON-RPC Request"| STDIO
    STDIO --> REGISTRY
    REGISTRY --> WORKING
    REGISTRY --> LINTER
    REGISTRY --> METRICS
    REGISTRY --> PROXY
    PROXY -->|"HTTPS Auth & Payload"| CPQ
    CPQ -->|"Execution Result / BML"| PROXY
    PROXY --> REGISTRY
    REGISTRY --> STDIO
    STDIO -->|"JSON-RPC Response"| AGENT
```

---

## 2. MCP Server Request & Tool Dispatch Lifecycle (CFG 1)

This control flow graph shows how incoming tool invocations are authenticated, schema-validated, executed, and formatted:

```mermaid
flowchart TD
    ReceiveReq(["Receive JSON-RPC Request over stdio"]) --> ParseJSON{"Valid JSON-RPC 2.0 payload?"}
    
    ParseJSON -->|"No"| ReturnParseError["Return JSON-RPC ParseError (-32700)"]
    ParseJSON -->|"Yes"| CheckMethod{"Method type?"}

    CheckMethod -->|"tools/list"| ReturnToolList["Return schema catalog for all 24 registered MCP tools"]
    CheckMethod -->|"tools/call"| ValidateTool{"Is toolName registered in Registry?"}

    ValidateTool -->|"No"| ReturnUnknownTool["Return MethodNotFound Error (-32601)"]
    ValidateTool -->|"Yes"| ValidateArgs{"Do arguments match JSON Schema in tool-def?"}

    ValidateArgs -->|"Invalid Schema"| ReturnInvalidParams["Return InvalidParams Error (-32602)"]
    ValidateArgs -->|"Valid Schema"| DispatchTool["Execute Tool Handler (tools/*.js)"]

    DispatchTool --> ExecutionSuccess{"Tool execution succeeded without error?"}
    ExecutionSuccess -->|"Yes"| FormatResult["Format payload with jsonResult helper"]
    ExecutionSuccess -->|"No"| FormatError["Wrap error message in isError: true payload"]

    FormatResult --> SendResponse(["Send JSON-RPC Response over stdio"])
    FormatError --> SendResponse
    ReturnParseError --> SendResponse
    ReturnToolList --> SendResponse
    ReturnUnknownTool --> SendResponse
    ReturnInvalidParams --> SendResponse
```

---

## 3. 5-Stage BML Function Lifecycle Flow (CFG 2)

The recommended 5-stage lifecycle workflow for AI agents developing BML functions:

```mermaid
flowchart TD
    StartLifecycle(["Start Function Development Workflow"]) --> Step1["Step 1: pull_function (Retrieve remote BML into working copy)"]
    
    Step1 --> Step2["Step 2: AI Code Generation & Local Edit in Working Copy"]
    
    Step2 --> Step3["Step 3: Verification via lint_function & validate_function"]
    Step3 --> HasLintErrors{"Are there Syntax or Type errors?"}
    HasLintErrors -->|"Yes"| Step2

    HasLintErrors -->|"No"| Step4["Step 4: debug_function (Execute remote test harness)"]
    Step4 --> CheckDebugOutput{"Debug result matches expected behavior?"}
    CheckDebugOutput -->|"No"| InspectPrint["Inspect console print output and adjust code"]
    InspectPrint --> Step2

    CheckDebugOutput -->|"Yes"| Step5["Step 5: save_function & deploy_function"]
    Step5 --> CompleteDeployment(["Function Successfully Deployed to CPQ Environment"])
```

---

## 4. Remote Debug Execution & Output Extraction (CFG 3)

The `debug_function` tool runs functions on the remote Oracle CPQ debug engine, with optional `printOnly: true` filtering:

```mermaid
flowchart TD
    TriggerDebug(["Call debug_function(funcName, params, printOnly)"]) --> PreparePayload["Assemble parameter Dictionary and function script"]
    
    PreparePayload --> DispatchProxy["Send HTTPS POST request to CPQ Debug API via proxy.js"]
    DispatchProxy --> HTTPResponse{"HTTP Status 200 OK received?"}
    
    HTTPResponse -->|"No"| EmitHTTPError["Return HTTP failure and error body"]
    HTTPResponse -->|"Yes"| ParseDebugResponse["Parse execution output and console logs"]

    ParseDebugResponse --> PrintOnlyCheck{"Is printOnly option set to true?"}
    PrintOnlyCheck -->|"Yes"| ExtractPrintLogs["Filter response to only include 'print' statement outputs"]
    PrintOnlyCheck -->|"No"| ExtractFullResult["Include return value, execution time, and stdout logs"]

    ExtractPrintLogs --> ReturnDebugResult(["Return Structured Debug JSON Result"])
    ExtractFullResult --> ReturnDebugResult
    EmitHTTPError --> ReturnDebugResult
```

---

## 5. Working Copy & Local Override State Machine (CFG 4)

Manages the separation between remote CPQ source, local overrides, and AI ephemeral working copies:

```mermaid
flowchart TD
    FileAction(["Function File Access Request"]) --> CheckOverride{"Does local override exist in .cpqdevkit/overrides?"}
    
    CheckOverride -->|"Yes"| LoadOverride["Load custom developer override file"]
    CheckOverride -->|"No"| CheckAICopy{"Does AI working copy exist in .cpqdevkit/ai?"}

    CheckAICopy -->|"Yes"| LoadAICopy["Load AI working copy"]
    CheckAICopy -->|"No"| FetchRemote["Fetch live function from CPQ via pull_function"]

    FetchRemote --> SaveLocalCache["Cache copy to local working tree"]
    SaveLocalCache --> ReturnFileContent(["Return BML Function Content"])
    LoadOverride --> ReturnFileContent
    LoadAICopy --> ReturnFileContent
```

---

## 6. Static Analysis & Code Quality Pipeline (CFG 5)

Calculates AST diagnostics, cyclomatic complexity, Halstead metrics, and nesting depths via MCP:

```mermaid
flowchart TD
    TriggerAnalysis(["Call lint_function or get_function_metrics"]) --> FetchScript["Load BML script content"]
    
    FetchScript --> RunLinter["Execute BML Linter Rule Runner (27 Rules)"]
    RunLinter --> CollectDiagnostics["Collect Errors, Warnings, and QuickFix counts"]

    CollectDiagnostics --> RunMetrics["Run AST Metrics Analyzer"]
    RunMetrics --> CalcCyclomatic["Compute Cyclomatic Complexity (decision branches + 1)"]
    CalcCyclomatic --> CalcHalstead["Compute Halstead Volume, Difficulty & Effort"]
    CalcHalstead --> CalcNesting["Compute Maximum Loop Depth and Block Depth"]

    CalcNesting --> BuildMetricsReport["Construct JSON Report with Grade and Complexity Score"]
    BuildMetricsReport --> ReturnQualityReport(["Return Complete Quality Metrics JSON"])
```

---

## 7. Regression Testing & Snapshot Verification (CFG 6)

Automates remote and local unit tests and compares execution snapshots against baselines:

```mermaid
flowchart TD
    TriggerTests(["Call run_bml_tests(testFilter, updateSnapshots)"]) --> LoadTestCases["Discover test fixtures and input datasets"]
    
    LoadTestCases --> RunEachTest["Execute function with test parameters"]
    RunEachTest --> RecordOutput["Capture execution return value and state"]

    RecordOutput --> UpdateFlag{"Is updateSnapshots == true?"}
    UpdateFlag -->|"Yes"| WriteBaseline["Write execution result as new approved snapshot baseline"]
    
    UpdateFlag -->|"No"| CompareBaseline{"Does result match stored snapshot JSON?"}
    CompareBaseline -->|"Match"| MarkPassed["Mark Test Case as PASSED"]
    CompareBaseline -->|"Diff Detected"| MarkFailed["Mark Test Case as FAILED with JSON diff"]

    WriteBaseline --> CheckMoreTests{"More test cases remaining?"}
    MarkPassed --> CheckMoreTests
    MarkFailed --> CheckMoreTests

    CheckMoreTests -->|"Yes"| RunEachTest
    CheckMoreTests -->|"No"| SummarizeResults["Generate Test Summary (Passed, Failed, Duration)"]
    SummarizeResults --> ReturnTestSummary(["Return Test Execution Report"])
```

---

## 8. Comprehensive MCP Tool Catalog (24 Tools)

| Category | Tool Name | Parameters | Description |
| :--- | :--- | :--- | :--- |
| **Lifecycle** | `pull_function` | `functionName`, `type` | Pulls a single BML function from CPQ into local working copy. |
| | `pull_functions` | `functionNames` | Batch-pulls multiple functions simultaneously. |
| | `save_function` | `functionName`, `code` | Saves the working copy to the CPQ environment. |
| | `validate_function` | `functionName`, `code` | Compiles and validates syntax remotely on CPQ. |
| | `debug_function` | `functionName`, `params`, `printOnly` | Executes function in remote debug harness with inputs. |
| | `deploy_function` | `functionName` | Deploys validated function to target CPQ environment. |
| | `mass_deploy_util_functions`| `folderName` | Deploys all util library functions in bulk. |
| | `deploy_commerce_process` | `processName` | Deploys commerce process definitions and scripts. |
| | `create_util_function` | `name`, `folder`, `returnType` | Creates a new util function skeleton in CPQ. |
| | `create_override` | `functionName`, `code` | Creates a local developer override file. |
| | `remove_override` | `functionName` | Removes local override, reverting to base. |
| | `reset_ai_copy` | `functionName` | Discards AI modifications and restores original copy. |
| | `list_local_functions` | `filter` | Lists all local BML functions in workspace. |
| **Formatting & Quality** | `format_bml` | `code`, `options` | Formats BML code with deterministic beautifier. |
| | `lint_function` | `functionName` | Runs 27 static analysis rules on single function. |
| | `lint_all_functions` | `severityThreshold` | Runs static analysis across entire workspace. |
| | `get_function_metrics` | `functionName` | Computes Cyclomatic complexity, Halstead, nesting depth. |
| **Lookups & Diff** | `lookup_bml_reference` | `query` | Searches standard built-ins, attributes, and variables. |
| | `explain_function` | `functionName` | Provides structured explanation of function purpose. |
| | `diff_function` | `functionName`, `target` | Computes diff between working copy and remote base. |
| | `search_functions` | `query`, `searchType` | Full-text / symbol search across all workspace functions. |
| **Testing & Snapshots** | `run_bml_tests` | `testFilter`, `updateSnapshot` | Executes unit test suites against BML functions. |
| | `update_snapshot` | `testName` | Updates baseline snapshot fixture for regression testing. |
| **Connection & Status** | `get_connection_status` | `testConnection` (optional) | Reports whether CPQ credentials are configured (never exposes secret values or instance URLs). |
| | `list_util_functions` | `folder` | Lists remote util functions from CPQ instance. |
| | `list_commerce_functions` | `process` | Lists remote commerce process functions. |
