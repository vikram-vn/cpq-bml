# Oracle CPQ BML Settings Panel: Architecture, Webview & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [Webview Initialization & Security Lifecycle (CFG 1)](#2-webview-initialization--security-lifecycle-cfg-1)
3. [Bi-Directional Message Passing & RPC Bridge (CFG 2)](#3-bi-directional-message-passing--rpc-bridge-cfg-2)
4. [Multi-Tier Configuration Persistence (CFG 3)](#4-multi-tier-configuration-persistence-cfg-3)
5. [Connection Testing & Secret Storage Flow (CFG 4)](#5-connection-testing--secret-storage-flow-cfg-4)
6. [Real-Time Formatter & Linter Settings Sync (CFG 5)](#6-real-time-formatter--linter-settings-sync-cfg-5)
7. [Settings Tab Catalog & Configuration Matrix](#7-settings-tab-catalog--configuration-matrix)

---

## 1. Overview & High-Level Architecture

The **BML Settings Panel** provides a rich, responsive graphical UI inside VS Code for configuring the entire CPQ-BML extension suite. It enables developers to tune Formatter options, toggle Linter rules, manage multi-environment CPQ cloud credentials, configure IntelliSense behavior, and manage custom spell-check dictionaries:

```mermaid
graph LR
    subgraph Webview UI Frontend
        HTML["index.html & CSS"]
        TABS["Settings Tabs (Formatter, Linter, CPQ, etc.)"]
        BRIDGE["vscode.postMessage Client Bridge"]
    end

    subgraph Extension Host Backend
        PANEL["WebviewPanel Manager<br/>panel.js & index.js"]
        MSG["Message Dispatcher<br/>messageHandler.js"]
        STATE["State & Config Manager<br/>state.js"]
    end

    subgraph Persistence Storage
        VSC_CFG["VS Code Settings (Global / Workspace)"]
        RC_FILE[".bmlbeautifyrc / .env Files"]
        SECRETS["VS Code SecretStorage (Passwords/Tokens)"]
    end

    TABS --> BRIDGE
    HTML --> TABS
    BRIDGE -->|"postMessage(command, payload)"| MSG
    PANEL --> MSG
    MSG --> STATE
    STATE --> VSC_CFG
    STATE --> RC_FILE
    STATE --> SECRETS
    STATE -->|"postMessage(stateUpdate)"| BRIDGE
```

---

## 2. Webview Initialization & Security Lifecycle (CFG 1)

Ensures secure panel instantiation with Content Security Policy (CSP), local resource loading restrictions, and state synchronization:

```mermaid
flowchart TD
    TriggerOpen(["Execute 'cpq-bml.openSettings' Command"]) --> CheckExisting{"Is SettingsPanel already active?"}
    
    CheckExisting -->|"Yes"| RevealPanel["panel.reveal() to bring existing panel to front"]
    CheckExisting -->|"No"| CreateWebview["vscode.window.createWebviewPanel('cpqBmlSettings', ...)"]

    CreateWebview --> SetupCSP["Generate Content Security Policy (Nonce, strict script-src)"]
    SetupCSP --> ResolveURIs["Map local webview dist assets to webview.asWebviewUri()"]
    ResolveURIs --> LoadHTML["Render HTML container with CSS design tokens (html.js)"]

    LoadHTML --> ReadInitialState["Read current VS Code settings, .bmlbeautifyrc, and secrets"]
    ReadInitialState --> PostInitialState["panel.webview.postMessage({ type: 'INIT_STATE', data })"]
    
    PostInitialState --> MountUI["Mount Webview UI with active tabs and populated controls"]
    RevealPanel --> MountUI
    MountUI --> ReadyState(["Settings Panel Ready for Interaction"])
```

---

## 3. Bi-Directional Message Passing & RPC Bridge (CFG 2)

Handles asynchronous messaging between the React/Vanilla frontend in the Webview and the Node.js backend in the Extension Host:

```mermaid
flowchart TD
    UserAction(["User interacts with UI (e.g. toggle rule, update indent, test connection)"]) --> BuildMessage["Construct message: { command, payload, requestId }"]
    
    BuildMessage --> PostToHost["vscode.postMessage(message)"]
    PostToHost --> ReceiveInHost["onDidReceiveMessage listener in messageHandler.js"]

    ReceiveInHost --> RouteCommand{"Command Type?"}
    
    RouteCommand -->|"SAVE_SETTINGS"| SaveSettingsHandler["Persist updated properties to target configuration"]
    RouteCommand -->|"TEST_CONNECTION"| TestConnHandler["Execute HTTPS ping against target CPQ instance"]
    RouteCommand -->|"RESET_DEFAULTS"| ResetDefaultsHandler["Restore factory configuration values"]
    RouteCommand -->|"EXPORT_CONFIG"| ExportConfigHandler["Write .bmlbeautifyrc to workspace root"]

    SaveSettingsHandler --> BuildAckResponse["Construct response: { type: 'SAVE_SUCCESS', requestId }"]
    TestConnHandler --> BuildAckResponse
    ResetDefaultsHandler --> BuildAckResponse
    ExportConfigHandler --> BuildAckResponse

    BuildAckResponse --> PostToWebview["panel.webview.postMessage(response)"]
    PostToWebview --> UpdateWebviewUI(["Update Webview UI (show toast / update status badge)"])
```

---

## 4. Multi-Tier Configuration Persistence (CFG 3)

Resolves setting precedence across User Settings, Workspace Settings, and project `.bmlbeautifyrc` files:

```mermaid
flowchart TD
    SaveRequest(["Save Configuration Property"]) --> CheckScope{"Target Configuration Scope?"}
    
    CheckScope -->|"Global User"| UpdateGlobal["vscode.workspace.getConfiguration('bml').update(..., Global)"]
    CheckScope -->|"Workspace Folder"| UpdateWorkspace["vscode.workspace.getConfiguration('bml').update(..., Workspace)"]
    CheckScope -->|"Project RC File"| UpdateRCFile["Write updated JSON to .bmlbeautifyrc on disk"]
    CheckScope -->|"Environment Secret"| UpdateSecret["secretStorage.store(envKey, password)"]

    UpdateGlobal --> InvalidateCache["Invalidate in-memory config cache (configCache.clear())"]
    UpdateWorkspace --> InvalidateCache
    UpdateRCFile --> InvalidateCache
    UpdateSecret --> InvalidateCache

    InvalidateCache --> NotifySubsystems["Notify Linter, Formatter & Language Client of change"]
    NotifySubsystems --> SaveComplete(["Configuration Successfully Persisted"])
```

---

## 5. Connection Testing & Secret Storage Flow (CFG 4)

Securely stores CPQ environment credentials and validates connectivity live:

```mermaid
flowchart TD
    ClickTest(["Click 'Test Connection' Button in CPQ Environment Tab"]) --> ExtractCreds["Extract URL, Username, and Password/Token from form"]
    
    ExtractCreds --> CheckStoreSecret{"Save credentials to VS Code SecretStorage?"}
    CheckStoreSecret -->|"Yes"| EncryptSecret["Store in encrypted OS keychain via SecretStorage"]
    CheckStoreSecret -->|"No"| EphemeralTest["Keep credentials in memory for test only"]

    EncryptSecret --> DispatchPing["POST /rest/v17/oauth2/token or GET /rest/v17/admin/ping"]
    EphemeralTest --> DispatchPing

    DispatchPing --> PingResponse{"Connection ping result?"}
    PingResponse -->|"200 OK Connected"| ShowSuccessBadge["Return status: Connected with latency benchmark (ms)"]
    PingResponse -->|"401 Unauthorized"| ShowAuthFail["Return status: Invalid username or password"]
    PingResponse -->|"Network / Timeout"| ShowNetFail["Return status: Unable to reach CPQ instance URL"]

    ShowSuccessBadge --> RenderBadge(["Update Environment Status Badge in UI"])
    ShowAuthFail --> RenderBadge
    ShowNetFail --> RenderBadge
```

---

## 6. Real-Time Formatter & Linter Settings Sync (CFG 5)

Applies settings changes immediately without requiring a VS Code restart:

```mermaid
flowchart TD
    SettingChanged(["Setting Modified in UI (e.g. brace_style changed to 'expand')"]) --> PersistChange["Persist change to configuration"]
    
    PersistChange --> EmitConfigEvent["vscode.workspace.onDidChangeConfiguration fires"]
    
    EmitConfigEvent --> FormatterSync["Reload Formatter Options in app/lang/beautify/options.js"]
    EmitConfigEvent --> LinterSync["Update active Rule Set in app/lang/lint/core/ruleRunner.js"]
    EmitConfigEvent --> IntelliSenseSync["Refresh Completion Providers & Inlay Hints"]

    FormatterSync --> ReformatActive["Format active editor on next save / format command"]
    LinterSync --> RelintActive["Trigger live re-linting across all open BML documents"]
    IntelliSenseSync --> SyncComplete(["All Subsystems Synchronized in Real-Time"])
    ReformatActive --> SyncComplete
    RelintActive --> SyncComplete
```

---

## 7. Settings Tab Catalog & Configuration Matrix

| Settings Tab | Config Keys Managed | Description |
| :--- | :--- | :--- |
| **BML Beautifier** | `indent_size`, `indent_char`, `brace_style`, `space_before_conditional`, `space_in_paren`, `space_in_empty_paren`, `preserve_newlines`, `max_preserve_newlines`, `end_with_newline`, `wrap_line_length` | Controls code indentation, brace placement, parenthesis spacing, and line wrapping. |
| **BML Linter** | `lint.enabled`, `lint.rules.*`, `lint.maxLoopDepth`, `lint.maxBlockDepth`, `lint.severityOverrides` | Configures 27 static analysis rules, nesting depth warnings, and severity thresholds. |
| **CPQ Environments** | `cpq.environments`, `cpq.activeEnvironment`, `cpq.timeout`, `cpq.retryCount` | Manages CPQ Cloud URLs, OAuth2 credentials, and active deployment targets. |
| **IntelliSense** | `intellisense.enabled`, `intellisense.inlayHints`, `intellisense.signatureHelp`, `intellisense.bmqlCompletions` | Configures autocomplete providers, hover tooltips, inlay parameter hints, and BMQL `$var` helpers. |
| **Spell Checker** | `spellcheck.enabled`, `spellcheck.customWords`, `spellcheck.checkComments` | Manages BML keywords, CPQ domain dictionary, and user-customized spelling words. |

---

## 8. Practical Usage Examples & Visual Configuration Walkthrough

### How to Open the Settings Panel
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS).
2. Type and select `CPQ-BML: Open Settings`.
3. Or click the **CPQ-BML** status bar item in the bottom right corner.

---

### Step-by-Step UI Configuration Walkthrough

#### 1. Configuring Formatter Tab
* **Indentation Size**: Adjust between 2, 4, or 8 spaces (default: `4`).
* **Brace Style**: Choose between `collapse` (1TBS: `if (cond) {`), `expand` (Allman: braces on new lines), or `preserve-inline`.
* **Preserve Newlines**: Toggle to keep empty lines between logic blocks.
* Click **Save Beautifier Config** to write directly to `.bmlbeautifyrc`.

---

#### 2. Configuring Linter Rules Tab
* Toggle individual rules on/off (`bml-semicolon`, `bml-unsupported-operator`, etc.).
* Adjust severity drop-downs (`Error`, `Warning`, `Information`, `Hint`).
* Set max loop nesting depth threshold (default: `3`) and max block nesting depth (default: `5`).

---

#### 3. Managing CPQ Cloud Environments Tab
* Add multiple CPQ environments (e.g. `Dev`, `QA`, `Production`).
* Provide **Site URL** (e.g. `https://sitename.oracle.com`), **Username**, and **Password / Token**.
* Click the 🔌 **Test Connection** button to verify network connectivity and permissions.
* The status badge updates immediately to 🟢 `Connected (42ms)`.

---

#### 4. Customizing Spell Checker Tab
* Add domain-specific words, acronyms, or product model names to the **Custom Words** list.
* Toggle comment checking and string literal checking independently.

