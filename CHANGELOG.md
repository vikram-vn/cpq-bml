# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.21.0] - 2026-07-09

### Added
- Implement AI Agent Skills (AgentSkills.io) integration, shipping with 8 pre-compiled semantic skills to inject CPQ and BML domain knowledge into AI assistants.
- Implement AI workspace skill integration and add comprehensive BML language linting, intellisense, and documentation tools.
- Implement settings panel UI and core spellchecker functionality with associated test suites.
- Implement new settings GUI dashboard with modular webview tabs and integrated linting and spelling utilities.
- Implement MCP server with tool definitions for CPQ function lifecycle, testing, formatting, and status operations.
- Implement text-based table formatting for debug outputs with word-wrapping and border support.

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

## [1.16.1] - 2026-07-03

### Changed
- Internal maintenance and housekeeping updates.

## [1.16.0] - 2026-07-03

### Added
- Add documentation formatting utility and ensure offline help links resolve against both raw and compressed files.

## [1.15.0] - 2026-07-03

### Added
- Implement linting and spell-check support for CPQ system variables.
- Add GitHub Actions workflow to automate extension packaging and releases.
