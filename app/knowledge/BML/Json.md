---
id: Json
title: "JSON Functions"
sidebar_label: "JSON Functions"
description: "JSON Functions CPQ’s markup language, BML, now allows administrators to create new Java Script Object Notation (JSON) data types (e.g. JSON, JSON arra..."
tags: ['BML', 'CPQ', 'Functions']
---

## JSON Functions
CPQ’s markup language, BML, now allows administrators to create new Java Script Object Notation (JSON) data types (e.g. JSON, JSON array, and JSON null) and generate, modify, parse, extract, and query JSON data using BML JSON and JSON array manipulation functions. The addition of JSON Path expression in JSON manipulation functions allows advanced users to easily retrieve or modify a node or value in JSON data.
Functions
isjsonnull

Checks for null values in a JSON or JSON array object and returns a boolean value.

true is returned if a null value is found.

false is returned if a null value is not found.

Syntax:
Boolean isjsonnull(Json jsonIdentifier, String key (or JsonArray jsonArrayIdentifier, Integer index))

**Example:**
```bml title="Example"
str1 = "{\"key1\":null,\"key2\":\"str\",\"key3\":90}";
```

jsonObj = json(str1);

valBoolean1 = isjsonnull(jsonObj,"key1");
print valBoolean1;
//Output: true

str2 = "[null,false,45,\"str\"]";
jsonArrObj = jsonarray(str2);
valBoolean2 = isjsonnull(jsonArrObj,0);
print valBoolean2;
//Output: true

json

Creates a JSON object from a given JSON formatted string. An empty JSON object is created if parameters are not provided.
Syntax:
Json json([String jsonFormatStr])

**Example:**
```bml title="Example"
jsonObj1 = json("{\"key1\":\"value1\"}");
```

print jsonObj1;
//Output: {"key1":"value1"}

jsonObj2 = json();
print jsonObj2;
//Output: {}

jsonarray

Creates a JSON array object from a given JSON array formatted string. An empty JSON array object is created if parameters are not provided
Syntax:
JsonArray jsonarray([String jsonArrStr])

**Example:**
```bml title="Example"
str = "[1,\"val1\",{\"key1\":10,\"key2\":\"val2\"}]";
```

jsonArrObj1 = jsonarray(str);
print jsonArrObj1;
//Output: [1,"val1",{"key1":10,"key2":"val2"}]

jsonArrobj2 = jsonarray();
print jsonArrObj2;
//Output: []

jsonarrayappend

Appends a given value to the end of a JSON array. The appended value is returned.
Syntax:
<ValueType> jsonarrayappend(JsonArray jsonarrayIdentifier, <ValueType> value)

**Example:**
```bml title="Example"
jsonArrObj = jsonarray();
```


appIntVal = jsonarrayappend(jsonArrObj,1);
print appIntVal;
//Output: 1

appStrVal = jsonarrayappend(jsonArrObj,"str");
print appStrVal;
//Output: str

print jsonArrObj;
//Output: [1,"str"]

jsonarraycopy

Creates a copy of a JSON array object. All objects in the array are copied and a similar hierarchy is created. Any changes made to the original JSON array object will not impact the copied JSON array object.
Syntax:
JsonArray jsonarraycopy(JsonArray jsonArrayIdentifier)

**Example:**
```bml title="Example"
str = "[\"string\",1,2.3,{\"key1\":\"val1\"},[1,2,3],true,false]";
```

jsonArrObj = jsonarray(str);

copyObj = jsonarraycopy(jsonArrObj);
print copyObj;
//Output: ["string",1,2.3,{"key1":"val1"},[1,2,3],true,false]

jsonarrayappend(jsonArrObj,"simple");
jsonarrayremove(jsonArrObj,0);
print jsonArrObj;
//Output: [1,2.3,{"key1":"val1"},[1,2,3],true,false,"simple"]

print copyObj;
//Output: ["string",1,2.3,{"key1":"val1"},[1,2,3],true,false]

jsonarrayget

Returns the value from a JSON array object at a given index. The returned value is converted to a data type equal to the valueType parameter, which is String by default.
An error is thrown if:

the given index is not available.

 the returned value could not be converted to the data type of valueType.

Syntax:
<ValueType> jsonarrayget(JsonArray jsonArrayIdentifier, Integer index [, String valueType])

**Example:**
```bml title="Example"
str = "[\"mystring\",10,2.9,[\"v1\",\"v2\"],true,{\"key7\":\"val7\",\"key8\":\"val8\"}]";
```

jsonArrObj = jsonarray(str);

/* Get string (two parameters) */
valStr1 = jsonarrayget(jsonArrObj,0);
print valStr1;
//Output: mystring

/* Get string (three parameters) */
valStr2 = jsonarrayget(jsonArrObj,0,"string");
print valStr2;
//Output: mystring

/* Get integer */
valInt = jsonarrayget(jsonArrObj,1,"integer");
print valInt;
//Output: 10

/* Get float */
valFloat = jsonarrayget(jsonArrObj,2,"float");
print valfloat;
//Output: 2.9

/* Get boolean */
valBool = jsonarrayget(jsonArrObj,4,"boolean");
print valBool;
//Output: true

/* Get jsonarray */
valJsonArr = jsonarrayget(jsonArrObj,3,"jsonarray");
print valJsonArr;
//Output: ["v1","v2"]

/* Get json */
valJson = jsonarrayget(jsonArrObj,5,"json");
print valJson;
//Output: {"key7":"val7","key8":"val8"}

jsonarrayrefid

Returns a unique reference ID that represents the input JSON array. Can only be invoked by Commerce advanced modify, auto update or advanced default functions. This function provides a more efficient method to pass a JSON array to the BML output to update an array set.
Syntax:
String jsonarrayrefid(JsonArray jsonArrayIdentifier)

**Example:**
```bml title="Example"
// feeJsonArray is a JSON array
```

// feeArraySet is the main doc array set variable name
// To update feeArraySet, jsonarrayrefid is more efficient than jsonarraytostr when the JSON array is large
// return "1~feeArraySet~" + jsonarraytostr(feeJsonArray);
return "1~feeArraySet~" + jsonarrayrefid(feeJsonArray);
When jsonarrayrefid is not used in the return statement of the BML, be aware that the reference ID refers to the JSON array by reference. As a result, any subsequent changes made to the JSON array are included.
result = "1~feeArraySet~" + jsonarrayrefid(feeJsonArray);
jsonarrayremove(feeJsonArray, 0);
return result; // feeArraySet does not include the removed first row.

jsonarrayremove

Removes an object specified at given index from the JSON array. The size of the array object after the object is removed is returned.An error is thrown if the given index is not available.
Syntax:
Integer jsonarrayremove(JsonArray jsonArrayIdentifier, Integer index)

**Example:**
```bml title="Example"
str = "[1,\"2\",{\"key1\":10,\"key2\":\"val\"}]";
```

jsonArrObj = jsonarray(str);

remVal = jsonarrayremove(jsonArrObj,2);
print remVal;
//Output: 2

print jsonArrObj;
//Output: [1,"2"]

jsonarraysize

Returns the size of the JSON array.
Syntax:
Integer jsonarraysize(JsonArray jsonarrayIdentifier)

**Example:**
```bml title="Example"
jsonArrObj1 = jsonarray();
```


arraySize1 = jsonarraysize(jsonArrObj1);
print arraySize1;
//Output: 0

str = "[1,\"2\",{\"key1\":10,\"key2\":\"val\"}]";
jsonArrObj2 = jsonarray(str);

arraySize2 = jsonarraysize(jsonArrObj2);
print arraySize2;
//Output: 3

jsonarraytostr

Converts a JSON array object into a JSON array formatted string.
Syntax:
String jsonarraytostr(JsonArray jsonArrayIdentifier)

**Example:**
```bml title="Example"
str = "[1,\"2\",{\"key1\":10,\"key2\":\"val\"}]";
```

jsonArrObj = jsonarray(str);

valStr = jsonarraytostr(jsonArrObj);
print valStr;
//Output: [1,"2",{"key1":10,"key2":"val"}]

jsoncopy

Creates a copy of a JSON object. All child nodes of the JSON object are copied and a similar hierarchy is created. Any changes made to the original JSON object will not impact the copied JSON object.
Syntax:
Json jsoncopy(Json jsonIdentifier)

**Example:**
```bml title="Example"
str = "{\"key1\":null,\"key2\":\"str\",\"key3\":90}";
```

jsonObj = json(str);

copyObj = jsoncopy(jsonObj);
print copyObj;
//Output: {"key1":null,"key2":"str","key3":90}

jsonremove(jsonObj,"key1");
print jsonObj;
//Output: {"key2":"str","key3":90}

print copyObj;
//Output: {"key1":null,"key2":"str","key3":90}

jsonget

Returns the value from a JSON object for the given key.  The returned value is converted to a data type equal to the valueType parameter, which is String by default. 

"null" is returned if: the given key is not available AND valueType is String, JSON, or JSON array AND defaultValue is not provided.

An error is thrown if:

the returned value could not be converted to the data type of valueType.

 the defaultValue parameter's data type is not the same as valueType parameter.

the given key is not available AND valueType is Integer, Float, or Boolean AND defaultValue is not provided.

Syntax:
<ValueType> jsonget(Json jsonIdentifier, String key [, String valueType [, <ValueType> defaultValue]])

**Example:**
```bml title="Example"
str = "{\"key1\":\"mystring\",\"key2\": 10,\"key3\":2.9,\"key4\":[\"v1\",\"v2\"],\"key5\":true,\"key6\":{\"key7\":\"val7\",\"key8\":\"val8\"}}";
```

jsonObj = json(str);

/* Get string (two parameters) */
valStr1 = jsonget(jsonObj,"key2");
print valStr1;
//Output: 10

/* Get string (three parameters) */
valStr2 = jsonget(jsonObj,"key1","string");
print valStr2;
//Output: mystring

/* Get integer */
valInt = jsonget(jsonObj,"key2","integer");
print valInt;
//Output: 10

/* Get float */
valFloat = jsonget(jsonObj,"key3","float");
print valFloat;
//Output: 2.9

/* Get boolean */
valBoolean = jsonget(jsonObj,"key5","boolean");
print valBoolean;
//Output: true

/* Get jsonarray */
valJsonArray = jsonget(jsonObj,"key4","jsonarray");
print valJsonArray;
//Output: ["v1","v2"]

/* Get json */
valJson = jsonget(jsonObj,"key6","json");
print valJson;
//Output: {"key7":"val7","key8":"val8"}

/* Get default value */
defaultVal1 = jsonget(jsonObj,"key10","string","defaultValue");
print defaultVal1;
//Output: defaultValue

/* Get default value */
defaultVal2 = jsonget(jsonObj,"key10","string");
print defaultVal2;
//Output: null

/* Get default value */
defaultVal3 = jsonget(jsonObj,"key10","integer");
print defaultVal3;
//An error is thrown because key10 is not found and the type is integer.

jsonkeys

Retrieves all first-level keys from a JSON object and returns an array of strings. If the optional parameter (ignoreNullValues) is set to true, null value keys are ignored.
Syntax:
String[] jsonkeys(Json jsonIdentifier [, Boolean ignoreNullValues])

**Example:**
```bml title="Example"
str = "{\"key1\":\"mystring\",\"key2\":10,\"key3\":2.9,\"key4\":[\"v1\",\"v2\"],\"key5\":null}";
```

jsonObj = json(str);

strArr1 = jsonkeys(jsonObj);
print strArr1;
//Output: [key1,key2,key3,key4,key5]

strArr2 = jsonkeys(jsonObj,true);
print strArr2;
//Output: [key1,key2,key3,key4]

jsonnull

Creates an instance of the JSON null object (represents null in the JSON string).
Syntax:
JsonNull jsonnull()

**Example:**
```bml title="Example"
jnull = jsonnull();
```

print jnull;
//Output: null

jsonpathcheck

Checks if a JSON path is found in a JSON object and returns a boolean value.

true is returned if the JSON path is found.

 false is returned if the JSON path is not found or if the JSON object is null.

An error is thrown if the JSON path is invalid.
Syntax:
Boolean jsonpathcheck(Json jsonIdentifier, String jsonPath)

**Example:**
```bml title="Example"
str = "{\"store\":{\"book\":[{\"category\":\"reference\",\"author\":\"Nigel Rees\"},{\"category\":\"fiction\",\"author\":\"Evelyn Waugh\"}]},\"expensive\":10}";
```

jsonObj = json(str);

isCatFound = jsonpathcheck(jsonObj,"$.store.book[0].category");
print isCatFound;
//Output: true

isExpFound = jsonpathcheck(jsonObj,"$..expensive");
print isExpFound;
//Output: true

isPriceFound = jsonpathcheck(jsonObj,"$..price");
print isPriceFound;
//Output: false

jsonpathcheck(jsonObj,"...");
//An error is thrown because the JSON path is invalid.

jsonpathgetmultiple

Retrieves the value(s) and path(s) from the JSON object for the given JSON path expression.
The asPath parameter is optional and its default value is false.

false returns a JSON array containing all object values corresponding to the given JSON path

true  returns a JSON array containing all nodes corresponding to the give JSON path

Syntax:
JsonArray jsonpathgetmultiple(Json jsonIdentifier, String jsonPath [, Boolean asPath])

**Example:**
```bml title="Example"
str = "{\"key1\":90,\"key2\":[{\"key1\":900}],\"key3\":{\"key1\":9000}}";
```

jsonObj = json(str);

arrayVals = jsonpathgetmultiple(jsonObj,"$..key1");
print arrayVals;
//Output: [90,900,9000]

pathVals = jsonpathgetmultiple(jsonObj,"$..key1",true);
print pathVals;
//Output: ["$['key1']","$['key2'][0]['key1']","$['key3']['key1']"]

str2 = "{\"key\":[{\"value\":9},{\"value\":90},{\"value\":900},{\"value\":9000}]}";
jsonObj2 = json(str2);
pathValue = jsonpathgetmultiple(jsonObj2,"$..key[1:3].value");
print pathValue;
//Output: [90,900]
//$..key[1:3] All keys from index 1 (inclusive) until index 3 (exclusive)

jsonpathgetsingle

Retrieves the value from the JSON object for the given JSON path expression.

The valueType and defaultValue parameters are optional.

The returned value is converted to a data type equal to the valueType parameter, which is String by default.

The defaultValue parameter is returned if the given JSON path is not found.

null is returned if: the given JSON path is not found AND valueType is String, JSON, or JSON array AND defaultValue is not provided.

 An error is thrown if:

there are multiple values corresponding to the given JSON path.

 the returned value could not be converted to the data type of valueType.

 the defaultValue parameter's data type is not the same as valueType parameter.

the given JSON path is not found AND valueType is Integer, Float, or Boolean AND defaultValue is not provided.

Syntax:
<ValueType> jsonpathgetsingle(Json jsonIdentifier, String jsonPath [, String valueType [, <ValueType> defaultValue]])

**Example:**
```bml title="Example"
str = "{\"store\":{\"book\":[{\"category\":\"reference\",\"author\":\"Nigel Rees\"},{\"category\":\"fiction\",\"author\":\"Evelyn Waugh\"}]},\"expensive\":10}";
```

jsonObj = json(str);

catArray = jsonpathgetsingle(jsonObj,"$.store.book[0]");
print catArray;
//Output: {"category":"reference","author":"Nigel Rees"}

expenseInt = jsonpathgetsingle(jsonObj,"$.expensive","integer");
print expenseInt;
//Output: 10

expenseStr = jsonpathgetsingle(jsonObj,"$.expensive","string");
print expenseStr;
//Output: 10

title = jsonpathgetsingle(jsonObj,"$.store.book[0].title","string");
print title;
//Output: null

price = jsonpathgetsingle(jsonObj,"$.store.book[0].price","float");
print price;
//An error is thrown because the JSON path is not found and valueType is float.

firstBook = jsonpathgetsingle(jsonObj,"$.store.book[0]","json");
print firstBook;
//Output: {"category":"reference","author":"Nigel Rees"}

defaultVal1 = jsonpathgetsingle(jsonObj,"$.store.book[100]","json",json());
print defaultVal1;
//Output: {}

defaultVal2 = jsonpathgetsingle(jsonObj,"$.store.book[0].location","string","unknown");
print defaultVal2;
//Output: unknown

jsonpathremove

Removes the object(s) and value(s) corresponding to a given JSON path expression.

true is returned if the node(s) corresponding to the given path is successfully removed.

false is returned if a node corresponding to the given path could not be found.

Notes:

If there are multiple JSON path nodes corresponding to the given path, all corresponding nodes are removed.

An exception is thrown if the JSON path syntax is not correct.

Because this function supports object references, caution is recommended while removing objects (JSON, JSON array).

Syntax:
Boolean jsonpathremove(Json jsonIdentifier, String jsonPat

**Example:**
```bml title="Example"
str = "{\"key1\":null,\"key2\":\"str\",\"key3\":90}";
```

jsonObj = json(str);

remVal1 = jsonpathremove(jsonObj,"$..key1");
print remVal1;
//Output: true

print jsonObj;
//Output: {"key2":"str","key3":90}

remVal2 = jsonpathremove(jsonObj,"$..key999");
print remVal2;
//Output: false

print jsonObj;
//Output: {"key2":"str","key3":90}

jsonpathset

Updates all nodes corresponding to a given JSON path in a JSON object with a value and returns a string array of the nodes that were updated.

A string containing all updated absolute/normalized JSON path nodes is returned.

An empty string array is returned if a node corresponding to the JSON path is not found.

null is returned if the object at the JSON path node is null or the JSON path is invalid.

Syntax:
String[] jsonpathset(Json jsonIdentifier, String jsonPath, <ValueType> value)

**Example:**
```bml title="Example"
str = "{\"key1\":90,\"key2\":[{\"key1\":900}],\"key3\":{\"key1\":9000}}";
```

jsonObj1 = json(str);
jsonObj2 = json("{\"key1\":89}");
jsonObj3 = json("{\"key2\":\"val2\"}");
jsonObj4 = json("{\"key1\":89}");

jsonPath1 = jsonpathset(jsonObj1,"$..key1",true);
print jsonPath1;
//Output: [$['key1'],$['key2'][0]['key1'],$['key3']['key1']]

print jsonObj1;
//Output: {"key1":true,"key2":[{"key1":true}],"key3":{"key1":true}}

jsonPath2 = jsonpathset(jsonObj2,"$..key1",jsonObj3);
print jsonPath2;
//Output: [$['key1']]

print jsonObj2;
//Output: {"key1":{"key2":"val2"}}

jsonput(jsonObj3,"key3","val2");
print jsonObj3;
//Output: {"key2":"val2","key3":"val2"}

jsonPath3 = jsonpathset(jsonObj4,"$..key3",jsonObj3);
print jsonPath3;
//Output: []

str2 = "{\"key\":[{\"value\":9},{\"value\":90},{\"value\":900},{\"value\":9000}]}";
jsonObj5 = json(str2);
jsonPath4 = jsonpathset(jsonObj5,"$.key[1:3].value",true);
print jsonPath4;
//output: [$['key'][1]['value'], $['key'][2]['value']]

print jsonObj5;
//output: {"key":[{"value":9},{"value":true},{"value":true},{"value":9000}]}
//$.key[1:3].value Updates nodes from index 1 (inclusive) until index 3 (exclusive)

jsonput

 Inserts or updates a key-value entry in a JSON object and returns the inserted/updated value. If the given key already exists in the JSON object, its corresponding value will be updated to the given value.
Syntax:
<ValueType> jsonput(Json jsonIdentifier, String key, <ValueType> value)

**Example:**
```bml title="Example"
jsonObj = json();
```


putStrVal = jsonput(jsonObj,"key1","mystring");
print putStrVal;
//Output: mystring

putIntVal = jsonput(jsonObj,"key2",10);
print putIntVal;
//Output: 10

putFloatVal = jsonput(jsonObj,"key3",2.9);
print putFloatVal;
//Output: 2.9

jsonArrObj = jsonarray("[\"v1\",\"v2\"]");
putArrVal = jsonput(jsonObj,"key4",jsonArrObj);
print putArrVal;
//Output: ["v1","v2"]

putBooleanVal = jsonput(jsonObj,"key5",true);
print putBooleanVal;
//Output: true

putNullVal = jsonput(jsonObj,"key6",jsonnull());
print putNullVal;
//Output: null

jsonStr = jsontostr(jsonObj);
print jsonStr;
//Output: {"key1":"mystring","key2":10,"key3":2.9,"key4":["v1","v2"],"key5":true,"key6":null}

jsonremove

Removes the first-level key-value entry from a JSON object for the given key and returns a boolean value.

true is returned if the key-value entry is successfully removed.

false is returned if the given key is not found.

Syntax:
Boolean jsonremove(Json jsonIdentifier, String key)

**Example:**
```bml title="Example"
str = "{\"a\":1,\"b\":\"test\"}";
```

jsonObj = json(str);

remVal = jsonremove(jsonObj,"a");
print remVal;
//Output: true

print jsonObj;
//Output: {"b":"test"}

jsontostr

Converts a JSON object into a JSON formatted string.
Syntax:
String jsontostr(Json jsonIdentifier)

**Example:**
```bml title="Example"
str = "{\"key1\":\"mystring\",\"key2\":10,\"key3\":2.9,\"key4\":[\"v1\",\"v2\"],\"key5\":true}";
```

jsonObj = json(str);

jsonStr = jsontostr(jsonObj);
print jsonStr;
//Output: {"key1":"mystring","key2":10,"key3":2.9,"key4":["v1","v2"],"key5":true}

Path Expressions

A JSON Path expression is used to represent one or more nodes or values in a JSON structure and is also used for data filtering and further data insight.
Write a Simple Path Expression

There are two ways to write a simple JSON path expression
Simple Dot Notations
Generally used when keys are alphanumeric (e.g. contain only numbers and alphabets).
	Each dot notation signifies one level scan. For example: $.id represents the value corresponding to the first level “id” key.
JSON paths have a similar use for an n-level deep scan. For example: $.attributes.size path starts by finding the first level “attributes” key and then goes to the second level “size” key.
When double dots(..) are used, this represents a deep scan in the JSON structure. For example: $..value represents all of the values corresponding to all the “value” keys at any level in the structure.
Combine single and double dot expressions to create JSON path expressions. For example: $..size.value first searches for the entire document and gets all the values corresponding to “size” keys at any level. Within these values, the values corresponding to the next level “value” key are then retrieved.
Whenever an array is encountered while writing a JSON path expression, specify the index of that array. For example: $.children[0].variableName gets the variable name from the first child.
When writing simple JSON path expression, combine dot, double-dots, object, and array notations to intuitively represent one or more values.
One JSON path can also represent multiple values. For example: $..label will represent two different values.
Bracket Notations

Bracket notations are generally used when keys are not alphanumeric, but the overall intuition is exactly the same as dot notations.
For example: $.['attributes'].['size'].['label'],$.['children'][0].['quantity'] Use the following operators to write complex JSON path expressions.

Dot Operators

  Operators
  Description

$

The root element that starts all path expressions.

@

The current node within the processed filter.

*

Name or numeric wildcard character.

..

Used to search all child nodes.  Generates an array of results.

.<name>

Single child relation representation.

['<name>' (, '<name>')]

Single or many child relation representation.

[<number> (, <number>)]

Single or many array index representation.

[start:end]

Array range representation.

[?(<expression>)]

Boolean filter expression.

  The min(), max(), avg(), and stddev() functions can be used to evaluate an array of numbers.  The length() function can be used to provide the size of an array result.
Boolean filter expressions help reduce a JSON array to a subset of intended values.  A typical filter is $.children[?(@.quantity> 1)] where @ represents the current node being processed. Create more complex filters with logical operators && and ||. Ensure string literals are enclosed by single quotes: $.children[?(@.partNumber == 'PT13345')]
Filter expressions support common comparison operators ==, !=, <, <=, >, >=, and the below advanced operators.

Advanced Operators

  Operators
  Description

=~

Left matches regular expression [?(@.name =~ /foo.*?/i)].

in

Left side is contained in right. [?(@.color in ['Red', 'Green'])].

nin

Left side is not contained in right.

size

Left side size is equal to right.

empty

Left side is empty.

JSON Path Examples

Given the following:
{
    "id": "7345ABCDE",
    "variableName": "BM54888-0",
    "partNumber": "BM54888",
    "quantity": 1,
    "definition": {
        "SequenceNum": 20,
        "ItemId": "EBS56321"
    },
    "fields": {
        "_price_list_price_each": 99.12,
        "line_action_code": "Update"
    },
    "attributes": {
        "size": {
            "value": "Large",
            "label": "Size"
        },
        "instruction": {
            "value": "Leave the package at the door.",
            "label": "Special Instruction"
        }
    },
    "children": [
        {
            "variableName": "BM54888-1",
            "partNumber": "PT13345",
            "quantity": 1
        },
        {
            "variableName": "BMDSK781-4",
            "partNumber": "DSK781-4",
            "quantity": 17
        }
    ],
    "numericVals": [1, 2, 4, 5.6, 89, 0.05],
    "Special key $$": true
}

JSON
 Path
Description / Output

$.id

Get the id.
"7345ABCDE"

$..value

Get all the values available at any level.
"Large"
"Leave the package at the door."

$.attributes.size.value

Get the value of the attributes - > size.
"Large"

$..size.value

Get the value of the size key available at any
 level.
"Large"

$.children[0]

Get the first child.
{"variableName":"BM54888-1",
  "partNumber":"PT13345","quantity":1}

$.children[0]..quantity

Get the quantity of the first child.
1

$.[ 'id']

Get the id.
"7345ABCDE"

$..[ 'value']

Get all the values available at any level.
"Large"
"Leave the package at the door."

$.[ 'attributes']..[ 'label']

Get all the labels under attributes.
"Size"
"Special Instruction"

$.['  Special key $$ ']

Get the value corresponding to given key.
true

$..children[0,1]

Get first and second children.
{"variableName":"BM54888-1",
  "partNumber":"PT13345","quantity":1}
  {"variableName":"BMDSK781-4",
  "partNumber":"DSK781-4","quantity":17}

$.children[?(@.quantity> 1)]

Get the children whose quantity is greater than 1.
{"variableName":"BMDSK781-4",
  "partNumber":"DSK781-4","quantity":17}

$.children[?(@.partNumber == 'PT13345')]

Get the children whose
 partNumber is 'PT13345'.
{"variableName":"BM54888-1",
  "partNumber":"PT13345","quantity":1}

$.numericVals.avg()

Get the avg of numeric values.
16.941666666666666

$.numericVals.length()

Get the length of the array corresponding to
 numericVals key.
6

$.children[?(@.partNumber nin ['PT13345'])].quantity

Get the quantity of the child whose partNumber is
 not 'PT13345'.
17

$..children[0].*

Get all the children values of first children.
BM54888-1"
"PT13345"
1

$.attributes.*

Get all the direct children of attributes node.
{"value":"Large","label":"Size"}
{"value":"Leave the package at the
 door.",
  "label":"Special Instruction"}

$.attributes..*

Get all the deep level children of attributes node.
{"value":"Large","label":"Size"}
{"value":"Leave the package at the
 door.",
  "label":"Special Instruction"}
"Large"
"Size"
"Leave the package at the door."
"Special Instruction"

$..children[-1:].quantity

Get the last child's quantity.
17

$..children[*].quantity

Get the quantities for all the children.
1
17

Use Case Examples
The following examples use  JSON to parse, extract, modify, add, or remove data using BML functions.
Convert a JSON String into a JSON Object

Given the following:jsonString="{\"asset-101\":{\"lines\":[{\"documentNumber\":\"33\",\"quantity\":\"1\",\"price\":8.9 },{\"documentNumber\":\"40\",\"quantity\":\"20\",\"price\":50}], \"finalDate\":null,\"finalAction\":\"UPDATE\",\"available\":true}}";
Input:jobjAsset=json(jsonString);print jobjAsset;
Output:{ 
   "asset-101":{ 
      "lines":[ 
         { 
            "documentNumber":"33",
            "quantity":"1",
            "price":8.9
         },
         { 
            "documentNumber":"40",
            "quantity":"20",
            "price":50
         }
      ],
      "finalDate":null,
      "finalAction":"UPDATE",
      "available ":true
   }
}

Use References to Modify JSON or JSON Array Object Values

JSON references can be used to retrieve and modify nested JSON or JSON array object values. The following functions return JSON or JSON array references: jsonget(), jsonarrayget(), jsonput(), and jsonarrayappend().
Given the following:jsonString="{\"asset-101\":{\"lines\":[{\"documentNumber\":\"33\",\"quantity\":\"1\",\"price\":8.9 },{\"documentNumber\":\"40\",\"quantity\":\"20\",\"price\":50}], \"finalDate\":null,\"finalAction\":\"UPDATE\",\"available\":true}}";
Get the Reference of a JSON Object with a Specific Document Number (documentNumber 40)
jobjLine=jsonpathgetsingle(jobjAsset,"$..lines[?(@.documentNumber=='40')]","json");// Print the asset object to view modificationsprint jobjLine;
Output:{ 
   "documentNumber":"40",
   "quantity":"20",
   "price":50
}

Use a Reference to Retrieve a Price
intPrice=jsonget(jobjLine,"price","integer");// Print the asset object to view modificationsprint intPrice;
Output: 50

 Use Reference "jobjLine" to Modify Quantity
jsonput(jobjLine,"quantity","99");// Print the asset object to view modificationsprint jobjAsset;{"asset-101":{"lines":[{"documentNumber":"33","quantity":"1","price":8.9},{"documentNumber":"40","quantity":"99","price":50}],"finalDate":null,"finalAction":"UPDATE","available ":true}}

Add a New JSON Object into a Lines JSON Array

Given the following:jsonString="{\"asset-101\":{\"lines\":[{\"documentNumber\":\"33\",\"quantity\":\"1\",\"price\":8.9 },{\"documentNumber\":\"40\",\"quantity\":\"20\",\"price\":50}], \"finalDate\":null,\"finalAction\":\"UPDATE\",\"available\":true}}";
Input:// Get the reference of the lines arrayjarrayLines=jsonpathgetsingle(jobjAsset,"$..lines","jsonarray");// Append an empty JSON object and get its referencejobjNewLine=jsonarrayappend(jarrayLines,json());// Add key-value pairs using the "jobjNewLine" referencejsonput(jobjNewLine,"documentNumber","43");jsonput(jobjNewLine,"quantity","10");jsonput(jobjNewLine,"price", 42);// Print the asset object to view modificationsprint jobjAsset;
Output:{"asset-101":{"lines":[{"documentNumber":"33","quantity":"1","price":8.9},{"documentNumber":"40",
"quantity":"99","price":50},{"documentNumber":"43","quantity":"10","price":42}],"finalDate":null,
"finalAction":"UPDATE","available":true}}

Add a New JSON Array into an Asset JSON Object

Given the following:jsonString="{\"asset-101\":{\"lines\":[{\"documentNumber\":\"33\",\"quantity\":\"1\",\"price\":8.9 },{\"documentNumber\":\"40\",\"quantity\":\"20\",\"price\":50}], \"finalDate\":null,\"finalAction\":\"UPDATE\",\"available\":true}}";
Input:// Add an empty JSON array object into an asset objectjarraySize=jsonput(jobjAsset,"size",jsonarray());// Use jarraySize reference to add further key-value pairsjsonarrayappend(jarraySize,"Large");jsonarrayappend(jarraySize,"Medium");jsonarrayappend(jarraySize,"Small");// Print the asset object to view modificationsprint jobjAsset;
Output:{"asset-101":{"lines":[{"documentNumber":"33","quantity":"1","price":8.9},{"documentNumber":"40","quantity":"99","price":50},{"documentNumber":"43","quantity":"10","price":42}],"finalDate":null,"finalAction":"UPDATE","available":true},"size":["Large","Medium","Small"]}

Use References to Modify an Asset Object

When a JSON or JSON array object is inserted using jsonput, jsonarrayappend, or jsonpathset a new reference object is created and inserted. Always use the new reference to make modifications to the object. 
Refer to the following  examples:// Create a new "jobjColor" referencejobjColor=json("{\"color\":\"red\"}");// Add the new "jobjColor" reference to a JSON asset objectjobjColor=jsonput(jobjAsset,"attribute",jobjColor);// Use an old "jobjcolor" reference to change the color to greenjsonput(jobjcolor,"color","green");// Use the new "jobjColor" reference to change the color to bluejsonput(jobjColor,"color","blue");// Print the asset object to view modificationsprint jobjAsset;// Note the modifications made using the old "jobjcolor" reference are not reflected in the asset object.
Output:{"asset-101":{"lines":[{"documentNumber":"33","quantity":"1","price":8.9},{"documentNumber":"40","quantity":"99","price":50},{"documentNumber":"43","quantity":"10","price":42}],"finalDate":null,"finalAction":"UPDATE","available":true},"size":["Large","Medium","Small"],"attribute":{"color":"blue"}}
jsonpathset()// Set the "finalAction" value to “ADD”jsonpathset(jobjAsset,"$..finalAction","ADD");
 
// Set the quantity of all lines to "8"
jsonpathset(jobjAsset,"$..lines..quantity","8");
 
// Add a new key with a null value
jsonput(jobjAsset,"newfield",jsonnull());
 
// If the final date is null, set it to the current date
// 1. Get the JSON object with first level key
jobjAsset101=jsonget(jobjAsset,"asset-101","json");
 
// 2. Check the "finalDate" and set the value
if (isjsonnull(jobjAsset101,"finalDate")){
jsonput(jobjAsset101,"finalDate",datetostr(getdate()));
}// Print the asset object to view modificationsprint jobjAsset;

 Note: Alternatively the following function can be used:

 jsonpathset(jobjAsset101,"$.finalDate",datetostr(getdate()));

Output:{"asset-101":{"lines":[{"documentNumber":"33","quantity":"8","price":8.9},{"documentNumber":"40","quantity":"8","price":50},{"documentNumber":"43","quantity":"8","price":42}],"finalDate":"06/28/2016 16:26:04","finalAction":"ADD","available":true},"size":["Large","Medium","Small"],"attribute":{"color":"blue"},"newfield":null}
jsonpathgetsingle()// Get the second quantityintQty=jsonpathgetsingle(jobjAsset,"$..lines[1].quantity","integer");print intQty; 
Output 8
jsonpathgetmultiple()// Retrieve multiple document numbersjarrayDoc=jsonpathgetmultiple(jobjAsset,"$..documentNumber");print jarrayDoc;
Output:  ["33","40","43"]
 Note: The jsonpathgetmultiple() function does not return references of the nested JSON or JSON  array objects. To return these references, retrieve the path(s) and use  jsonpathgetsingle. 
Refer to the following example to retrieve references of all JSON objects with a price > 5// 1. Get the pathjarrpath=jsonpathgetmultiple(jobjAsset,"$..lines[?(@.price>5)]",true);print jarrpath;
Output:[
"$['asset-101']['lines'][0]",
"$['asset-101']['lines'][1]",
"$['asset-101']['lines'][2]"
]

// 2. Loop through the JSON array containing the path
jarrsize=jsonarraysize(jarrpath);
dummyarr=string[jarrsize];
i=0;
for dummyElement in dummyarr {
path=jsonarrayget(jarrpath,i);

// 3. Use the path to get the reference
jobjRef=jsonpathgetsingle(jobjAsset,path,"json");

// 4. Use 'jobRref' to make changes
i=i+1;
}
jsonpathremove()

// 5. Remove the line with the document number of '33'
jsonpathremove(jobjAsset,"$..lines[?(@.documentNumber== '33')]");

// Print the asset object to view modifications
print jobjAsset;
Output:{"asset-101":{"lines":[{"documentNumber":"40","quantity":"8","price":50},{"documentNumber":"43","quantity":"8","price":42}],"finalDate":"06/28/2016 17:17:19","finalAction":"ADD","available":true},"size":["Large","Medium","Small"],"attribute":{"color":"blue"},"newfield":null}

Known Limitations and Issues
There are known limitations related to creating or updating a JSON or a JSON array object. 
Limitations and Issues for JSON Object Keys

Refer to the following guidelines:

JSON objects cannot have keys which are null objects.

It’s not possible to create or add a null object key in a JSON object.
jsonpathset() cannot update keys which contain the character "[" (opening square bracket).
jsonpathset() cannot update empty string keys ("").

Issues for JSON Object Values

Refer to the following guidelines:

The string "null" or 'null' (with the quotation marks being a part of the string) can’t be saved as value in a JSON object. Instead it will be saved as string null (i.e. without the double or single quotation marks .)

Any string, encircled by curly { } or square brackets [ ], which is also encircled by single or double quotation marks can’t be saved in this form as a value within a JSON object. The value will be saved without the quotation marks. For example, "{value1}", "[value2]", '{value3}', or '[value4]' is saved as {value1}, [value2], {value3}, or [value4].

Recommendations and Workaround Examples

We recommend you do not to use curly { } or square[ ] brackets in JSON keys. If a key contains an opening square bracket, you must use jsonput() or  json() function for updating instead of the jsonpathset() function.
If a value needs to be encircled by quotation marks, it may be necessary to use two pairs of quotation marks.
The following BML code demonstrates the behavior. j = json();value_string = "[value]";  //  a pair of square bracketsjsonput(j, "key", value_string);print "new value: " + jsonget(j, "key");  // this will show as new value: [value]value_string = "\"[value]\"";  // single pair of quotation marks around a pair of square bracketsjsonput(j, "key", value_string);print "new value: " + jsonget(j, "key");  // this will show as   new value: [value]   Same result as above.value_string = "\"\"[value]\"\"";  // two pairs of quotation marks around a pair of square bracketsjsonput(j, "key", value_string);print "new value: " + jsonget(j, "key");  // this will show as new value: ""[value]"" as expected

Related Topics

See Also