"""Builds the AI skills directory from the scratch knowledge base.

The app/ai/skills/ directory is git-ignored and generated at build time.
This ensures the massive reference markdown files are bundled in the VSIX
without polluting the git repository.
"""
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_KNOWLEDGE_DIR = os.path.join(ROOT, "knowledge", "BML")
DEST_SKILLS_DIR = os.path.join(ROOT, "app", "ai", "skills")

# Embedded SKILL.md templates
SKILL_TEMPLATES = {
    "bml-language": """---
name: bml-language
description: >-
  Core BML language skill. Covers all syntax, data types, built-in functions, 
  BMQL, system variables, and coding conventions.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Language Core

### Data Types
- **Scalars**: `String`, `Integer`, `Float`, `Boolean`, `Date`
- **Collections**: `String[]`, `Integer[]`, `Float[]`, `Boolean[]`, `Date[]`, `String[][]`, `Integer[][]`
- **Data Structures**: `dict(type)`, `dict("anytype")`, `json()`, `jsonarray()`, `RecordSet`

### Operators
- **Logical**: `AND`, `OR`, `NOT(condition)` *(never use `&&`, `||`, `!`)*
- **Comparison**: `==`, `<>`, `<=`, `>=`, `<`, `>`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Concatenation**: `+`

### Control Flow
```bml
// Conditionals
if (condition) {
    statement;
} elif (otherCondition) {
    statement;
} else {
    statement;
}

// For Loop (Iterating Arrays / RecordSets)
for item in itemArray {
    print item;
}
```

### Array Literals, Sizing & Methods
```bml
// 1D Array Literal & Sized Declarations
colors = String[]{ "red", "green", "blue" };
buffer = String[10];

// 2D Array Literal & Sized Declarations
matrix = Integer[][]{ {1, 2}, {3, 4} };
grid = Float[5][5];

// Array Access (0-indexed)
firstColor = colors[0];
val = matrix[0][1];

// Common Array Functions
len = sizeofarray(colors);
idx = findinarray(colors, "green"); // returns -1 if not found
append(colors, "yellow");
remove(colors, 0); // removes element at index 0
sort(colors, "asc"); // "asc" or "desc"
reverse(colors);
intSeq = range(5); // [0, 1, 2, 3, 4]
```

### Core Built-in Functions
- **String**: `len(s)`, `substring(s, start, [end])`, `find(s, sub)`, `replace(s, old, new)`, `trim(s)`, `lower(s)`, `upper(s)`, `split(s, delim)`, `join(arr, delim)`, `atof(s)`, `atoi(s)`, `string(val)`, `startswith(s, sub)`, `endswith(s, sub)`, `formatascurrency(num)`.
- **Date**: `getdate([bool])`, `datetostr(d, [fmt], [tz])`, `strtojavadate(s, fmt, [tz])`, `adddays(d, n)`, `addmonths(d, n)`, `minusdays(d, n)`, `comparedates(d1, d2)`, `getdiffindays(d1, d2)`, `isleap(d)`, `isweekend(d)`, `getcurrenttimeinmillis()`.
- **Math**: `sqrt(x)`, `pow(x, y)`, `round(x, dec)`, `ceil(x)`, `fabs(x)`, `fmod(x, y)`, `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)`, `log(x)`, `ln(x)`, `exp(x)`, `hypot(x, y)`.

*For detailed reference docs, refer to the `references/` directory.*
""",
    "bml-db-access": """---
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
""",
    "bml-json-dict": """---
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
jObj = json("{\\"name\\":\\"CPQ\\",\\"version\\":25}");
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
""",
    "bml-web-services": """---
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
""",
    "cpq-domain": """---
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
""",
    "bml-editor-workflow": """---
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
""",
    "bml-pitfalls": """---
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
""",
    "cpq-mcp-workflow": """---
name: cpq-mcp-workflow
description: >-
  Step-by-step guidance for the AI on how to effectively use CPQ-BML MCP tools,
  including the mandatory human-approval deployment flow.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.1"
---
# CPQ MCP Workflow

You have access to tools to interact directly with CPQ BML code via the MCP Server:
1. `get_connection_status`: Check if credentials and CPQ connection are configured and working (`testConnection: true`).
2. `global_search_bml`: Search text across all remote BML scripts (libraries, rules, attributes) on CPQ.
3. `pull_function`: Pull remote BML into the local AI working copy (`<variableName>_ai.bml`).
4. `edit`: Modify the local working copy.
5. `lint_function` / `validate_function`: Verify syntax locally and compile remotely on CPQ without saving.
6. `debug_function`: Run remote tests with input parameters (`parameters: { ... }`, `printOnly: true`).
7. `save_function`: Save the working copy changes to CPQ (`variableName: "..."`).
8. `deploy_function` / `mass_deploy_util_functions` / `deploy_commerce_process`:
   - **MANDATORY HUMAN APPROVAL**: Deploying pushes changes directly to the live CPQ environment.
   - Calling deployment tools without `confirm: true` returns an error requiring human permission.
   - **Protocol**: You MUST ask the human user for explicit approval in chat first (e.g. "Do you approve deploying <function> to the live CPQ environment?").
   - Once the user explicitly approves in chat, re-invoke the tool with `confirm: true` (e.g. `{"variableName": "...", "confirm": true}`).
"""
}

# Map of skill names to their required reference files in knowledge/BML
SKILL_REFERENCES = {
    "bml-language": [
        "Arrays.md", "ArraysOverview.md", "String.md", "Math.md", 
        "Date.md", "Conditional.md", "BMLOverview.md", "BMLCodingBestPractices.md"
    ],
    "bml-db-access": [
        "BMQL.md", "DynamicBMQLVariables.md", "DirectDBAccess.md"
    ],
    "bml-web-services": [
        "URLAccess.md", "XML.md", "UseSOAPwithBML.md"
    ],
    "bml-json-dict": [
        "Json.md", "Dictionary.md"
    ],
    "cpq-domain": [
        "Others.md", "Others-BOM.md", "Others-Constants.md", "Others-GlobalDict.md",
        "Others-SysConfig.md", "Others-UserSessions.md", "PackageLifecycleManagement.md"
    ],
    "bml-editor-workflow": [
        "BML_Editor.md", "FunctionEditorBasics.md", "FunctionWizard.md", 
        "BMLFunctionsList.md", "Library_Functions.md", 
        "UtilBmlLibraryFunctionsList.md", "DebugUtilFunctions.md"
    ],
    "bml-pitfalls": [],
    "cpq-mcp-workflow": []
}

def generate_skills_into(dest_dir, copy_images=False):
    os.makedirs(dest_dir, exist_ok=True)
    for skill_name, refs in SKILL_REFERENCES.items():
        skill_dir = os.path.join(dest_dir, skill_name)
        os.makedirs(skill_dir, exist_ok=True)
        
        # Write SKILL.md from embedded template
        skill_content = SKILL_TEMPLATES.get(skill_name, "")
        if skill_content:
            with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as f:
                f.write(skill_content)
        
        # Copy references
        if refs:
            refs_dir = os.path.join(skill_dir, "references")
            os.makedirs(refs_dir, exist_ok=True)
            for ref in refs:
                src_ref = os.path.join(SRC_KNOWLEDGE_DIR, ref)
                if os.path.exists(src_ref):
                    shutil.copy2(src_ref, refs_dir)
                else:
                    print(f"Warning: Reference file {ref} not found for skill {skill_name}")
            
            # Optionally copy images for local workspace rendering
            if copy_images:
                src_images = os.path.join(SRC_KNOWLEDGE_DIR, "images")
                dest_images = os.path.join(refs_dir, "images")
                if os.path.exists(src_images) and not os.path.exists(dest_images):
                    shutil.copytree(src_images, dest_images)

def build_skills():
    print(f"Building AI Skills in {DEST_SKILLS_DIR} and workspace .agents/skills...")
    
    # 1. Clean and generate app/ai/skills (without images for lean brotli compression)
    if os.path.exists(DEST_SKILLS_DIR):
        shutil.rmtree(DEST_SKILLS_DIR)
    generate_skills_into(DEST_SKILLS_DIR, copy_images=False)

    # 2. Also synchronize workspace .agents/skills (with images for rich local rendering)
    agents_skills_dir = os.path.join(ROOT, ".agents", "skills")
    generate_skills_into(agents_skills_dir, copy_images=True)

    print("AI Skills build complete.")

if __name__ == "__main__":
    build_skills()

