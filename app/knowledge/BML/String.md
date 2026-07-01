---
id: String
title: "String Functions"
sidebar_label: "String Functions"
description: "String Functions Functions String data types allow any type of text character to be returned. However, be aware that not all string functions have return values of the string type. atof This function..."
tags: ['BML', 'CPQ', 'Functions']
---

## String Functions
 Functions
 String data types allow any type of text character to be returned. However, be aware that not all string functions have return values of the string type.
 atof


 This function converts text that represents a number into a float value.

**Syntax:**
```bml
atof(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Given input string that is to be parsed into a float value. |

> **Return Type:** `Float`

 Error messages:
 If you attempt to pass an empty string or a string with letters into either  atoi  or  atof , you will see:


 Example of atof and atoi:


 An empty string will throw an exception error.


 atoi


 This function converts text that represents a number into an integer value.

**Syntax:**
```bml
atoi(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Given input string that is to be parsed into an integer value. |

> **Return Type:** `Integer`

 Error messages:


 If you attempt to pass an empty string or a string with letters into either  atoi  or  atof , you will see:


 If you attempt to pass a string with a decimal point ("123.456") into  atoi , you will see:


 Example of atof and atoi:


 You can't parse a string with a decimal point into an integer.
 An empty string will throw an exception error.


 decodebase64


 Takes an encoded Base64 string and returns it as a plain text string.

**Syntax:**
```bml
decodebase64("str")
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | A Base64-encoded string |

> **Return Type:** `String`


**Example:**

 decodebase64("YWJj");  will return the plain text format of the Base64-encoded string parameter. In this example, it is  abc .


 encodebase64


 This function parses the string parameter and converts it into its Base64 equivalent, as an encoded string.
   Syntax :  encodebase64("str")


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Given input string that is to be converted into its Base64 equivalent as an encoded string. |

> **Return Type:** `String`

  Example of encodebase64:
 encodebase64("abc");  will return the Base64 format of String "abc". In this example, it is  YWJj .
  Example of using encodebase64 for information in a URL string  webSvcsUser = "WebSvcsUserHere";
webSvcsPassword = "WebSvcsPasswordHere";

webSvcResult = dict("string");
headers = dict("string");

httpAuthUserAndPassword = webSvcsUser + ":" + webSvcsPassword;
httpAuthEncodedString = encodebase64(httpAuthUserAndPassword);

put(headers, "Authorization", "Basic " + httpAuthEncodedString);

print _user_session_id;

url = "https://sitename.oracle.com/rest/v8/commerceDocumentsBase_process_bmClone_5Transaction/7737901/transactionLine";
params = "";

webSvcResult = urldata(url, "GET", headers, params);

print webSvcResult;

return "";


 endswith


 This function checks whether a string ends with a particular substring.
   Example Use Case:  Determine if a part number starts with a certain text and if a part number contains a specific suffix.

**Syntax:**
```bml
endswith(str, substring)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |
| `substring` | String | Determines if the given input string ends with this substring. |

> **Return Type:** `Boolean`

 Example of startswith and endswith:


 We know that the return of  endResults  will be true because the string "I like this string", ends with the substring "string".

 An empty string will return as true.
 This function is case-sensitive.


 find


 This function returns the position of a substring within a string.
 Example Use Cases:

 Multi-select menu checking
 Find a value or where a value exists within a string
 Powerful when used with a substring function


**Syntax:**
```bml
find(str, substring, [start], [end])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |
| `substring` | String | Required string parameter that specifies the substring, position of which this function will return. |
| `[start]` | Integer | Optional:  Can be used to specify the index at which to begin the search for the substring. |
| `[end]` | Integer | Optional:  Can be used to specify the index at which to end the search for the substring. |

> **Return Type:** `Integer`


**Example:**

 This example uses four different variations of the find function:

   emptyTest:  We are trying to see what will be returned if we pass two empty strings through the  find  function.
   test_2:  what will happen if you try to pass the same two empty strings, but also define the optional start index for the substring.
   longTest:  shows what is returned when we pass through a string and substring, but begin searching for the substring at an index that is outside of the length of the string.
   result:  shows what happens if  find  is looking for a substring and contains both a start and end index.


 Find("", "")  or  find("", "", num>0)  returns 0.
   Find("str", "substring", start>length(str))  returns -1.
 If not specified, start is 0 and end is  length(str)

 This function is case-sensitive.


 formatascurrency


 Takes a number and returns it as a formatted currency string.

 This function takes the first parameter and formats that number to the transaction's currency if used within a commerce transaction or the current user's currency otherwise.
 The second parameter can be included to format the value to a different currency if desired.


**Syntax:**
```bml
formatascurrency(x, [currencyCode])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | The number to be formatted as a certain currency. |
| `currencyCode` | String | Optional:  The desired currency. |

> **Return Type:** `Boolean`


**Example:**

 formatascurrency(32.15, "EUR");  will return the string "€32,15".


 getcurrencyvalue


 This function takes a formatted currency string and returns the string's numeric value. It parses the first parameter using the currency format specified by the currency code passed in the second parameter and returns the float value.

**Syntax:**
```bml
getcurrencyvalue(value, [currencyCode])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `value` | String | The formatted currency string to be converted to a numeric value. |
| `[currencyCode]` | String | Optional:  The currency code to use for parsing the first parameter. |

> **Return Type:** `Float or Boolean`


**Example:**

 getcurrencyvalue("€32,15", "EUR");  will return the Float 32.15.


 html


 This function provides a method for HTML escaping (output encoding) of a string as safe plain text. This applies for content that originated from user input which could be vulnerable to injection attacks such as cross-site scripting (XSS).
 Oracle CPQ recommends using html as a best practice for content written to a web page to avoid possible injection attacks since the string will be rendered as inactive plain text on the web page.

**Syntax:**
```bml
String html(String str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | The formatted string to be rendered as inactive plain text. |

> **Return Type:** `String`

 Examples:
 Safe content example:  html("<test>");  will return the string "&lt;test&gt;
 Unsafe/XSS attack example where content is neutralized:  html("<script>/*Bad content here ... */</script>");  will return the string  &lt;script&gt;/* Bad content here... */&lt;/script&gt;
 For more information about Cross-site Scripting (XSS), refer to  OWASP Cross-Site Scripting .


 join


 This function concatenates a String array into a String with a specified delimiter.

 If str_array is empty, then the function returns an empty string.
 If both str and delimiter are empty, then the function returns an empty string.
 If delimiter is empty, then the function returns all the array entries concatenated.


**Syntax:**
```bml
join(String[] str_array, String delimiter)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str_array` | Array | The original string array. |
| `[delimiter]` | String | Optional:   Specifies where to put a space between the strings in the array. |

> **Return Type:** `Boolean`


**Example:**

 strArr1 = string[]{"1", "2", "3"}; strArr2 = join(strArr1, "");  will set the value of strArr2 to "123".
 This function is case-sensitive.


 isnumber


  The Boolean function  isnumber(str)   returns true when the string is a number and false if it contains other characters.
 Example Use Case:  Check if a table cell contains a number. This check needs to be performed to prevent system errors when converting that value to a number.

**Syntax:**
```bml
isnumber(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |

> **Return Type:** `Boolean`


**Example:**


 If  str  is an empty string, then the function returns false.
 If no string is passed into the function, then a compile time error is thrown.


 len


 The  len  function returns the length of a string.
   Example Use Case:  To constrain the length of an input text field.

**Syntax:**
```bml
len(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |

> **Return Type:** `Integer`


**Example:**


 If  str  is an empty string, then the function returns a 0.


 lower


 This function converts all characters in the text into all lowercase letters.
  Example Use Cases:

 Used in table comparisons to make sure you have clean data.
 Ignore case in searches.
 Correcting mistakes made from not following Best Practices during implementation.


**Syntax:**
```bml
lower(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Given input string that must be converted to lowercase. |

> **Return Type:** `String`

 Example of upper & lower:


 The code will print three different examples:

 Application of the  upper(str)  function to a typical output string.
 Application of the same function to an empty string.

 Application of the  lower(str)  function to the same string.  You will notice a blank space in between the  upper(str)  and  lower(str)  functions.   This represents the return that will occur if you use an empty string.
 This function is case sensitive.
 If the string is empty, then the function will return an empty string.


 replace


 Use this function to return a copy of a string, with all occurrences of the old parameter replaced with the new parameter.  All occurrences of the old substring are replaced by new.  If the optional integer argument is given, only the first n occurrences are replaced.
   Example Use Case:  You must replace multiple subsets of a string.

**Syntax:**
```bml
replace(str, old, new, [n])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |
| `old` | String | Specifies the substring that is being replaced. |
| `new` | String | Specifies the substring that is replacing the old substring. |
| `[n]` | Integer | Optional:  Specifies the number of occurrences of the old that must be replaced. |

> **Return Type:** `Copy of String with replacements made.`


**Example:**


 This function is case-sensitive.
 Replacing with any empty string throws an exception:   ("", "", "") ,  ("abc", "", "")  or  (""abc", "", "I") .


 split


  This function splits a String at the specified separator, populates a string array, and trims all of the blank spaces from the result.

 If str is empty string then function returns empty array of size 1.
 If both str and separator is empty, then function returns empty array of size 1.
 If separator is empty, then every character in the string str is split.


**Syntax:**
```bml
String[] split(str, separator)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |
| `separator` | String | Specifies where to break the string into another section. It represents a variety of separators. However, they must all be enclosed in double-quotes, including spaces. |

> **Return Type:** `String`


**Example:**

 strArray = split("a.b.c", "");  will return an array with every character split:  ["a",".", "b", ".", "c"]  with a size of 5.
 This function is case-sensitive.


 startswith


 This function checks whether a string starts with a particular substring.
   Example Use Case:  Determine if a part number starts with a certain text and if a part number contains a specific suffix.

**Syntax:**
```bml
startswith(str, substring)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |
| `substring` | String | Determines if this string begins with this substring. |

> **Return Type:** `Boolean`

 Example of startswith and endswith:


 We know that the return of  endResults  will be true because the string "I like this string", ends with the substring "string".

 An empty string will return as true.
 This function is case-sensitive.


 string


  Converts a float, integer or boolean value into text.

**Syntax:**
```bml
string(float(integer(boolean)))
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `Float ,  Integer , or  Boolean` | String | Represents the given input that must be converted into a string. |

> **Return Type:** `String`


**Example:**


 This function is case-sensitive.
 The function will throw a compile time error if a string is passed in as a parameter.


 substring


 This function returns a part of the text from a larger text.. This function is case sensitive.
  Example Use Cases:

 Break a large string down into similar strings
 Test characters of dynamic part numbers
 Determine which characters are at what index


**Syntax:**
```bml
substring(str, start, [end])
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the original string you are going to parse. |
| `start` | Integer | The index where you will begin parsing the string. |
| `[end]` | Integer | Optional:  Index where you will stop parsing. |

> **Return Type:** `String`

   Example of substring:
 We are performing a number of actions with the substring function:


   subStr:  The first thing you should notice is that substring is being populated by using the str, start index and optional [end] index.
   test_1:  This is using the find function with the substring we just defined.
   negIndResults:  Here we are giving you an example of what happens when you use a negative start and end index.
   longStartInd:  This last example shows you what to expect if start is given an index value that is greater than the length of the string.


 Start and End can have a negative index value.
 If start is given an index value that is greater than the length of the string, an empty string will be returned.


 trim


 This function removes the white space from both edges of strings.
   Example Use Case:  Compare strings with leading or trailing white space.


**Syntax:**
```bml
trim(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Represents the given input string. |

> **Return Type:** `String`


**Example:**


 This function is case-sensitive.
 If  str  is empty, then the function returns an empty string.


 upper


 This converts all characters in the text into all uppercase letters.
  Example Use Cases:

 Used in table comparisons to make sure you have clean data.
 Ignore case in searches.
 Correcting mistakes made from not following Best Practices during implementation.


**Syntax:**
```bml
upper(str)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `str` | String | Given input string that must be converted to uppercase or lowercase. |

> **Return Type:** `String`

 Example of upper & lower:


 The code will print three different examples:

 Application of the  upper(str)  function to a typical output string.
 Application of the same function to an empty string.

 Application of the  lower(str)  function to the same string.  You will notice a blank space in between the  upper(str)  and  lower(str)  functions.   This represents the return that will occur if you use an empty string.
 This function is case sensitive.
 If the string is empty, then the function will return an empty string.


 Notes


 NULL and blank Integer values are treated as separate values: NULL= 0 Blank = ""
 Using NULL as an attribute value is strongly discouraged.
 If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account.


 Related Topics

 See Also
