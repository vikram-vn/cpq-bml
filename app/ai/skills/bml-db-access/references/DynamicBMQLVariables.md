---
id: DynamicBMQLVariables
title: "Dynamic BMQL Variables"
sidebar_label: "Dynamic BMQL Variables"
description: "Dynamic BMQL Variables Overview Using direct variable substitution, called dynamic variables, makes it simpler to write BML queries that change based on user input, without having to write a unique cl..."
tags: ['BML', 'CPQ', 'Functions']
---

# Dynamic BMQL Variables


## Overview


Using direct variable substitution, called *dynamic variables*, makes it simpler to write BML queries that change based on user input, without having to write a unique clause in the query for every possible permutation of inputs.  As a result, scripts using this feature is much more scalable.


CPQ’s query language, BMQL, allows the use of dynamic variables for column names , Data table names and WHERE clauses.


When a BMQL call contains dynamic variables, the data types for the variables are validated and the dynamic variables are replaced with the input values at run-time.  For more information on validation, see the section [Validation](Validation.md) below. Then BMQL returns a full SQL string that is executed.


## Administration


## Syntax


To support dynamic variables in BMQL, an additional optional parameter, `fieldMap`, is available.  There are two optional parameters: `contextOverride` and `fieldMap`.


The BMQL method supports the following three signatures:


```bml
bmql(QueryString)
```

```bml
bmql(QueryString, contextOverride)
```

```bml
bmql(QueryString, contextOverride, fieldMap)
```


When using `contextOverride` to specify a certain language and `fieldMap`to use variables inside a variable WHERE clause, the syntax for the entire call is:


```sql
bmql(QueryString, contextOverride, fieldMap);
bmql("select columnName from tableName WHERE $where", lang, fields);
```


:::tip
For more information about these optional parameters, see [BMQL Parameters](BMQL_parameters.md).
:::


---


## Dynamic Variables in the WHERE Clause


If variable substitution is needed within the WHERE clause, use the method signature which passes in the values of each of the variables.


These variables must be defined in a string Dictionary and passed in as the third parameter.  In this case, a second parameter must also be defined.


For example, if the `$where` variable used the declared variables `x_var` and `y_var`, the variables would need to be added to a dictionary prior to the BMQL call.


**Example 1:**


```sql title="Example 1"
table = “dataTableName”; //dataTableName is the name of an existing data table
columns = “columnName”;
fields = dict("string");
put(fields, "$field1", x_var);
put(fields, "$field2", y_var);
where = "x = $field1 AND y = $field2";
results = bmql("SELECT $columns FROM $table WHERE $where", lang, fields);
```


**Example 2:**


```sql title="Example 2"
pno = "part123";
lead = integer[]{3,4,5}
results = bmql("select part_number from _parts where part_number = $pno and lead_time in $lead");
```


* The '$' symbol must be prepended to the variable name when used in the query string.

* The data types of the variables must be string, integer or float.

* For an IN condition, the data types of the variables must be string[], integer[] or float[].

* Line item variables cannot be used in the query.


**Example 3:**


## Using the function  recordset()  as an example, you can see how using variables works.


```sql
results = bmql("select part_number from _parts where part_number = 'part%'");
for result in results {
partno = get(result, "part_number")
...
}
```


* BMQL returns `results`, which contains the list of data that matched the query.

* Use the for loop on `results` to go through all the rows of data returned.

* Use the get function to get the specific column from each iterated row.


## Changing a Query Based on Regions Example


A customer stores data in different Data Tables for pricing in different regions.


###### Before


```sql
bmqlReturn = "nothing";
table = util.passed_string1();
if(table == "sorting_rename_1") {
results = bmql("select str from sorting_rename_1 where str = 'a'");
for result in results {
bmqlReturn = get(result, "str");
}
}
elif(table == "sorting_rename_2") {
results = bmql("select str from sorting_rename_1 where str = 'a'");
for result in results {
bmqlReturn = get(result, "str");
}
}
elif(table == "sorting_rename_3") {
results = bmql("select str from sorting_rename_1 where str = 'a'");
for result in results {
bmqlReturn = get(result, "str");
}
}
else {
bmqlReturn = "not a valid table";
}
return bmqlReturn;
```


###### After


With dynamic variables, the admin can write something like this instead:


```sql
bmqlReturn = "nothing";
table = util.passed_string1();
results = bmql("select str from $table where str = 'a'");
for result in results {
bmqlReturn = get(result, "str");
}
return bmqlReturn;
```


:::tip
Using dynamic variables, the code is much simpler and much more scalable.
:::


---


## Changing a Query Based on User Inputs Example


Imagine that you want to make a complicated query that will change depending upon user inputs.  Without dynamic variables, you are forced to write something like the following code, where you must have a clause for every possible input.


###### Before


```sql
result = recordset();
if (len(_bm_pline_name) <> 0 and len(_bm_pline_variable_name) <> 0) {
result = BMQL(“SELECT str1 FROM table_100columns WHERE $where”,lang, fields);
} elif (len(_bm_pline_name == 0 and len(_bm_pline_variable_name) <> 0) {
result = bmql (“SELECT str1 FROM table_100_columns WHERE str3 = $_bm_pline_variable_name”);
} elif (len(_bm_pline_name) <> 0 and len (_bm_pline_variable_name) == 0) {
result = bmql(“SELECT str1 FROM table_100columns WHERE str2 = $_bm_pline_name”);
} else {
result = bmql(“SELECT str1 FROM table_100columns”);
}
print result;
```


###### After


Using dynamic variables, you can write something like this instead:


```sql
result = recordset();
fields = dict("string");
fields.put(fields, "$name", _bm_pline_name);
put(fields,"$varname",_bm_pline_variable_name);
where = " WHERE";
conjunction = "";
if (len(_bm_pline) &amp;lt;&amp;gt; 0) {
where = where + "str2 = $name";
conjunction = " OR ";
}
if (len(_bm_pline_variable_name) &amp;lt;&amp;gt; 0) {
where = where + conjunction + "str3 = $varname";
}
result = BMQL("SELECT str1 FROM table_100columns $where", fields);
```


:::tip
The code is longer in this instance, but it is much more scalable, since you do not need a separate clause for each possible input.
:::


---


## Grammar


A dollar sign ($) indicates a dynamic variable.


When writing a query in BMQL that will use a dynamic variable, direct variable substitution should be used in lieu of string concatenation or full substitution.


* **Correct:** Direct Variable Substitution


```sql
"results = bmql("SELECT $columns FROM $table WHERE $where")";
```


* **Incorrect:** Concatenating Strings


```sql
"results = bmql("SELECT value FROM " + tableName + " WHERE date = $current_date")";
```


* **Incorrect:** Using Full Substitution


```bml
"results = bmql(bmqlStringVariable)";
```


## $ Notation


* Without dynamic variables


```sql
“SELECT a FROM b WHERE c = $variable1”;
```


* With dynamic variables:


* **Correct**


```sql
fields = dict("string");
x_var = "6.08";
put(fields, "$field1", x_var);
where = "float1 = $field1";
results = bmql("select column from table WHERE $where", lang, fields)
```

* **Incorrect**


```sql
bmql("select columnName from TableName WHERE " + where, lang, fields);
```


This code will throw a syntax error.


---


## Exception Handling


There are two exception handling situations.


* Variables are used in the $where clause and no field dictionary is passed in.


This BML will validate, but will throw an error when run.


* No new variable types are used but fields are passed in.


This BML will not throw any errors and will work. Optional parameters are ignored if they are not needed.


---


## The WHERE Clause as a Variable


The entire WHERE clause can be a string variable.


:::note
If there are variables in the WHERE clause variable, you must define these variables in a string Dictionary and pass them as a third parameter.  In this case, you must also define a second parameter.
:::


---


## Making Everything Dynamic


In this example, everything that can be dynamic is dynamic.


```sql title="In this example, everything that can be dynamic is dynamic"
bmqlReturn = "nothing";
select = "string1,int1";
from = "uploadXMLtable";
lang = dict("string");
fields = dict("string");
x_var = "6.08";
y_var = "2.03";
a_var = 2;
b_var = 1;
put(fields, "$field1", x_var);
set1 = "string1 = 'Platypus'";
set2 = "string1 = 'Platypodes'";
where = "float1 = $field1";
where_delete = "string1 = $field1";
results = bmql("insert into $from ($select) values ($x_var, $a_var),($y_var, $b_var)");
results = bmql("delete from $from where $where_delete", lang, fields);
results = bmql("update $from set $set1 where $where", lang, fields);
results = bmql("modify $from set $set2 where $where", lang, fields);
results = bmql("select $select from $from where $where", lang, fields);
for result in results {
bmqlReturn = get(result, "string1");
}
return bmqlReturn;
```


Consult the Function Wizard to see Data Table names and associated column details.


---


## Notes


There are several issues to consider when using dynamic variables in BML queries.


## Validation


Most of the validation in BMQL that uses dynamic variables will occur when the code is executed.  Previously, validation occurred when the code was checked or saved.


This change is required because variables aren't replaced with their values until runtime.  However, syntax will still be checked when code is saved to confirm that variables are in the right places and the standard keywords are still there.


Therefore, when using variables for columns, Data Tables, or the entire WHERE clause, more rigorous testing of the BMQL should be done and potential errors should be handled by using the `hasError(rs)`and `getMessage(rs)` BML functions.


String literal BMQL calls are not affected by these changes and will continue to perform a full validation when checked and saved.


---


## SQL Injection


Continue to follow existing best practices regarding SQL injection.  Do not allow any user-generated data to be used directly in a BMQL statement.


In a fully dynamic WHERE clause, you must put variables into the fields array. These variables in the fields array will have SQL characters escaped.


For example:


```sql title="For example"
fields = dict("string");
dict.put(fields, "$ca1", commerceAttribute1);
where = "field1 = $ca1 AND field2 = 'someValue'";
results = bmql("SELECT col1 FROM table WHERE $where", lang, fields);
```

Each customer is individually responsible for writing and testing their own dynamic BMQL calls to ensure that they are safeguarded from potential SQL injections.


---


:::note
BMQL does not support a parts query that retrieves more than 500 parts from a non-default price book.
:::


## Related Topics


## See Also
