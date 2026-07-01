---
id: Dictionary
title: "Dictionary Functions"
sidebar_label: "Dictionary Functions"
description: "Dictionary Functions Functions Dictionaries are used to store key value pairs. Their purpose is similar to that of an array or Data Table. A dictionar..."
tags: ['BML', 'CPQ', 'Functions']
---

## Dictionary Functions
Functions
Dictionaries are used to store key value pairs.  Their purpose is similar to that of an array or Data Table.  A dictionary key is used to look up a value. Dictionaries allow users to store and retrieve data quickly and easily.   Once you have created a dictionary, values are stored using a key.  You can attach a value with any data type to a dictionary, except another dictionary.  When you declare a dictionary, ensure to declare what data type is needed. 
containskey

This is a dictionary function that checks to see if the key is found in the dictionary.

 Syntax: containskey(dictIdentifier, key)
Parameters:

Parameter
Data Type
Description

dictIdentifier

Dictionary
 Identifies the dictionary being searched to find if it contains the key you have identified.

key

String, Integer, or Float
 Unique identifier for the value parameter.

Return Type: Boolean 
Example:

dict

This function is used to create a dictionary of a specific data type, which is specified by the dictType parameter.

 Syntax: dict(dictType)
Parameters:

Parameter
Data Type
Description

dictType
 

dictType> represents one of the
 following data types:

string
integer
float
date
boolean

string[]
integer[]
float[]
date[]

string[][]
integer[][]
float[][]
date[][]

 Specify the data type of the dictionary.

 Return Type: Boolean
dict<anytype>

This function supports the addition of multiple types of
 objects in a dictionary. The dictionary get( ), put( ), and keys( ) functions
 also now support the addition or retrieval of values or keys from a
 dict<anytype>.
Syntax:dict(String <anytype>)

Parameter
Data Type
Description

<anytype>
 

String
 

<anytype> represents one or more combinations of the
 following data types:

string
integer
float
date
boolean
JSON
JSON array
byte array

string[]
integer[]
float[]
date[]
string[][]
integer[][]
float[][]
date[][]

dict<string>
dict<anytype>
dict(dict<anytype>)

Sample Input:d1 = dict("anytype");put(d1, "key1", "value1");jObj = json("{\"K1\":\"V1\"}");put(d1, "key2", jObj);
Return: A dictionary to contain key-value entries of various data
 types is created and two key-value entries are inserted into the dictionary.

get

This function retrieves the value of the provided key from the dictionary.

 Syntax: get(dictIdentifier, key)
Parameters:

Parameter
Data Type
Description

dictIdentifier

Dictionary
 Identifies the dictionary you are retrieving values from.

key

String, Integer, or Float
 Unique identifier for the value parameter.

 Return Type: The return type is based on the dictionary data type
 Example: 
Below, three separate keys and values have been defined and placed within the same dictionary. 

keys

Use this function to retrieve an unordered String Array of all keys found within a Dictionary. If the Dictionary does not contain any keys, an empty array is returned. 
 Syntax: keys(Dictionary dictionaryIdentifier)
 Return Type: All keys will be cast as a String and returned in an array in no particular order.
Example :d= dict("string");put(d, "1", "string1");put(d, "2", "string2");put(d, 1, "string3");put(d, 2, "string4");return keys(d);
This function will return a string array with 4 string elements.

put

Once a dictionary has been created, you can define keys and values to put into the dictionary.
 Syntax: put(dictIdentifier, key, value)
Parameters:

Parameter
Data Type
Description

dictIdentifier

Dictionary
 Identifies the dictionary you are adding values to.

key

 String, Integer, or Float
 Unique identifier for the value parameter.

value

 String, Integer, or Float
 Data value that relates to the unique key identifier.

Return Type: Boolean
Example of put(): 

values

Gets the array of the values of all the dictionary entries.
The dictionaries supported are: "string", "integer", "float", "string[]", "integer[]", "float[]", "date", "date[]",

Note: Double dimensional dictionaries, boolean dictionaries, and dictionary anytype are not supported by the values function.

Syntax: values(Dictionary dictionaryIdentifier)
Example:d= dict("string");put(d, "key1", "string1");put(d, "key2", "string2");return values(d);
This function will return a string array with 2 string elements.

Notes

Dictionaries have better speed and performance than performing table cells.

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

Related Topics

See Also