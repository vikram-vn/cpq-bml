---
id: BMLCodingBestPractices
title: "BML Coding Best Practices"
sidebar_label: "BML Coding Best Practices"
description: "BML Coding Best Practices Overview The purpose of good coding style is to write code that is readable. Readable code is easier to debug, extend, and m..."
tags: ['BML', 'CPQ']
---

# BML Coding Best Practices

## Overview

The purpose of good coding style is to write code that is readable. Readable code is easier to debug, extend, and modify, thus increasing your productivity and that of anyone else who will read your code. It is your duty as a programmer to adhere to style best practices.

## Types of Coding Styles


## Structural Coding Style


1. The Function Header should describe the entire script's salient properties.

* The name of the script or function (for global BML search)

* Script location within BMI

* Parameters

* Return type

* Include short script descriptions or cautions for future programmers who might edit your code

* The name of the script author, date,  function editors' names, and summarizing comments

Example:

```bml title="Example"
Name                 Date                 Comments
------------------
John Doe           1/1/19               Created Function
Jane Doe            5/1/19               Added additional managers to notifications
```

1. Major sections of your code should be clearly marked and contain a brief explanation of its purpose, who wrote the code, and the date the code was written or modified.

* Provide visual contrast if possible

* Organize like chapters in a book or specific tasks in an algorithm

* Aids other programmers in identifying where they are in your script, and the current section's purpose

* Ensures your script is well structured and reminds you of what you did in different areas of a very large BML script (for example, Commerce Pricing)

* Aids in quickly skimming or scanning BML script without having to read through multiple, individual lines of comments

1. Secondary sections of your code should also be clearly marked and contain a brief explanation, if necessary.

* Some major sections of your BML script can become very complex; decompose your steps and provide explanations for readers

1. Group related lines of code together.

* The proximity of related lines of code communicates to a reader that those lines are related

* This helps a reader identify which lines of code correspond to which pieces of functionality, therefore aiding: debugging, amendment, and extension

1. Follow conventional indentation and bracketing practices (alignment).

* Use the Tab key in Notepad++

* Every immediately nested code block should be indented exactly one tab to the right with respect to its parent content

* Curly brackets should always open at the end of a line of code

  * No code of any kind should follow on the same line after the opening of a curly bracket (which denotes the start of a nested code block)

* Curly brackets should always close at the beginning and end of a line of code

* No code should exist on the same line as a closing curly bracket (which denotes the end of a nested code block)

  * The only exception for the curly bracket rules should be the inner array declaration of a hard-coded 2D array


## Inline Coding Style


1. The name and format of a BML local variable should immediately communicate its purpose, intended behavior, and usage.

Local variables used as constants should:

* Capitalize all letters

* Use underscores to separate words in the name of the constant
  * **Example:**   `ITEM_DELIM = "*@*@*";`

Local variables used as variables should:

* The first letter should be lower case

* The first letter of each subsequent word in the name should be UPPER CASE

* Do not use underscores to delimit separate words in the name
  * **Example:** `totalListPrice = 0.0`

In all cases, the name of the variable should describe itself:

* `totalListPrice` is the sum of all line item list prices

* Variable names for Arrays should have the "List", "Arr", "Array" and/or "2D" suffix
  * For example: `docNumList`, `upgradedPartsArray`, `partsData2DArray`

Variable names for Dictionaries should have the "Dict" suffix, and have a comment at the end of the declaration explaining the mapping between Key and Value:

* For example, `sequenceNumDict = dict(string) //Key: Document Number,  Value: Sequence Number`

* For example, `relatedLicenseToDocNumDict = dict(float) //Key: relatedLicense,  Value: Document Number`

* The exception to this rule is when iterating over Records in a RecordSet

  * For example, `"for partRecord in partRecords {"`

Variable names for RecordSets should have the "Records" suffix:

* For example, `partRecords`

Variable names for Booleans should have the "is" or "has" prefix (answered with a "yes/no" answer):

* Possible exceptions include standard Booleans such as "debug"
  * For example, `isUpgrade`, `isMandatory`, `hasRelatedLicense`

1. There should never be more than one statement on one line *that is, never more than one semicolon ending a statement)*.

2. Print statements should be extricated from convoluted code and separated into a debug-flag controlled if block, and if it doesn't cause the code to become less readable.

3. Functions with a single argument should always enclose that argument in parentheses, for example, `not(hasLicensing)` rather than `not hasLicensing`.

4. Extremely long single-line statements, such as String concatenations, should be split across multiple lines.

:::note
The repetition of these naming conventions will aid a reader in determining the purpose of any variable without having to refer to additional context.
:::

## Related Topics


## See Also
