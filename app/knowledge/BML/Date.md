---
id: Date
title: "Date Functions"
sidebar_label: "Date Functions"
description: "Date Functions Functions Date functions are often used when evaluating and calculating quotes in Commerce. As an example, they are used to set quote e..."
tags: ['BML', 'CPQ', 'Functions']
---

## Date Functions
Functions
Date functions are often used when evaluating and calculating quotes in Commerce. As an example, they are used to set quote expiration dates. Dates are always strings in Commerce, but can be converted to dates using the functions included in this article. 
adddays

This function returns the date which is obtained after adding X number of days to a particular date. Example Use Case: Often used in Commerce to set the time a quote is valid, or when it expires.

 Syntax: adddays(date, num_of_days)
Parameters:

Parameter
Data Type
Description

date

Date
Represents the given date.

num_of_days

Integer
 How many days you want to add to the given date.

 Return Type: Date
 Example: 
We will use multiple functions to accomplish the following:

Add 60 days to the current date.
Convert that date to a string format.
Remove the hours:minutes:seconds from the return.

addmonths

This function returns the date which results after adding or subtracting a number of months from a specified date. This function is available in BML and Commerce Library functions. Example Use Case: Often used to set the expiration date for quote, assign end dates to contracts, or assign renewal dates for subscriptions.
Syntax: Date addmonths (Date date, Integer num_of_months)
Parameters:

Parameter
Data Type
Description

date

Date
Represents the given date.

num_of_months

Integer
 The number of months you want to add to the given month. A positive value will add months. A negative value will subtract months from the date specified. If this value is 0, the result returns the same date.

Return Type: Date
Example: return datetostr(addmonths(getdate(), 2));
This BML Date function takes into account the number of days in a month and leap year. If the date is at the end of a month, the date result will be a valid calendar day for the calendar year.

January 31st + 1 month = February 28th (unless leap year then February 29th)
February 28th + 1 month = March 28th
August 31st + 3 months = Nov 30th
Sept 28th + 1 month = October 28th
Dec 15th - 3 months = September 15th

comparedates

Use this function to compare two dates based on date and time. 

 Syntax: comparedates(Date date1, Date date2)
Parameters:

Parameter
Data Type
Description

date1

Date
Represents the given date.

date2

Date
 Represents another given date.

 Return Type: Integer
Example:

If...
...Returns

Both dates are equal
0

First date is before second date
-1

First date is after second date
1

This function also considers the time for a given date. For "11/04/2009 00:02:00" and "11/04/2009 00:01:00", the function returns 1.

datetostr

This function converts a date to a string.  It can take an optional parameter that can return a formatted string. 
Example Use Case: Date fields in commerce are considered string fields, so to return a date to a commerce attribute you need to convert it to a string first.

 Syntax: datetostr(Date date,[String dateFormat, [String timeZone]])
 Parameters: 

Parameter
Data Type
Description

date

Date
Mandatory date parameter. 

[dateFormat]

String
 Optional: Returns a formatted string.

[timeZone]

String
 Optional: Retrieve the data in another time zone.

 Return Type: String

Valid Date Components
Description

yyyy
Year in long form specifying all digits

MM
Month in numeric format

dd
The day of the month in numeric form for example. 24

HH
The hour as a number in 24 hour form

hh
The hour as a number in 12 hour form

mm
Minutes

ss
Seconds

a
AM/PM

z
General Time Zone

Z
RFC 822 Time Zone

Examples :

Example 1:testDate = strtojavadate("02/03/2010 03-22-55", "MM/dd/yyyy HH-mm-ss");dateStr = datetostr(testDate, "yyyy-MM-dd HH:mm:ss")

dateStr now holds the string "2010-02-03 03:22:55"

The date and time is stored in the server's time zone by default (For this example, assume GMT-8).

 Example 2: Retrieve the data in another time zone, include the"timeZone" parameter as a string.datestr = datetostr(testDate, "yyyy-MM-dd HH:mm:ss", "GMT-6")

datestr returns "2010-02-03 01:22:55"

 Example 3: twelvehour = datetostr(testDate, "yyyy-MM-dd hh:mm:ss a", "GMT+4")

twelvehour will return "2010-02-03 03:22:55 PM"

The function datetostr (getdate()) will return today's date in the format MM/dd/yyyy HH:mm:ss if no format is supplied

getcurrenttimeinmillis

This function returns the current time in milliseconds.
 Syntax: Integer getcurrenttimeinmillis()
 Return Type:  Integer

getdate

This function returns the current date/time based on the base time zone you have set-up in your application. The function takes a parameter and returns a date, with or without time. Example Use Case: Find the current date.

 Syntax: getdate([boolean includeTime])
Parameters:

Parameter
Data Type
Description

[includeTime]

Boolean
 Optional: Returns the current system date and time. If it is not included, it will be set to true by default.  If this parameter is set to false, the component is set to 00:00:00 and is not displayed to the user.

 Return Type: Date
Example getdate:

Example getdate(false):

getdiffindays

This function calculates the number of days between two different dates. Example Use Case: Check to see if a quote is expired.

 Syntax: getdiffindays(date 1, date 2)
Parameters:

Parameter
Data Type
Description

date 1

Date
Mandatory date parameter.

date 2

Date
Mandatory date parameter.

 Return Type: Float
Example:

The inputs must be in Date format. Use the function strtojavadata() to change a Date from a string format to a date format.

getstrdate

Returns the string representation of current date.
 Syntax: String getstrdate()
 Return Type: String

isleap

Using this function will determine whether the date falls within a leap year.  The function will return true if the year provided as a parameter is a leap year. 
 Example Use Case: Can determine if the date entered by a user is a valid date; or can be used when trying to calculate the total number of days in a given year.

 Syntax: isleap(year_num)
Parameters:

Parameter
Data Type
Description

year_num

Integer
Four-digit integer that represents the year in question.

 Return Type: Boolean
Example:

Since the year 2008 was a leap year, the function returns True.

isweekend

This function determines whether a date falls within a weekend (Saturday or Sunday).   The function will return true if the date provided as a parameter is a Saturday or Sunday. 
 Example Use Case: Can determine if the date entered by a user is a valid date.

 Syntax: isweekend(date)
Parameters:

Parameter
Data Type
Description

date

Date
Mandatory date parameter. 

 Return Type: Boolean
Example:

The console will return either True or False. 

minusdays

This function returns a date that is x days before the base date. Example Use Case: Can be used to set an expiration date of a quote.

 Syntax: minusdays(date, num_of_days)
Parameters:

Parameter
Data Type
Description

date

Date 
Represents the given date. 

num_of_days

Integer
 How many days you want to subtract from the given date.

 Return Type: Date
Example:

strtodate

This function is deprecated, and no longer supported. It converted data in String format to Date format.
Use strtojavadate() instead.

 Syntax: strtodate(String str, String format [, String timeZone])

strtojavadate

This function converts a string to a date and replicates Java behavior.  Use this function instead of strtodate(), which is deprecated and no longer supported.
 Syntax:: strtojavadate(String str, String format, [String timeZone])
Parameters:

Parameter
Data Type
Description

str

String
String format of a date.

format

Date Format
 Specifies the format the date will be returned in.

timeZone

String
 Optional: Retrieve the data in another time zone.

 Return Type: Date

Date Format
Date Type 

yyyy
Year in long form specifying all digits

MM
Month in numeric format

dd
The day of the month in numeric form for example. 24

HH
The hour as a number in 24 hour form

hh
The hour as a number in 12 hour form

mm
Minutes

ss
Seconds

a
AM/PM

Examples:

Example 1: Convert to US Formatstrtojavadate("02/12/2010", "MM/dd/yyyy")

Returns a date object representing February 12th, 2010.

Example 2: Convert to European Format
strtojavadate("01/02/2010", "dd/MM/yyyy") 
Returns a date object representing 01 February  2010.

Example 3: Convert to European Format with Paris, France time zone
parisdate = strtojavadate("01/02/2010 16:30:40", "dd/MM/yyyy HH:mm:ss", "Europe/Paris") 
Returns a date object representing 01 February 2010 with a time zone in Paris France.
When the datetostr method is used, another time zone can be specified and will render with the appropriate time difference.
datetostr(parisdate, "dd/MM/yyyy HH:mm:ss", "America/Chicago") 
Returns a date object with a Paris France time zone rendered into a Chicago time zone, "01/02/2010 09:30:40"

The input date string should contain month, day, and year values. If these values are omitted the results may not be correct,  i.e. an invalid date.

The format strings supported are different from the ones supported by strtodate function.

Notes
In Commerce, dates always need to be returned as strings.

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

Related Topics

See Also