---
name: cpq-domain
description: >-
  Understand Oracle CPQ concepts like Commerce, Configuration, BOM, and System Variables.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# CPQ Domain Knowledge

### Commerce & Configuration Context
- **Commerce**: Context variables, line item arrays, transaction attributes (`_document_number`, `_price_total`, `_transaction_currency`).
- **Configuration**: Dynamic product sizing arrays, configuration BOM rules, and pricing recommendations.

### BOM (Bill of Materials) Mapping APIs
```bml
// Retrieve, convert, and save BOM structures
bomJson = getbom(docNumber);
hierBom = convertbomtohier(flatBomJson);
flatBom = convertbomtohier(hierBomJson);
deltaBom = calculatedeltabom(priorBom, currentBom);
savedDocNum = savebom(docNumber, bomInstance);
```

### Global Dictionary & User Sessions
```bml
// Cross-script caching via Global Dictionary
globaldictset("cacheKey", "cachedValue");
val = globaldictget("cacheKey");
globaldictremove("cacheKey");

// User Session Management
usersessionset("sessionKey", "sessionValue");
sessVal = usersessionget("sessionKey");
usersessionremove("sessionKey");
```

### Key System Constants
- Unchanged Values: `BM_UNCHANGED_STR`, `BM_UNCHANGED_NUM`, `BM_UNCHANGED_DATE`
- Approvals: `BM_REASON_STATUS_APPROVED`, `BM_REASON_STATUS_PENDING`, `BM_REASON_STATUS_REJECTED`
- Security: `BM_PARTNER_SECURITY_TOKEN` (SOAP WSSE token)

*For detailed reference docs, refer to the `references/` directory.*
