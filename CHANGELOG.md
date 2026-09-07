# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.79.0] - 2026-09-07

### Added

- Add bug icon SVG for debugging functionality.
- Add debug icon SVG to assets.
- Add debug icon as SVG asset.

## [1.78.0] - 2026-09-07

### Added

- Implement MCP tool integration with secure output scrubbing and headless VS Code proxying.
- Add transaction retrieval module and register MCP tools for BML search and commerce lookups.
- Add commerce deployment icon and context tracking to distinguish between commerce and utility BML files.
- Implement REST pull command for library and commerce functions.
- Add unused variable linter rule with comprehensive test coverage.

## [1.77.0] - 2026-09-07

### Added

- Add BML web crawler utility to fetch and convert documentation to markdown.
- Introduce dynamic folder icons, CPQ documentation crawler, and project spelling dictionary support.
- Add BML logo assets and generation script.
- Add icon definitions and icon optimization script.
- Add new material folder icons to library.
- Implement icon set management with new configuration, optimization script, and packaging workflow.
- Introduce BML icon set with build script, language definitions, and folder rules.

## [1.76.0] - 2026-09-06

### Added

- Add BML icon asset, generation script, and configuration index.

## [1.75.0] - 2026-09-06

### Added

- Implement dynamic folder icon synchronization and optimize build pipeline with native Node.js compilation.
- Add bml-icons.json icon definitions file.
- Add custom folder icons for beautify, metrics, bml, and xml to icon theme definitions.

## [1.74.0] - 2026-09-06

### Added

- Auto-activate BML icon theme on startup and provide manual activation command.
- Implement native Node.js build script and configure minified icon theme usage.
- Add logo assets and SVG generation scripts.
- Add new material icons for various file types and folders.

## [1.73.0] - 2026-09-06

### Added

- Implement MCP tools for BML script management and global search with documentation support.

## [1.72.0] - 2026-09-06

### Added

- Add build script for AI skill directory and initialize knowledge base documentation.
- Implement BML snippets for IntelliSense and add linting rules for magic numbers.
- Add spelling dictionary module and custom configuration for VS Code spell checker.
- Add new BML benchmark fixture files for stress and performance testing.

## [1.71.0] - 2026-09-06

### Added

- Add BML language reference guide and custom IDE intellisense snippets.
- Add linter rule to detect unused BML expressions and include corresponding tests.
- Implement BML static type checking and linting rules for variables and expressions.
- Support `Dict`, `Map`, and `Set` suffixes for dictionary variable naming convention (`bml-dict-naming-suffix`).
- Support `Items` and `Entries` suffixes for array variable naming convention (`bml-array-naming-suffix`).
- Add variable naming convention rules for `json` (`bml-json-naming-suffix`), `jsonarray` (`bml-jsonarray-naming-suffix`), `date` (`bml-date-naming-suffix`), and `stringbuilder` (`bml-stringbuilder-naming-suffix`) with Quick Fix support.

### Fixed

- Elevate consecutive semicolons (`;;`) to a syntax error.
- Disallow direct invocation of `range(...)` in `for..in` loops, requiring collection assignment first.
- Resolve double-parentheses insertion when autocompleting functions in the editor.
- Update custom snippets with valid delimiter formats.

## [1.70.1] - 2026-08-31

### Changed

- Performance optimizations, benchmark fixtures, and stability enhancements.
