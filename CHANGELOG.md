# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.89.0] - 2026-09-09

### Added

- **BML Debug Adapter Protocol (DAP)**: Native VS Code step-through debugging (`F5` launch, `F9` breakpoints, `F10` step-over, `F11` step-into, stack trace navigation, local/CPQ variable scopes, and Debug Console expression eval).
- **Native VS Code Test Explorer (`vscode.TestController`)**: First-class Testing sidebar integration for `.test.bml` test suites with `@test "description"` blocks, assertions (`assert.equals`, `assert.isTrue`, `assert.notNull`), and execution timing.
- **Interactive Data Table Grid Editor (`vscode.CustomTextEditorProvider`)**: Full visual spreadsheet editor for `*.dt.json` and `*.dt.csv` files with row editing, column schema validation, filtering, and direct CPQ deployment.
- **AST Parser, Semantic Tokens & `F2` Symbol Rename**: Recursive-descent AST parser for BML, semantic highlighting distinguishing library calls, local variables, and system properties, plus safe workspace-wide identifier renaming (`F2`).
- **Dynamic Instance Type Definitions (`cpq.d.bml`)**: Auto-introspects active CPQ instance attributes (Document 1, Document 2, and Data Tables) into `.cpq/schema.json` and generates `cpq.d.bml` stubs for real-time autocomplete.
- **Static Performance & Timeout Profiler**: Real-time editor diagnostics and CLI tool (`cpq-bml profile`) detecting critical CPQ execution bottlenecks: unsupported `while` loops, $O(N)$ BMQL queries in loops, string concatenation antipatterns, and excessive loop/block nesting (> 3/5).
- **Extended AI MCP Tools**: 4 new agent tools: `profile_bml_performance`, `generate_bml_unit_test`, `execute_bml_test_suite`, and `introspect_cpq_schema`.

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

## [1.84.0] - 2026-09-08

### Added

- Add workspace AI file management and global skill synchronization for Antigravity IDE support.
- Implement commerce metadata synchronization system with UI settings and backend caching.
- Add sync modules to fetch and cache commerce attributes, system attributes, and lookups.
- Implement semantic material folder icon mapping rules and configuration dictionary.
- Add new material icons and register folder icon rules.
- Enforce <= 500 lines per JS file, add debug concurrency to web panel and settings with default 2.
- Implement settings registry and search functionality with enhanced REST debugging and AI tool configuration support.
- Implement MCP lifecycle tools for BML functions including validate, save, deploy, and debug capabilities.
- Introduce commerceAttributes module for CPQ workspace metadata processing and ignore .cpq directory.

## [1.83.0] - 2026-09-08

### Added

- Implement native Node.js build runner and commerce attribute REST API logic.

## [1.82.1] - 2026-09-08

### Changed

- Performance optimizations, benchmark fixtures, and stability enhancements.

## [1.82.0] - 2026-09-07

### Added

- Implement REST-based commands, commerce metadata syncing, and associated unit tests.
- Implement BML library REST API client with corresponding commerce attribute support and integration tests.
- Implement documentation build system with automation scripts and reference content for Oracle CPQ REST APIs.
- Implement AI skill documentation and build scripts for CPQ and BML modules.

## [1.81.0] - 2026-09-07

### Added

- Implement BML library REST API client with corresponding commerce attribute support and integration tests.
- Implement documentation build system with automation scripts and reference content for Oracle CPQ REST APIs.
- Implement AI skill documentation and build scripts for CPQ and BML modules.

## [1.80.1] - 2026-09-07

### Changed

- Performance optimizations, benchmark fixtures, and stability enhancements.

## [1.80.0] - 2026-09-07

### Added

- Add clear, save, and validate SVG icons for BML functionality.
- Add bug icon SVG for debugging functionality.
- Add debug icon SVG to assets.
- Add debug icon as SVG asset.
