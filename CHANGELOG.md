# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.7.0] - 2026-07-02

### Added
- Add comprehensive BML linting engine and unreachable code detection diagnostics.
- Implement settings panel UI and core linting logic for CPQ integration.
- Implement BML best-practice linting for function constraints and literal misuses.
- Add Markdown documentation transformer and BML crawler scripts.
- Reorganize BML documentation scripts into a sub-directory and add web crawler utilities.
- Add bml_crawler and bml_intellisense scripts with html-to-markdown conversion tools and linting rules.
- Implement comprehensive BML linting framework with style, performance, and best practice rules.
- Add release automation script to manage versioning, changelogs, and build packaging.

## [1.6.0] - 2026-07-01

### Added
- Implement custom Markdown help viewer with admonition support and caching.
- Implement BML language support including tokenization, linting, and intellisense features.

## [1.5.0] - 2026-07-01

### Added
- Add BML knowledge base documentation and crawler support for BML accordion components.
- Implement HTML-to-Markdown conversion utilities and BML-specific document formatting modules.
- Add post-processing script to format BML documentation into Docusaurus-compatible markdown files.
- Add postprocessing script to normalize and format BML markdown documentation.
- Add BML language reference documentation and implement a BML crawler script.
- Implement BML intellisense provider and add scripts for documentation and API metadata generation.
- Add BML knowledge base documentation and initialize intellisense generation scripts.
- Add BML knowledge base documentation and crawler utility scripts.
- Add comprehensive BML documentation, image assets, and automated intellisense generation scripts.
- Add BML function documentation and conversion script for CPQ knowledge base.
- Add comprehensive BML documentation and import script for CPQ knowledge base.
- Add linter test cases and utility for regenerating expected linting results.
- Implement BML linter and add automated test expectation generation.

### Documentation
- Add BML function library documentation and associated instructional images.
- Initialize knowledge base for Oracle CPQ BML functions and editor documentation.

## [1.4.4]

### Added
- Standardized all codebase filenames to use **camelCase** for consistency across core logic and tests.
- Implemented `index.js` entry-points for all sub-feature modules (`app/lang/metrics` and `app/lang/testing`).
- Re-architected `extension.js` imports to require from clean modular directory entrypoints.
- Integrated central toggle controls in the settings panel WebView for all core BML extension features (Beautifier, IntelliSense, Doc Header, XSLT, Metrics, and Testing).
- Enforced dynamic configuration checks across all extension feature modules to respect the toggled settings.

## [1.4.0]

- **Phase 1: Additional Linting Rules**:
  - Null Safety Check (`bml-null-check-required`) warning.
  - Type Coercion / Concatenation Mismatch (`bml-concat-type-mismatch`) warning.
  - Infinite / Empty Loop Checker (`bml-empty-loop`) warning.
- **Phase 2: Developer Experience LSP Navigation**:
  - Workspace index scanner for `util.*` and `commerce.*`.
  - Go to Definition, Find All References, Rename, and Document Outline Symbols.
  - Extended Hover documentation with parameter lists, return types, and Javadoc-style headers.
- **Phase 3: Code Metrics WebView Report**:
  - Cyclomatic complexity, brace nesting depth, and non-empty line counts.
  - Dashboard WebView panel with sortable metrics table.
- **Phase 4: MCP AI Tools**:
  - `explain_function`: returns offline documentation, signatures, and code previews.
  - `diff_function`: returns unified line-by-line local vs remote diff.
  - `search_functions`: full-text local codebase search sorted by match count.
- **Phase 5: BML Testing Framework**:
  - BML Test Runner (`cpqBml.test.runTests`) executing local `*.bmltest.json` test cases against CPQ sandbox.
  - Regression Snapshot testing (`cpqBml.test.updateSnapshot` / `compareSnapshot`) flagging changes as editor diagnostics.
- **Phase 6: Formatting & Snippets**:
  - Auto Doc-Header completion (`///` trigger) generating comment blocks prefilled from sidecar `metadata.json`.
  - 6 new Smart Snippets: `bmql-safe`, `bmql-loop`, `sb-concat`, `null-guard`, `split-safe`, and `try-atoi`.

- **Performance linting** (`app/lang/lint/performance.js`): five new rule categories run on every save:
  - _Nested loops_ — warns when a `for` loop is nested inside another `for` loop (negative performance impact).
  - _BMQL inside loops_ — flags any `bmql(...)` call whose position falls inside a loop body; recommends moving the query outside.
  - _String concatenation in loops_ — detects self-concatenation patterns for string/return accumulator variables inside loops; recommends `sbappend`/`sbtostring` (StringBuilder).
  - _Repeated identical BMQL queries_ — normalises whitespace and lowercases query text; flags every duplicate occurrence after the first.
  - _Excessive same-table queries_ — when the same table is queried more than twice, flags all occurrences and recommends combining queries.
  - _Deep nesting_ — warns when brace nesting depth exceeds 3.
  - _High cyclomatic complexity_ — counts decision keywords (`if`, `elif`, `for`, `and`, `or`); warns when the total exceeds 15 and recommends helper-function refactors.

- **Extended style linting** (`app/lang/lint/style.js`): three new rule categories:
  - _Multiple statements per line_ — warns when two or more semicolons appear on one line of code.
  - _`not` without parentheses_ — catches `not x` (where `x` is a variable) and requires `not(x)`.
  - _Unguarded `print()` calls_ — `print(...)` outside a `if (debug) { ... }` block is flagged as an info diagnostic.
  - _Line length_ — lines exceeding 200 characters of non-comment code produce a warning with the actual character count.

- **Extended bestPractices linting** (`app/lang/lint/bestPractices.js`): nine new rule categories beyond what was previously checked:
  - _`SELECT _`in BMQL* — warns when a BMQL query literal uses`SELECT \*`; recommends explicit column lists.
  - _Division by literal zero_ — parses the full numeric literal to avoid false positives on `/ 0.5`; flags only genuine `/ 0` (runtime exception).
  - _Float direct equality comparison_ — warns when a variable is compared to a float literal with `==` or `!=`; recommends a tolerance threshold.
  - _Hardcoded URLs_ — flags `"https://..."` string literals (excluding well-known schema URIs like `w3.org`); recommends Data Tables or System Variables.
  - _`dict()` with no type argument_ — `dict()` compiles but throws at runtime; the rule requires e.g. `dict("string")` and carries code `bml-dict-missing-type`.
  - _Array element assignment_ — `arr[i] = value` is a BML syntax error; recommends `append()` / `insert()` instead.
  - _`break`/`continue` outside a loop_ — tracks brace/loop structure and flags these control-flow keywords when they appear outside any loop body.
  - _Invalid member access / method call_ — detects dot-notation on non-`util`/`commerce` identifiers (e.g. `x.length`, `x.doSomething()`); recommends BML built-in alternatives.
  - _`_config_attributes` / `_config_attr_text` ban_ — these hidden system attributes must never be used in Commerce BML.

- **Enhanced inline suppression system** (`app/lang/lint/suppressions.js`):
  - Directives are now **fully case-insensitive** — `// Bml-Lint-Disable-Next-Line` works identically to the all-lowercase form.
  - **Block-comment directives** — `/* bml-lint-disable-next-line */` and `/* bml-lint-disable-line */` are now recognised and processed with the correct line mapping derived from the full source offset.
  - **No-space directives** — `//bml-lint-disable-line` (no space after `//`) is accepted.
  - **Comma-separated code lists** — `// bml-lint-disable-next-line bml-operator-fix, bml-spelling-error` correctly parses both codes.
  - **Targeted-code suppression** — when codes are listed, only diagnostics whose `.code` matches one of those codes are suppressed; a directive targeting a different code no longer accidentally suppresses unrelated diagnostics.
  - Exported `describeLintDirective(commentText)` now has a dedicated non-global regex to avoid shared `lastIndex` state across callers.

- **Comprehensive suppression test suite** (`test/linter/suppressions.test.js`, `test/spellCheck/suppression.test.js`): edge-case tests covering block-comment next-line, no-space directives, comma-separated code lists, mixed-case directives, same-line block comments, non-`bml-`-prefixed explanations, targeted single-code suppression, and file-wide suppression placement.

### Fixed

- Suppression directives placed inside `/* block comments */` that span a single line now map to the correct source line number; previously the line was computed from the start of the comment rather than the position of the directive match within it.
- A targeted `bml-lint-disable-line bml-some-other-code` comment no longer suppresses diagnostics with a different code (regression introduced when the fallback detection loop was added).

## [1.3.8]

### Added

- **Built-in function argument type checking**: flags a call argument whose literal type (string/integer/float/boolean/typed-array/constructor) doesn't match the corresponding parameter's declared type in a built-in function's signature (e.g. `atoi(5)` instead of `atoi("5")`). Conservative by design - only checks arguments whose type is unambiguous from the literal text itself (variables and general expressions are never flagged), and allows passing an Integer literal where a Float parameter is expected.
- **"Did you mean" suggestions for unknown function calls**: an unrecognized bare function call now suggests the closest real built-in name when it's a near-exact typo (e.g. `atfo("5.0")` suggests `atof`), with a matching Quick Fix to apply it.

### Fixed

- **Built-in function argument-count accuracy**: rewrote the functionSignature parser (`app/lang/lint/functionSignature.js`) to correctly handle Oracle's "cascading" nested-optional parameter notation (e.g. `datetostr(Date date [, String dateFormat [, String timeZone]]))`), which the previous naive comma-split parser mis-classified - sometimes under-counting required parameters (so a genuinely-missing required argument went unflagged), sometimes over-counting them. Signatures using a non-standard polymorphic "Type(or Type2, Type3)" union notation (`max`, `min`, `put`, `get`, ...) or describing a truly variadic function (`sbappend`) are now detected and excluded from count/type validation entirely, rather than being checked against a guessed (and wrong) shape.
- Function-call diagnostics (`bml-unknown-function`, `bml-function-arg-count`, `bml-function-not-found-workspace`) now carry a `code`, so lint-suppression directives and downstream tooling can target them individually.

## [1.3.0]

### Added

### Fixed

- **Linting Path Resolution Issues**: Resolved several path resolution edge cases that could prevent BML linting from correctly locating workspace metadata, library resources, and supporting configuration files in certain workspace layouts.
- **Spell Checker Path Resolution Issues**: Fixed path discovery and file resolution problems affecting the native BML spell checker, ensuring consistent dictionary loading and workspace-aware validation across multi-folder and nested workspace configurations.
- Fixed various linting and spell-check false positives caused by missing or incorrectly resolved project resources.

### Improved

- Increased overall test suite coverage across language services, diagnostics, and extension activation workflows.
- Enhanced validation of real-world Oracle CPQ BML code patterns through broader regression testing against production-like code samples.

## [1.2.0]

### Added

- **BML Function & Parameter Linter**: Validates parameter counts for standard BML built-in functions against signatures in `common.json`, and warns about unknown bare function calls.
- **Custom Workspace Function Validation**: Validates custom workspace utility and commerce library calls (`util.name()` and `commerce.name()`) against parameters in their metadata files, checking counts and existence.
- **CPQ System Variable Checks**: Using Oracle's own predefined system variable catalog (`commonVariables.json`), the linter now warns when code assigns to a read-only system variable (`_user_*`, `_site_*`, ...) - a silent no-op on the real platform - and suggests the correct name when a bare underscore-prefixed identifier is a near-exact typo of one (e.g. `_user_nam` → "did you mean `_user_name`?").
- **Variable Type Consistency Checking**: BML variables are statically typed by their first assignment, and CPQ's compiler rejects reassigning one to a value of a different type later in the same script (e.g. `test = 1;` ... `test = "2";`). The linter now infers the type of literal assignments - primitives (String/Integer/Float/Boolean), typed arrays (`string[]{...}`, `integer[][]{...}`), and type-named constructors (`dict()`, `json()`, `jsonarray()`, `bytearray()`, `stringbuilder()`, `recordset()`) - and flags any later assignment whose literal type conflicts, as an Error. Deliberately conservative: skips anything that isn't an unambiguous literal (function calls, concatenation, variable references) rather than guess.
- **Metadata Sidecar Type Validation**: using Oracle's `functionParamDataTypes.json`/`functionReturnTypes.json` lookup tables, the linter cross-checks a function's local `-meta.json` sidecar for internal consistency (catching a corrupted/hand-edited sidecar where `dataType.value`/`returnType.value` no longer matches its own `displayValue`) and flags a `return <literal>;` whose type conflicts with the function's own declared return type. A function's declared parameter types now also seed the variable type-consistency check above, so reassigning a parameter to a conflicting literal type is caught too.
- **Dead-code checks inspired by ESLint/RuboCop**: always-true/always-false `if`/`elif` conditions (`if (true)`) and self-comparisons (`if (x == x)`); unreachable code after an unconditional `return`/`break`/`continue`/`throwerror(...)`; and a duplicate condition later in the same `if`/`elif` chain that can never run since an earlier, identical branch already caught it. Verified against the entire real `bml/library` corpus before shipping - and in the process, found and would now flag a genuine duplicate-branch bug already present in `oRCL_OSC_TransactionStatus.bml` (`status == "DELETED"` checked twice in one chain).
- **More ESLint-inspired checks**: `AND`/`OR` mixed without grouping parentheses in an `if`/`elif` condition (`no-mixedOperators`); an `else` block containing nothing but a single `if` statement, which BML's dedicated `elif` keyword exists specifically to avoid (`no-lonelyIf`); a bare comparison statement with no effect, almost always a typo for `=` or a forgotten `if` (`no-unusedExpressions`); and - scoped to util library functions only, since commerce functions have too many implicit platform-provided bindings to check safely - a variable read before its own later assignment in the same file (`no-undef`/useBeforeDefine). Verified against the entire real corpus, including finding a genuine pre-existing bug copy-pasted across three near-duplicate utility functions (`abo_updateAsset`/`abotester_doUpdateAsset`): `curAssetKey` is compared before it's ever assigned, despite a comment claiming it's pre-initialized.
- Added a permanent regression-guard test that lints every real `.bml` file in `bml/library` through the actual linter entry point on every test run, confirming no rule ever throws against real-world code.

### Fixed

- **Storage-type constructor false positives**: `Float(...)`, `Boolean(...)`, `Date(...)`, `Record(...)`, and `Dictionary(...)` calls were incorrectly flagged as "Unknown built-in function" - these are valid BML storage types (per `bml.tmLanguage.json`'s grammar) with no entry of their own in `common.json`.

## [1.1.1]

### Added

- **BML Better Comments**: tagged comment highlighting (`!`, `?`, `*`, `//`, `TODO`, `FIXME`, `BUG`, `WARNING`, `IMPORTANT`, `HACK`, `XXX`, `NOTE`, `OPTIMIZE`, `IDEA`), distinct highlighting for functional directive comments (`// bml-lint-disable*`, `/* beautify ignore:start/end */`) with hover tooltips explaining exactly what each one does, and automatic detection/styling of BML docHeader comment blocks (`Function Name:`, `Description:`, `Inputs:`, `Return:`). Toggle with the new `cpqBml.features.comments` setting.
- **Features Tab**: Added a dedicated "Features" tab to the settings panel webview to group BML Linting and BML Better Comments configurations.
- **BML Color Themes**: four bundled VS Code color themes (`Ctrl+K Ctrl+T` → "BML Dark", "BML Dark Default", "BML Light", or "BML Light Default") with full-language token coverage plus a BML-specific richness layer - built-in functions tinted by category (string/math/date/database/url/array/dictionary/xml/json/misc), CPQ attribute/member access tinted separately from plain variables and from each other (line-level vs transaction-level vs generic member), and assignment/comparison/arithmetic/logical operators each given their own color.

### Changed

- **BML syntax colors are now theme-driven, not automatic**: removed the `editor.tokenColorCustomizations` forced into every user's settings via `configurationDefaults` (it auto-applied regardless of the active theme, and conflicted with BML Better Comments' own decoration colors). BML-specific syntax richness now only shows up while one of the bundled BML color themes is selected.

### Fixed

- **Settings Panel Crash**: Resolved a runtime crash (`TypeError: Cannot read properties of undefined (reading 'enable')`) that occurred when opening the settings webview.
- **Production builds**: the packaged extension's JS (including the settings panel's React webview bundle) is now built with `NODE_ENV=production`, stripping React's development-only warning code from the shipped VSIX.
- **BML built-in function categorization**: cross-checked the grammar's per-category function lists against Oracle's own CPQ BML function catalog (`app/lookups/bml/common.json`) and fixed several mismatches that caused wrong colors - `getbom`/`getconfigattrvalue`/`getconfigbom`/`getoldvalue` were tinted as "database" but are actually general-purpose (`OTHERS`); `globaldictget`/`globaldictset`/`globaldictremove` were tinted as "dictionary" but are also `OTHERS`; `min`/`max` were duplicated under "math" (shadowing their correct `ARRAY` color); fixed a `jsonarrayref` typo (real function is `jsonarrayrefid`) and added the missing `jsonarrayremove`. Also added previously-uncategorized real functions (`find`, `calculateconfiguration`, `configureabo`, `getarrayattrstring` (was misspelled `getarraystr`), `getcoveragesupportdict`, `getsystemattrvalues`, `getsystemdata`, `getsystemmultipleattrvalues`, `setattributevalue`, and fixed `saveconfig` → `saveconfigbom`).

## [1.1.0]

### Added

- Initial release: syntax highlighting, IntelliSense, snippets, and BML-aware formatting for `.bml` files.
- **BML REST**: live integration with Oracle CPQ — pull, validate, save, debug, and deploy Util Library Functions and Commerce Process Functions directly from VS Code, including individual and mass deploy, standard-function overrides, and multi-environment switching.
- **MCP Server**: an in-process Model Context Protocol server so AI agents (Claude Code or any MCP-compatible client) can drive BML REST directly — pull, edit, validate, debug, and deploy functions — without the agent ever seeing your CPQ credentials.
- MCP tools now always edit a `<variableName>-AI` working copy rather than the pulled file itself, so the original stays available as a diff baseline and a re-pull can never clobber in-progress AI edits.
- Every MCP tool call (list, pull, save, validate, debug, deploy, mass deploy, deploy commerce process, create) now always returns a full progress/outcome log in its result. Set the new `cpqBml.mcp.logToTerminal` setting (off by default) to also stream that log live into a dedicated "CPQ-BML (AI)" integrated terminal.
- Human-triggered Pull (util and commerce) now logs to the "CPQ-BML" terminal too, matching Save/Validate/Debug/Deploy - previously it only showed toast notifications, with no terminal record of what was fetched or why a fetch failed.
- **CPQ-BML: Open Settings**: a single WebView form for everything previously spread across Settings UI + several commands - site URL, username, password/token (write-only, never displayed back), multiple environments (add/edit/activate/delete), REST API version, commerce process/document, pull folder, and every MCP/lint/debug toggle - plus a one-click Test Connection check. Opens automatically once, the first time the extension activates after install.
