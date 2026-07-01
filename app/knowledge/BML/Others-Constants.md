---
id: Others-Constants
title: "Other Functions"
sidebar_label: "Other Functions"
description: "Other Functions CPQ Constants BM_CM_RULES_LOCATION Dictionary key for the rule's message location. Where the message will be displayed. Options are at..."
tags: ['BML', 'CPQ', 'Functions']
---

## Other Functions
CPQ Constants
BM_CM_RULES_LOCATION

Dictionary key for the rule's message location.
Where the message will be displayed. Options are attribute (default) and top.

BM_CM_RULES_MESSAGE

Dictionary key for the rule's message.
The message to be displayed for the violated constraint.

BM_CM_RULES_OPERATOR

Dictionary key for the rule's operator.
Operator used to evaluate constraint, as in Simple Constraints.

BM_CM_RULES_VALUES

Dictionary key for the rule's values.
Tilde-delimited values used to evaluate constraint, as in Simple Constraints.

BM_CONFIGURATION_KEY

Generic key used to determine the current configuration context.

BM_DEFAULT_SOURCE_IDENTIFIER

The variable name of the commerce process or external application identifier.

BM_PARTNER_SECURITY_TOKEN

The BM_PARTNER_SECURITY_TOKEN parameter represents the WSSE security Username Token for SOAP, used for sending stateless SOAP with UrlDataByPost.
Example: ...<soapenv:Header><ClientName xmlns="urn:crmondemand/ws">Bigmachines</ClientName>"+BM_PARTNER_SECURITY_TOKEN+"</soapenv:Header>...
Inserts the block<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity- secext-1.0.xsd"><wsse:UsernameToken><wsse:Username>User'sPartnerLogin</wsse:Username> <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">User'sPartnerPassword</wsse:Password></wsse:UsernameToken> </wsse:Security>

BM_PRIOR_CONFIGURATION_KEY

Generic key used to determine prior configuration context.

BM_PRIOR_ROOT_BOM_ITEM

Projected state of the asset calculated for a requested date.

BM_REASON_STATUS_APPROVED

Reason exists in the user-side tree and it is approved by all approvers, therefore the reason is completely approved. 

BM_REASON_STATUS_INACTIVE

Reason exists in admin reason tree but the condition for the reason is not met, therefore no record for it exists in the user-side tree. 

BM_REASON_STATUS_INVALID

No reason exists in admin reason tree with given variable name.

BM_REASON_STATUS_PENDING

Reason exists in the user-side reason tree and there are pending approvals. 

BM_REASON_STATUS_REJECTED

Reason exits in user-side tree, but has been rejected by at least one approver. 

BM_REMOTE_APPROVAL_STATUS_APPROVED

Approved Status. This is used in Remote Approvals in the tilde separated approval history to be returned in the BML in Approve/Reject action
Example:returnString=returnString+ApproverName+"~"+ApproverCompany+"~"+ApproverDate+"~"+BM_REMOTE_APPROVAL_STATUS_APPROVED+ "~" + ApproverComment +"~||";

BM_REMOTE_APPROVAL_STATUS_CUSTOM

Custom Status. This is used in Remote Approvals in the tilde separated approval history to be returned in the BML in Approve/Reject action. This can be used for anything other than Approved/Rejected
Example:returnString=returnString+ApproverName+"~"+ApproverCompany+"~"+ApproverDate+"~"+BM_REMOTE_APPROVAL_STATUS_CUSTOM+ "~" + ApproverComment +"~||";

BM_REMOTE_APPROVAL_STATUS_REJECTED

Rejected Status. This is used in Remote Approvals in the tilde separated approval history to be returned in the BML in Approve/Reject action
Example:returnString=returnString+ApproverName+"~"+ApproverCompany+"~"+ApproverDate+"~"+BM_REMOTE_APPROVAL_STATUS_REJECTED+ "~" + ApproverComment +"~||";

BM_SALES_ROOT_BOM_ITEM

Sales BOM used for launching configurator.

BM_UNCHANGED_DATE

Constant for 'Leave Value Unchanged' for Date. 
 Return Type:  Date
 Example:  
Consider a date array dateArr = Date [] {getdate, getdate}.
If you want to keep the value of dateArr[0] unchanged, specify the following:
dateArr = Date [] {$BM_UNCHANGED_DATE$, getdate};

BM_UNCHANGED_NUM

Constant for 'Leave Value Unchanged' for Number. This is used to specify an array value that should remain unchanged.
 Return Type:  Numeric
 Example of:  
Consider an int array intArr = Integer [] {1,2,3}.
If you want to assign new values to intArr[1] and intArr[2] but keep intArr[0] = 1, specify the following:
intArr = Integer [] {$BM_UNCHANGED_NUM$, 21,23};

BM_UNCHANGED_STR

Constant for 'Leave Value Unchanged' for String.
 Return Type:  String
Example:
Consider a string array strArr = String [] {"a","b"}.
If you want to keep the value of strArr[0] unchanged, specify the following:
strArr = String [] {$BM_UNCHANGED_STR$, "abc"};

Related Topics

See Also