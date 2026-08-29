---
name: bml-editor-workflow
description: >-
  Understand the CPQ BML Function Editor, Function to Function calls, and Library Functions.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Editor Workflow

### Library Function Calls
```bml
// Util Library Function Call (Redwood / Classic)
result = util.pricing.calculateLineDiscount(listPrice, qty);

// Commerce Process Function Call
taxVal = commerce.calculateTax(docNumber, totalAmount);
```

### Function Debugging
- Use `print` statements in script definition area for diagnostic tracing.
- Extricate print statements behind debug flags in production BML scripts.

*For detailed reference docs, refer to the `references/` directory.*
