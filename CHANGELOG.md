# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

## [1.19.0] - 2026-07-08

### Added
- Implement MCP tools for status reporting and BML function management.
- Add settings panel for configuration management and implement debug dump table visualization.

## [1.18.0] - 2026-07-07

### Added
- Implement MCP tools for BML lifecycle management, including AI-copy isolation, validation, deployment, and debug execution.
- Implement MCP tools for BML lifecycle management, including file operations, deployments, and overrides.
- Implement MCP tools for local BML knowledge, including function explanation, diffing, searching, and linting.

## [1.17.2] - 2026-07-07

### Changed
- MCP server error fix.


## [1.17.1] - 2026-07-04

### Changed
- Internal maintenance and housekeeping updates.

## [1.17.0] - 2026-07-04

### Added
- Implement BML intellisense engine with automated API data loading and discovery scripts.
- Implement offline function documentation extraction and pre-packaging for improved hover performance.
- Implement high-performance, Docusaurus-aware offline help viewer with cached rendering and Brotli support.

### Fixed
- Correct relative image paths in String.md and add regression test for broken documentation links.
