---
name: cpq-rest-api
description: >-
  Oracle CPQ REST API services, collection query filters (q parameter), sorting (orderBy),
  pagination (limit, offset), hierarchical expansion (expand), and HTTP status codes.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# Oracle CPQ REST API Standards & Collection Operations

### Query Filtering with `q` Parameter
Oracle CPQ REST collections use MongoDB-style JSON syntax for filtering:
```http
GET /rest/v19/commerceDocumentsOraclecpqoTransaction?q={"status_t":{"$eq":"CREATED"}}
```

#### Comparison Operators:
- `$eq` / `$ne`: Equality / inequality (`{"status_t":{"$eq":"CREATED"}}`)
- `$gt` / `$gte`: Greater than / greater than or equal (`{"totalAmount_t":{"$gte":1000}}`)
- `$lt` / `$lte`: Less than / less than or equal (`{"quantity":{"$lt":50}}`)
- `$exists`: Field existence check (`{"createdBy":{"$exists":true}}`)

#### Logical Operators:
- `$and`: Conjunction of conditions
  `?q={"$and":[{"status_t":{"$eq":"PENDING"}},{"totalAmount_t":{"$gt":500}}]}`
- `$or`: Disjunction of conditions
  `?q={"$or":[{"status_t":{"$eq":"CREATED"}},{"status_t":{"$eq":"DRAFT"}}]}`

### Sorting with `orderBy`
Order results using `orderBy=attributeName:[asc|desc]`. Comma-separated for multiple fields:
```http
GET /rest/v19/commerceDocumentsOraclecpqoTransaction?orderBy=dateModified_t:desc,transactionID_t:asc
```

### Pagination
Control page windows using `limit`, `offset`, and request total counts:
- `limit`: Maximum records per response (1 to 1000, default 25).
- `offset`: Starting record index (0-based).
- `totalResults`: Set `?totalResults=true` to include the total record count.

Response metadata structure:
```json
{
  "items": [...],
  "hasMore": true,
  "limit": 25,
  "offset": 0,
  "count": 25,
  "totalResults": 142,
  "links": [{"rel": "next", "href": "..."}]
}
```

### Hierarchical Expansion with `expand`
Retrieve child objects/subdocuments inline in a single request:
```http
GET /rest/v19/commerceDocumentsOraclecpqoTransaction/{id}?expand=items,lineItems
```

### Standard HTTP Status Codes & Error Handling
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `204 No Content`: Successful execution with empty body (DELETE / Actions).
- `400 Bad Request`: Validation error or malformed query `q` syntax.
- `401 Unauthorized` / `403 Forbidden`: Authentication / Permission failure.
- `404 Not Found`: Resource or URI does not exist.
- `409 Conflict`: Optimistic locking or concurrent modification conflict.
- `500 Internal Server Error`: Unhandled CPQ server or BML exception.

### MCP Tools Integration
When interacting with CPQ Commerce via MCP tools:
- `get_transactions(q="{status_t:'CREATED'}", orderby="dateModified_t:desc", limit=25, offset=0)`
- `list_transactions(q="{_customer_t_company_name:'Oracle'}", fields="_id,transactionID_t,status_t")`

*For detailed reference docs, refer to the `references/` directory.*
