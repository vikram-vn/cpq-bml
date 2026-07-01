# Function Editor Overview

## Overview

:::note
This topic covers the Funtion Editor using the classic interface pages. Refer to [Util BML Library Functions List](../UtilBmlLibraryFunctionsList.md) and [Util Function Editor](BML_Editor.md) for process administration using Redwood UI pages.
:::

While there are notable differences between the function editors found in the Oracle CPQ application, there are some common characteristics as well.

Button Definitions

You will see the buttons at the bottom of the **Editor** pane:

* The **Translations** button translates Oracle CPQ content and product templates into the following languages: French, German, and Spanish.

* The **Validate** or **Check** button checks your code for errors.

* The **Apply** button allows you to save your code and continue editing.

* The **Update** button saves your code and closes the function editor.

* The **Back** button returns you to the previous page.

Syntax Colors

The following code is displayed in different colors:

| Color | Definition                                                          |
| ----- | ------------------------------------------------------------------- |
| Black | Variable names, float and integer variables                         |
| Pink  | Numeric Operators                                                   |
| Aqua  | Literals or Data Types (string, float, integer, boolean, and so on) |
| Blue  | Functions and string variables                                      |
| Green | Conditional Functions                                               |
| Gray  | Comments                                                            |

Script Definition Area

BML can be typed directly into the Script Definition Area.  Save your changes after writing/editing the script. **Example:**

The bar across the bottom represents the character position in the code and the total number of characters.

The box on the left defines the position of the character based on its line and index.  The box to the right gives you the actual number of characters in each line.

Clicking the **Binoculars**  will open a **Search and Replace** dialog box, to find and/or replace part of the script.

:::tip
Use the toolbar above to undo/redo changes, change the font or jump to a specific line in the script.

You can also click the **blue arrow** to jump to a specific line in the script.
:::

:::note
Character indexes begin with 0.
:::

Attributes & Actions

In the function editor, you can select attributes to include within your code.  These attributes are specific to the product family that you are working in.  For example, when you are in Configuration, you can select from a standard product line, model, account, user or configuration attributes.

Adding an Attribute

1. Select **Add Attributes** in the **Attributes** tab.  *This adds an editable row to the Attributes list.*

2. Navigate through the drop-down attributes menu to find the desired attribute, or start typing. The attribute list will filter for you.

The proper **Variable Name** will automatically populate.

3. Click the drop-down in the first column and navigate through the attributes list to find the desired attribute, or click and start typing. The attribute list will filter for you.

The proper **Variable Name** will automatically populate.

4. Navigate through the drop-down and choose the desired value for the selected attribute.

5. Click the **blue arrow** to insert the attribute value into the Script Definition Area.

:::note
The return type of your code will be displayed in between the section with the header tabs and the script definition area.

The action attribute values you select will determine the return type of your code.
:::

Library Function(s): Function to Function Calls

Util and Commerce Library Function Editors use Function to Function calls. Function to Function calls allow admins to compartmentalize BML when dealing with complicated configuration or quoting scenarios. This feature will assist with the organization of BML and provides a solution to the compiled Java class size-limit issue. *Function to function calls mimic the behavior of a Modify function calling a Library function.*

Adding a Function to Function Call

1. Open the **Function** drop-down.

2. Select a Library Function to **Insert into BML**. The options are:
  * **Commerce Library functions:** Only available in Commerce Library Function Editors. Commerce Library functions may only be called by Commerce Library functions.
  * **Util Library functions:** Available in both Commerce and Util Library Function Editors.

3. Once the function is viewed using the **Preview Function**, click the **Insert into BML** blue arrow button.

4. When finished, click one of the following buttons:

:::tip
The **Function to Function** link appears on the **Related Rules** page. When it is referenced by other Utils it will be displayed on the **Related Rules** page.
:::

:::note
Recursive validation is performed during the following for Util and Commerce Library Functions: Validate, adding, applying, or updating a function.
:::

:::warning
Util and Commerce Library functions cannot self-reference. Recursive calling of the same Util and Commerce Library functions will fail and result in a compilation error when called at any point in the reference chain. Util and Commerce Library functions will not appear in the Import list for themselves.
:::

## Related Topics

See Also