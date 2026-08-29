---
name: bml-json-dict
description: >-
  Advanced JSON and Dictionary manipulation in Oracle CPQ BML.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# JSON & Dictionaries in BML

### Dictionaries
```bml
// Create typed dictionary or anytype dictionary
myDict = dict("string");
anyDict = dict("anytype");

// Basic operations
put(myDict, "key1", "value1");
val = get(myDict, "key1");
hasKey = containskey(myDict, "key1");
remove(myDict, "key1");
allKeys = keys(myDict);
allValues = values(myDict);
```

### JSON Objects
```bml
// Create JSON from string or empty
jObj = json("{\"name\":\"CPQ\",\"version\":25}");
emptyJson = json();

// JSON manipulation
jsonput(jObj, "status", "active");
statusStr = jsonget(jObj, "status");
jsonremove(jObj, "status");
hasProperty = jsonhas(jObj, "name");

// JSON Path queries
val = jsonpathgetsingle(jObj, "$.name");
```

### JSON Arrays
```bml
// Create JSON Array
jArr = jsonarray("[1, 2, 3]");
emptyArr = jsonarray();

// Array operations
jsonarrayappend(jArr, "item4");
item0 = jsonarrayget(jArr, 0);
arrSize = jsonarraysize(jArr);
```

*For detailed reference docs, refer to the `references/` directory.*
