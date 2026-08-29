# Oracle CPQ BML IntelliSense: Architecture, Providers & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [Completion Item Provider Lifecycle (CFG 1)](#2-completion-item-provider-lifecycle-cfg-1)
3. [Signature Help & Parameter Hinting (CFG 2)](#3-signature-help--parameter-hinting-cfg-2)
4. [Hover Information Provider Flow (CFG 3)](#4-hover-information-provider-flow-cfg-3)
5. [BMQL Dynamic Variable Autocompletion Flow (CFG 4)](#5-bmql-dynamic-variable-autocompletion-flow-cfg-4)
6. [Workspace Library Indexing & Cross-File Symbol Resolution (CFG 5)](#6-workspace-library-indexing--cross-file-symbol-resolution-cfg-5)
7. [Inlay Parameter Hints Provider (CFG 6)](#7-inlay-parameter-hints-provider-cfg-6)
8. [Lookup Catalogs & Data Sources](#8-lookup-catalogs--data-sources)

---

## 1. Overview & High-Level Architecture

The **BML IntelliSense** subsystem provides IDE intelligence for Oracle CPQ BML, powering code completions, signature tooltips, hover documentation, cross-file definition navigation, inlay parameter hints, and BMQL variable auto-suggestions:

```mermaid
graph LR
    subgraph Lookups & Schema
        BUILTIN["Built-in BML Functions<br/>bml-functions-api-usage.json"]
        ATTRS["Commerce & System Attributes<br/>bml-attributes-api-usage.json"]
        VARS["System Variables<br/>bml-variables-api-usage.json"]
        SNIPPETS["Custom Snippets<br/>custom-snippets.json"]
    end

    subgraph Workspace Indexer
        WS["Workspace Symbol Indexer<br/>workspaceIndex.js"]
    end

    subgraph Language Server Providers
        COMPL["Completion Provider<br/>index.js"]
        SIG["Signature Help Provider<br/>signatureHelp.js"]
        HOVER["Hover Info Provider<br/>index.js"]
        INLAY["Inlay Hints Provider<br/>inlayHints.js"]
        BMQL["BMQL Variable Completer<br/>bmqlVariableCompletions.js"]
    end

    subgraph VS Code Editor
        ED["Editor Cursor & UI"]
    end

    BUILTIN --> COMPL
    BUILTIN --> SIG
    BUILTIN --> HOVER
    BUILTIN --> INLAY
    ATTRS --> COMPL
    ATTRS --> HOVER
    VARS --> COMPL
    VARS --> HOVER
    SNIPPETS --> COMPL
    WS --> COMPL
    WS --> SIG
    WS --> HOVER
    WS --> INLAY

    ED --> COMPL
    ED --> SIG
    ED --> HOVER
    ED --> INLAY
    ED --> BMQL
```

---

## 2. Completion Item Provider Lifecycle (CFG 1)

This control flow graph shows how completions are resolved and prioritized when triggered (by keystroke or trigger characters `.`, `$`, `"`):

```mermaid
flowchart TD
    TriggerCompl(["Completion Triggered at Cursor Position"]) --> InspectPrefix["Inspect preceding tokens and trigger character"]
    
    InspectPrefix --> IsBMQL{"Inside BMQL string after '$' ?"}
    IsBMQL -->|"Yes"| TriggerBMQL["Delegate to BMQL Variable Completion Provider"]
    TriggerBMQL --> ReturnBMQL(["Return Local Variable Completions"])

    IsBMQL -->|"No"| IsDot{"Triggered by dot '.' ?"}
    IsDot -->|"Yes"| DotTarget{"Target preceding dot"}
    
    DotTarget -->|"util"| ReturnUtilFolders["Suggest Util Library Folders (e.g. util.pricing)"]
    DotTarget -->|"util.<folder>"| ReturnUtilFuncs["Suggest Functions inside Folder (util.pricing.calcDiscount)"]
    DotTarget -->|"commerce"| ReturnCommFuncs["Suggest Commerce Process Library Functions"]
    DotTarget -->|"line / transaction"| ReturnAttrs["Suggest Commerce Line/Transaction Attributes"]
    DotTarget -->|"Other Object"| ReturnMethods["Suggest Dictionary/JSON/RecordSet Methods"]

    IsDot -->|"No"| BuildGlobalList["Assemble Global Scope Autocompletions"]
    BuildGlobalList --> AddBuiltins["Add Built-in Functions with Snippet Signatures"]
    AddBuiltins --> AddSysVars["Add System Variables (_system_user_login, etc.)"]
    AddSysVars --> AddKeywords["Add BML Keywords (AND, OR, NOT, if, elif, else, for, return)"]
    AddKeywords --> AddSnippets["Add Common BML Code Snippets (bmql, for-in, dict, json)"]
    AddSnippets --> AddLocalSymbols["Add Scope-visible Local Variables from AST"]
    
    AddLocalSymbols --> RankAndFilter["Apply Fuzzy Filter, Sort Priority & Return CompletionList"]
    ReturnUtilFolders --> RankAndFilter
    ReturnUtilFuncs --> RankAndFilter
    ReturnCommFuncs --> RankAndFilter
    ReturnAttrs --> RankAndFilter
    ReturnMethods --> RankAndFilter
    RankAndFilter --> ReturnCompletions(["Display Completion Menu in Editor"])
```

---

## 3. Signature Help & Parameter Hinting (CFG 2)

Active parameter position tracking and parameter signature tooltip generation:

```mermaid
flowchart TD
    TriggerSig(["Signature Help Triggered '(' or ','"]) --> ScanCall["Scan backwards from cursor to find enclosing Function Call"]
    
    ScanCall --> FoundCall{"Found enclosing '(' without matching ')' ?"}
    FoundCall -->|"No"| ReturnNullSig["Return null (No active signature)"]
    
    FoundCall -->|"Yes"| ExtractName["Extract Function Identifier (e.g. 'datetostr' or 'util.pricing.calc')"]
    ExtractName --> CountCommas["Count top-level commas before cursor to calculate activeParameterIndex"]
    
    CountCommas --> LookupSig{"Resolve Function Signature in API Data or Workspace Index"}
    LookupSig -->|"Found"| BuildSignature["Construct vscode.SignatureInformation(label, doc)"]
    BuildSignature --> BuildParams["Attach ParameterInformation array for all params"]
    BuildParams --> SetActive["Set activeSignature = 0 and activeParameter = activeParameterIndex"]
    SetActive --> ReturnSig(["Display Signature Tooltip in Editor"])

    LookupSig -->|"Not Found"| ReturnNullSig
```

---

## 4. Hover Information Provider Flow (CFG 3)

Displays rich markdown documentation, return types, parameter tables, and usage examples on mouse hover:

```mermaid
flowchart TD
    HoverTrigger(["Mouse Hover on Token at Range"]) --> IdentifyToken["Identify Word / Expression Range under Cursor"]
    
    IdentifyToken --> TokenCategory{"Classify Token Type"}
    
    TokenCategory -->|"Built-in Function"| FormatBuiltinDoc["Format Signature, Description, Parameters Table & Example"]
    TokenCategory -->|"Workspace Util Func"| FormatWorkspaceDoc["Format Workspace Library Path, Parameters & Return Type"]
    TokenCategory -->|"Commerce Attribute"| FormatAttrDoc["Format Attribute VarName, Label, Data Type & Document Level"]
    TokenCategory -->|"System Variable"| FormatSysVarDoc["Format System Variable Type, Description & Context"]
    TokenCategory -->|"Local Variable"| FormatLocalVar["Format Inferred Data Type and Declaration Line"]

    FormatBuiltinDoc --> WrapMarkdown["Construct vscode.Hover with Rich MarkdownString"]
    FormatWorkspaceDoc --> WrapMarkdown
    FormatAttrDoc --> WrapMarkdown
    FormatSysVarDoc --> WrapMarkdown
    FormatLocalVar --> WrapMarkdown

    WrapMarkdown --> DisplayHover(["Display Hover Tooltip"])
```

---

## 5. BMQL Dynamic Variable Autocompletion Flow (CFG 4)

Provides intelligent variable suggestions when typing dynamic SQL variables (`$`) inside BMQL queries:

```mermaid
flowchart TD
    TypeDollar(["Typing '$' character in BMQL string"]) --> CheckStringContext{"Is cursor inside bmql(...) string argument?"}
    
    CheckStringContext -->|"No"| IgnoreBMQL["No action"]
    CheckStringContext -->|"Yes"| ScanScope["Scan current function AST for all variables in scope"]

    ScanScope --> FilterUsable["Filter out non-scalar types (Keep String, Integer, Float, Date, Boolean)"]
    FilterUsable --> FormatBMQLItems["Create CompletionItems with '$' prefix and variable type info"]
    FormatBMQLItems --> ReturnBMQLItems(["Display In-Query BMQL Variable Suggestions"])
```

---

## 6. Workspace Library Indexing & Cross-File Symbol Resolution (CFG 5)

Maintains a fast in-memory index of all BML util libraries and commerce process scripts across the workspace:

```mermaid
flowchart TD
    InitWorkspace(["VS Code Workspace Opened / File Changed"]) --> ScanBMLFiles["Scan all .bml and function files in workspace"]
    
    ScanBMLFiles --> ParseMetadata["Parse Function Headers, Parameters, and Return Types"]
    ParseMetadata --> IndexByNamespace["Index by Namespace: util.<folder>.<functionName>"]
    
    IndexByNamespace --> WatcherActive["Register FileSystemWatcher for instant live updates"]
    
    WatcherActive --> FileEvent{"File Created / Modified / Deleted?"}
    FileEvent -->|"Modified/Created"| ReindexFile["Re-parse single file and update index cache"]
    FileEvent -->|"Deleted"| RemoveIndex["Remove file symbols from namespace map"]
    
    ReindexFile --> UpdateComplete(["Index Ready for Instant Completion & Go-to-Definition"])
    RemoveIndex --> UpdateComplete
```

---

## 7. Inlay Parameter Hints Provider (CFG 6)

Renders inline parameter names at call sites to clarify arguments at glance:

```mermaid
flowchart TD
    RenderView(["Document Rendered in Visible Viewport"]) --> ScanCalls["Scan AST for all CallExpression nodes in viewport"]
    
    ScanCalls --> HasArgs{"Function call has 1 or more arguments?"}
    HasArgs -->|"No"| NextCall["Proceed to next call expression"]
    HasArgs -->|"Yes"| FetchSignature["Lookup parameter names for target function"]

    FetchSignature --> SignatureResolved{"Signature available with parameter names?"}
    SignatureResolved -->|"No"| NextCall
    SignatureResolved -->|"Yes"| MapArgPositions["Map each argument token position in editor"]

    MapArgPositions --> BuildInlayHint["Construct vscode.InlayHint(paramName + ':', argStartPos)"]
    BuildInlayHint --> CollectInlays["Append InlayHint to Viewport Collection"]
    CollectInlays --> NextCall

    NextCall --> ViewportComplete{"All visible calls processed?"}
    ViewportComplete -->|"Yes"| PublishInlays(["Render Inlay Parameter Hints in Editor Buffer"])
```

---

## 8. Lookup Catalogs & Data Sources

| Catalog File | Purpose | Size / Symbols |
| :--- | :--- | :--- |
| **`bml-functions-api-usage.json`** | Built-in functions, descriptions, parameters, return types, and code examples. | 363 KB (~150+ functions) |
| **`bml-attributes-api-usage.json`** | Standard commerce line/transaction attributes, descriptions, and data types. | 228 KB (~500+ attributes) |
| **`bml-variables-api-usage.json`** | System session variables, system configuration keys, and runtime variables. | 19 KB (~50+ variables) |
| **`bml-util-attributes-api-usage.json`** | Util library standard properties and configurations. | 10 KB |
| **`function-param-data-types.json`** | Fast lookup mapping for function parameter validation. | 1 KB |
| **`function-return-types.json`** | Fast lookup mapping for return type inference. | 1 KB |
| **`custom-snippets.json`** | Pre-packaged snippets for BMQL, conditionals, dictionaries, JSON, and web services. | 3.8 KB |
