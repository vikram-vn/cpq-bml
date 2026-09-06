# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

## [1.70.0] - 2026-08-31

### Added

- Implement linting aggregation logic for CPQ BML best practices and language-specific rules.
- Implement linting engine with performance benchmarks and core static analysis rules.

## [1.68.0] - 2026-08-31

### Added

- Implement BML style code actions and add initial beautifier infrastructure with tests.
- Implement BML static type checking for variable reassignments and binary expressions.

## [1.67.0] - 2026-08-30

### Added

- Add BML language keyword and constant hovers with supporting tests.
