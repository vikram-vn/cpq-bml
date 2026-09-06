---
id: DebugUtilFunctions
title: "Debugging Util Functions"
sidebar_label: "Debugging Util Functions"
description: "Debugging Util Functions Overview BML libraries are extremely important in that they allow us to avoid duplicate code, and to easily maintain discrete logical operations. They are different than Advan..."
tags: ['BML', 'CPQ', 'Functions']
---

# Debugging Util Functions


## Overview


BML libraries are extremely important in that they allow us to avoid duplicate code, and to easily maintain discrete logical operations.  They are different than Advanced Modify functions and Advance Validation rules, and it may take some extra effort to reproduce errors.


BML libraries can take Arrays and Dictionaries as parameters. There is no UI interface for representing these objects, so you will have to create a test script to call the function.


## Administration


## Before you begin


The process to debug a BML library will generally be the same:


1. Find the original function call that failed.

2. Identify what parameters were passed in.

3. Recreate the call in the test script and run the debugger.


Be aware in your testing that objects are passed by reference. This means that arrays and dictionaries that are modified in a library will be changed in the calling context. **For example:**


//in util library "passByRef"


// param myDict {dict("string")} An object to be modified;


put(myDict, "key2", "val2");


return "This is the return string.";


// in advanced modify function


myDict = dict("string");


put(myDict, "key1", "val1");


res = util.passByRef(myDict);


print res; // will be "This is the return string."


print myDict; // will be "{key1=val1, key2=val2}"


---


## Example


Assume that when a user clicks Save they get an error "Divide by 0". The error logs identify the problem as occurring in the Save action.


1. Track down Save's Advanced modify and see the error occurring when you call util.getAverage:


pricesArray = util.parsePricesDelimitedString(pricesDelimitedString_quote, pricesDelimiter_quote);


averagePrice = util.getAverage(pricesArray); // error occurs here


//[...] rest of save function

2. Get a copy of the parameters being passed in. You can do this by printing the array:


pricesArray = util.parsePricesDelimitedString(pricesDelimitedString_quote, pricesDelimiter_quote);


print pricesArray; // will show up in the debugger


averagePrice = util.getAverage(pricesArray); // error occurs here


//[...] rest of save function

3. Let's assume that we print out the array, and get back the value "[]". We are now ready to go debug the util library directly.  Say the util library looks like so:


/*


* Util library 'getAverage'


* @param numbers {Integer[]} Array of numbers to be averaged


* @returns {Integer} Average of all the numbers in the array


*/


count = sizeofarray(numbers);


total = 0;


for num in numbers {


total = total + num;


}


result = total/count;


return result;

4. We can't run the debugger directly, because of the array parameter. So we will write a test script instead.  Some notes about writing test scripts:

5. Write a test that passes or fails. Do this by specifying an expected value, and comparing it to the result of the function.

6. Leave other test scripts in place; you can use tests written previously to help identify conflicts in your code.


// test script for util lib getAverage


//create a blank array per the results in the Save action


myArr = integer[];


//when we pass in a blank array, we expect to get 0 back


actual = util.getAverage(myArr);


//test can pass or fail - print a meaningful message if there is a problem


expected = 0;


if(expected != actual) {


print "Test Failed: expected value 0 for empty array, got: " + actual;


} else {


print "Test Passed: empty array returns value of 0.";


}


return res;


Now when we run our test script, we get the expected "Divide by 0" error. We've successfully reproduced the error, and have also used the test script to describe the desired behavior in a meaningful way. We can now fix the error, which occurs when "count" is equal to zero:


/*


* Util library 'getAverage'


* @param numbers {Integer[]} Array of numbers to be averaged


* @returns {Integer} Average of all the numbers in the array


*/


count = sizeofarray(numbers);


total = 0;


//Empty arrays should return a value of 0


if(count == 0) {


return 0;


}


for num in numbers {


total = total + num;


}


result = total/count;


return result;


---


## Use Case


## Util Library Debugger


1. Obtain required information for the Util Function.


  1. Locate the function that contains the Util Function you wish to debug. *This could be a Commerce function, such as Pricing, or a function on an action or attribute.*

  2. Add a print statement for the function you wish to debug.


  3. Click **Run** to debug the function.


---


1. Create a test script for the Util Function.


> 1. The Util Function Debugger can use a test script for debugging within the function itself. The test script creates the variables and stores the information produced in **Step 1** into the variables that will be returned in the Util Function.
>
> 2. Create and initialize variables that are the same type as those passed through the Util Function. For stings, integers, of floats, the initialization can be the actual value produced in **Step 1**.
>
>
>
>
> 
>
> 3. Populate the variables with the information obtained in Step 1. *This is mainly for dictionaries and arrays; they are populated using BMLs the standard way.*
>
>
>
>
> 
>
> 4. Return the Util Function holding its parameters.
>
>
>
>
> 


---


1. Use the test script to generate the output.


> 1. Copy and paste the test script produced in **Step 2** into the Test Script area of the Debugger.
>
> 2. Select the **Use Test Script** checkbox.
>
>
>
>
> 
>
> 3. Click **Run** to ensure that there are no errors in the test script. The return string will be generated here.
>
>
>
>
> :::tip
> From here you can use the debugger like the Commerce function debugger. You can change your values in your script as often as you like to test different scenarios and values.
> :::


---


## Troubleshooting


Think through how to correct an error with invalid data passed into a BML library, since it may be called from many different places. Follow proper error handling practices to ensure that the code is easy for others to maintain, and provides a good experience for end users.


## Notes


:::tip
The same rules apply to both Util and Commerce libraries.
:::


:::note
Integration details can be retrieved using BMQL, including usernames and passwords. Making requests using the Integration Password will fail in the BML debugger, since their values are masked to prevent exposure.
:::


## Related Topics


## See Also
