---
name: bml-db-access
description: >-
  Advanced BMQL and Direct Database Access in Oracle CPQ BML. Use when querying
  system tables or Data Tables, or performing CRUD operations.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# Direct DB Access & BMQL

### BMQL Syntax
```bml
// Query Data Table or Parts Database
records = bmql("SELECT partNumber, price, description FROM parts WHERE price > $minPrice AND status == 'active'");

// Iterate RecordSet
for record in records {
    part = get(record, "partNumber");
    priceVal = getfloat(record, "price");
    print part + ": " + string(priceVal);
}

// Live Data Table Modification (INSERT / UPDATE / MODIFY / DELETE)
modifyResult = bmql("MODIFY my_datatable SET status = 'processed' WHERE order_id = $orderId");
```

### Dynamic Variables & Clauses
- Use `$variableName` syntax for parameterized values.
- Dynamic table and column names can be substituted dynamically into the SQL string.
- Results are capped at 1,000 records when using `UPDATE`, `MODIFY`, `DISTINCT`, or `ORDER BY`.

*For detailed reference docs, refer to the `references/` directory.*
