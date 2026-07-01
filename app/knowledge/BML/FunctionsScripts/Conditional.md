# Conditional Functions

## Functions

Conditional functions are commands that run only when specified criteria is met. Each conditional statement requires a Boolean expression that may or may not be visible to you. To put it more plainly, a conditional function must evaluate to true or false.

break

Using this function will break a `for...loop` at the element that you define.

Example:

In this example, we used a 1-D string array and asked it to stop when it reached the element "ccc".

continue

This function calls out an element from an array and essentially skips it, but continues looping through the rest of the array. Unlike the break function, the loop continues after it skips over the element.

Example:

for...loop

The `for...loop` function is meant to loop through a block of code until a specific condition is met.

**The basic syntax is:**

```
for(variable) in (system_array) {
statement(s);
}
```

The variable represents the element, but you can label this however you want.  You can call it 'each' or 'element' or even your name if you wanted to. Let's think of a table of values that we will name `Table_Array`:

|       | Column 1 | Column 2 | Column 3 |
| ----- | -------- | -------- | -------- |
| Row 1 | 1        | 2        | 3        |

Now, let's use the same syntax as above:

```
for(row element) in Table_Array{
print row element;
}
```

So, what we are really saying is:  "For Row 1 in `Table_Array`, print each element in the row".

* Example of for...loop in 1-D Array:

In the following example, we are setting up a 1-D integer array.  What this code is saying is, "for whatever array element is in `myArray`, print that array element".

So, the code is going to loop through the integer array we have defined and print every element that is in this 1-D array.

* Example of for...loop in 2-D Array:

Now, let's say we have a table that has more than one row.

|       | Column 1 | Column 2 |
| ----- | -------- | -------- |
| Row 1 | 0        | 3        |
| Row 2 | 1        | 4        |
| Row 3 | 2        | 5        |

You will have to use a loop within a loop in order to return the row values and the column values.

So, what we will see is that for each row, it will print that row {Row 1 will return (0,3)}, after it loops through and pulls the value for the row, it's going to loop through the row and pull the values for the columns, returning to you the individual values of 0 and 3.

if...

What this is saying in plain language is:  "If (condition) is True, then perform the statement".  If that condition is False, then no action is taken.

Example:

This is a very basic example, saying that if the variable string is a number, then we want to convert it to a float.

In this case, "25" is a number, so we used `atof()` to convert the string to a Float.

if...else

An `if...else` statement is essentially the same as an `if..`. statement, except that instead of doing nothing if the condition isn't met, a different statement is run.

**The basic syntax is:**

```
if (condition){
statement;
} else {
statement;
}
```

Example:

So, it's saying "Do something if the first condition is met, if not, do this instead".  You can also have multiple else statements nested within one another.

We are saying, "if the var = 25" is a number, then convert the string to a Float. If it's not a number, print "NaN".

if...else...if

An `if...else...if` statement is a statement with two or more conditions.

Example:

```
if(attr1 == 100){
return true;} elif (attr1 == 200){
return false;}
```

## Notes

* NULL and blank Integer values are treated as separate values:
  * NULL= 0
  * Blank = ""

* Using NULL as an attribute value is strongly discouraged.

* If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account.

## Related Topics

See Also