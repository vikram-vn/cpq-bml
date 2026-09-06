---
id: ArraysOverview
title: "Using Array Functions"
sidebar_label: "Using Array Functions"
description: "Using Array Functions Overview Oracle CPQ declares, initializes, populates, and manipulates arrays using BML. Refer to Array Functions for details about available functions. An array is an ordered col..."
tags: ['BML', 'CPQ', 'Functions']
---

# Using Array Functions


## Overview


Oracle CPQ declares, initializes, populates, and manipulates arrays using BML. Refer to  [Array Functions](Arrays.md) for details about available functions.


An array is an ordered collection of values, referenced by a single variable name.  Think of an array as a table, with values in rows and columns.  Another way to think of arrays is in relation to an x-y axis.  If you recall, data sets are formatted as (x, y).  Data in arrays is similar:


(row, column)
(x, y)
("color", "shape")


* 1-D Array


The index indicates the position of the value within the array.  So, if we were looking for Value 7 within the array,  its location is Index 6.  Indexes are zero-based in BML, meaning that the first element will always have an index of 0 and the last element will have an index of i(number of element).


| Index | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   |
| ----- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

* 2-D Array


There are also 2-dimensional arrays.  These arrays can be thought of as a grid or a table with multiple rows and columns.  The convention for defining and accessing these arrays is [row, column].


| Variable 3 | 8   | 4   | 3   |
| ---------- | --- | --- | --- |


### Array Attributes


* **What are array attributes?** Array attributes are used to allow users to easily group multiple, scalar attributes using a single data structure and are available both for the selection and configuration process. Similar to other configuration attributes, you can create array attributes at all levels in the configuration hierarchy, but can delete them only at the level in which they were created. You can create array attributes for all the available data types (Float, Integer, String).

* **Example of an array attribute (user-side):** In the example below, the user had selected that three floors needed to have their elevators configured. From this one screen, you can individually configure each elevator. As you can see, each one has a different combination of door type, door trim and buttons.


* **Control Attribute:** This size of arrays are defined by the control attribute. When creating a control attribute, the attribute itself must have a Data Type of integer and you must make sure that the Array Type box is not checked. In the case below, the user wants to configure 27 floors. Number Of Floors is the control attribute.


### Before You Begin:


Here is some general information regarding arrays that you should know before you get started. *Another way to think of an array is as a 1-D or 2-D table.*


* 1-D table of an array attribute


| Elevator # | 1     | 2    | 3   |
| ---------- | ----- | ---- | --- |
| Door_Type  | Stone | Blue | Red |

* 2-D table of an array attribute


| Buttons | Shiny | Easy | Plastic |
| ------- | ----- | ---- | ------- |


### BML Array Syntax


| Element         | Meaning                       |
| --------------- | ----------------------------- |
| []              | Indicates a 1-D array         |
| [] []           | Indicates a 2-D array         |
| [n]             | 1-D array with a defined size |
| [n][n]          | 2-D array with a defined size |
| {x, y}          | Elements within a 1-D array   |
| {(x, y), (z,r)} | Elements within a 2-D array   |


### Indexes


* Index values in a 1-D array


| ROW 1 | Index 0 | Index 1 | Index 2 | Index 3 | Index 4 | Index 5 | Index 6 | Index 7 |
| ----- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |

* Index values in a 2-D array


Index values represent both the row index and the column index, so the basic syntax is `index[row][column]`.


| ROW 3 | Index [2][0] | Index [2][1] | Index [2][2] |
| ----- | ------------ | ------------ | ------------ |


### Populating Arrays


Examples of how to populate 1-D and 2-D arrays using a `for...loop`.


* 1-D Arrays


Create a 1-D array of values equal to the sum of each array element:


* 2-D Arrays


In this example, we are going to combine two 2-D arrays by adding together their value and placing them in a new 2-D array.  Remember that range() creates an integer array of indexes.  We will be using two here.


What we are going to do here is add together the values of the two arrays based on their indexes.  `colRange`and `rowRange`are initializing integer arrays.  So, both `colRange`and `rowRange = [0, 1, 2]`. respectively.  Next, we have to declare and initialize the 2-D array that we are going to populate.  Then, comes the `for...loop`.  The first `for...loop` will loop through the rows of indexes in `rowRange`.  The second will loop through the columns of indexes and thus will populate the new array by pulling out the column values.


### Uninitialized Arrays


In order to show you the different ways to declare arrays, we will display two separate arrays below.  `myArray`will show you what to expect if you define an array size without initializing array fields.  `yourArray`will show you what is returned when you define the size of an array as well as initialize the fields.


Example of Uninitialized Arrays


As you can see, `myArray`returned a string with four null values because array fields were not initialized after the array was declared.


## Notes


:::warning
* NULL and blank Integer values are treated as separate values:
  * NULL= 0
  * Blank = ""

* Using NULL as an attribute value is strongly discouraged.

* If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account.
:::


:::tip
BML size limits have default settings. The default row size is 5000. The default column size is 50.
To increase the default row and column size, open a ticket on [My Oracle Support](https://support.oracle.com/).
:::


## Related Topics


## See Also
