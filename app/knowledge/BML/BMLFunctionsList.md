---
id: BMLFunctionsList
title: "BML Functions List"
sidebar_label: "BML Functions List"
description: "BML Functions List BML functions are listed below are listed alphabetically and display the category link for each function. Function Category Descrip..."
tags: ['BML', 'CPQ', 'Functions']
---

## BML Functions List
BML functions are listed below are listed alphabetically and display the category link for each function.

Function
Category
Description

acos
Math

Returns the arc-cosine of the number or angle in the range of 0 through π.

adddays
Dates

Returns the date which is obtained after adding X number of days to a
 particular date.

addmonths
Dates

Returns the date which results after adding or subtracting a number of
 months from a specified date.

addpartstotransaction
Others

Adds parts to a quote automatically from within a transaction.

addtotransaction
Others

Adds models to a transaction using BML.

append
Arrays

Attaches a new element to the end of an array and can be used with
 initialized and uninitialized arrays.

applybom
Others (BOM Mapping)

Applies the passed in BOM to the base BOM and return the resultant BOM.

applytemplate
XML

Applies a set of token key-value pairs to the template file using JSON
 data.

asín
Math

Returns the arc-sine of a number or angle.

atan
Math

Returns the arc tangent of the number or angle, the range of which is:
 -π/2 ≤ y ≤ π/2.

atof
String

Converts text that represents a number into a float.

atoi
String

Converts text that represents a number into an integer.

BM_CM_RULES_LOCATION
Others (Constants)

Dictionary key for the rule's message location.

BM_CM_RULES_MESSAGE
Others (Constants)

Dictionary key for the rule's to be displayed for the violated
 constraint.

BM_CM_RULES_OPERATOR
Others (Constants)

Dictionary key for the rule's operator used to evaluate constraint, as in
 Simple Constraints.

BM_CM_RULES_VALUES
Others (Constants)

Dictionary key for the rule's values.

BM_CONFIGURATION_KEY
Others (Constants)

Generic key used to determine the current configuration context.

BM_DEFAULT_SOURCE_IDENTIFIER
Others (Constants)

The variable name of the commerce process or external application
 identifier.

BM_PARTNER_SECURITY_TOKEN
Others (Constants)

Represents the WSSE security Username Token for SOAP, used for sending
 stateless SOAP with UrlDataByPost.

BM_PRIOR_CONFIGURATION_KEY
Others (Constants)

Generic key used to determine prior configuration context.

BM_PRIOR_ROOT_BOM_ITEM
Others (Constants)

Projected state of the asset calculated for a requested date.

BM_REASON_STATUS_APPROVED
Others (Constants)

Reason exists in the user-side tree and it is approved by all approvers,
 therefore the reason is completely approved.

BM_REASON_STATUS_INACTIVE
Others (Constants)

Reason exists in admin reason tree but the condition for the reason is
 not met, therefore no record for it exists in the user-side tree.

BM_REASON_STATUS_INVALID
Others (Constants)

No reason exists in admin reason tree with given variable name.

BM_REASON_STATUS_PENDING
Others (Constants)

Reason exists in the user-side reason tree and there are pending
 approvals.

BM_REASON_STATUS_REJECTED
Others (Constants)

Reason exits in user-side tree, but has been rejected by at least one
 approver.

BM_REMOTE_APPROVAL_STATUS_APPROVED
Others (Constants)

Approved Status. This is used in Remote Approvals in the tilde separated
 approval history to be returned in the BML in Approve/Reject action.

BM_REMOTE_APPROVAL_STATUS_CUSTOM
Others (Constants)

Custom Status. This is used in Remote Approvals in the tilde separated
 approval history to be returned in the BML in Approve/Reject action. This can
 be used for anything other than Approved/Rejected.

BM_REMOTE_APPROVAL_STATUS_REJECTED
Others (Constants)

Rejected Status. This is used in Remote Approvals in the tilde separated
 approval history to be returned in the BML in Approve/Reject action.

BM_SALES_ROOT_BOM_ITEM
Others (Constants)

Sales BOM used for launching configurator.

BM_UNCHANGED_DATE
Others (Constants)

Constant for 'Leave Value Unchanged' for Date.

BM_UNCHANGED_NUM
Others (Constants)

Constant for 'Leave Value Unchanged' for Number.

BM_UNCHANGED_STR
Others (Constants)

Constant for 'Leave Value Unchanged' for string.

bmql
Direct DB Access

Returns a record set containing the results of the SQL query. You can
 query system tables and Data Tables using a SQL-like syntax.

boolean[n]
Arrays

Initializes a 1-D Boolean array with the specified size.

boolean[n][n]
Arrays

Initializes a 2-D Boolean array with the specified size.

break
Conditional

Breaks a for...loop at the element that you define.

bytearray
Arrays

Stores a collection of binary data such as the contents of a file. It
 encodes the given string into a sequence of bytes using the specified
 character encoding.

calculateconfiguration
Others (BOM Mapping)

Calculates the projected configuration for a list of open order lines
 passed as input and returns a configuration key that will be used to load the
 projected state of the configuration when a configurator session is launched.
 This function is used in subscription order implementation.

calculatedeltabom
Others (BOM Mapping)

Compares the prior BOM with current BOM and then returns the difference
 between the two with appropriate action code for each item.

ceil
Math

Converts a float into the next highest whole number.

comparedates
Dates

Compares two dates based on date and time.

containskey
Dictionaries

Checks to see if the key is found in the dictionary.

continue
Conditional

Calls out an element from an array and essentially skips it, but
 continues looping through the rest of the array. Unlike the break function,
 the loop continues after it skips over the element.

convertbomtoflat
Others (BOM Mapping)

Converts a flattened BOM into a hierarchical BOM.

convertbomtohier
Others (BOM Mapping)

Converts a hierarchical BOM into a flattened BOM.

cos
Math

Returns the cosine of the number/angle.

cosh
Math

Returns the hyperbolic cosine of a number or angle.

date[n]
Arrays

Initializes a 1-D Date array with the specified size.

date[n][n]
Arrays

Initializes a 2-D Date array with the specified size.

datetostr
Dates

Converts a date to a string.

decodebase64
String

Takes an encoded Base64 string and returns it as a plain text string.

dict
Dictionaries

Creates a dictionary of a specific data type.

dict<anytype>
Dictionaries

Used to add multiple types of
 objects in a dictionary.

encodebase64
String

Parses the string parameter and converts it into its Base64 equivalent,
 as an encoded string.

endswith
String

Checks whether a string starts with a particular sub-string.

exp
Math

Returns Euler's number e raised to the power of the number passed through
 the function, also known as the exponential function.

fabs
Math

Returns the absolute value of a number.

find
String

Returns the position of a sub-string within a string.

findinarray
Arrays

Checks whether a certain element exists in an array. If it does, the
 index is returned, otherwise a -1 is returned. arrays.

float[n]
Arrays

Initializes a 1-D Float array with the specified size.

float[n][n]
Arrays

Initializes a 2-D Float array with the specified size.

fmod
Math

Returns the remainder of the division operation x, y.

for...loop
Conditional

Loops through a block of code until a specific condition is met.

formatascurrency
String

Takes a number and returns it as a formatted currency string.

generatehmacmessage
Others

Creates Hash-based Message Authentication Codes for use in securing
 outbound web service calls to public web services.

get
Dictionaries

Retrieves the value of the provided key from the dictionary.

getarrayattrstring
Others

Returns the delimited string for array attributes with $,$ as the
 delimiter.

getattachmentdata
Others

Returns the file name (filename), file content (filecontent), and MIME
 type (mimetype) of a given file attachment attribute in a dictionary of
 <anytype>.

getbom
Others (BOM Mapping)

Retrieves the saved sales BOM or manufacturing BOM from a transaction, to
 submit to the fulfillment system for order fulfillment.

getboolean
Direct DB Access

Returns the boolean value in the record for the provided field name.

getconfigattrvalue
Others

Retrieves the values of configuration attributes in Commerce.

getconfigbom
Others (BOM Mapping)

Retrieves the configbom stored via the saveConfigBom API and the
 configBom created via an external client application Configurator UI session.

getcurrencyvalue
String

Takes a formatted currency string and returns the string's numeric
 value.

getcurrenttimeinmillis
Dates

Returns the current time in milliseconds.

getdate
Dates

Returns the current date/time based on the base time zone you have set-up
 in your application.

getdate (for bmql)
Direct DB Access

Returns
 the date value in the record for the provided field name.

getdiffindays
Dates

Calculates the number of days between two different dates. 

getfloat
Direct DB Access

Returns the float value in the record for the provided field name.

getint
Direct DB Access

Returns the integer value in the record for the provided field name.

getmessage
Direct DB Access

Returns the error message in the given record set if it has errors with
 query execution; empty otherwise.

getoldvalue
Others

Retrieves an old value for given variable name containing old value and
 document number.

getpartsdata
Direct DB Access

This function is deprecated, and no longer supported. Use BMQL() instead.

getreasonstatus
Others

Returns the status of the reason variable name in an approval sequence.

getstrdate
Dates

Returns the string representation of current date.

getsystemattrvaIues
Others (System Configuration)

Returns a string containing a single attribute's values from a System
 Configuration.

getsystemdata
Others (System Configuration)

Provides a hierarchical JSON structure representing the structure of the
 system, along with the key components of configured models in the
 system.

getsystemmultipleattrvalues
Others (System Configuration)

Returns dictionary key and value string arrays containing attribute
 values from a System Configuration.

gettabledata
Direct DB Access

This function is deprecated, and no longer supported. Use BMQL() instead.

gettransaction
Direct DB Access

Retrieves the transaction XML for a given Transaction ID as a string.

getuuid
Others

Generates unique IDs for assets tracked in Asset-Based Ordering.

globaldictget
Other (Global Dictionary)

Returns a value stored in the global dictionary corresponding to the
 given key.

globaldictremove
Other (Global Dictionary)

Removes a given key-value pair from the global dictionary.

globaldictset
Other (Global Dictionary)

Adds or updates the key-value pair in the global dictionary.

haserror
Direct DB Access

Returns true if fetching the given record set failed and has errors with
 query execution; false otherwise.

html
String

Provides a method for HTML escaping (output encoding) of a string as safe
 plain text.

hypot
Math

Returns the sqrt(x2 + y2) without intermediaries.

if...
Conditional

Performs the statement if the condition is true.

if...else
Conditional

Performs the statement if the condition is true. If that condition is
 false, then a different statement is run.

if...else...if
Conditional

Performs the if… else logic with two or more conditions.

importtransactiondata
Others

Imports the transaction data.

integer
Math

Returns the integer portion of a float number.

integer[n]
Arrays

Initializes a 1-D Integer array with the specified size.

integer[n][n]
Arrays

Initializes a 2-D Integer array with the specified size.

invoke
Others

Invokes global table functions.

isempty
Arrays

Determines if the array is empty. 

isjsonnull
JSON

Gets an instance of the JSON null object.

isleap
Dates

Determines whether the date falls within a leap year. The function will
 return true if the year provided as a parameter is a leap year.

isnull
Others

Evaluates whether a particular Object is null or not. Returns true if
 argument passed is null.

isnumber
String

Returns true when the string is a number and false if it contains other
 characters.

isweekend
Dates

Determines whether a date falls within a weekend (Saturday or Sunday).
 The function will return true if the date provided as a parameter is a
 Saturday or Sunday.

jNaN
Math

Java constant for Not a Number.

join
String

Concatenates a string array into a string with a specified delimiter.

json
JSON

Creates a JSON object.

jsonarray
JSON

Creates a JSON array object.

jsonarrayappend
JSON

Appends the given value at the end of the JSON array.

jsonarraycopy
JSON

Returns a copy of the of the given JSON array object.

jsonarrayget
JSON

Gets the value from the JSON array object for the index provided.

jsonarrayrefid
JSON

Returns a unique reference ID that represents the input JSON array.

jsonarrayremove
JSON

Removes an object specified at given index from the JSON array.

jsonarraysize
JSON

Returns the size of the JSON array.

jsonarraytostr
JSON

Converts a JSON array object into a JSON array formatted string.

jsoncopy
JSON

Creates a copy of the given JSON object.

jsonget
JSON

Returns the value from the JSON object for the key provided.

jsonkeys
JSON

Retrieves all first-level keys from a JSON object and returns an array of
 strings.

jsonnull
JSON

Returns an instance of the JSON null object.

jsonpathcheck
JSON

Checks if a JSON path is found in a JSON object.

jsonpathgetmultiple
JSON

Retrieves the value(s) and path(s) from the JSON object for the given
 JSON path expression.

jsonpathgetsingle
JSON

Retrieves the value from the JSON object for the given JSON path
 expression.

jsonpathremove
JSON

Removes the object(s) and value(s) corresponding to a given JSON path
 expression.

jsonpathset
JSON

Updates all of the nodes corresponding to a given JSON path expression
 with a given value.

jsonput
JSON

Puts an entry (key-value) into the JSON object.

jsonremove
JSON

Removes the first-level key-value pair from the JSON object.

jsontostr
JSON

Converts a JSON object into a JSON formatted string.

keys
Dictionaries

Use this function to retrieve an unordered string Array of all keys found
 within a dictionary.

len
String

Returns the length of a string.

ln
Math

Returns the natural logarithm (base e) of the number.

log
Math

Returns the base-10 logarithm of the number.

logtime
Others

Writes an event to the Performance Log table, which is visible by
 filtering on "BML" for the Event Type.

lower
String

Converts all characters in the text into all lowercase letters.

makeurlparam
String

Converts a series of name-value pairs into a query string, which can be
 appended to a URL.

max
Arrays

Returns the largest element of an integer or float array.

min
Arrays

Returns the smallest element of an integer or float array. 

minusdays
Dates

Returns a date that is x days before the base date

NaN
Math

This function is deprecated, and no longer supported. Use jNaN instead.

pow
Math

Returns the value of the first argument raised to the power of the second
 argument.

print
Others

Prints into the console window of the Function Editor.

put
Dictionaries

Define keys and values to put into the dictionary.

range
Arrays

Declares an integer array with a specified size and initializes it to its
 index value.

readxmlmultiple
XML

Returns a BML dictionary from a set of multiple XML node contents based
 on a set of XPath expressions.

readxmlsingle
XML

Returns a BML dictionary from a set of single XML node content based on a
 set of XPath expressions.

recordset
Direct DB Access

Returns a new record set to be used for later assignments. It is a
 collection of dictionaries. It can also be used as a function in conjunction
 with BMQL.

remove
Arrays

Removes an element from an existing array based on a given index.

replace
String

Returns a copy of a string, with all occurrences of the old parameter
 replaced with the new parameter.

reverse
Arrays

Reverses all elements in the array.

round
Math

Returns the rounded value of a number up to a certain decimal point.

savebom
Others (BOM Mapping)

Saves a BOM into a transaction without Configuration attributes and
 returns the document number of the saved transaction.

saveconfigbom
Others (BOM Mapping)

Saves a client integration BOM instance and a "configId" to the
 Oracle CPQ configBomInstance resource and returns a "configId".

sbappend
Others

Attaches a new element to the end of the string builder object.

sbtostring
Others

Converts the finished stringbuilder element to a string.

setattributevalue
Others

Sets a Commerce attribute value on a Main document or Sub-document.

sin
Math

Returns the trigonometric sine of the number/angle.

sinh
Math

Returns the hyperbolic sine of a number or angle.

sizeofarray
Arrays

Returns the length of the array for a 1-D array and the number of rows
 for a 2-D array.

sort
Arrays

Sorts array elements based on defined sort method. You can sort in
 ascending or descending order. 

split
String

Splits a string at the specified separator, populates a string array, and
 trims all of the blank spaces from the result.

sqrt
Math

Returns the positive square root of a number.

startswith
String

Checks whether a string ends with a particular sub-string.

string
String

Converts a float, integer or boolean value into text.

string[n]
Arrays

Initializes a 1-D string array with the specified size.

string[n][n]
Arrays

Initializes a 2-D string array with specified size.

stringbuilder
Others

Generates large strings using "stringbuilder",
 "sbappend", and "sbtostring".

strtodate
Dates

This function is deprecated, and no longer supported. Use strtojavadate()
 instead.

strtojavadate
Dates

Converts a string to a date and replicates Java behavior. 

substring
String

Returns a part of the text from a larger text.

tan
Math

Returns the tangent of the number/angle.

tanh
Math

Returns the hyperbolic tangent of a number or angle.

throwerror
Others

Stops the execution of a BML script and displays either a business logic
 error or a system error to the end user.

transformxml
XML

Transforms an XML string with an XSLT file stored in the File Manager.

trim
String

Removes the white space from both edges of strings.

upper
String

Convert all characters in the text into all lowercase letters.

urldata
URL Access

Sends and receives data from a URL using HTTP GET, POST, PUT, or PATCH
 methods.

urldatabyget
URL Access

Retrieves data from a URL address by the HTTP Get Method.

urldatabypost
URL Access

Passes parameters separately from the URL. It is useful when handling
 sensitive data and/or larger requests. It allows for encrypted requests.

urldatabypostasync
URL Access

Retrieves data asynchronously from a URL using HTTP POST

urlmultipartbypost
URL Access

Sends a multi-part message with attachments for Remote Approvals.

usersessionget
Others (User Sessions)

Retrieves a value for a given key from a user session. If the key is not
 found, null is returned.

usersessionremove
Others (User Sessions)

Removes a key-value pair from the user session.

usersessionset
Others (User Sessions)

Sets a key-value pair to the user session.

validatequoteforagreement
Others

Validates that all prerequisites are satisfied prior to creation of an agreement.

values
Dictionaries

Gets the array of the values of all the dictionary entries.

Related Topics

See Also