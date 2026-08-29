---
name: bml-web-services
description: >-
  Interact with external web services using HTTP REST (urldata), SOAP, and XML.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# Web Services & XML in BML

### REST Calls with `urldata()`
```bml
// Setup Headers Dictionary
headersDict = dict("string");
put(headersDict, "Content-Type", "application/json");
put(headersDict, "Authorization", "Bearer " + token);

// Execute HTTP Request (GET, POST, PUT, DELETE)
responseDict = urldata(endpointUrl, "POST", headersDict, requestBodyJsonStr, 30000);

// Process Response
statusCode = get(responseDict, "status");
responseBody = get(responseDict, "body");
```

### XML Parsing & Construction
```bml
// Read single or multiple nodes using XPath-like syntax
val = readxmlsingle(xmlString, "/root/item/price");
nodes = readxmlmultiple(xmlString, "/root/items/item");
```

*For detailed reference docs, refer to the `references/` directory.*
