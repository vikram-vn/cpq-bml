# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.3.8]

### Added

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
- **More ESLint-inspired checks**: `AND`/`OR` mixed without grouping parentheses in an `if`/`elif` condition (`no-mixed-operators`); an `else` block containing nothing but a single `if` statement, which BML's dedicated `elif` keyword exists specifically to avoid (`no-lonely-if`); a bare comparison statement with no effect, almost always a typo for `=` or a forgotten `if` (`no-unused-expressions`); and - scoped to util library functions only, since commerce functions have too many implicit platform-provided bindings to check safely - a variable read before its own later assignment in the same file (`no-undef`/use-before-define). Verified against the entire real corpus, including finding a genuine pre-existing bug copy-pasted across three near-duplicate utility functions (`abo_updateAsset`/`abotester_doUpdateAsset`): `curAssetKey` is compared before it's ever assigned, despite a comment claiming it's pre-initialized.
- Added a permanent regression-guard test that lints every real `.bml` file in `bml/library` through the actual linter entry point on every test run, confirming no rule ever throws against real-world code.

### Fixed

- **Storage-type constructor false positives**: `Float(...)`, `Boolean(...)`, `Date(...)`, `Record(...)`, and `Dictionary(...)` calls were incorrectly flagged as "Unknown built-in function" - these are valid BML storage types (per `bml.tmLanguage.json`'s grammar) with no entry of their own in `common.json`.

## [1.1.1]

### Added

- **BML Better Comments**: tagged comment highlighting (`!`, `?`, `*`, `//`, `TODO`, `FIXME`, `BUG`, `WARNING`, `IMPORTANT`, `HACK`, `XXX`, `NOTE`, `OPTIMIZE`, `IDEA`), distinct highlighting for functional directive comments (`// bml-lint-disable*`, `/* beautify ignore:start/end */`) with hover tooltips explaining exactly what each one does, and automatic detection/styling of BML doc-header comment blocks (`Function Name:`, `Description:`, `Inputs:`, `Return:`). Toggle with the new `cpqBml.features.comments` setting.
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
