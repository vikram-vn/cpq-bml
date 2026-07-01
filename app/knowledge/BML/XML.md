---
id: XML
title: "XML Functions"
sidebar_label: "XML Functions"
description: "XML Functions Functions This group of functions streamlines XML manipulations. applytemplate This function applies a set of token key-value pairs to t..."
tags: ['BML', 'CPQ', 'Functions']
---

## XML Functions
Functions
This group of functions streamlines XML manipulations. 
applytemplate

This function applies a set of token key-value pairs to
 the template file using JSON data. 
  This function supports JSON data along with the already-existing dictionary
 payload. 
  If a value is present in both the dictionary payload and JSON data for the
 same key, the JSON data takes precedence over the dictionary payload.

**Syntax:**
```bml

```

String applytemplate(String templateFileLocation [, Dictionary payload [, String defaultErrorMessage [, Json jsonIdentifier]]])


| Parameter | Data Type | Description |
| --- | --- | --- |
| `templateFileLocation` | String | The location of the template file. |
| `payload` | Dictionary | The payload containing values for the defined tokens in |
| `the template.` | Optional. The default value is null. | defaultErrorMessage |
| `String` | The default error message to be displayed in case any | error is encountered. |
| `Optional. The default value is null.` | jsonIdentifier | Json |
| `The JSON containing values for the defined tokens in the` | template. | Optional. The default value is null. |


**Example:**

Template file
 test.txt: 4
This is user defined variable VAR1, value = {{VAR1}}.
This is user defined variable VAR2, value = {{VAR2}}This is user defined variable VAR3, value = {{VAR3}}.

BML:templateFileLocation = "$BASE_PATH$/ApplytemplateTest/test.txt";payload = dict("string");put(payload, "VAR1", "payloadVal1");put(payload, "VAR2", "payloadVal2");jsonObj = json("{\"VAR2\":\"jsonVal2\",\"VAR3\":\"jsonVal3\"}");output = applytemplate(templateFileLocation, payload, "", jsonObj);

Sample Output
This is user defined variable VAR1, value = payloadVal1.
This is user defined variable VAR2, value = jsonVal2.
This is user defined variable VAR3, value = jsonVal3.

> **Return Type:** `String that represents the result of applying a set of token key/value pairs to the template file. This set of token key/value pairs can come from either an explicitly user defined map, or implicitly imported rule input variables from System, Main Document or Sub-Document.`

Overwriting an imported rule input variable
Overwrite locally has higher precedence than overwrite globally.

Overwrite Globally
To overwrite an imported rule input variable, use the imported rule input variable name as the key in the user map. This value from the user map will be applied globally to either the main document or sub-document within the template.

Overwrite Locally
To overwrite an imported rule input variable within a specific document, use a prefix of "[documentNumber]~" (such as 1~) on the imported rule input variable name as the key in the user map.

Valid Formats for Template Files
The tokens in the template file should start with "{{" and end with "}}" signs. This is the list of valid formats and features.

Formats
Descriptions

{{YOUR_TOKEN_HERE}}

This token will be replaced by the string value defined by the key "YOUR_TOKEN_HERE" in the input payload dictionary.

{{#each <SubDocumentVariableName>}} {{/each}}

Used for looping through the instances of a Sub-Document.

{{#if YOUR_NOT_NULL_STRING_VALUE_HERE}} {{/if}}

This is a conditional statement.

{{formatDateString context originalFormat newFormat}}

This function is used to format context dateString from the original format to the new format.

Context: current date string 
OriginalFormat: format used for current date string
NewFormat: the format the output use. 
Return: dateString using the new format

For more information, refer to Java SimpleDateFormat.

{{#equal context compareTo}}{{else}}{{/equal}}

This is an equal block statement. If the context equals compareTo, then the template before the {{else}} will be rendered; otherwise the {{else}} will be rendered.

Example of {{#each <SubDocumentVariableName>}} {{/each}}

Imagine that the SubDocumentVariableName is "lineItem" and the attributes "_price_subtotal" and "_price_net_price" of the lineItem have been manually imported as rule inputs in BML scripts. To reference those attributes within the template, use the following code:{{#each lineItem}}<Line><PriceSubTotal>{{_price_subtotal}}</PriceSubTotal><PriceNetPrice>{{_price_net_price}}</PriceNetPrice></Line>{{/each}}

Example of {{#if YOUR_NOT_NULL_STRING_VALUE_HERE}} {{/if}}

Imagine this template:{{#if _type}}<Line><PriceSubTotal>{{_price_subtotal}}</PriceSubTotal></Line>{{/if}}

If the variable "_type" contains a not null value or non-blank value then the template will be rendered.
If the variable "_type" contains the value "" or null, then nothing will be rendered for the template.

Example of {{#equal context compareTo}}{{else}}{{/equal}} 
{{#equal price_type "RECURRING"}}<recurringprice>{{_recurringprice}}</recurringprice>{{else}}Price type is not recurring.{{/equal}}

If variable "price_type" is "RECURRING", then above template will be rendered as <recurringprice>34</recurringprice>.
If variable "price_type" is not "RECURRING", then "Price type is not recurring." will be rendered.
The {{else}} is optional.

Processing Rules for Template Files

Input payload should contain value of type String for each key.
All the variable and token names are not case sensitive.
There must be token specified within the {{}}, or error message will be returned.
Token in the template should not contain "~" sign, or error message will be returned.
If there is token specified within the {{}}, such as {{NO_TOKEN_VALUE_DEFINED}}, but no value is defined in either input payload nor imported variables, nothing will be rendered for this token.
The returned error message are not translated.
Special characters (such as &) will not display correctly in the debugger.
Some special characters in the token value are replaced by their HTML code equivalent, e.g. "=" is replaced with "& #x3D ;". To avoid this, the token must be specified with {{{}}}.

Example of Processing Rules for Template Files

(Template file test.txt content)
This is user defined variable VAR1, value = {{VAR1}}.
(BML script)templateFileLocation = "$BASE_PATH$/ApplytemplateTest/test.txt"payload = dict("string");put(payload, "VAR1", "Hello world");output = applytemplate(templateFileLocation, payload);return output;
(Result)
This is user defined variable VAR1, value = Hello world.

readxmlmultiple

 This function reads a set of multiple XML node contents based on a set of XPath expressions.

**Syntax:**
```bml
readxmlmultiple(String xmlPayload, String[] xpaths [, String defaultErrorMessage])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `xmlPayload` | String | xpaths |
| `String` | default ErrorMessage | String |

> **Return Type:** `String`

This function will return a BMLDictionary, where the String keys are the input xpaths and String values are the XPath evaluation results for the input xpaths.
If an error occurs, the function will return a BMLDictionary that contains the error message. The key for the error message in the BMLDictionary is "BM_READXMLMULTIPLE_ERROR".
Processing Rules
If a given XPath is evaluated as a single node in result, the returned String content is based on the node type and content. 

A node that contains white space only will be ignored.

EntityRef nodes are not processed, because DTD is not allowed.

Any element nodes in the sub-list are ignored.

The returned error message is not translated.

Node Type and Content
Returned String Content

 ATTRIBUTE_NODE
ATTRIBUTE_NODE value

Node that contains text content in its child nodes
The concatenated node values from TEXT nodes and CDATA nodes, if they contain not-empty text, are returned as the content of the node

Node that does not contain text content in its child nodes
 A String representation of the node (XML fragment)

Multiple ATTRIBUTE_NODE or ELEMENT_NODEs
Only the content of the first node string will be returned, based on String content retrieving rules

Defining Namespaces
To avoid abuse in the usage of the namespace prefix, the input argument xmlPayload should not contain namespace prefixes for more than 1,000 namespaces. Otherwise, the error message "IllegalArgumentException" will be returned.
There are three ways to define namespaces in a document: 

Default namespaces
No namespace
Namespaces with prefixes.

Namespaces are used differently, depending on their context.

Namespace Context
Namespace Use

The input XML document contains default namespaces, but the default namespace is not on the root
The element(s) in such a default namespace will be ignored.

The input XML document contains default namespaces on the root. The input XPath for these default namespace elements should contain a namespace prefix "BM_NS". 
If the return is an XML fragment, the returned evaluated result will contain the namespace attribute information.

The input XML document contains no namespaces
No namespace prefix is needed in the input XPath.

The input XML document contains namespaces with prefixes. A namespace prefix is needed in the input XPath.
If the return is an XML fragment, the returned evaluated result will contain the namespace attribute information.

Example of readxmlmultiple():

(BML script)xmlPayload = "<?xml version="1.0" encoding="UTF-8"?><library><book lang=\"en\">Spring in Action</book><book lang=\"fr\">J2EE Blueprint</book></library>";xpaths = string[1];xpaths[0] = "/library/book/@lang";output = readxmlmultiple(xmlPayload, xpaths);for xpath in xpaths {print("(key) = (" + xpath + ")");values = string[1];values = get(output, xpath);for value in values{ print(" (value) = (" + value + ")"); }}return "";
 Output:  (key) = (/library/book/@lang)(value) = (en)(value) = (fr)

 readxmlsingle 

This function reads a set of single XML node content based on a set of XPath expressions.

**Syntax:**
```bml
readxmlsingle(String xmlPayload, String[] xpaths [, String defaultErrorMessage])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `xmlPayload` | String | xpaths |
| `String` | default ErrorMessage | String |

> **Return Type:** `String`

This function will return a BMLDictionary, where the String keys are the input xpaths and String values are the XPath evaluation results for the input xpaths.
If an error occurs, the function will return a BMLDictionary that contains the error message. The key for the error message in the BMLDictionary is "BM_READXMLSINGLE_ERROR".
Processing Rules
If a given XPath is evaluated as a single node in result, the returned String content is based on the node type and content. 

A node that contains white space only will be ignored.

EntityRef nodes are not processed, because DTD is not allowed.

Any element nodes in the sub-list are ignored.

The returned error message is not translated.

Node Type and Content
Returned String Content

 ATTRIBUTE_NODE
ATTRIBUTE_NODE value

Node that contains text content in its child nodes
The concatenated node values from TEXT nodes and CDATA nodes, if they contain not-empty text, are returned as the content of the node

Node that does not contain text content in its child nodes
 A String representation of the node (XML fragment)

Multiple ATTRIBUTE_NODE or ELEMENT_NODEs
Only the content of the first node string will be returned, based on String content retrieving rules

Defining Namespaces
To avoid abuse in the usage of the namespace prefix, the input argument xmlPayload should not contain namespace prefixes for more than 1,000 namespaces. Otherwise, the error message "IllegalArgumentException" will be returned.
There are three ways to define namespaces in a document: 

Default namespaces
No namespace
Namespaces with prefixes.

Namespaces are used differently, depending on their context.

Namespace Context
Namespace Use

The input XML document contains default namespaces, but the default namespace is not on the root
The element(s) in such a default namespace will be ignored.

The input XML document contains default namespaces on the root. The input XPath for these default namespace elements should contain a namespace prefix "BM_NS". 
If the return is an XML fragment, the returned evaluated result will contain the namespace attribute information.

The input XML document contains no namespaces
No namespace prefix is needed in the input XPath.

The input XML document contains namespaces with prefixes. A namespace prefix is needed in the input XPath.
If the return is an XML fragment, the returned evaluated result will contain the namespace attribute information.

Example of readxmlsingle():

(BML script)xmlPayload = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><library><book lang=\"en\">Spring in Action</book></library>"; xpaths = string[1];xpaths[0] = "/library/book[1]/@lang";output = readxmlsingle(xmlPayload, xpaths);for xpath in xpaths{ print("(key, value) = (" + xpath + ", " + get(output, xpath) + ")"); }return "";
Output:(key, value) = (/library/book[1]/@lang, en)

transformxml


**Syntax:**
```bml
transformxml(String xml, String xslFileLocation [, String defaultErrorMessage])
```

This function transforms an XML string with an XSLT file stored in the File Manager.
It returns the transformed xml message, or the error message if it failed to transform. The error message will be either the default error message (if it is defined) or the system-generated error message, which starts with "ERROR: ".


| Parameter | Data Type | Description |
| --- | --- | --- |
| `xml` | String | xslFileLocation |
| `String` | Location of the XSL file. | default ErrorMessage |

> **Return Type:** `String`

 Example of transformxml(): 
xmlcontent = "<?xml version="1.0" encoding="UTF-8"?><book><id>123456</id></book>";xslt = "xsl/test.xsl";output = transformxml(xmlcontent, xslt); output has the generated result.

Related Topics

See Also