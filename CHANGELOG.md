# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.94.0] - 2026-09-10

### Added

- Implement cloud data tables explorer and CSV export functionality.

## [1.93.0] - 2026-09-10

### Added

- Implement lint rules and code actions for BML performance optimizations and code style improvements.
- Implement framework for automated BML code action quick fixes.

## [1.92.0] - 2026-09-10

### Added

- Implement BML file scaffolding and metadata management for Oracle CPQ REST services.
- Implement CloudExplorer logic and add headless VS Code mocks for unit testing.
- Add testing infrastructure with custom module resolution and commerce API unit tests.
- Implement cloud data tables exploration and CSV export functionality.
- Implement native Node.js build runner and remove icon theme support.

## [1.91.0] - 2026-09-10

### Added

- Implement comprehensive language tooling, including linter, intellisense, REST command framework, and MCP integration with supporting unit tests.
- Implement Next.js-style @ path alias across editor, bundler, and tests.
- Add unit tests for BML test runner, discovery, coverage calculation, and remote test execution.
- Conditionally activate BML spell check only when Code Spell Checker is installed and contribute cSpell dictionaries.
- Implement live BMQL intelligent query autocomplete and record field completions.
- Add live datatables explorer, preflight checker, remote test runner, and bmlt support.
- Add transaction mocking utilities, library metadata support, and cloud explorer functionality.
- Introduce REST API health monitoring, cache management, and BML transaction mocking utilities.
- Implement full-stack code complexity, pipeline dependency, and BML testing infrastructure.

### Changed

- Adopt @ import alias systematically across entire codebase.
- Rename app/lang/test to app/lang/test-controller.
- Minimize verbose comments and remove redundant block documentation throughout extension.
- Prune evaluator, debug adapter, profiler, AST tokens/rename, attribute graph webview, doc generator, and scaffolder.
- Completely prune complexity analyzer and explorer, inlining essential loop threat checks into preflightChecker.
- Prune standalone REPL, Halstead metrics dashboard, variable type inlay hints, and generic English spellcheck.
- Convert all recent modules from ES6 classes to pure functions and factory closures.

### Documentation

- Add architectural documentation for BML linter and advanced BML design patterns.

## [1.90.0] - 2026-09-10

### Added

- Implement comprehensive language tooling, including linter, intellisense, REST command framework, and MCP integration with supporting unit tests.
- Implement Next.js-style @ path alias across editor, bundler, and tests.
- Add unit tests for BML test runner, discovery, coverage calculation, and remote test execution.
- Conditionally activate BML spell check only when Code Spell Checker is installed and contribute cSpell dictionaries.
- Implement live BMQL intelligent query autocomplete and record field completions.
- Add live datatables explorer, preflight checker, remote test runner, and bmlt support.
- Add transaction mocking utilities, library metadata support, and cloud explorer functionality.
- Introduce REST API health monitoring, cache management, and BML transaction mocking utilities.
- Implement full-stack code complexity, pipeline dependency, and BML testing infrastructure.

### Changed

- Adopt @ import alias systematically across entire codebase.
- Rename app/lang/test to app/lang/test-controller.
- Minimize verbose comments and remove redundant block documentation throughout extension.
- Prune evaluator, debug adapter, profiler, AST tokens/rename, attribute graph webview, doc generator, and scaffolder.
- Completely prune complexity analyzer and explorer, inlining essential loop threat checks into preflightChecker.
- Prune standalone REPL, Halstead metrics dashboard, variable type inlay hints, and generic English spellcheck.
- Convert all recent modules from ES6 classes to pure functions and factory closures.

### Documentation

- Add architectural documentation for BML linter and advanced BML design patterns.

## [1.89.0] - 2026-09-09

### Added

- **Native VS Code Test Explorer (`vscode.TestController`)**: First-class Testing sidebar integration for `.test.bml` test suites with `@test "description"` blocks, assertions (`assert.equals`, `assert.isTrue`, `assert.notNull`), and execution timing.
- **Extended AI MCP Tools**: 2 new agent tools: `run_bml_tests` and `update_snapshot` / `compare_snapshot` for BML test regression workflows.

## [1.88.0] - 2026-09-09

### Added

- **Native Call Hierarchy (`Shift+Alt+H`)**: Complete incoming and outgoing call tree analysis for workspace `util.*` and `commerce.*` functions.
- **Safe Side-by-Side Diff on Pull**: Interactive diff comparison (`vscode.diff`) and conflict prevention when pulling remote CPQ scripts over modified local files.
- **Automated BML Scaffolding & Sidecars**: Commands to generate new library functions with docHeaders and paired `-meta.json` sidecars, plus parameterized BMQL query scaffolds.
- **Offline BMQL Query Validator & Syntax Explainer**: Full offline BMQL parser and optimizer tool (`validate_bmql_query`) warning on SQL injection, unbounded queries, and unsupported SQL keywords.
- **Standalone CI/CD CLI (`cpq-bml`)**: Command-line tool and npm script (`npm run audit`) for automated security and quality auditing in CI pipelines.
- **Status Bar Environment Quick-Switcher & Team Profiles**: Status bar item to switch active CPQ environments with 1 click, plus safe export/import of `.cpq/profiles.json` (sensitive secrets stripped).
- **Real-Time Editor Squiggles & Quick-Fixes**: In-editor diagnostics and `Alt+Enter` code actions for BMQL injection risks and loop safeguards.
- **Native MCP Resources**: Standard MCP resources (`cpq://attributes/commerce`, `cpq://attributes/configuration`, `cpq://datatables/list`).
- **Enhanced Document & On-Type Formatter**: Auto-formats BML on `;` and `}` keystrokes and full document format support.
- **Strict Codebase Refactoring**: Complete architectural compliance ensuring zero JS/JSX files exceed 500 lines of code across the repository.

## [1.87.0] - 2026-09-09

### Added

- **Multi-Client MCP Auto-Registration**: Seamless auto-registration for Cursor, GitHub Copilot, Google Antigravity, Claude Desktop, and ChatGPT Desktop. Reads active port from settings, skips uninstalled tools without directory pollution, and updates configs on port changes.
- **Settings Panel MCP Controls**: Conditional rendering in Settings Webview — port configuration, BML skill sync, and registration actions only show when MCP is enabled.
- **Live MCP Traffic Inspector**: Streaming request & latency inspector directly inside the Settings Panel tab with expandable arguments and error details.
- **1-Click AI Setup Diagnostic Scorecard**: Automated health evaluation of local MCP server binding, CPQ credentials, attribute cache, and client registrations.
- **BML Code Security Auditor**: High-speed AST/regex auditor (`audit_bml_code`) detecting BMQL injection risks, N+1 queries in loops, unbounded while loops, and memory bottlenecks.
- **Data Tables Discovery MCP Tools**: `list_datatables` and `get_datatable_schema` tools allowing AI models to inspect schemas before writing BMQL queries.
- **`@bml` Copilot Chat Participant**: Interactive `@bml` chat assistant in VS Code with slash commands: `/bmql`, `/audit`, and `/attr`.
- **Zero-Touch Automatic Port Recovery**: Automatically recovers from `EADDRINUSE` port collisions by finding the next open port, updating user configuration, and syncing registered AI tools.
- **MCP HTTP Health Check**: `GET /health` endpoint reporting server health, bound port, and service status.

## [1.86.0] - 2026-09-09

### Added

- Implement MCP knowledge tools for local BML function management, analysis, and skill documentation.
- Implement dynamic MCP server configuration and settings panel support.
- Implement commerce metadata loading and settings panel management infrastructure.
- Implement commerce metadata loading, cleanup utilities, and corresponding test state integration.
- Implement settings panel UI with tab-based configuration and sync management capabilities.
- Add BML logo icon in SVG format.

## [1.85.0] - 2026-09-09

### Added

- Add script to generate BML utility attribute metadata and integrate into IntelliSense provider.
