# Oracle CPQ BML REST API: Architecture, Commands & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [REST API Request & Authentication Flow (CFG 1)](#2-rest-api-request--authentication-flow-cfg-1)
3. [Metadata Synchronization Pipeline (CFG 2)](#3-metadata-synchronization-pipeline-cfg-2)
4. [Remote BML Compilation & Validation Flow (CFG 3)](#4-remote-bml-compilation--validation-flow-cfg-3)
5. [Remote Debug Execution & Terminal Formatting (CFG 4)](#5-remote-debug-execution--terminal-formatting-cfg-4)
6. [Multi-Environment Deployment Pipeline (CFG 5)](#6-multi-environment-deployment-pipeline-cfg-5)
7. [Workspace Scaffolding & Local Override Flow (CFG 6)](#7-workspace-scaffolding--local-override-flow-cfg-6)
8. [Oracle CPQ REST Endpoint Catalog](#8-oracle-cpq-rest-endpoint-catalog)

---

## 1. Overview & High-Level Architecture

The **CPQ REST API Client** is the communication backbone between the CPQ-BML extension and Oracle CPQ Cloud instances. It manages multi-environment configuration, secure credential storage, metadata caching, remote BML validation, debug execution, and deployment:

```mermaid
graph LR
    subgraph VS Code Extension
        CMD["Commands & MCP Tools<br/>commands/*.js"]
        CONFIG["Config & Secrets Manager<br/>config.js & secrets.js"]
        TERM["DevKit Output Terminal<br/>terminal.js"]
    end

    subgraph REST Client Core
        CLIENT["HTTPS HTTP Client<br/>client.js"]
        API["API Service Layer<br/>api.js"]
        META["Metadata Fetcher & Cache<br/>metadata.js"]
    end

    subgraph Oracle CPQ Cloud
        AUTH["Auth Endpoint<br/>/rest/v17/oauth2/token"]
        REST_API["Admin REST APIs<br/>/rest/v17/*"]
        DEBUG_SVC["BML Debug Engine<br/>/rest/v17/admin/debug"]
    end

    CMD --> API
    CONFIG --> CLIENT
    API --> CLIENT
    META --> CLIENT
    CLIENT --> AUTH
    CLIENT --> REST_API
    CLIENT --> DEBUG_SVC
    CLIENT -->|"Response Payload / Logs"| API
    API -->|"Formatted Tables & Logs"| TERM
```

---

## 2. REST API Request & Authentication Flow (CFG 1)

Handles request construction, OAuth2 / Basic Authentication, token refresh, exponential backoff retries, and network error handling:

```mermaid
flowchart TD
    InitRequest(["Initiate REST API Request"]) --> LoadCredentials["Load environment credentials from SecretStorage / .env"]
    
    LoadCredentials --> CheckAuthType{"Authentication Type?"}
    CheckAuthType -->|"OAuth2"| CheckToken{"Is OAuth2 Access Token valid and unexpired?"}
    CheckAuthType -->|"Basic Auth"| BuildBasicHeader["Construct 'Authorization: Basic <base64>' header"]

    CheckToken -->|"Yes"| BuildOAuthHeader["Construct 'Authorization: Bearer <token>' header"]
    CheckToken -->|"Expired / Missing"| RequestNewToken["POST /rest/v17/oauth2/token"]
    
    RequestNewToken --> TokenSuccess{"Token request successful?"}
    TokenSuccess -->|"No"| EmitAuthError["Emit Authentication Failure Diagnostic"]
    TokenSuccess -->|"Yes"| CacheToken["Store fresh access token in memory cache"]
    CacheToken --> BuildOAuthHeader

    BuildBasicHeader --> DispatchHTTPS["Dispatch HTTPS Request via client.js"]
    BuildOAuthHeader --> DispatchHTTPS

    DispatchHTTPS --> CheckResponse{"HTTP Status Code?"}
    CheckResponse -->|"200 - 299 OK"| ParseSuccessJSON["Parse JSON Response Body"]
    CheckResponse -->|"401 Unauthorized"| RetryAuth{"First retry attempt?"}
    CheckResponse -->|"429 Rate Limited"| RateLimitWait["Apply Exponential Backoff Sleep & Retry"]
    CheckResponse -->|"500 - 599 Error"| ParseServerError["Extract Oracle CPQ Server Error Message"]

    RetryAuth -->|"Yes"| RequestNewToken
    RetryAuth -->|"No"| EmitAuthError
    RateLimitWait --> DispatchHTTPS
    ParseServerError --> ReturnErrorResult(["Return Structured REST API Error"])
    EmitAuthError --> ReturnErrorResult
    ParseSuccessJSON --> ReturnSuccessResult(["Return Parsed Response Data"])
```

---

## 3. Metadata Synchronization Pipeline (CFG 2)

Synchronizes remote CPQ data dictionaries, commerce attributes, and util libraries with the local workspace:

```mermaid
flowchart TD
    TriggerPull(["Trigger Metadata Pull Command / pull_function"]) --> SelectTarget{"Select target entity type"}
    
    SelectTarget -->|"Util Library"| FetchUtilList["GET /rest/v17/admin/bmlLibraries"]
    SelectTarget -->|"Commerce Process"| FetchProcessList["GET /rest/v17/admin/commerceProcesses"]
    SelectTarget -->|"Data Table Schema"| FetchDataTables["GET /rest/v17/admin/dataTables"]
    SelectTarget -->|"Attributes"| FetchAttributes["GET /rest/v17/admin/commerceAttributes"]

    FetchUtilList --> DownloadScripts["Download BML script bodies for all functions"]
    FetchProcessList --> DownloadRules["Download Action, Rule, and Advanced Action scripts"]
    FetchDataTables --> DownloadSchema["Extract Data Table columns and primary keys"]
    FetchAttributes --> DownloadAttrTypes["Extract Attribute variable names and data types"]

    DownloadScripts --> WriteWorkspace["Write structured .bml and metadata .json files to workspace"]
    DownloadRules --> WriteWorkspace
    DownloadSchema --> WriteWorkspace
    DownloadAttrTypes --> WriteWorkspace

    WriteWorkspace --> UpdateLocalIndex["Trigger Workspace Symbol Re-indexing"]
    UpdateLocalIndex --> CompletePull(["Metadata Synchronization Complete"])
```

---

## 4. Remote BML Compilation & Validation Flow (CFG 3)

Validates BML scripts directly against Oracle CPQ Cloud's server-side compiler:

```mermaid
flowchart TD
    TriggerValidate(["Trigger BML Validation (validate.js)"]) --> ExtractSource["Extract active BML editor buffer text"]
    
    ExtractSource --> ResolveMetadata["Resolve function return type, parameters, and context"]
    ResolveMetadata --> BuildValidationPayload["Construct JSON payload: { script, params, returnType, context }"]

    BuildValidationPayload --> SendValidateReq["POST /rest/v17/admin/bml/validate"]
    SendValidateReq --> ParseValidateResp{"Validation response received?"}

    ParseValidateResp -->|"Validation Passed"| EmitSuccess["Show Success notification: '0 compilation errors'"]
    ParseValidateResp -->|"Compiler Errors"| ParseCompilerErrors["Extract Line Numbers, Columns, and Error Messages"]

    ParseCompilerErrors --> MapEditorDiagnostics["Map compiler errors to VS Code Problems Panel"]
    MapEditorDiagnostics --> HighlightLines["Highlight syntax errors directly in editor buffer"]
    
    EmitSuccess --> DoneValidation(["Validation Flow Completed"])
    HighlightLines --> DoneValidation
```

---

## 5. Remote Debug Execution & Terminal Formatting (CFG 4)

Executes BML functions in the cloud debug environment and formats return values and stdout logs:

```mermaid
flowchart TD
    TriggerDebug(["Execute Remote Debug (debug.js)"]) --> PromptParams{"Input parameters required?"}
    
    PromptParams -->|"Yes"| CollectInputParams["Collect parameter values via QuickPick / InputBox"]
    PromptParams -->|"No"| AssemblePayload["Assemble payload with empty parameter dictionary"]
    
    CollectInputParams --> AssemblePayload
    AssemblePayload --> AttachScript["Attach BML script content and function context"]
    
    AttachScript --> SendDebugReq["POST /rest/v17/admin/bml/debug"]
    SendDebugReq --> DebugResponse{"Debug execution finished?"}

    DebugResponse -->|"Execution Succeeded"| ExtractResult["Extract Return Value, Execution Time, and Log Stream"]
    DebugResponse -->|"Runtime Exception"| ExtractStackTrace["Extract Exception Message and Line Trace"]

    ExtractResult --> FormatTable["Format parameter and return tables using debugTableFormat.js"]
    FormatTable --> PrintTerminal["Stream output with ANSI color to 'CPQ DevKit' Terminal"]
    
    ExtractStackTrace --> PrintErrorTerminal["Stream stack trace in Red to 'CPQ DevKit' Terminal"]
    
    PrintTerminal --> CompleteDebug(["Debug Execution Displayed in Terminal"])
    PrintErrorTerminal --> CompleteDebug
```

---

## 6. Multi-Environment Deployment Pipeline (CFG 5)

Safely packages and deploys BML functions and commerce processes across Dev, Test, and Prod instances:

```mermaid
flowchart TD
    TriggerDeploy(["Trigger Deployment Command (deploy.js)"]) --> SelectEnv["Select Target CPQ Environment (e.g. Test, Staging, Prod)"]
    
    SelectEnv --> PreDeployLint["Run BML Linter on local code to ensure 0 fatal errors"]
    PreDeployLint --> LintPassed{"Did pre-deploy static analysis pass?"}
    
    LintPassed -->|"No"| AbortDeploy["Abort Deployment: Fix lint errors before deploying"]
    LintPassed -->|"Yes"| BuildDeploymentPackage["Construct Deployment Package JSON"]

    BuildDeploymentPackage --> CheckMassDeploy{"Is Mass Deploy or Single Function?"}
    CheckMassDeploy -->|"Single Function"| PUTSingleFunc["PUT /rest/v17/admin/bmlLibraries/{folder}/{func}"]
    CheckMassDeploy -->|"Mass Deploy"| POSTMassDeploy["POST /rest/v17/admin/bmlLibraries/massDeploy"]

    PUTSingleFunc --> DeploymentResponse{"Deployment API response 200 OK?"}
    POSTMassDeploy --> DeploymentResponse

    DeploymentResponse -->|"Success"| ClearOverrides["Clear local overrides and update deployment timestamp"]
    DeploymentResponse -->|"Error"| Rollback["Display deployment failure details and keep local working copy"]

    ClearOverrides --> NotifyUser["Notify: 'Successfully deployed to target environment'"]
    NotifyUser --> DoneDeploy(["Deployment Complete"])
    Rollback --> DoneDeploy
    AbortDeploy --> DoneDeploy
```

---

## 7. Workspace Scaffolding & Local Override Flow (CFG 6)

Scaffolds new BML functions and manages local override workflows:

```mermaid
flowchart TD
    TriggerScaffold(["Trigger Scaffold Command (scaffold.js)"]) --> PromptFolder["Prompt for Library Folder Name"]
    
    PromptFolder --> PromptFuncName["Prompt for Function Name & Description"]
    PromptFuncName --> PromptReturnType["Prompt for Return Type (String, Integer, Float, Boolean, Date, dict, json)"]
    PromptFuncName --> PromptParamsList["Prompt for Parameter Names and Types"]

    PromptParamsList --> GenerateBoilerplate["Generate .bml file with JSDoc headers and type skeletons"]
    GenerateBoilerplate --> WriteWorkspaceFile["Write file to workspace library folder"]
    
    WriteWorkspaceFile --> RegisterMetadata["Register function in local .cpqdevkit metadata index"]
    RegisterMetadata --> OpenEditor(["Open newly created BML file in editor"])
```

---

## 8. Oracle CPQ REST Endpoint Catalog

| HTTP Method | API Endpoint | Purpose |
| :--- | :--- | :--- |
| `POST` | `/rest/v17/oauth2/token` | Authenticates client and issues OAuth2 Bearer token. |
| `GET` | `/rest/v17/admin/bmlLibraries` | Lists all BML Util Library folders and functions. |
| `GET` | `/rest/v17/admin/bmlLibraries/{folder}/{func}` | Fetches BML script body and metadata for a function. |
| `PUT` | `/rest/v17/admin/bmlLibraries/{folder}/{func}` | Updates/saves BML script body on the CPQ instance. |
| `POST` | `/rest/v17/admin/bml/validate` | Compiles BML source remotely and returns syntax errors. |
| `POST` | `/rest/v17/admin/bml/debug` | Executes BML script in remote debug harness with inputs. |
| `GET` | `/rest/v17/admin/commerceProcesses` | Lists all Commerce Processes and active documents. |
| `GET` | `/rest/v17/admin/commerceProcesses/{proc}/rules` | Fetches Commerce Action, Rule, and Advanced BML scripts. |
| `PUT` | `/rest/v17/admin/commerceProcesses/{proc}/rules` | Deploys updated Commerce Process BML scripts. |
| `GET` | `/rest/v17/admin/dataTables` | Lists Data Tables, schemas, columns, and primary keys. |
| `GET` | `/rest/v17/admin/commerceAttributes` | Fetches Commerce Line and Transaction attribute definitions. |

---

## 9. Practical Usage Examples & VS Code Commands

### Configuring Multi-Environment Access (`.env`)

Store credentials securely in a `.env` file in the workspace root or via VS Code Secrets:

```bash
# Active CPQ Cloud Instance
CPQ_SITE_URL=https://sitename.oracle.com
CPQ_USERNAME=admin_user
CPQ_PASSWORD=SecurePassword123!
CPQ_AUTH_METHOD=basic
CPQ_REST_VERSION=v17
CPQ_COMMERCE_PROCESS=oraclecpqo
CPQ_COMMERCE_DOCUMENT=transaction
```

---

### Command 1: Pull BML Function from CPQ Cloud
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS).
2. Type and select `CPQ: Pull Function`.
3. Choose the library folder (e.g. `pricing`) and function name (`calcDiscount`).
4. The extension automatically fetches the live script, saves it to `.cpqdevkit/ai/pricing/calcDiscount.bml`, and opens the editor.

---

### Command 2: Validate BML Against Cloud Compiler
1. Inside an open `.bml` file, press `Ctrl+Shift+P` &rarr; `CPQ: Validate Current Function`.
2. The extension sends the buffer to `/rest/v17/admin/bml/validate`.
3. If syntax errors exist, they appear immediately in the **Problems** panel mapped to line/column ranges.

---

### Command 3: Remote Debug Execution & Terminal Output
1. Press `Ctrl+Shift+P` &rarr; `CPQ: Debug Function`.
2. Enter parameter inputs in the prompt or provide a JSON fixture.
3. The execution results and logs stream live to the **CPQ DevKit** output terminal:

```
[CPQ DevKit] ----------------------------------------------------
[CPQ DevKit] Executing Remote Debug: util.pricing.calcDiscount
[CPQ DevKit] Environment: Development (https://sitename.oracle.com)
[CPQ DevKit] ----------------------------------------------------
[PARAMS]
  • basePrice: 1500.0 (Float)
  • customerTier: "PLATINUM" (String)

[STDOUT LOGS]
  [09:20:15] [DEBUG] Starting discount evaluation
  [09:20:15] [DEBUG] Matched Tier: PLATINUM -> 20% discount

[RETURN VALUE]
  • Type: Float
  • Value: 0.20
  • Execution Time: 38.4ms
[CPQ DevKit] ----------------------------------------------------
```

---

### Command 4: Deploy Function to Target Environment
1. Press `Ctrl+Shift+P` &rarr; `CPQ: Deploy Function`.
2. Select target environment (`Development`, `Test`, `Production`).
3. Pre-deploy static analysis verifies 0 fatal errors before committing.
4. On success, a toast notification confirms deployment.

