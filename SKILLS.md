# CPQ-BML Contributor Guide

This file documents how *this specific* extension is actually built, so a
contributor (human or AI) with zero prior context can be productive on day
one without re-deriving the architecture from scratch. It is not generic VS
Code extension advice - it is grounded in this repo's real files, real test
runs, and lessons learned the hard way across past sessions.

**Stack reality check** (don't assume otherwise): plain CommonJS JavaScript,
no TypeScript anywhere, no `src/` folder. Source lives under `app/lang/`,
tests under `test/`, mirroring each other. esbuild bundles to
`dist/extension.js` for the real Node-side extension; a separate esbuild
invocation bundles a React webview to
`app/lang/settingsPanel/webview/dist/main.js`.

---

## 1. Activation flow

`extension.js` (repo root) is the single entry point. `activate(context)`
calls one `register<Feature>(context)` per module, in this order:

```js
registerBeautifier(context);        // ./app/lang/beautify
registerBmlIntelliSense(context);   // ./app/lang/intellisense
registerBmlLinter(context);         // ./app/lang/lint
registerBmlComments(context);       // ./app/lang/comments
registerBmlRest(context);           // ./app/lang/rest
registerMcp(context);               // ./app/lang/mcp
registerSettingsPanel(context);     // ./app/lang/settingsPanel
```

Plus one inline command (`cpqBml.beautifyWorkspace`) registered directly in
`extension.js`. There is no top-level gating - every module always
registers; each module decides internally (via its own config reads) whether
to actually do anything.

Adding a new top-level feature module follows this exact shape: a folder
under `app/lang/`, an `index.js` exporting `register<Name>(context)`, called
from `extension.js`.

## 2. Module map

| Module | Entry export | `vscode` required at | Purpose |
|---|---|---|---|
| `app/lang/beautify/` | `registerBeautifier` | top-level | Document/range formatting providers; delegates to pure logic in `./bml/` |
| `app/lang/intellisense/` | `registerBmlIntelliSense` | top-level | Completion + hover, data-driven from JSON files in this folder (`bml_*_api_usage.json`, `custom_snippets.json`) |
| `app/lang/lint/` | `registerBmlLinter` | top-level (in `index.js`; pure rule files do not) | Diagnostics - see section 3, the largest and most actively developed module |
| `app/lang/comments/` | `registerBmlComments` | top-level | Tag/directive/docHeader comment decorations + hover, debounced like the linter |
| `app/lang/rest/` | `registerBmlRest` | via `./commands/index.js` | Live Oracle CPQ REST integration: pull/save/validate/debug/deploy |
| `app/lang/mcp/` | `registerMcp` | inside the function, not top-level | MCP server so an AI agent can call the REST tools directly over localhost |
| `app/lang/settingsPanel/` | `registerSettingsPanel` | inside the function, not top-level | WebView settings UI (React, see section 6); auto-opens on first install if workspace looks unconfigured |
| `app/lang/spellCheck/` | `checkSpelling` (no `register*`) | none - takes `vscode` as a parameter | Pure spell-checker; called as a sub-step *from inside* `lint.js`, not from `extension.js` - see section 3 |
| `app/lang/syntaxes/` | n/a (JSON only) | n/a | `bml.tmLanguage.json` TextMate grammar, referenced from `package.json` |

**Why the `vscode`-at-top-level column matters:** any file with
`const vscode = require('vscode')` at module scope cannot be `require()`d
from a plain `node` script - only from inside the real extension host (or
`npx vscode-test`). Several lint rule files deliberately avoid this so they
can be unit-tested or corpus-verified with plain `node` - see section 4.

## 3. The lint pipeline (`app/lang/lint/`)

This is the densest, most-extended part of the codebase. `index.js` is the
*wiring* layer: debounces re-lint on open/change/save (300ms), reads the two
feature flags, and calls into `lint.js`. `lint.js` is the *orchestrator*:
it does **not** depend on `vscode` at module scope (`vscode` is passed in as
a parameter to `lintBMLCustom(doc, diagnosticCollection, vscode)`), which is
what makes it possible to corpus-verify against real `.bml` files with plain
`node` before ever touching the real extension host.

### Pipeline shape

```js
function lintBMLCustom(doc, diagnosticCollection, vscode) {
    const text = doc.getText();
    const isLintEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
    const isSpellingEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.spelling', true);

    const commentRanges = getCommentRanges(text);
    const conditionRanges = getConditionRanges(text);
    const cleanText = blankRanges(text, commentRanges);          // comments -> spaces, strings intact
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = blankRanges(cleanText, stringRanges);  // comments AND strings -> spaces

    if (isLintEnabled) { /* ~20 checkXxx(...) calls, see below */ }
    if (isSpellingEnabled) { diagnostics.push(...checkSpelling(text, cleanText, noStringsText, doc, vscode)); }

    const suppressions = computeSuppressions(text, commentRanges);
    const visible = diagnostics.filter(d => !suppressions.isSuppressed(d.range.start.line, d.code));
    diagnosticCollection.set(doc.uri, visible);
}
```

**`blankRanges` preserves `\n`/`\r`** while blanking everything else in a
range to spaces - this keeps every later `doc.positionAt(index)` call
correct without re-deriving line numbers. Never replace this with a naive
`' '.repeat(...)` substring removal; that collapses multi-line block
comments and shifts every line number after them.

**Which text variant to pass each rule** is not arbitrary - get this wrong
and you reintroduce a real bug class this codebase has already hit twice:
- `cleanText` (comments blanked, strings intact): for anything that needs
  to inspect literal string *content* - e.g. comparing condition text like
  `x == "a"` vs `x == "b"`. Running this kind of check on `noStringsText`
  instead silently collapses different string literals to the same blanked
  text and produces false "duplicate"/"identical" matches.
- `noStringsText` (comments AND strings blanked): for anything that should
  ignore string contents entirely - bracket/paren depth tracking, variable
  name scanning (so a variable name occurring inside an unrelated string
  literal isn't mistaken for a real reference).

**Diagnostics share precomputed derived data instead of each rule
re-deriving it.** `conditionRanges` (from `getConditionRanges`) and
`conditionalChains` (from `parseConditionalChains`) are each computed once
in `lint.js` and passed into every rule that needs them
(`checkConstantConditions`, `checkMixedOperators`,
`checkDuplicateConditionBranches`, `checkLonelyIf`) rather than each rule
calling the deriving function itself. This was a real, measured performance
fix (~23% faster on the largest real corpus file) - don't reintroduce a rule
that silently re-derives one of these itself.

**Every diagnostic that should be individually suppressible gets a
`diag.code` string** (e.g. `'bml-constant-condition'`,
`'bml-useBeforeDefine'`). `computeSuppressions` (in `suppressions.js`)
makes every coded diagnostic automatically respect
`// bml-lint-disable[-line|-next-line|-file] <code1> <code2>` comments for
free - no rule needs to implement suppression itself, just set `diag.code`.

### Feature flags

`cpqBml.features.lint` and `cpqBml.features.spelling` are two independent
toggles (not one combined flag) - `index.js`'s `onDidChangeConfiguration`
handler reacts to either changing and re-lints all open `.bml` documents
immediately, no reload needed. `cpqBml.features.comments` is a separate
flag read by the `comments/` module, unrelated to either of these.

### Adding a new lint rule - the established workflow

This sequence is not optional ceremony - every step here previously caught
a real bug (either in the new rule itself, or a genuine pre-existing bug in
real CPQ library code under `bml/library/`):

1. **Write the rule as a pure function** in its own file under
   `app/lang/lint/`, taking plain text/precomputed-ranges + `doc` + `vscode`
   as parameters, with zero module-level `require('vscode')`. Return an
   array of `vscode.Diagnostic`s with a `diag.code` set.
2. **Verify against the real corpus before wiring it in.** Write a
   throwaway Node script (delete it when done) that walks every `.bml` file
   under `bml/library/`, runs the rule's function with a minimal fake
   `vscode` object (`{ Range, Diagnostic, DiagnosticSeverity }` - see any
   rule file's own JSDoc-less signature for the shape needed), and prints
   every flag. **Read every single flag.** A rule with 0 hits is not
   automatically correct - it can mean "genuinely nothing to find" or
   "silently broken." Confirm which with a few hand-written synthetic
   should-flag/should-not-flag cases before trusting a 0.
3. **If anything looks like a false positive, fix the rule, not the
   corpus.** Past examples: a duplicate-branch checker collapsed different
   string literals because it ran on `noStringsText` instead of `cleanText`
   (32 false positives, traced and fixed); a lonelyIf checker had an
   off-by-one in a slice boundary that silently made it never fire on
   anything.
4. **If a flag turns out to be a genuine bug in real library code, that's a
   feature, not a problem** - it validates the rule. Past examples: a
   duplicate `status == "DELETED"` check in `oRCL_OSC_TransactionStatus.bml`;
   a `curAssetKey` read-before-assignment bug copy-pasted across 3 near-
   duplicate utility functions, despite a comment claiming it was pre-
   initialized.
5. **Wire it into `lint.js`** - require it at the top, add a numbered
   pipeline-step comment (`// 10x. ...` following the existing numbering),
   pass the correct text variant (see above), and thread through any
   already-computed shared data instead of re-deriving it.
6. **Add tests under `test/linter/`** using `lintText()` from
   `test/linter/fixtures.js` (see section 4) - at minimum one should-flag
   and one should-not-flag case per meaningful edge case you found during
   corpus verification.
7. **Run the full suite** (`npx vscode-test`) and fix any file-based fixture
   mismatches under `test/lint/*.expected.json` - if an existing fixture's
   test code *legitimately* also triggers your new rule (this has happened
   repeatedly, since fixtures share `if (true)`-style patterns across
   rules), add the new expected diagnostic rather than weakening the rule.
8. **Update `CHANGELOG.md`** under the current version's `### Added`,
   describing the rule and, if corpus verification found one, the real bug
   it caught.
9. **Delete every throwaway verification script** before finishing - this
   repo's convention is zero scratch files left in the repo root.

## 4. Testing conventions

- Test runner: `@vscode/test-cli` (`npx vscode-test`, config in
  `.vscode-test.mjs`, which just globs `test/**/*.test.js`). Tests run
  inside a real extension host with a real `vscode` module - this is why
  most rule/module files can require `vscode` freely in tests even when
  they can't be run via plain `node`.
- Mocha-style `suite()`/`test()`, Node's built-in `assert`.
- **`test/linter/fixtures.js`** exports `lintText(bmlText, filePath?)` - the
  standard way to test the lint pipeline end-to-end without touching real
  files. Returns the diagnostics array directly.
  - Caveat: its mock `doc.positionAt` does a naive `text.slice(0, idx).split(/\r?\n/)`
    per call - O(n) per call. Fine for correctness tests (typical fixture
    text is tiny). **Do not reuse this pattern for performance
    measurement** - it silently inflates any rule that calls `positionAt`
    many times (e.g. once per match in a large file), producing numbers
    that look like a real bottleneck but are actually measuring the test
    harness's own inefficiency, not the rule. For real perf numbers, open
    an actual file via `await vscode.workspace.openTextDocument(path)` and
    time `lintBMLCustom` directly - VS Code's real `positionAt` is O(log n)
    via an internal offset table, not O(n).
- **File-based fixture tests**: `test/linter/fileBased.test.js` walks pairs
  of `test/lint/<name>.bml` + `test/lint/<name>.expected.json`
  (`[{line, severity, message}, ...]`, 0-indexed lines) and asserts the
  linter's output matches exactly. When a new rule legitimately also fires
  on existing fixture code, update the `.expected.json`, don't suppress it.
- **`test/linter/_corpusSmoke.test.js`** is a permanent regression guard -
  it lints every real `.bml` file under `bml/library/` through the actual
  `lintBMLCustom` entry point and asserts none of them throw. Keep this
  passing; it's cheap insurance against a rule that works on synthetic
  fixtures but crashes on real-world syntax it didn't anticipate.
- Other modules follow the same "real `vscode`, mocked `vscode.window`/
  `secrets`/`workspace.getConfiguration` where needed" pattern - see
  `test/rest/testHelpers.js` for the REST module's `createFakeVscode`/
  `createFakeContext` helpers if extending that area.

## 5. Build & packaging

- `npm run compile` - esbuild bundles `extension.js` (and everything it
  `require()`s, except `vscode`) into `dist/extension.js`
  (`--external:vscode --format=cjs --platform=node`), then runs
  `compile:webview` for the settings panel's React bundle
  (`--format=iife --platform=browser --jsx=automatic`, output to
  `app/lang/settingsPanel/webview/dist/main.js`).
- `npm run watch` / `npm run minify` mirror the same two-bundle shape with
  `--watch` / `--minify --legal-comments=none` respectively.
- `npm test` runs `pretest` (`compile`) then `vscode-test`.
- **`.vscodeignore`** is the map of what's bundled-away vs shipped as-is in
  the VSIX. Source `.js` files for most modules (`beautify`, `lint`, `rest`,
  `comments`, `mcp`, `intellisense`, `settingsPanel`, plus root
  `extension.js`) are excluded - they're already inlined into
  `dist/extension.js`. Data/static files ship as-is and are **not**
  excluded: `app/lang/intellisense/*.json`, `app/lang/spellCheck/*.txt`,
  `app/lang/syntaxes/bml.tmLanguage.json`,
  `app/lang/settingsPanel/webview/dist/main.js` (the *compiled* webview
  output - the React `.jsx` sources under `webview/src/` are excluded,
  the bundle is not), `themes/*.json`, `language-configuration.json`,
  `app/images/`. When adding a new module with a JS entry point that gets
  bundled, add its source path to `.vscodeignore` alongside the others;
  when adding new static data files a module reads at runtime via `fs`,
  make sure they're *not* excluded.
- **Known gap as of this writing:** `app/lang/spellCheck/spelling.js` is not
  yet listed in `.vscodeignore` (every sibling module's `.js` source is).
  Its dictionary `.txt` files correctly need to ship as-is, but the `.js`
  itself is already inlined into `dist/extension.js` via `lint.js`'s
  `require`, so shipping the raw source too is redundant VSIX bloat, not a
  functional bug. Add `app/lang/spellCheck/*.js` to the exclusion list next
  time that area is touched.

## 6. Settings & commands inventory

Configuration keys under `cpqBml.*` (check here before adding a
similarly-named one):

```
connection.enabled, connection.siteUrl, connection.authMethod, connection.username, connection.environments
rest.restVersion, rest.commerceProcess, rest.commerceDocument, rest.pullFolder
features.lint, features.comments, features.spelling
mcp.enable, mcp.port, mcp.logToTerminal
debug.logRestDetails, debug.logOutputToFile
```

Passwords/tokens are **never** stored in settings - only via
`context.secrets`, site+username-keyed (see `app/lang/rest/config.js`).

Commands (id -> title), all under the `BML`/`CPQ-BML` category:
`cpqBml.rest.{setPassword, setAuthToken, pullLibraryFunctions,
pullCommerceFunctions, validateCurrentFile, debugCurrentFile,
saveCurrentFile, clearResults, createOverride, removeOverride,
deployCommerceProcess, deployCurrentFile, deployUtilFunctions,
createBmlFunction, changeEnvironment}`, `cpqBml.mcp.showInfo`,
`cpqBml.settings.open`, `cpqBml.beautifyWorkspace`.

## 7. House rules learned the hard way

- **Never revert a file you didn't touch just because it looks unexpectedly
  different from what you remember.** Treat externally-modified files
  (outside this conversation - the user's own parallel edits) as
  intentional. Don't comment on noticing them; just work with current
  reality. Always re-`Read` a file you're about to edit if there's any
  chance it changed since you last looked at it.
- **Trust `git status`/`Glob` over memory** - this project's state changes
  between sessions and even mid-session (e.g. `app/lang/cspell-loader/` was
  deleted and replaced by the self-contained `app/lang/spellCheck/` module
  mid-development; old plans/docs may reference settings keys like
  `cpqBml.lint.enable` that no longer exist - the real key today is
  `cpqBml.features.lint`).
- **Don't trust a "0 results" from a new check without separately
  confirming the check itself fires on a hand-built positive case.** This
  has caught multiple silently-broken rules in this codebase already.
- **Reference data is Oracle's own official BML data catalog**, and lives
  entirely under `app/lookups/bml/` (`common.json`, `commonVariables.json`,
  `functionCategory.json`, `functionParamDataTypes.json`,
  `functionReturnTypes.json`, `lookups.json`, `operators.json`) - dev-only,
  `app/lookups/**` is excluded from packaging in `.vscodeignore`. **Nothing
  under `app/lang/` ever reads `app/lookups/` directly at runtime** - it is
  read only by the generator scripts under `app/scripts/`
  (`generateBmlFunctions.js`, `generateBmlVariables.js`,
  `generateBmlAttributes.js`, `generateBmlUtilAttributes.js`,
  `generateBmlDataTypes.js`, run together via `node app/scripts/index.js`),
  which transform it into `app/lang/intellisense/*.json` - those already
  ship in the VSIX (`.vscodeignore` only excludes `app/lang/intellisense/
  *.js`, not its JSON) and are what both the intellisense hover/completion
  feature and the linter (`app/lang/lint/functions.js`, `systemVariables.js`,
  `metadataTypes.js`) read at runtime. If you add a new runtime consumer of
  Oracle lookup data, write a generator for it rather than pointing the
  consumer at `app/lookups/` directly - that file won't exist in the
  packaged extension. When in doubt about a function's real category,
  parameter types, or return type, check the raw `app/lookups/bml/` data
  before guessing from the grammar or prose docs.
- **The real `.bml` corpus lives under `bml/library/`** - use it as ground
  truth for "does this actually happen in real CPQ code" before assuming a
  pattern is rare or common.
- Keep the repo root free of scratch/debug scripts when done; this project
  has no tracked "tools/" or "scripts/" folder for one-off verification, by
  convention those are temporary and deleted before the task is reported
  complete.
