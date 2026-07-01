---
id: Arrays
title: "Array Functions"
sidebar_label: "Array Functions"
description: "Array Functions Functions The following functions initialize arrays without specifying the size. At a later time, when the values are assigned in different array indexes, the system expands the array..."
tags: ['BML', 'CPQ', 'Functions']
---

## Array Functions
 Functions

 The following functions initialize arrays without specifying the size. At a later time, when the values are assigned in different array indexes, the system expands the array into the appropriate size automatically.

 append


  This function  will attach a new element to the end of an array and can be used with initialized and uninitialized arrays.

  This parameter only works with 1-D arrays.


**Syntax:**
```bml
append(arrayID, newArrayElem)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | string[], integer[], float[] | This is the given array that you are going to add an element to. |
| `newArrayElem` | float, float[], integer, integer[], string, string[], boolean, boolean[] | This represents the new element that you are appending to the array. |

> **Return Type:** `Integer  (denotes the new size of the array)`

 If array max size is reached and you try to append a new element, it will fail.

**Example:**


 If a null element is added to an array, it should be allowed to be added and the value of the element in the array should be null.


 boolean[n]


 Initializes a Boolean array with the specified size.


 For a Boolean array, the value in each field of the array after the array declaration (for example,  arr = boolean[10]; ) is equal to false if the array fields are not initialized.


 Boolean arrays are dynamic in nature and the length can be increased.


  This parameter only works with 1-D arrays.


**Syntax:**
```bml
Boolean[] boolean[Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `boolean` | Boolean Array | Used to declare a boolean array. |
| `[n]` | Integer | Optional:  Use number "n"  to declare an array of a specific size. |

> **Return Type:** `Boolean Array`

 Examples:

 booleanArray = Boolean[2]; //  This will create a boolean array of length 2
 booleanArray[4] = true; //  This will automatically extend the length of booleanArray to 5


 boolean[n][n]


 Initializes a 2-D Boolean array with the specified size.
 For a 2-D Boolean array, the value in each field of the array after the array declaration (for example,  arr = boolean[10][2]; ) is equal to false if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.
 Syntax:
  Boolean[][] boolean[Integer n][Integer n]


| Parameter | Data Type | Description |
| --- | --- | --- |
| `boolean[][]` | Boolean Array | Used to declare a 2-D Boolean array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `Boolean[][]`

 Examples:

 booleanArray = boolean[2] [2]; //  This will create a boolean array with two rows and two columns
 booleanArray [2][3] = true; //  This will automatically extend the length of booleanArray to include an extra column


 bytearray


 This function stores a collection of binary data such as
 the contents of a file. It encodes the given string into a sequence of bytes
 using the specified character encoding. This new type was added to support
 PCS integration and is used in the BML  getattachmentdata  function to return
 the content of a file as a byte array.
 Syntax:
 ByteArray bytearray(String content [, String charset])


 Parameters
 Data Type
 Description


 content


 String


 The string to be encoded.


 charSet


 String


 The character encoding. This can be any encoding supported
 by Java SE Runtime Environment 6, such as ASCII, ISO-8859-1, UTF-32BE, etc.


 Optional, the default is UTF-8 if not provided.


 An error will be thrown if invalid charSet is given.


**Example:**
```bml title="Example"
var = bytearray("Sample String","UTF-16");
```

print var;
//Output: bytearray [UTF-16]: Sample String


 date[n]


 Initializes a Date array with the specified size.


 For a Date array, the value in each field of the array after array declaration (for example,  arr = date[10]; ) is equal to null if the array fields are not initialized.


 Date Arrays are dynamic in nature and the length can be increased.


  This parameter only works with 1-D arrays.


**Syntax:**
```bml
Date[] date[Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `date[]` | Date Array | Used to declare a date array. |
| `[n]` | Integer | Optional:  Use number "n"  to declare an array of a specific size. |

> **Return Type:** `Date Array`

 Examples:

 dateArray = Date[2]; //  This will create a date array of length 2
 dateArray [4] = getdate(); //  This will automatically extend the length of dateArray to 5


 date[n][n]


 Initializes a 2-D Date array with the specified size.
 For a 2-D Date array, the value in each field of the array after array declaration (for example,  arr = date[10][2]; ) is equal to null if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.

**Syntax:**
```bml
Date[][] date[Integer n][Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `date[][]` | Date Array | Used to declare a 2-D Date array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `Date[][]:`

 Examples:

 dateArray = date[2] [2]; //  This will create a date array with two rows and two columns
 dateArray [2][3] = getdate(); //  This will automatically extend the length of dateArray to include an extra column.


 findinarray


 This function is used to check whether a certain element exists in an array.  If it does, the index is returned, otherwise a -1 is returned.   Findinarray()  can only be used with 1-D arrays.

**Syntax:**
```bml
findinarray(arrayID, element)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayID` | string[], integer[], float[] | This is the given array you are searching. |
| `element` | string, integer, float | Represents the element you are looking for in the given array. |

> **Return Type:** `Integer   (denotes the index of the element in the array)`


**Example:**


 float[n]


 Initializes a Float array with the specified size.
 For a float array, the value in each field of the array after array declaration (for example,  arr = float[10]; ) is equal to 0.0, if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.
 For example:

 fltArray = Float[2]; //  This will create a float array of length 2
 fltArray [4] = 2.1; //  This will automatically extend the length of fltArray to 5


  This parameter only works with 1-D arrays.


**Syntax:**
```bml
Float[] float[Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `float[n]` | Float Array | Used to declare a float array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `Float Array`


**Example:**


 float[n][n]


 Initializes a 2-D Float array with the specified size.
 For a 2-D Float array, the value in each field of the array after array declaration (for example,  arr = float[10][2]; ) is equal to 0.0 if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.

 fltArray = Integer[2] [2]; //  This will create a float array with two rows and two columns
 fltArray [2][3] = 5; //  This will automatically extend the length of fltArray to include an extra column


**Syntax:**
```bml
Float[][] float[Integer n][Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `float[][]` | Float Array | Used to declare a 2-D float array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `Float[][]`


**Example:**


 integer[n]


 Just as you do for string arrays, in order to initialize an array of a particular size, use the function integer[n]. This function initializes an Integer array with the specified size.
 For an Integer array, the value in each field of the array after array declaration (for example,  arr = integer[10]; ) is equal to 0 if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.
 For example:

 intArray = Integer[2]; //  This will create an integer array of length 2
 intArray [4] = 2; //  This will automatically extend the length of intArray to 5


  This parameter only works with 1-D arrays.


**Syntax:**
```bml
Integer[] integer[Integer n]
```


 #

| Parameter | Data Type | Description |
| --- | --- | --- |
| `1` | integer[] | Integer Array |
| `Used to declare an integer array.` | 2 | [n] |

> **Return Type:** `Integer Array`

 Example):


 In contrast to  string[] , if you define an array size without initializing array fields, you will see a 0 instead of null.


 integer[n][n]


 Initializes a 2-D Integer array with the specified size.
 For an 2-D Integer array, the value in each field of the array after array declaration (for example,  arr = integer[10][2]; ) is equal to 0 if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.

 intArray = Integer[2] [2]; //  This will create an integer array with two rows and two columns
 intArray [2][3] = 5; //  This will automatically extend the length of intArray to include an extra column


**Syntax:**
```bml
Integer[][] integer[Integer n][Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `integer[][]` | Integer Array | Used to declare a 2-D array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `Integer[][]`


**Example:**


 Notice the multiple print statements being used in the code above. We are printing a specific element index and value index.  Since there are two elements, the element indexes are 0 and 1 respectively.  Each element has two values, so the value indexes are also 0 and 1.  The syntax used in the code will print each value in the console.


 isempty


  This function determines if the array is empty.

  This parameter only works with 1-D arrays.


**Syntax:**
```bml
isempty(arrayIdentifier)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | string[], integer[], float[] | This is the given array. |

> **Return Type:** `Boolean  (True if array is empty and False if it is not)`


**Example:**


 The string array above is empty, therefore True is returned.


 max


 Returns the largest element of an integer or float array.

  This parameter only works with 1-D arrays.


**Syntax:**
```bml
max(arrayIdentifier)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | integer[], float[] | This is the given array you will use to find the max value. |

> **Return Type:** `Returns an Integer or Float, depending on the type of array.`


**Example:**


 min


 Returns the smallest element of an integer or float array.

  This parameter only works with 1-D arrays.


**Syntax:**
```bml
min(arrayIdentifier)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | integer[], float[] | This is the given array you will use to find the max value. |

> **Return Type:** `Returns and Integer or Float depending on the type of array.`


**Example:**


 range


  Declares an integer array with a specified size and initializes it to its index value.

**Syntax:**
```bml
range(x)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Integer | Denotes the size of the integer array. |

> **Return Type:** `Integer[]`

 This function is case-sensitive.

**Example:**

 In the following example, the numberOfDesserts value is a configurable attribute that is setup as the array size control for an array in a configuration flow. dessertCountArr = range(numberOfDesserts);
print dessertCountArr;
isValidArr = boolean [];

for dessertNumber in dessertCountArr {
   print dessertNumber;
   print isValidArr;
   // check what type of dessert it is and if it has "Nuts" selected
   if((dessertType[dessertNumber] == "Chai Tea Latte" OR dessertType[dessertNumber] == "Milkshake")
   AND nuts[dessertNumber] == true) {
      append(isValidArr, true);
      print "skip print of array";
      continue; // move to the next iteration of desserts if true
   }
   append (isValidArr, (NOT nuts(dessertNumber)));
   print isValidArr;
}

return isValidArr;
 If x is 0, then the function returns an integer[0]. For example,  intArray=range(2)  returns an integer array size of 2 where  intArray[0]=0  and  intArray[1]=1 .


 remove


  The function removes an element from an existing array based on a given index.

**Syntax:**
```bml
remove(arrayIdentifier, removePos)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | string[], integer[], float[] | This is the given array from which you will remove an element. |
| `removePos` | Integer | This represents the index of the element you will be removing. |

> **Return Type:** `Integer  (denotes the size of the new array)`

 Only integers are allowed to be passed in for the index of the element to be removed.

**Example:**


 You can see the new array that is being returned once the element at  index[2]  is removed.
 If the array is empty, the function will fail.


 reverse


 This function is used to reverse all elements in the array.

**Syntax:**
```bml
reverse(arrayIdentifier)
```


  This parameter only works with 1-D arrays.


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | string[], integer[], float[] | This is the given array. |

> **Return Type:** `Returns the array with all of the elements in reverse order.`


**Example:**


 sizeofarray


 This function returns the length of the array for a 1-D array and the number of rows for a 2-D array.

**Syntax:**
```bml
sizeofarray(arrayIdentifier)
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayIdentifier` | string[], integer[], float[], string[][], integer[][], float[][], boolean[], boolean[][] | This represents the given array. |

> **Return Type:** `Integer`

 Examples:
 1-D Array: sizeofarray(arrayIdentifier)


 2-D Array: sizeofarray(arrayIdentifier)


 While there are 6 separate values in this array, there are only three elements.  Remember that  sizeOfArray for a 2-D array will return the number of rows.


 sort


  This function sorts array elements based on defined sort method.  You can sort in ascending or descending order.

**Syntax:**
```bml
sort(arrayID, [sortOrder], [sortType])
```


  This parameter only works with 1-D arrays.


| Parameter | Data Type | Description |
| --- | --- | --- |
| `arrayID` | string[], integer[], float[] | The array you want to sort. |
| `[sortOrder]` | String | Takes the string values  "asc"  (ascending) or  "desc"  (descending).  The default is  "asc" .  It must be a string literal. |

  Examples:
 a = string[]{"a", "c", "b"};


 sort(a); -> ["a", "b", "c"]


 sort(a, "desc"); -> ["c", "b", "a"]


 [sortType]

 "text", "numeric"  or "date"

  Takes the string values  "text"  or  "numeric"  they must be a string literal or date values.
 A string array with no sortType is sorted by numbers first, capitals letters next, then lower case.  Numbers are treated as strings: they are sorted by the first digit, then subsequent digits.

**Example:**

 a = string[]{"2", "12", "a", "A", "B", "b"};
 sort(a, "asc"); -> ["12", "2", "A", "B", "a", "b"]


 "text"  sortType entries are not case sensitive.

**Example:**

 sort(a, "asc", "text"); -> ["12", "2", "a", "A", "B", "b"]


 "numeric"  sortType arrays must only contain entries that can be parsed as numbers.

**Example:**

 stringArray = string[]{"1", "2", "10", "20"};
 sort(stringArray, "asc");  -> ["1", "10", "2", "20"]
 sort(stringArray, "asc", "numeric"); -> ["1", "2", "10", "20"]
 An integer array will sort with  "numeric"  as default.

**Example:**

 intArray = integer[]{1, 2, 10, 20};
 sort(intArray, "asc"); -> [1, 2, 10, 20]
 sort(intArray, "asc", "text"); -> [1, 10, 2, 20]


 "date"  sortType  can only be used to sort a date array.


> **Return Type:** `String Array, in the specified sort order`


**Example:**


 string[n]


 Initializes a String array with the specified size.
 For a String array, the value in each field of the array after array declaration (for example,  arr = string[10]; ) is equal to null if the array fields are not initialized.
 These arrays are dynamic in nature and the length can be increased.
 For example:

 strArray = String [2]; //  This will create a string array of length 2
 strArray [4] = "a"; //  This will automatically extend the length of strArray to 5


  This parameter only works with 1-D arrays.


**Syntax:**
```bml
String[] string[Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `string[]` | String Array | Used to declare a string array. |
| `[n]` | Integer | Optional:  Use number "n"  to declare an array of a specific size. |

> **Return Type:** `String Array`


**Example:**


 string[n][n])


 Initializes a 2-D String array with specified size.
 For a 2-D String array, the value in each field of the array after array declaration (for example,  arr=string[2][3]) ) is equal to null if the array fields are not initialized.

**Syntax:**
```bml
String[][] string[Integer n][Integer n]
```


| Parameter | Data Type | Description |
| --- | --- | --- |
| `string[][]` | String Array | Used to declare a 2-D string array. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |
| `[n]` | Integer | Optional:  Use number "n" to declare an array of a specific size. |

> **Return Type:** `String[][]`


**Example:**


 Notes


 NULL and blank Integer values are treated as separate values: NULL= 0 Blank = ""
 Using NULL as an attribute value is strongly discouraged.
 If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account.


 Notes:

 Specifying a negative number (including NaN, which is equal to -999999) for the array size throws a runtime exception. For example,  arr = float[-9];  throws a RuntimeException.
 When you specify the array size equal to jNaN, then an array of size 0 is initialized.
 Contact admin for size limits.


 Tips and Considerations


 For 1-D arrays, the maximum number of columns  is 1000.


 For 2-D arrays, the maximum number of rows  is 1000 and the maximum number of columns is 50.


 BML size limits have default settings. The default row size is 5000. The default column size is 50.  To increase the default row and column size, open a ticket on  My Oracle Support .


 Related Topics

 See Also
