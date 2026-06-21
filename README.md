# CPQ‑BML VS Code Extension

A professional, feature-rich Visual Studio Code extension providing comprehensive language support, advanced diagnostics, workspace formatting, and remote synchronization for Oracle CPQ BigMachines Language (BML).

---

## Key Features

### 1. Language Support & IntelliSense

- **Syntax Highlighting:** Complete semantic colorization for BML methods, operators, keywords, control flow statements, variables, and literal structures. For the richest result, pair this with one of the bundled **BML Dark / Dark Default / Light / Light Default** color themes (see below).
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

### 4. BML Better Comments & Documentation

The extension automatically formats, styles, and highlights your BML comments with distinct colors, underlines, and strike-throughs to emphasize task status, directives, and headers:

- **Symbol Tags:**
  - `// ! Alert or critical information` (Red highlighting)
  - `// ? Question or review needed` (Blue italicized highlighting)
  - `// * Highlighted note or key point` (Green italicized highlighting)
  - `// // Commented-out code line` (Strikethrough line comment style)
- **Word Tags (Case-Insensitive):**
  - `// TODO: Task to complete` (Orange highlighting)
  - `// FIXME: Bug to resolve` (Light red highlighting)
  - `// BUG: Code bug or issue` (Light red bold highlighting)
  - `// WARNING: Action warning` (Yellow bold highlighting)
  - `// IMPORTANT: Critical warning` (Red bold highlighting)
  - `// HACK: Temporary workaround` (Orange bold and underlined)
  - `// XXX: Warning or code warning` (Orange bold and underlined)
  - `// NOTE: General context note` (Teal highlighting)
  - `// OPTIMIZE: Performance optimization` (Teal bold highlighting)
  - `// IDEA: Design suggestion or idea` (Blue highlighting)
- **Directives (Highlighting + Logic):**
  - Lint suppression directives (e.g. `// bml-lint-disable-line`) and formatter ignore tags (e.g. `/* beautify ignore:start */` / `/* beautify ignore:end */`) get visually highlighted with a distinctive purple border/background.
- **Documentation Headers:**
  - Standardized BML function documentation headers (such as `Function Name:`, `Description:`, `Inputs:`, `Returns:`) are automatically detected and styled in italicized light blue blocks for maximum readability.

### 5. Interactive Settings Dashboard

- Access the custom webview setting dashboard via **`CPQ-BML: Open Settings`** (`cpqBml.settings.open`).
- **Features Tab:** Dedicated dashboard section to configure editor assistant features like BML Linting and BML Better Comments.
- **Secure Credential Storage:** Connects with the VS Code Secret Storage API so passwords and token keys are saved securely on the operating system's keychain rather than plaintext config files.
- Manage multiple environment targets (e.g., Dev, Test, Stage, Prod).

### 6. Remote REST Integration & Synchronization

Integrate directly with your live Oracle CPQ environment to pull and sync code:

- **Pull Code:** Download utility libraries and commerce functions (`cpqBml.rest.pullLibraryFunctions`, `cpqBml.rest.pullCommerceFunctions`) along with metadata configurations.
- **Remote Compilation & Validation:** Compile files against the live CPQ engine on demand (`cpqBml.rest.validateCurrentFile`) and view diagnostics in an integrated terminal.
- **Sandbox Debugger:** Run BML functions on the live CPQ server (`cpqBml.rest.debugCurrentFile`) with a pop-up parameter input dialog to test logic changes without deploying.
- **Deployment Control:** Save, push, and mass-deploy BML functions or commerce processes setup (`cpqBml.rest.deployCurrentFile`, `cpqBml.rest.deployUtilFunctions`, `cpqBml.rest.deployCommerceProcess`).
- **Environment Switcher:** Cycle between configured sandboxes (`cpqBml.rest.changeEnvironment`).

### 7. Model Context Protocol (MCP) Server for AI Agents

Connect code editors or standalone AI terminals (like Claude Code) directly to your active VS Code CPQ-BML workspace:

- **Local Integration:** Enabling `cpqBml.mcp.enable` spins up a local server binding to `127.0.0.1` (on `cpqBml.mcp.port`, default `47821`).
- **Secure Bridging:** AI agents can invoke workspace operations (listing, pulling, saving, validating, debugging, deploying, and creating functions) locally. Your CPQ credentials are kept inside the host extension process and are never shared or sent to the external client.
- **Live Logging:** Toggle `cpqBml.mcp.logToTerminal` to stream all AI-initiated commands and REST integrations directly into a visible `CPQ-BML (AI)` terminal panel.

### 8. BML Color Themes

Four bundled VS Code color themes - **BML Dark**, **BML Dark Default**, **BML Light**, and **BML Light Default** - each a complete editor theme with a BML-specific richness layer on top:

- **Activation:** Open the Color Theme picker (`Ctrl+K Ctrl+T` / `Cmd+K Cmd+T`) and select one of the four. Like any VS Code theme, this replaces your current theme entirely (every language, not just BML) until you switch back.
- **BML-specific richness:** built-in function calls are tinted by category (string, math, date, database, URL, array, dictionary, XML, JSON, misc functions each get a distinct color), CPQ attribute/member access (`line.x`, `transaction.x`, generic member/property access) is tinted separately from plain variables and from each other, and assignment/comparison/arithmetic/logical operators each get their own color so e.g. a stray `=` vs `==` is easier to spot at a glance.
- **Full-language coverage:** sensible default colors for comments, strings, numbers, keywords, functions, types, and punctuation across other languages too, so non-`.bml` files stay readable while any of these themes is active.
- This **replaces** the older approach of forcing BML colors onto whatever theme was already active - that auto-applying behavior no longer exists; BML-specific colors are only visible while one of these themes is selected.

---

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/vikram-vn/cpq-bml.git
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

### Connection & Environments (`cpqBml.connection.*`)
- `cpqBml.connection.enabled` (default: `true`): Enable Oracle CPQ REST integrations.
- `cpqBml.connection.siteUrl` (default: `""`): CPQ server instance domain name or root URL.
- `cpqBml.connection.authMethod` (default: `"basic"`): Authentication method to use: `"basic"` (username/password) or `"bearer"` (OAuth tokens).
- `cpqBml.connection.username` (default: `""`): Username for API access.
- `cpqBml.connection.environments` (default: `[]`): Array of sandbox environments.

### REST Synchronization (`cpqBml.rest.*`)
- `cpqBml.rest.restVersion` (default: `"v18"`): REST API segment path version segment.
- `cpqBml.rest.commerceProcess` (default: `"oraclecpqo"`): Target commerce process key.
- `cpqBml.rest.commerceDocument` (default: `"transaction"`): Active commerce process document name.
- `cpqBml.rest.pullFolder` (default: `"library"`): Relative folder destination path for remote fetches.

### Editor Features (`cpqBml.features.*`)
- `cpqBml.features.lint` (default: `true`): Enable BML linting, styling diagnostics, and code fixes.
- `cpqBml.features.comments` (default: `true`): Enable BML Better Comments decoration highlighting and documentation hover support.

### MCP Server (AI) (`cpqBml.mcp.*`)
- `cpqBml.mcp.enable` (default: `false`): Toggles the local Model Context Protocol server state.
- `cpqBml.mcp.port` (default: `47821`): Local port bound by the MCP HTTP server.
- `cpqBml.mcp.logToTerminal` (default: `false`): Stream AI agent integrations to a dedicated terminal.

### Diagnostics & Debugging (`cpqBml.debug.*`)
- `cpqBml.debug.logRestDetails` (default: `false`): Stream raw API transaction summaries locally to `bml_rest_api.log`.
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

MIT © 2026 vikram-n
