# Oracle CPQ BML Developer & Extension Knowledge Base

Welcome to the comprehensive technical documentation and architecture reference for Oracle CPQ BML and the **CPQ-BML VS Code Extension Suite**.

---

## 📚 Knowledge Base Sitemap

### 1. Extension Subsystems & Developer Tooling
Detailed architecture, control flow graphs, configuration options, and real-world code snippets:

| Guide / Document | Focus Area | Key Features & Capabilities |
| :--- | :--- | :--- |
| **[BML Beautifier](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_Beautifier.md)** | Code Formatting | Deterministic 4-stage formatting, brace styles, block comment star alignment, minimal range diff optimizer, and `.bmlbeautifyrc`. |
| **[BML Linter](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_Linter.md)** | Static Analysis | 27 built-in rules, AST node visitors, syntax/type validation, loop/block nesting checks, and single-click Quick Fixes (`Ctrl+.`). |
| **[BML IntelliSense](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_IntelliSense.md)** | IDE Intelligence | Workspace util library autocompletion (`util.pricing.`), in-query BMQL dynamic variable (`$`) completion, signature help, and rich hovers. |
| **[BML MCP Server](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_MCP.md)** | AI Agent Protocol | 24 Model Context Protocol tools, 5-stage BML function lifecycle, remote debug harness, and regression testing snapshots. |
| **[BML REST API](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_REST_API.md)** | Cloud Integration | OAuth2 authentication, multi-environment `.env` configuration, remote compilation validation, and CPQ DevKit Terminal streaming. |
| **[BML Settings Panel](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_Settings_Panel.md)** | Configuration UI | Interactive Webview dashboard, bi-directional RPC message bridge, multi-tier config persistence, and live connection testing. |
| **[BML Spell Check](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_Spell_Check.md)** | Domain Lexicon | Smart morphological inflection engine, developer/cloud lexicon, zero-disk-IO Brotli dictionaries, and custom workspace dictionaries. |
| **[BML XSLT & XML](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_XSLT.md)** | Document Engine | XSL template formatting, XPath 1.0 autocompletion, schema validation, quick fixes, and BML `transformxml()` integration. |
| **[BML Code Metrics](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML_Metrics.md)** | Quality Assurance | McCabe Cyclomatic Complexity, Halstead Software Science metrics, Maintainability Index (MI) score, and visual dashboard. |

---

### 2. Core Oracle CPQ BML Reference Documents (`knowledge/BML/`)
Complete reference documentation covering language fundamentals, system tables, functions, and best practices:

* **[Language Basics](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_basics.md)** &mdash; Syntax, data types, keyword operators (`AND`, `OR`, `NOT`), arrays, and control flow.
* **[BMQL & Database Access](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_bmql.md)** &mdash; Direct table querying, dynamic `$var` parameters, and 1,000-record caps.
* **[JSON & Dictionaries](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_json_and_dictionary_functions.md)** &mdash; `dict()`, `json()`, `jsonarray()`, and nested traversal.
* **[Web Services & REST/SOAP](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_web_services_calls.md)** &mdash; `urldata()`, REST integration, SOAP payloads, and XML parsing.
* **[Commerce Functions & Processes](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_commerce_functions.md)** &mdash; Transaction/Line attributes, document actions, and approval workflows.
* **[Configuration & BOM Mapping](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_configuration_functions.md)** &mdash; Configuration rules, BOM tables, and pricing calculations.
* **[All Built-in Functions Reference](file:///c:/Users/Vikram-N/Downloads/cpq-bml/knowledge/BML/bml_functions_index.md)** &mdash; Complete signatures, parameters, and return types for 150+ standard BML functions.

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
