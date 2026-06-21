# CPQ‑BML VS Code Extension

A professional, feature-rich Visual Studio Code extension providing comprehensive language support, advanced diagnostics, workspace formatting, and remote synchronization for Oracle CPQ BigMachines Language (BML).

---

## Key Features

### 1. Language Support & IntelliSense

- **Syntax Highlighting:** Complete semantic colorization for BML methods, operators, keywords, control flow statements, variables, and literal structures.
- **Snippets Library:** Preconfigured, context-aware code templates for common loops, conditional statements, BML system functions, and BMQL database queries.
- **IntelliSense Autocomplete:** Signature help, parameter tooltips, and completion lists matching CPQ's language specification.
- **Spell Checker Integration:** Built-in integration with CSpell to prevent typos in variable names and standard library function calls.

### 2. Workspace Beautifier & Formatter

- **Directory-Level Formatting:** Command `CPQ-BML: Beautify / Format All BML Files in Workspace` (`cpqBml.beautifyWorkspace`) formats BML files recursively across single or multi-root projects.
- **Folder Selection UI:** Multi-select Quick-Pick dialog listing all workspace roots and their sub-folders for precise format targeting.
- **CPQ Standard Enforcement:** Formats code layout and automatically converts occurrences of the reserved word `not` to the mandatory uppercase `NOT`.
- **Configurable Defaults & Overrides:** Uses global formatting preferences that can be customized on a per-folder basis using a `.bmlbeautifyrc` JSON file.

### 3. Comprehensive BML Linter & Diagnostics

The extension includes a custom, language-aware linter that checks for:

- **Best Practices & Security:**
  - **SQL Injection Detection:** Flags dynamic string concatenation in `bmql()` queries; recommends the safe `$variable` parameter syntax.
  - **API Deprecations:** Flags calls to `strtodate` (recommends `strtojavadate`), `gettabledata` and `getpartsdata` (recommends `bmql` to prevent vulnerabilities).
  - **Oracle Constants:** Flags standard JS `NaN` and suggests CPQ-compatible `jNaN`.
  - **Return Verifications:** Signals compiler errors if the script is missing a `return` statement, or warns if commerce BML return strings are missing the mandatory pipe `|` delimiter.
- **Safety & Quality Checks:**
  - **Numerical Validity:** Flags `atoi` / `atof` calls missing preceding `isnumber()` validations.
  - **Array Boundaries:** Warns if elements of a `split()` array are accessed without checking `sizeofarray()` first.
  - **Dead & Empty Code:** Identifies empty `if`, `elif`, `else`, or `for` blocks.
  - **Magic Numbers:** Detects raw literals (except `0`, `1`, `2`, `10`, `100`) and suggests using named constants.
- **Semicolon & Style Checking:**
  - Strict or relaxed semicolon insertion guidelines.
  - Style enforcement rules (e.g. variable shadowing, naming conventions, formatting rules).
- **Directives & Suppressions:**
  - Granular lint rules can be bypassed for specific lines or files using inline comments:
    - `// bml-lint-disable`
    - `// bml-lint-disable-line`
    - `// bml-lint-disable-next-line`
    - `// bml-lint-disable-file`
- **Quick Fixes:** Rich VS Code Code Actions support to automatically repair semicolon issues, syntax typos, deprecated function calls, and format warnings in place.

### 4. Interactive Settings Dashboard

- Access the custom webview setting dashboard via **`CPQ-BML: Open Settings`** (`cpqBml.settings.open`).
- Manage multiple environment targets (e.g., Dev, Test, Stage, Prod).
- **Secure Credential Storage:** Connects with the VS Code Secret Storage API so passwords and token keys are saved securely on the operating system's keychain rather than plaintext config files.

### 5. Remote REST Integration & Synchronization

Integrate directly with your live Oracle CPQ environment to pull and sync code:

- **Pull Code:** Download utility libraries and commerce functions (`cpqBml.rest.pullLibraryFunctions`, `cpqBml.rest.pullCommerceFunctions`) along with metadata configurations.
- **Remote Compilation & Validation:** Compile files against the live CPQ engine on demand (`cpqBml.rest.validateCurrentFile`) and view diagnostics in an integrated terminal.
- **Sandbox Debugger:** Run BML functions on the live CPQ server (`cpqBml.rest.debugCurrentFile`) with a pop-up parameter input dialog to test logic changes without deploying.
- **Deployment Control:** Save, push, and mass-deploy BML functions or commerce processes setup (`cpqBml.rest.deployCurrentFile`, `cpqBml.rest.deployUtilFunctions`, `cpqBml.rest.deployCommerceProcess`).
- **Environment Switcher:** Cycle between configured sandboxes (`cpqBml.rest.changeEnvironment`).

### 6. Model Context Protocol (MCP) Server for AI Agents

Connect code editors or standalone AI terminals (like Claude Code) directly to your active VS Code CPQ-BML workspace:

- **Local Integration:** Enabling `cpqBml.mcp.enable` spins up a local server binding to `127.0.0.1` (on `cpqBml.mcp.port`, default `47821`).
- **Secure Bridging:** AI agents can invoke workspace operations (listing, pulling, saving, validating, debugging, deploying, and creating functions) locally. Your CPQ credentials are kept inside the host extension process and are never shared or sent to the external client.
- **Live Logging:** Toggle `cpqBml.mcp.logToTerminal` to stream all AI-initiated commands and REST integrations directly into a visible `CPQ-BML (AI)` terminal panel.

---

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://example.com/cpq-bml.git
   cd cpq-bml
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Compile the Project:**
   ```bash
   npm run compile
   ```
4. **Run and Debug:**
   Open the folder in VS Code, and press **F5** to start an Extension Development Host.

---

## Commands Reference

| Command ID                          | Title                                                   | Description                                                |
| :---------------------------------- | :------------------------------------------------------ | :--------------------------------------------------------- |
| `cpqBml.beautifyWorkspace`          | `CPQ-BML: Beautify / Format All BML Files in Workspace` | Iterates and formats BML files matching path constraints   |
| `cpqBml.settings.open`              | `CPQ-BML: Open Settings`                                | Launches WebView dashboard panel                           |
| `cpqBml.rest.changeEnvironment`     | `CPQ-BML: Change Environment`                           | Switch active CPQ connection credentials                   |
| `cpqBml.rest.setPassword`           | `CPQ-BML: Set CPQ Password`                             | Securely stores password for Basic auth                    |
| `cpqBml.rest.setAuthToken`          | `CPQ-BML: Set CPQ Auth Token`                           | Securely stores Bearer token credentials                   |
| `cpqBml.rest.pullLibraryFunctions`  | `CPQ-BML: Pull Util Library Functions from CPQ`         | Pulls utility BML functions from remote server             |
| `cpqBml.rest.pullCommerceFunctions` | `CPQ-BML: Pull Commerce Functions from CPQ`             | Downloads commerce scripts from remote server              |
| `cpqBml.rest.validateCurrentFile`   | `CPQ-BML: Validate Current File Against CPQ`            | Compiles active BML file on live server                    |
| `cpqBml.rest.debugCurrentFile`      | `CPQ-BML: Debug Current Function on CPQ`                | Executes function on sandbox with parameter payloads       |
| `cpqBml.rest.saveCurrentFile`       | `CPQ-BML: Save Current File to CPQ`                     | Pushes current buffer changes to remote repository         |
| `cpqBml.rest.createBmlFunction`     | `CPQ-BML: Create BML Function`                          | Scaffold a new BML function on CPQ and locally             |
| `cpqBml.rest.deployCurrentFile`     | `CPQ-BML: Deploy Current Util Function to CPQ`          | Publishes utility changes on active environment            |
| `cpqBml.rest.deployUtilFunctions`   | `CPQ-BML: Mass Deploy Util Library Functions`           | Pushes local utility files to CPQ in batches               |
| `cpqBml.rest.deployCommerceProcess` | `CPQ-BML: Deploy Commerce Process Setup`                | Initiates process-wide deployment task                     |
| `cpqBml.rest.createOverride`        | `CPQ-BML: Create Override`                              | Establishes a local file override configuration            |
| `cpqBml.rest.removeOverride`        | `CPQ-BML: Remove Override`                              | Destroys local file overrides                              |
| `cpqBml.rest.clearResults`          | `CPQ-BML: Clear Results Terminal`                       | Wipes output results log terminal                          |
| `cpqBml.mcp.showInfo`               | `CPQ-BML: Show MCP Server Connection Info`              | Prints local URL and port of Model Context Protocol server |

---

## Configuration Settings

Define these properties in your User or Workspace `settings.json`:

- `cpqBml.connection.enabled` (default: `true`): Enable Oracle CPQ REST integrations.
- `cpqBml.lint.enable` (default: `true`): Enable BML linting, styling diagnostics, and code fixes.
- `cpqBml.connection.siteUrl` (default: `""`): CPQ server instance domain name or root URL.
- `cpqBml.connection.authMethod` (default: `"basic"`): Authentication method to use: `"basic"` (username/password) or `"bearer"` (OAuth tokens).
- `cpqBml.connection.username` (default: `""`): Username for API access.
- `cpqBml.connection.environments` (default: `[]`): Array of sandbox environments.
- `cpqBml.connection.restVersion` (default: `"v18"`): REST API segment path version.
- `cpqBml.connection.commerceProcess` (default: `"oraclecpqo"`): Target commerce process key.
- `cpqBml.connection.commerceDocument` (default: `"transaction"`): Active commerce process document name.
- `cpqBml.connection.debugLog` (default: `false`): Stream raw API transaction summaries locally to `bml_rest_api.log`.
- `cpqBml.rest.pullFolder` (default: `"library"`): Relative folder destination path for remote fetches.
- `cpqBml.mcp.enable` (default: `false`): Toggles the local Model Context Protocol server state.
- `cpqBml.mcp.port` (default: `47821`): Local port bound by the MCP HTTP server.
- `cpqBml.mcp.logToTerminal` (default: `false`): Stream AI agent integrations to a dedicated terminal.
- `cpqBml.debug.logOutputToFile` (default: `false`): Save return values and print statements from debug sessions to the workspace root.

---

## Format Configuration (`.bmlbeautifyrc`)

Place a `.bmlbeautifyrc` file in any directory to customize the formatter options for BML files in that hierarchy. It overrides workspace defaults.

Example config file:

```json
{
  "indent_size": 2,
  "brace_style": "collapse",
  "preserve_newlines": true,
  "max_preserve_newlines": 1,
  "space_before_conditional": true
}
```

---

## License

MIT © 2024-2026 vikram-n
