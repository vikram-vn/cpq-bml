---
id: Others-SysConfig
title: "Other Functions"
sidebar_label: "Other Functions"
description: "Other Functions System Configuration Functions The following BML functions are used to retrieve System Configuration attribute values from other confi..."
tags: ['BML', 'CPQ', 'Functions']
---

## Other Functions
System Configuration Functions
The following BML functions are used to retrieve System Configuration attribute values from other configured models within the system. These BML functions are available in configuration context only and not available in commerce.

Note: These functions should only be used with System Configurations. System Configurations are BOM hierarchies that contain one or more nested child models.

getsystemdata

Returns a JSON object containing the entire representation of the System Configuration Data.
Syntax:
getsystemdata()
Response Parameters:

Parameter

 Value Type

Description

id

String
The identifier for this item

documentNumber

Integer

The document number of the Oracle CPQ Commerce line item for this item.
Value of -1 when this item has not yet been saved to Oracle CPQ Commerce.

configAttributes

JSON

If this item identifies a model:

Attribute variable name is the key, attribute value is the value

JSON representation of the known attribute values (minus HTML attributes)

children

Array
If the item has children, contains an array of children items.

conditionIndex

Integer

Index of the innermost containing the Configuration array where this item is found.
Value of 0 if this item is not found in an array.

Example:systemJson = json();systemJson = getsystemdata();

Notes:

This function will not return the value of HTML attributes. This behavior is consistent with other configuration rules that do not allow the selection of HTML attributes.

When not in the context of a Configuration session, an empty JSON object is returned.
If System Configuration Data does not exist, an empty JSON object is returned.
This function will also return an empty JSON object if a System Configuration has not yet been configured. The empty JSON object should be handled accordingly.

getsystemattrvalues

This function returns a string containing a single attribute's values from a System Configuration.
Syntax:
getsystemattrvalues(String jsonPath)
Parameters:

Parameter
Data Type
Description

jsonPath	

String

A string containing the JSON path

ExamplemodelValue = String[];modelValue = getsystemattrvalues("$.configAttributes.attributeVarname");

Notes:

This function will not return the value of HTML attributes. This behavior is consistent with other configuration rules that do not allow the selection of HTML attributes.

If the JSON Path does not return an array of single values, empty string array ("[]") will be returned.
The function will also return empty values for any models that are yet to be configured and paths that do not return values. The empty array should be handled accordingly.

getsystemmultipleattrvalues

  This function returns dictionary key and value string arrays containing attribute values from a System Configuration.
Syntax:
getsystemmultipleattrvalues(Dictionary<String>)
Parameters:
Dictionary with String keys and String values. The values are expected to be JsonPath Expressions.

The key should be an identifier for the attributes identified in the associated value.

The values are expected to be JSON Path expressions that identify the location of the attribute in the fully expanded system definition (BOM).

Response Parameters:
Returns a Dictionary (key: String, value: String[]) containing attribute values from a System Configuration.

The keys will be the identifiers provided in the input Dictionary.
The values will be the configured attribute values of the attribute(s) at the JSON Path expressions associated with the input key.

ExamplejsonPaths = dict("string");put(jsonPaths, "attributeVarname", "$.configAttributes.attributeVarname");put(jsonPaths, "childAttributeVarname", "$.children[*].configAttributes.childAttributeVarname");interModelValues = dict("string[]");interModelValues = getsystemmultipleattrvalues(jsonPaths);values = String[];values = get(interModelValues, "attributeVarname");

Notes:

This function will not return the value of HTML attributes. This behavior is consistent with other configuration rules that do not allow the selection of HTML attributes.

If a JSON Path does not return an array of single values, that key-value pair will result in an empty array.
The function will return empty arrays for models that have not been configured and paths that do not return values. The empty arrays should be handled accordingly.

Notes

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

 

Related Topics

See Also