# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.29.0] - 2026-07-12

### Added
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

## [1.28.0] - 2026-07-12

### Added
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

## [1.27.0] - 2026-07-12

### Added
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

## [1.26.0] - 2026-07-09

### Added
- Add BML linting rules and AI skill synchronization, and bump version to 1.25.0.
- Implement linting rules for URL access, XML parsing, and BMQL safety with associated test suites.
- Implement linting rules for logtime, globaldictset, generatehmacmessage, and stringbuilder functions.
- Implement automatic AI skill synchronization for Claude, Cursor, and Copilot tools.
- Implement automated AI skill synchronization for Claude, Cursor, and Copilot via native project configuration files.

## [1.25.0] - 2026-07-09

### Added
- Implement linting rules for URL access, XML parsing, and BMQL safety with associated test suites.
- Implement linting rules for logtime, globaldictset, generatehmacmessage, and stringbuilder functions.
- Implement automatic AI skill synchronization for Claude, Cursor, and Copilot tools.
- Implement automated AI skill synchronization for Claude, Cursor, and Copilot via native project configuration files.

## [1.24.0] - 2026-07-09

### Added
- Bump version to 1.23.0 and add BML language support with AI skill synchronization and MCP integration.
- Implement automated project-specific AI skill synchronization for Claude, Cursor, and Copilot tools.
- Implement comprehensive BML language support including linting, beautification, AI-assisted skills, and MCP integration.
- Implement comprehensive linting, MCP support, AI skill enhancements, and expanded test coverage for BML development tools.

## [1.23.0] - 2026-07-09

### Added
- Implement automated project-specific AI skill synchronization for Claude, Cursor, and Copilot tools.
- Implement comprehensive BML language support including linting, beautification, AI-assisted skills, and MCP integration.
- Implement comprehensive linting, MCP support, AI skill enhancements, and expanded test coverage for BML development tools.

## [1.22.0] - 2026-07-09

### Added
- Implement automatic AI skills setup with brotli decompression and target file generation.

## [1.21.0] - 2026-07-09

### Added
- Implement AI Agent Skills (AgentSkills.io) integration, shipping with 8 pre-compiled semantic skills to inject CPQ and BML domain knowledge into AI assistants.
- **Zero-Config AI Setup:** Enabling the MCP server automatically scaffolds `.agents/skills.json`, `CLAUDE.md`, and `.cursorrules` to route assistants to the skills library.
- **Payload Optimization:** The AI skills markdown knowledge base is compressed into a tiny `.br` archive at build time and excluded from the `.vsix` payload. It decompresses directly to VS Code's global storage directory at runtime.
- Implement settings panel UI and core spellchecker functionality with associated test suites.
- Implement MCP server with tool definitions for CPQ function lifecycle, testing, formatting, and status operations.

### Removed
- Removed the `CPQ-BML: Enable AI Agent Skills for this Workspace` manual command (setup is now fully automated when MCP is enabled).

## [1.20.0] - 2026-07-09

### Added
- Implement table formatting for BML debug document attribute dumps and command output.
