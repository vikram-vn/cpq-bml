import os
import json

BASE_KEYWORD_HOVERS = {
    "if": {
        "syntax": "if (condition) { ... }",
        "category": "keyword",
        "notes": "Executes block if condition evaluates to true."
    },
    "elif": {
        "syntax": "elif (condition) { ... }",
        "category": "keyword",
        "notes": "Executes block if previous if/elif condition was false and this condition is true."
    },
    "else": {
        "syntax": "else { ... }",
        "category": "keyword",
        "notes": "Executes block if all preceding if/elif conditions were false."
    },
    "for": {
        "syntax": "for var in array { ... }",
        "category": "keyword",
        "notes": "Loops through each element in an array or collection."
    },
    "while": {
        "syntax": "while (condition) { ... }",
        "category": "keyword",
        "notes": "Repeatedly executes the enclosed block while condition evaluates to true."
    },
    "break": {
        "syntax": "break;",
        "category": "keyword",
        "notes": "Terminates the nearest enclosing for-loop immediately."
    },
    "continue": {
        "syntax": "continue;",
        "category": "keyword",
        "notes": "Skips the remainder of the current loop iteration and advances to the next element."
    },
    "return": {
        "syntax": "return value;",
        "category": "keyword",
        "notes": "Returns value from the function and terminates execution."
    },
    "and": {
        "syntax": "condition1 AND condition2",
        "category": "keyword",
        "notes": "Logical conjunction operator. Evaluates to true if both conditions are true."
    },
    "or": {
        "syntax": "condition1 OR condition2",
        "category": "keyword",
        "notes": "Logical disjunction operator. Evaluates to true if either condition is true."
    },
    "not": {
        "syntax": "NOT(condition)",
        "category": "keyword",
        "notes": "Logical negation operator. Inverts the truth value of the enclosed condition."
    },
    "bmql": {
        "syntax": "recordset bmql(\"SELECT column1, column2 FROM dataTable WHERE condition = $var\");",
        "category": "function",
        "functionCategory": "direct_db_access",
        "notes": "BigMachines Query Language (BMQL) - executes direct database SQL queries on CPQ Data Tables."
    },
    "throwerror": {
        "syntax": "throwerror(errorMessage [, isSystemError]);",
        "category": "function",
        "functionCategory": "others",
        "notes": "Stops script execution and raises a user-facing error message on CPQ UI."
    },
    "print": {
        "syntax": "print(value);",
        "category": "function",
        "functionCategory": "others",
        "notes": "Prints value to the CPQ BML Function Editor execution log / console."
    },
    "true": {
        "syntax": "true",
        "category": "constant",
        "notes": "Boolean true constant."
    },
    "false": {
        "syntax": "false",
        "category": "constant",
        "notes": "Boolean false constant."
    },
    "null": {
        "syntax": "null",
        "category": "constant",
        "notes": "Null reference or empty object."
    }
}


def generate_keyword_hovers(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'keyword-hovers.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'keyword-hovers.json')

    data = dict(BASE_KEYWORD_HOVERS)

    if os.path.exists(input_path):
        with open(input_path, 'r', encoding='utf-8') as f:
            file_data = json.load(f)
            data.update(file_data)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[generateKeywordHovers] ok: {len(data)} keyword hovers -> {os.path.relpath(output_path, root_dir)}")

