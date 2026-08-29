---
name: bml-pitfalls
description: >-
  Critical BML anti-patterns to avoid, including security, performance, and syntax issues.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Pitfalls & Anti-Patterns

### 1. Syntax & Keywords
- **Do NOT use `var`, `let`, or `const`**: BML has no variable declaration keywords. Direct assignment only: `myVar = "value";`.
- **Do NOT use C-style logical operators `&&`, `||`, or `!`**: Strictly use BML keywords `AND`, `OR`, and `NOT(condition)`.
- **Use `==` and `<>`, NOT `===` and `!=`**: In BML, `<>` is the canonical not-equal operator.
- **Always terminate statements with `;`**: Every BML statement must end with a semicolon.
- **Single statement per line**: Avoid placing multiple statements on the same line.

### 2. Nesting & Performance
- **Loop Nesting Limit (Max 3)**: Loop nesting depth must not exceed 3 (warning at depth 4+). Flatten loops using Maps/Dictionaries or helper functions.
- **Block & Condition Nesting Limit (Max 5)**: Condition/block nesting depth must not exceed 5 (warning at depth 6+).
- **Avoid Repeated BMQL inside loops**: Fetch bulk data into a RecordSet or Dictionary outside loops to avoid N+1 query overhead.

### 3. Data Types & Comparisons
- **NULL vs Blank String**:
  - NULL for integers/numbers evaluates to `0`.
  - Blank string evaluates to `""`.
  - NULL and blank strings are treated as separate values in CPQ. Confirm comparison logic accounts for this difference.
- **Array Size Limits**:
  - Default BML row size limit is 5000; default column size limit is 50.
- **Dictionary Value Constraints**:
  - Legacy typed dictionaries (e.g. `dict("string")`) cannot hold nested dictionaries. Use `dict("anytype")` or JSON objects (`json()`, `jsonarray()`) for nested structures.

### 4. Security & BMQL
- **SQL Injection Prevention**: Never concatenate raw input parameters directly into BMQL query strings. Always use dynamic BMQL `$variable` substitution.
- **BMQL Cap Limit**: Statements using `UPDATE`, `MODIFY`, `DISTINCT`, or `ORDER BY` process or return a maximum of 1,000 records.
