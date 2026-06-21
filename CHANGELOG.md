# Change Log

All notable changes to the "CPQ-BML" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.1.1]

### Added
- **BML Better Comments**: tagged comment highlighting (`!`, `?`, `*`, `//`, `TODO`, `FIXME`, `BUG`, `WARNING`, `IMPORTANT`, `HACK`, `XXX`, `NOTE`, `OPTIMIZE`, `IDEA`), distinct highlighting for functional directive comments (`// bml-lint-disable*`, `/* beautify ignore:start/end */`) with hover tooltips explaining exactly what each one does, and automatic detection/styling of BML doc-header comment blocks (`Function Name:`, `Description:`, `Inputs:`, `Return:`). Toggle with the new `cpqBml.features.comments` setting.
- **Features Tab**: Added a dedicated "Features" tab to the settings panel webview to group BML Linting and BML Better Comments configurations.

### Fixed
- **Settings Panel Crash**: Resolved a runtime crash (`TypeError: Cannot read properties of undefined (reading 'enable')`) that occurred when opening the settings webview.
- **Production builds**: the packaged extension's JS (including the settings panel's React webview bundle) is now built with `NODE_ENV=production`, stripping React's development-only warning code from the shipped VSIX.

## [1.1.0]

### Added

- Initial release: syntax highlighting, IntelliSense, snippets, and BML-aware formatting for `.bml` files.
- **BML REST**: live integration with Oracle CPQ — pull, validate, save, debug, and deploy Util Library Functions and Commerce Process Functions directly from VS Code, including individual and mass deploy, standard-function overrides, and multi-environment switching.
- **MCP Server**: an in-process Model Context Protocol server so AI agents (Claude Code or any MCP-compatible client) can drive BML REST directly — pull, edit, validate, debug, and deploy functions — without the agent ever seeing your CPQ credentials.
- MCP tools now always edit a `<variableName>-AI` working copy rather than the pulled file itself, so the original stays available as a diff baseline and a re-pull can never clobber in-progress AI edits.
- Every MCP tool call (list, pull, save, validate, debug, deploy, mass deploy, deploy commerce process, create) now always returns a full progress/outcome log in its result. Set the new `cpqBml.mcp.logToTerminal` setting (off by default) to also stream that log live into a dedicated "CPQ-BML (AI)" integrated terminal.
- Human-triggered Pull (util and commerce) now logs to the "CPQ-BML" terminal too, matching Save/Validate/Debug/Deploy - previously it only showed toast notifications, with no terminal record of what was fetched or why a fetch failed.
- **CPQ-BML: Open Settings**: a single WebView form for everything previously spread across Settings UI + several commands - site URL, username, password/token (write-only, never displayed back), multiple environments (add/edit/activate/delete), REST API version, commerce process/document, pull folder, and every MCP/lint/debug toggle - plus a one-click Test Connection check. Opens automatically once, the first time the extension activates after install.
