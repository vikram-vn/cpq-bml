# Oracle CPQ BML Developer & Extension Knowledge Base

Welcome to the comprehensive technical documentation and architecture reference for Oracle CPQ BML and the **CPQ-BML VS Code Extension Suite**.

---

## 📚 Knowledge Base Sitemap

### 1. Extension Subsystems & Developer Tooling
Architecture, Control Flow Graphs (CFGs), configuration options, and real-world code snippets:

| Guide / Document | Focus Area | Key Features & Capabilities |
| :--- | :--- | :--- |
| **[BML Beautifier](BML_Beautifier.md)** | Code Formatting | Deterministic 4-stage formatting, brace styles, block comment star alignment, minimal range diff optimizer, and `.bmlbeautifyrc`. |
| **[BML Linter](BML_Linter.md)** | Static Analysis | 27 built-in rules, AST node visitors, syntax/type validation, loop/block nesting checks, and single-click Quick Fixes (`Ctrl+.`). |
| **[BML IntelliSense](BML_IntelliSense.md)** | IDE Intelligence | Workspace util library autocompletion (`util.pricing.`), in-query BMQL dynamic variable (`$`) completion, signature help, and rich hovers. |
| **[BML MCP Server](BML_MCP.md)** | AI Agent Protocol | 24 Model Context Protocol tools, 5-stage BML function lifecycle, remote debug harness, and regression testing snapshots. |
| **[BML REST API](BML_REST_API.md)** | Cloud Integration | OAuth2 authentication, multi-environment `.env` configuration, remote compilation validation, and CPQ DevKit Terminal streaming. |
| **[BML Settings Panel](BML_Settings_Panel.md)** | Configuration UI | Interactive Webview dashboard, bi-directional RPC message bridge, multi-tier config persistence, and live connection testing. |
| **[BML Spell Check](BML_Spell_Check.md)** | Domain Lexicon | Smart morphological inflection engine, developer/cloud lexicon, zero-disk-IO Brotli dictionaries, and custom workspace dictionaries. |
| **[BML XSLT & XML](BML_XSLT.md)** | Document Engine | XSL template formatting, XPath 1.0 autocompletion, schema validation, quick fixes, and BML `transformxml()` integration. |
| **[BML Code Metrics](BML_Metrics.md)** | Quality Assurance | McCabe Cyclomatic Complexity, Halstead Software Science metrics, Maintainability Index (MI) score, and visual dashboard. |
| **[BML Snippets Catalog](BML_Snippets.md)** | Developer Productivity | 26 production-grade code skeletons, sequential `$1` &rarr; `$2` &rarr; `$0` tab-stops, and variable mirroring. |

---

### 2. Core Oracle CPQ BML Reference Documents (`knowledge/BML/`)
All 30 standard Oracle CPQ BML reference manuals categorized by topic:

#### 🔷 Core Language & Fundamentals
* **[BML Overview](BML/BMLOverview.md)** &mdash; Introduction to BigMachines Language syntax, statements, and runtime execution.
* **[Conditional Statements](BML/Conditional.md)** &mdash; `if`, `elif`, `else` constructs and keyword operators (`AND`, `OR`, `NOT`).
* **[BML Coding Best Practices](BML/BMLCodingBestPractices.md)** &mdash; Coding conventions, performance guidelines, and architectural standards.
* **[All BML Built-in Functions List](BML/BMLFunctionsList.md)** &mdash; Comprehensive reference for 150+ built-in BML functions.
* **[Util BML Library Functions List](BML/UtilBmlLibraryFunctionsList.md)** &mdash; Standard util library namespaces and function signatures.

#### 🔷 BMQL & Database Operations
* **[BMQL Overview & Queries](BML/BMQL.md)** &mdash; `SELECT`, `UPDATE`, `MODIFY`, `DELETE` operations on Data Tables and system tables.
* **[Dynamic BMQL Variables](BML/DynamicBMQLVariables.md)** &mdash; Using dynamic `$variable` placeholders inside BMQL queries.
* **[Direct Database Access](BML/DirectDBAccess.md)** &mdash; Interacting with CPQ system tables, recordsets, and CRUD patterns.

#### 🔷 Data Types & Manipulations
* **[JSON Manipulation](BML/Json.md)** &mdash; `json()`, `jsonarray()`, `jsonpath`, nested extraction, and serialization.
* **[Dictionary Functions](BML/Dictionary.md)** &mdash; Creating, reading, and iterating typed dictionaries (`dict("string")`, `put()`, `get()`).
* **[String Functions](BML/String.md)** &mdash; String concatenation, formatting, search, substring, and case conversions.
* **[Arrays Overview](BML/ArraysOverview.md)** &mdash; Scalar arrays, multi-dimensional array declarations, and memory management.
* **[Array Functions](BML/Arrays.md)** &mdash; `sizeofarray()`, `split()`, `join()`, resizing, and sorting functions.
* **[Date & Time Functions](BML/Date.md)** &mdash; `getdate()`, `datetostr()`, `strtojavadate()`, timezones, and date arithmetic.
* **[Math Functions](BML/Math.md)** &mdash; Mathematical calculations, trigonometry, rounding, and `jNaN` handling.

#### 🔷 Web Services & XML Transformation
* **[XML Functions](BML/XML.md)** &mdash; `readxml()`, `transformxml()`, XML parsing, and tag manipulation.
* **[URL & REST Access](BML/URLAccess.md)** &mdash; `urldata()`, HTTP methods (`GET`, `POST`, `PUT`, `DELETE`), headers, and payloads.
* **[Use SOAP with BML](BML/UseSOAPwithBML.md)** &mdash; SOAP envelope construction, WSDL endpoints, and XML response handling.

#### 🔷 CPQ Domain, Platform & System Services
* **[BOM & Configuration Functions](BML/Others-BOM.md)** &mdash; Bill of Materials mapping, BOM hierarchy, and configuration rules.
* **[System Configuration](BML/Others-SysConfig.md)** &mdash; System properties, environment constants, and runtime variables.
* **[Constants Reference](BML/Others-Constants.md)** &mdash; System constants (`BM_*`, `NULL`, `TRUE`, `FALSE`).
* **[Global Dictionaries](BML/Others-GlobalDict.md)** &mdash; Session-level and transaction-level global cache dictionaries.
* **[User Sessions & Context](BML/Others-UserSessions.md)** &mdash; User authentication context, currency conversions, and localization.
* **[Other Platform Functions](BML/Others.md)** &mdash; Miscellaneous system utilities, error handling, and hashing.
* **[Package Lifecycle Management](BML/PackageLifecycleManagement.md)** &mdash; Migration packages, deployment steps, and versioning.

#### 🔷 Function Editors & Tooling
* **[BML Function Editor Basics](BML/FunctionEditorBasics.md)** &mdash; Oracle CPQ Cloud BML editor interface and parameters setup.
* **[BML Editor Advanced](BML/BML_Editor.md)** &mdash; Advanced script configuration, script types, and editor properties.
* **[Library Functions Management](BML/Library_Functions.md)** &mdash; Managing reusable util library scripts across folders.
* **[Function Wizard](BML/FunctionWizard.md)** &mdash; Using the function wizard for automated skeleton generation.
* **[Debug Util Functions](BML/DebugUtilFunctions.md)** &mdash; Using CPQ debug harness, logging, and parameter testing.

---

### 3. Oracle CPQ Best Practices Reference (`knowledge/BestPractices/`)
Core BML-relevant Oracle CPQ best practices and architectural design patterns:

* **[Naming Conventions for Rules, Attributes & Variables](BestPractices/NamingConventions.md)** &mdash; Standard naming conventions for attributes, variables, rules, and functions.
* **[Application Boundaries & Magic Numbers](BestPractices/ApplicationBoundariesMagicNumbers.md)** &mdash; Eliminating hard-coded magic values and setting clean layer boundaries.
* **[Commerce Best Practices](BestPractices/CommerceBestPractices.md)** &mdash; Commerce process design, modify actions, and transactional logic.
* **[Identifying the Site Name](BestPractices/IdentifySiteName.md)** &mdash; Environment detection and domain-aware script branching (`_system_site_name`).
* **[Parsing Strings Into Numbers](BestPractices/ParseStringsIntoNumbers.md)** &mdash; Safe numeric conversions (`isnumber()`, `atoi()`, `atof()`) and error suppression.
* **[Performance Best Practices](BestPractices/PerformanceBestPractices.md)** &mdash; Maximizing site performance, caching, loop minimization, and line item optimization.
* **[Source Control and Versioning](BestPractices/SourceControlVersioning.md)** &mdash; Migration packages, deployment sequencing, and version management.
* **[Storing Data in Delimited Strings](BestPractices/StoreDataDelimitedStrings.md)** &mdash; Patterns and considerations for storing delimited dataset values.
* **[Errors & Error Handling](BestPractices/ErrorHandling.md)** &mdash; Robust error handling, validation rules, and transaction recovery.
* **[Error Messages](BestPractices/ErrorMessages.md)** &mdash; Writing actionable, clear user-facing validation and error messages.
* **[Using JavaScript in Oracle CPQ](BestPractices/UseJavaScriptCPQ.md)** &mdash; Guidelines for JET UI extensions and client-side scripts.
* **[Best Practices Overview](BestPractices/BestPracticesOverview.md)** &mdash; High-level CPQ architecture, design rules, and recommendations.

---

## ⚡ Quick Start: Essential Shortcuts

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) |
| :--- | :--- | :--- |
| **Format Document** | `Shift+Alt+F` | `Shift+Option+F` |
| **Quick Fix / Lightbulb** | `Ctrl+.` | `Cmd+.` |
| **Trigger Autocomplete** | `Ctrl+Space` | `Cmd+Space` |
| **Signature Help** | `Ctrl+Shift+Space` | `Cmd+Shift+Space` |
| **Go to Definition** | `F12` | `F12` |
| **Open Settings Panel** | `Ctrl+Shift+P` &rarr; `CPQ-BML: Open Settings` | `Cmd+Shift+P` &rarr; `CPQ-BML: Open Settings` |
| **Show Code Metrics** | `Ctrl+Shift+P` &rarr; `BML: Show Code Metrics` | `Cmd+Shift+P` &rarr; `BML: Show Code Metrics` |
| **Pull Function from Cloud** | `Ctrl+Shift+P` &rarr; `CPQ: Pull Function` | `Cmd+Shift+P` &rarr; `CPQ: Pull Function` |
| **Debug Function Remotely** | `Ctrl+Shift+P` &rarr; `CPQ: Debug Function` | `Cmd+Shift+P` &rarr; `CPQ: Debug Function` |
