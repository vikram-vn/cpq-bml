# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

## [1.66.0] - 2026-08-30

### Added

- **Homogeneous Typed Dictionary Static Analysis**: Added compile-time validation for `put(dictVar, key, value)` against declared element types (`dict("integer")`, `dict("string")`, `dict("date")`, `dict("float")`, `dict("boolean")`, `dict("json")`, `dict("jsonarray")`) with rule `bml-dict-put-type-mismatch`.
- **Compile-Time Array Bounds Checking**: Added static analysis for constant index expressions on sized constructors (`type[size]`) and literal array initializers (`type[]{...}`) with rule `bml-array-bounds-error`.
- **JSONPath Filter, Slice & Aggregation Completions**: Added autocompletions for JSONPath aggregations (`.min()`, `.max()`, `.sum()`, `.avg()`, `.stddev()`), boolean filters (`[?(@.active == true)]`), set filters (`[?(@.field in ['A', 'B'])]`), and slices (`[:2]`, `[1:3]`).
- **Advanced BMQL Query Autocompletions**: Added BMQL query templates for IN array filtering, LIKE wildcard pattern matching, BETWEEN range queries, and dynamic query variable substitution.
- **Typed JSON & JSONPath Snippets**: Added `jsonget-typed`, `jsonpath-get-typed`, and `jsonarray-get-typed` snippets with inline type choices.
- **Depth-Aware Signature Help**: Enhanced parameter tracking across nested sub-calls and isolated commas inside inline array literals (`String[]{"a", "b"}`) and bracket indices.
- **System Constant Categorization & Hover Badges**: Reclassified all 21 `BM_*` system constants to `"constant"`, rendering `(constant)` and typed metadata (`*constant · String*`, `*constant · Float*`, `*constant · Integer*`).
- **Rich Inlay Hint Tooltips**: Added Markdown tooltips to inferred type inlay labels detailing manipulation methods and iteration semantics.

## [1.65.0] - 2026-08-30

### Added

- Implement BML intellisense engine with function metadata and testing infrastructure.
- Implement BML intellisense generation scripts and metadata configuration.
- Implement docFormatting utility for generating BML hover tooltips.
- Implement automated BML documentation extraction and hover-ready formatting pipeline.

## [1.64.0] - 2026-08-30

### Added

- Implement BML documentation crawler and post-processing scripts to sync CPQ help content into knowledge directory.
- Implement BML documentation crawler and create directory for knowledge assets.
- Add BML code quality linter for empty blocks, magic numbers, and missing returns.
- Implement performance linting rules, diagnostic code actions, and custom snippets for BML optimization.
- Add BML documentation crawler and comprehensive knowledge base reference.
- Add BML function metadata and documentation formatting utilities for intellisense support.

## [1.63.0] - 2026-08-30

### Added

- Implement BML documentation crawler and post-processing scripts to sync CPQ help content into knowledge directory.
- Implement BML documentation crawler and create directory for knowledge assets.
- Add BML code quality linter for empty blocks, magic numbers, and missing returns.
- Implement performance linting rules, diagnostic code actions, and custom snippets for BML optimization.
- Add BML documentation crawler and comprehensive knowledge base reference.
- Add BML function metadata and documentation formatting utilities for intellisense support.
