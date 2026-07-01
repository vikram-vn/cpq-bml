# Package Lifecycle Management

## Overview

Administrators have the ability to create packages of functionality to migrate across environments and can manage the lifecycle of these packages by deploying or updating a specific package. Package Lifecycle Management provides a unique namespace to environments associated with entities, such as implementation partners, who want to create and protect their intellectual property. In addition, the content of packages is encrypted. As a result, users cannot edit the content of a package outside of an Oracle CPQ site, and the import of packages across versions is not possible.

## Administration

###### Steps to Enable

To enable the Package Lifecycle Management feature, open a Service Request (SR) on [My Oracle Support](https://support.oracle.com/).

Apply a Namespace to a Util Library Function

Administrators can open a Service Request (SR) on [My Oracle Support](https://support.oracle.com/) to set a site namespace. When this occurs, the namespace displays in the **Namespace** field on the **Util BML Library Function Editor: Properties and Parameters** page for imported functions. The use of a namespace prevents a naming conflict when migrating the util library function from a source to a target site.

When migrated, namespaced util library functions appear in folders based on the namespace of the site from which they were migrated.

Create an Override Function

An override function is an editable copy of an original and namespaced util library function. Administrators can upload a namespaced util library function and view the util library function in the **Util BML Library Function Editor: Properties and Parameters** page.

Complete the following procedure to create an override function.

1. Click **Admin** to go to the Admin Home page.

2. Click **BML Library** in the **Developer Tools** section.

The **Util BML Library Functions List** page opens.

3. Click the **Create** link to create an "Override" function.

> [!NOTE]
> **Note:** The Create link only displays when an administrator has not yet created an override function.

The util library function then opens in the **Util BML Library Function Editor: Properties & Parameters** page. Administrators can use this page to create an override function by editing the original function.

> [!NOTE]
> **Note:** Administrators cannot import new attributes or library functions into an override function. They can, however, use the Function Wizard or test the BML in the Debugger. For example: Administrators can enter Context Parameters in the Debugger and view the returned text.

4. Update the util function, then click **Update**.

When the **Edit** and **Remove** links display on the **Util BML Library Functions List** page, this indicates an override function already exists. Administrators can perform the following:

  * Select the **Edit** link to return to the override function to make additional updates.

  * Select the **Remove** link to remove an override function.

  * Select the link under the **Script Name** heading to view the original function associated with an override function.

> [!NOTE]
> **Note:** Administrators can migrate override functions along with their original namespaced util library functions. The migration flow maintains customizations made to the original namespaced util library functions.

## Notes

* Oracle highly recommends that customers only enable the Package Lifecycle Management functionality in a complex deployment structure or when developing content specifically for other environments. If customers only have a Test and Production site, Oracle does not recommend enabling the functionality.

* Partners who change an environmentâs namespace are responsible for managing all of their different namespaced util library functions. Migration treats each different namespaced util library function as a different util library function.

* Administrators can lock util library functions but not Commerce library functions.

* Administrators can only create an override function when the original util library function is namespaced.

> [!NOTE]
> Bulk downloads do not download namespaced util library functions.
> 
> 
> 
> 
> * Attempts to bulk upload override functions associated with namespaced util library functions will fail.
> 
> * Bulk uploading functions that import namespaced util library functions will fail.

## Related Topics

See Also