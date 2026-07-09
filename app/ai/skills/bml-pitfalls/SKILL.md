---
name: bml-pitfalls
description: >-
  Critical BML anti-patterns to avoid, including security, performance, and syntax issues.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Pitfalls

- **Do NOT use `var`, `let`, or `const`**. BML has no declaration keywords. Just assign: `myVar = "value";`.
- **Use `==` and `<>`, NOT `===` and `!=`**.
- **Always terminate statements with `;`**.
- **Do NOT concatenate unvalidated parameters into BMQL** (SQL injection risk).
