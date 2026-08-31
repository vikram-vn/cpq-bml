# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

## [1.62.0] - 2026-08-30

### Added

- Implement BML documentation crawler and post-processing scripts to sync CPQ help content into knowledge directory.
- Implement BML documentation crawler and create directory for knowledge assets.
- Add BML code quality linter for empty blocks, magic numbers, and missing returns.
- Implement performance linting rules, diagnostic code actions, and custom snippets for BML optimization.
- Add BML documentation crawler and comprehensive knowledge base reference.
- Add BML function metadata and documentation formatting utilities for intellisense support.

## [1.61.0] - 2026-08-29

### Added

- Add BML code snippets, linting rules, and corresponding unit tests.

## [1.60.0] - 2026-08-29

### Added

- Add automated BML function documentation parser and intellisense support scripts.
- Introduce automated benchmarking suite for code actions and fix-all subsystems.

## [1.59.0] - 2026-08-29

### Added

- Implement comprehensive linting engine with modular rule sets and performance benchmarking.
- Implement bulk code action for safe style and naming fixes and add common benchmark scripts.
- Implement comprehensive Python-based benchmarking suite for extension subsystems.
- Implement BML comment decorations and extend intellisense with workspace indexing capabilities.
- Implement BML tokenizer with support for BMQL and JSON string formatting.
- Implement BML tokenizer with BMQL query formatting and array literal detection support.

### Documentation

- Update license file reference in README.md.
