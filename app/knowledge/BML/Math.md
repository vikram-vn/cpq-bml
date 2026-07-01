---
id: Math
title: "Math Functions"
sidebar_label: "Math Functions"
description: "Math Functions Functions Math, or numeric, functions serve many purposes throughout the Oracle CPQ application. Many of them represent basic mathemati..."
tags: ['BML', 'CPQ', 'Functions']
---

## Math Functions
Functions
Math, or numeric, functions serve many purposes throughout the Oracle CPQ application. Many of them represent basic mathematical and trigonometric functions. 
acos

This function returns the arc cosine of the number or angle in the range of 0 through π. 
Example Use Case: Find the inverse function of the cosine of an angle.
 Syntax: acos(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

Return Type: Float
Example:

A float variable > 1 returns NaN.

asin

The usual notation of the inverse trig function arcsine is y = arcsine(x), which is also defined as x = sin(y). This notation is the same for arccosine and arctangent. This function returns the arcsine of a number or angle. The range is: -π/2 ≤ y ≤ π/2 or -90˚ ≤ y ≤ 90˚ and the domain is -1 ≤ x ≤ 1.
Example Use Case: Find the inverse function of the sine of an angle.

 Syntax: asin(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
 Example:
If you enter your float variable as (-1), which is the lowest number in the domain, it will return the lowest number in the range, which is -π/2.

A float variable > 1 returns NaN.

atan

This function returns the arctangent of the number or angle, the range of which is: -π/2 ≤ y ≤ π/2. 
Example Use Case: Find the inverse function of the tangent of an angle.

 Syntax: atan(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

ceil

This function converts a float into the next highest whole number. 
Example Use Case: Rounding up to the next highest whole number.
 Syntax: ceil(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

If -1.0 < x < 0, then the result is negative zero.

cos

This function returns the cosine of the number/angle. 
Example Use Case: Find the ratio of the side adjacent the given angle and the hypotenuse.
 Syntax: cos(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example :

cosh

 This function returns the hyperbolic cosine of a number or angle.
Syntax: cosh(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

cosh x = 1/2(ex + e-x)

exp

This function returns Euler's number e raised to the power of the number passed through the function, also known as the exponential function. 
Example Use Case: Find whether a quantity grows or decays at a rate proportional to its current value, such as compound interest.
 Syntax: exp(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

fabs

This function returns the absolute value of a number. 
Example Use Case: Finding the distance of the quantity from zero.
 Syntax: fabs(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

fmod

This function returns the remainder of the division operation x, y.
 Syntax: fmod(x, y)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents the dividend. |
| `y` | Float | Represents the divisor. |

 Return Type: Float
Example:

If you were to use long division, the answer is 5 with a remainder of 2.  If you plus this operation into your calculator, you will see the answer is 5.6667, because the remained is being divided by the divisor.

hypot

This function returns the sqrt(x2 + y2) without intermediaries. 
Example:   sqrt(32 + 42) = sqrt(25) = 5.0 or -5.0.
 Syntax: hypot(x, y)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents the x in sqrt (x2 + y2). |
| `y` | Float | Represents the y in sqrt (x2 + y2). |

 Return Type: Float
Example:

As you can see, we have declared three variables.  The two that were required for this function to work, as well as a third variable so we can round the results of the hypot function. The result of this function return a rather large number.  Using the round function, we were able to round to the third decimal place.
Negative numbers can be passed as parameters to this function.

integer

This function returns the integer portion of a float number.  For example, this function would return 14 for the number 14.3345324. Example Use Case: Returning an attribute as an integer, without rounding.
 Syntax:  integer(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Integer
Example:

jNaN

Java Constant for Not a Number. This constant is recommended instead of NaN.
Syntax: jNaN

ln

This function returns the natural logarithm (base e) of the number.
 Syntax: ln(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float parameter. |

 Return Type: Float
Example:

If e3 = x, then ln(x) = 3.
Special Rules: 
ln(1.0) = )
ln(0) or ln(-0) = infinity 
ln(infinity) = infinity

log

This function returns the base-10 logarithm of the number.
 Example Use Case: If 1000 = 103, then 3 = log10(1000).  The logarithm of 1000 would be 3 because that is how many times you must multiply 10 to get 1000.
 Syntax: log(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float parameter. |

 Return Type: Float
Example:

If x = by, then y = logb(x)).
log(0) or log(-0) is negative infinity. 
log(infinity) is infinity.

NaN

This function is deprecated, and no longer supported. It represented a constant for Not a Number.
Use jNaN instead.

pow

This function returns the value of the first argument raised to the power of the second argument. Example Use Case: Finding the product obtained from multiplying a quantity by itself one or more times.
 Syntax: pow(x, y)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents the value of the input float. |
| `y` | Float | Represents the power to which you raise the input float. |

 Return Type: Float
Example:

round

This function returns the rounded value of a number up to a certain decimal point. 
Example Use Case: For returning float values that represent currency.  You may want to round to a certain decimal place.
 Syntax:  round(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents the given input float parameter. |
| `[n]` | Integer | Optional: Specifies the number of decimal places to round to. |

 Return Type: Float
Example:

sin

This function returns the trigonometric sine of the number/angle. 
Example Use Case: Finding the ratio of the size opposite the given angle and the hypotenuse.
 Syntax: sin(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

sinh

This function returns the hyperbolic sine of a number or angle.
 Syntax: sinh(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example :

sinh x = 1/2(ex - e-x)

sqrt

This function returns the positive square root of a number.
 Syntax: sqrt(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

tan

This function returns the tangent of the number/angle. 
Example Use Case: Find the ratio of the side opposite the given angel to the adjacent side.
 Syntax:  tan(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float 
Example:

tanh

This function returns the hyperbolic tangent of a number or angle.
 Syntax:  tanh(x)
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `x` | Float | Represents a given float input parameter. |

 Return Type: Float
Example:

tanh x = (ex - 1) / (e2x + 1)

Notes

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

Related Topics

See Also