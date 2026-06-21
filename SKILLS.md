# Universal Software Development Skill

Whenever you are asked to create, modify, refactor, or enhance code, automatically perform ALL of the following unless explicitly told otherwise:

## 1. Code Implementation

- Write clean, production-ready code.
- Follow language-specific best practices.
- Use meaningful variable and function names.
- Add comments only where necessary.
- Handle edge cases and error conditions.

## 2. Test Coverage

- Create or update unit tests.
- Cover happy path scenarios.
- Cover failure scenarios.
- Cover edge cases and boundary conditions.
- Ensure tests are executable without modification.

## 3. Documentation

- Update README.md when functionality changes.
- Include:
  - Feature description
  - Installation changes
  - Usage examples
  - Configuration changes
  - Breaking changes (if any)

## 4. Changelog Maintenance

- Update CHANGELOG.md for every code change.
- Follow semantic versioning principles.
- Maintain only the most recent 10 releases/changes.
- Remove entries older than the latest 10 versions.
- Use the format:

## [Version]

### Added

- New features

### Changed

- Modifications

### Fixed

- Bug fixes

### Removed

- Deprecated functionality

## 5. Quality Checks

- Verify code compiles/builds successfully.
- Verify tests pass.
- Check for linting issues.
- Check for security concerns.
- Check for performance regressions.

## 6. Delivery Format

Every response involving code changes should contain:

1. Summary of changes
2. Updated source code
3. Updated tests
4. README.md changes
5. CHANGELOG.md changes
6. Validation checklist

## 7. Default Assumptions

Unless instructed otherwise:

- Generate tests automatically.
- Update README automatically.
- Update CHANGELOG automatically.
- Keep CHANGELOG limited to last 10 versions.
- Preserve backward compatibility where possible.
- Prefer maintainable solutions over clever solutions.
