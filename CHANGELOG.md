# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.45.0] - 2026-08-22

### Added
- Consolidate build scripts into build_all.py and update package.json commands.

## [1.44.0] - 2026-08-22

### Added
- Add linting rules for detecting undeclared variables and use-before-define errors in BML.
- Implement BML syntax rules and variable naming convention linters.

## [1.43.0] - 2026-08-22

### Added
- Implement BML parameter type validation and add comprehensive linting test suites.
- Add linter rules and tests for BML function parameter constraints.

## [1.42.0] - 2026-08-22

### Added
- Implement parameter completion dispatcher and dictionary linter validation rules.
- Introduce CPQ BML language grammar, build scripts, and syntax testing suite.
- Implement MCP server registration and add chat participant and tool configurations.
- Add BML function metadata and lint definitions for intellisense support.

## [1.41.0] - 2026-08-22

### Added
- Initialize spell-check word lists with BML and English dictionaries.

## [1.40.0] - 2026-08-22

### Added
- Implement security quick-fixes and add variable usage analysis for linting.
- Implement commerce attribute scope validation and comprehensive linting code-actions framework.

## [1.39.0] - 2026-08-22

### Added
- Implement linting rules to detect undeclared variables and use-before-define errors in BML files.

## [1.38.0] - 2026-08-22

### Added
- Implement quick fixes for BMQL linting diagnostic issues.

## [1.37.0] - 2026-08-22

### Added
- Implement BML linting engine with operator checks, commerce attribute scoping, and code-action fixes.

## [1.36.0] - 2026-08-22

### Added
- Implement static analysis linting for BML array operations and BMQL query safety patterns.
- Add code quality linting rules and associated quick fixes with unit tests.
- Implement intelligent parameter completion provider for BML functions.
- Implement unused variable and loop variable linting logic.
- Add linting expectation test files and update project configuration.
- Add BML style linting, custom spelling rules, and associated test coverage.
- Implement comprehensive linting code actions framework with automated quick fixes for BML diagnostics.
- Add BML color themes and syntax highlighting test file.
- Implement BML operand type checking and register associated language syntax and tests.
- Implement BML attribute dump parser and ASCII formatter, and bump version to 1.32.0.
- Implement BML document attribute dump parsing and ASCII table formatting utilities.
- Add BML attribute dump parser and ASCII table formatter for debug commands.
- Implement BML REST commands, linting engine, and custom UI icons, and bump version to 1.30.0.
- Implement BML REST commands, custom UI icons, and linting engine, and bump version to 1.29.0.
- Implement BML REST command registration and status bar tracking while removing unused download log command.
- Implement REST client for CPQ BML and register VS Code status bar commands.
- Implement REST client and log file download command for CPQ-BML.
- Add command to download and display remote CPQ system logs.
- Implement automated BML attribute dumping, add MCP configuration integration tests, and bump version to 1.28.0.
- Implement automated document attribute dumping and logging for BML REST debug commands.
- Add download-log and settings SVG icons to assets.
- Add application-specific SVG icons to support new UI features.
- Add debug icon SVG to assets directory.
- Add custom SVG icons and implement MCP server configuration integration tests.
- Replace built-in VS Code icons with custom SVG assets for extension commands.
- Add UI icons and implement a BML linter performance profiling harness.
- Add UI icons to BML commands, expose log download in navigation, and update lint performance profile.
- Add linting engine and comprehensive unit test coverage for BML code analysis.
- Implement BML linting engine with performance, spell-checking, and best-practices analysis modules.
- Implement BML linting rules and automated AI skill synchronization, and bump version to 1.26.0.
- Add BML linting rules and AI skill synchronization, and bump version to 1.25.0.
- Implement linting rules for URL access, XML parsing, and BMQL safety with associated test suites.
- Implement linting rules for logtime, globaldictset, generatehmacmessage, and stringbuilder functions.
- Implement automatic AI skill synchronization for Claude, Cursor, and Copilot tools.
- Implement automated AI skill synchronization for Claude, Cursor, and Copilot via native project configuration files.

### Changed
- Added mssing debug data for commerce.
- Remove setImmediate wrapper from activation logic to register services synchronously.
