# CPQ-BML VS Code Extension

A high-performance, feature-rich development environment for **Oracle CPQ BigMachines Language (BML)**. Built for CPQ developers, architects, and AI pair-programmers.

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=vikram-n.cpq-bml">
    <img src="https://img.shields.io/badge/Marketplace-VS%20Code-007acc?logo=visualstudiocode" alt="Marketplace Link">
  </a>
  <a href="https://github.com/vikram-vn/cpq-bml/releases/latest">
    <img src="https://img.shields.io/github/v/release/vikram-vn/cpq-bml?label=Version&logo=github&color=ff69b4" alt="Latest Release">
  </a>
  <a href="https://github.com/vikram-vn/cpq-bml/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/vikram-vn/cpq-bml?label=License&color=blue" alt="License">
  </a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=vikram-n.cpq-bml">
    <img src="https://img.shields.io/badge/Install-VS%20Code%20Marketplace-007ACC?style=for-the-badge&logo=visualstudiocode" alt="Install from Marketplace">
  </a>
  <a href="https://github.com/vikram-vn/cpq-bml/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20VSIX-181717?style=for-the-badge&logo=github" alt="Download VSIX">
  </a>
</p>

---

## ⚡ Quick Start: Key Capabilities & Documentation

For complete architectural blueprints, Control Flow Graphs (CFGs), and code examples, explore our **[Knowledge Base](knowledge/README.md)**:

| Feature Area | Description | Deep Dive Guide |
| :--- | :--- | :--- |
| **💡 IntelliSense & Autocomplete** | Workspace util library suggestions (`util.pricing.`), BMQL `$var` dynamic completion, parameter signatures, Call Hierarchy (`Shift+Alt+H`), and `F12` Go to Definition. | **[IntelliSense Guide](knowledge/BML_IntelliSense.md)** |
| **🛠 BML Beautifier & Formatter** | Deterministic 4-stage formatting, brace styles (`collapse`/`expand`), minimal range diffing, on-type formatting, and `.bmlbeautifyrc`. | **[Beautifier Guide](knowledge/BML_Beautifier.md)** |
| **🔍 Real-Time Security & Linter** | Real-time squiggles and `Alt+Enter` Quick-Fixes for BMQL injection risks, queries in loops, unbounded while loops, and type validation. | **[Linter Guide](knowledge/BML_Linter.md)** |
| **⚡ BML Logic Scratchpad** | Offline interactive sandbox to test pure BML algorithms (math, string manipulation, dates, dict, json) and view print logs instantly. | **[Scratchpad](knowledge/BML_MCP.md)** |
| **🤖 Model Context Protocol (MCP)** | Seamless multi-client MCP auto-registration for Cursor, Copilot, Google Antigravity, Claude Desktop, and ChatGPT. | **[MCP Server Guide](knowledge/BML_MCP.md)** |
| **☁ Safe Cloud Sync & 3-Way Diff** | OAuth2/Basic Auth client, side-by-side diff review on pull conflicts, and live debug streaming to CPQ DevKit Terminal. | **[REST API Guide](knowledge/BML_REST_API.md)** |
| **🏗 BML & BMQL Scaffolding** | Explorer context scaffolding for library functions with docHeaders and `-meta.json` sidecars, plus parameterized BMQL queries. | **[Scaffolding](knowledge/BML_Snippets.md)** |
| **🚦 CI/CD Security Audit** | Workspace-wide BML security and quality audit via MCP `audit_bml_code` tool — detects BMQL injection risks, queries in loops, and failing quality scores. | **[Linter Guide](knowledge/BML_Linter.md)** |
| **⚙ Interactive Settings Panel** | Webview UI dashboard for managing environments, credentials, formatter options, MCP traffic inspection, and diagnostics. | **[Settings Panel Guide](knowledge/BML_Settings_Panel.md)** |
| **🔤 Smart Spell Checker** | Morphological inflection analyzer and domain dictionary designed for BML identifiers and comments. | **[Spell Check Guide](knowledge/BML_Spell_Check.md)** |
| **📄 XSLT & XML Subsystem** | Document Engine XSL template formatting, XPath 1.0 autocompletion, and BML `transformxml()` integration. | **[XSLT Guide](knowledge/BML_XSLT.md)** |
| **📊 Code Quality & Metrics** | McCabe Cyclomatic Complexity, Halstead Software Science, Maintainability Index (MI), and visual dashboard. | **[Metrics Guide](knowledge/BML_Metrics.md)** |

---

## ⌨ Key Shortcuts & Common Commands

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Command Palette (`Ctrl/Cmd+Shift+P`) |
| :--- | :--- | :--- | :--- |
| **Format Document** | `Shift+Alt+F` | `Shift+Option+F` | `Format Document` |
| **Call Hierarchy** | `Shift+Alt+H` | `Shift+Option+H` | `Show Call Hierarchy` |
| **Go to Definition** | `F12` | `F12` | `Go to Definition` |
| **Find All References** | `Shift+F12` | `Shift+F12` | `Find All References` |
| **Quick Fix / Lightbulb** | `Ctrl+.` | `Cmd+.` | `Quick Fix...` |
| **Open BML Scratchpad** | - | - | `CPQ-BML: Open BML Logic Scratchpad (Offline Sandbox)` |
| **Run BML Script Locally** | - | - | `CPQ-BML: Run BML Script Locally (Scratchpad)` |
| **Scaffold Library Function** | - | - | `CPQ-BML: Scaffold New Library Function (with -meta.json sidecar)` |
| **Scaffold BMQL Query** | - | - | `CPQ-BML: Scaffold Parameterized BMQL Query` |
| **Switch Environment** | - | - | `CPQ-BML: Switch Active CPQ Environment` |
| **Export Team Profiles** | - | - | `CPQ-BML: Export Team Profiles (.cpq/profiles.json)` |
| **Open Settings Panel** | - | - | `CPQ-BML: Open Settings` |
| **Show Code Metrics** | - | - | `BML: Show Code Metrics` |
| **Pull Function from CPQ** | - | - | `CPQ: Pull Function` |
| **Debug Function Remotely**| - | - | `CPQ: Debug Function` |
| **Deploy Function** | - | - | `CPQ: Deploy Current Util Function to CPQ` |

---

## ⚙ Configuration Setup

Configure your CPQ environments in `.env` (workspace root) or through the **Settings Panel** (`CPQ-BML: Open Settings`):

```bash
# Oracle CPQ Cloud Environment Setup (.env)
CPQ_SITE_URL=https://sitename.oracle.com
CPQ_USERNAME=api_developer
CPQ_PASSWORD=YourPasswordHere!
CPQ_AUTH_METHOD=basic
CPQ_REST_VERSION=v17
CPQ_COMMERCE_PROCESS=oraclecpqo
CPQ_COMMERCE_DOCUMENT=transaction
```

To customize formatting options across your project, create a `.bmlbeautifyrc` file:

```json
{
  "indent_size": 4,
  "brace_style": "collapse",
  "space_before_conditional": true,
  "preserve_newlines": true,
  "max_preserve_newlines": 2,
  "uppercase_reserved_words": true
}
```

---

## 💻 Local Development & Contributions

```bash
# Clone the repository
git clone https://github.com/vikram-vn/cpq-bml.git
cd cpq-bml

# Install dependencies
npm install

# Compile the extension bundle
npm run compile
```

Press **F5** in VS Code to launch the Extension Development Host.

---

## 📄 License & Disclaimer

* **License:** Licensed under the [MIT License](LICENSE).
* **Disclaimer:** This extension is an independent open-source tool and is not affiliated with or endorsed by Oracle Corporation.
