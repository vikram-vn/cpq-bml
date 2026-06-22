# VS Code Extension Development Skill

Whenever you are asked to design, build, modify, review, optimize, or troubleshoot a Visual Studio Code extension, automatically apply the following standards unless explicitly instructed otherwise.

## Core Deliverables

Every implementation must include:

1. Architecture Summary
2. Implementation Code
3. Unit Tests
4. Documentation Updates
5. CHANGELOG Updates
6. Packaging & Publishing Review
7. Validation Checklist

---

# Skill 1: Extension Architecture

## Requirements

Design extensions using clear separation of concerns:

- Extension Activation
- Commands
- Providers
- Services
- Utilities
- UI Components

## Structure

Prefer:

```text
src/
├── extension.ts
├── commands/
├── providers/
├── services/
├── diagnostics/
├── formatting/
├── completion/
├── hover/
├── codeActions/
├── utils/
└── test/
```

## Activation

- Use lazy activation whenever possible.
- Avoid activating on startup unless required.
- Minimize activation time.
- Register disposables correctly.

---

# Skill 2: TypeScript Quality

## Requirements

- Use strict TypeScript.
- Avoid `any`.
- Prefer interfaces and types.
- Add JSDoc comments for public APIs.
- Use async/await instead of promise chains.

## Validation

Generate:

- Type-safe code
- Error handling
- Null checks
- Input validation

---

# Skill 3: VS Code API Usage

## Best Practices

Use official VS Code APIs whenever available.

Prefer:

- DiagnosticCollection
- CompletionItemProvider
- HoverProvider
- DocumentSymbolProvider
- CodeActionProvider
- FormattingProvider
- TreeView
- Webview
- StatusBarItem

Avoid unnecessary polling or custom implementations when native APIs exist.

---

# Skill 4: Language Features

When implementing language support, evaluate:

## IntelliSense

- Completion Provider
- Snippets
- Auto Imports
- Signature Help

## Navigation

- Go To Definition
- References
- Document Symbols
- Workspace Symbols

## Analysis

- Diagnostics
- Quick Fixes
- Refactoring Actions

## Formatting

- Document Formatting
- Range Formatting
- On-Type Formatting

---

# Skill 5: Performance Optimization

## Requirements

Minimize:

- Activation Time
- Memory Usage
- CPU Usage

## Guidelines

- Cache expensive operations.
- Debounce document analysis.
- Avoid scanning entire workspaces repeatedly.
- Use incremental updates.
- Run heavy analysis asynchronously.

## Validation

Measure:

- Activation duration
- Analysis duration
- Completion response time
- Memory consumption

---

# Skill 6: Diagnostics & Code Analysis

Whenever diagnostics are added:

## Include

- Error Detection
- Warning Detection
- Information Messages
- Quick Fix Suggestions

## Requirements

Provide:

- Clear messages
- Precise ranges
- Actionable fixes
- Severity levels

---

# Skill 7: Testing

Whenever code changes are made:

## Generate

### Unit Tests

Test:

- Utility functions
- Services
- Parsers
- Validators

### Integration Tests

Test:

- Commands
- Providers
- Diagnostics
- Formatting

### Regression Tests

Prevent previously fixed bugs from returning.

## Coverage

Target meaningful coverage for critical extension features.

---

# Skill 8: Telemetry & Logging

## Requirements

Telemetry must be:

- Optional
- Privacy-compliant
- Documented

## Never Collect

- Source code contents
- Secrets
- Passwords
- Tokens
- Personal information

## Logging

Use structured logging.

Provide:

- Debug logs
- Error logs
- Performance metrics

---

# Skill 9: Documentation

Whenever functionality changes:

## Update

- README.md
- CHANGELOG.md
- package.json contributions
- Commands documentation
- Settings documentation

## README Requirements

Include:

- Features
- Screenshots/GIFs
- Installation
- Usage
- Configuration
- Troubleshooting

---

# Skill 10: Marketplace Publishing

Before publishing:

## Validate

- Extension name
- Publisher name
- Version number
- License
- Repository URL
- Icon
- Keywords
- Categories

## Packaging

Run:

- npm run lint
- npm run test
- npm run package

Verify:

- No build errors
- No unused dependencies
- No large bundled files

---

# Skill 11: CHANGELOG Management

Whenever changes are made:

## Update CHANGELOG.md

Include:

### Added

New features.

### Changed

Behavior modifications.

### Fixed

Bug fixes.

### Removed

Deprecated functionality.

## Retention Rule

Maintain the last 10 released versions in CHANGELOG.md.

---

# Skill 12: AI-Assisted Development

Whenever generating extension code:

## Automatically

- Generate implementation code
- Generate tests
- Update README.md
- Update CHANGELOG.md
- Validate package.json contributions
- Check activation events
- Check command registrations
- Check disposal patterns

## Review

- Performance impact
- Memory impact
- Security impact
- User experience impact

---

# Default Assumptions

Unless explicitly instructed otherwise:

- Use TypeScript.
- Use strict mode.
- Generate tests.
- Update README.md.
- Update CHANGELOG.md.
- Follow VS Code API best practices.
- Optimize activation performance.
- Validate extension packaging.
- Maintain backward compatibility where possible.
- Avoid unnecessary dependencies.
- Prefer native VS Code APIs over third-party libraries.
