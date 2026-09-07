---
id: REST_Expand_Objects
title: "REST API Services for Oracle CPQ: Expand Hierarchical Objects"
sidebar_label: "REST_Expand_Objects"
description: "Reference for expanding hierarchical and child resources in Oracle CPQ REST APIs using the expand parameter."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Expand.html
---

## Expand Hierarchical Objects

Expand queries can expand the root item and child items of hierarchical objects. You can use dotted notation to perform the following functions:

- Expand assets, attribute & action definitions at the transaction level, translations & menu items at the attribute level, and translations at the menu item level.
- Recursively expand linked child objects using `childname*.all`.
- Activate selective fields during expand and recursive expand.

Use the following syntax to specify parameters.

`{resourceURI}?{param}={paramSpec}&{param}={paramSpec}&{param}={paramSpec}`

- `{resourceURI}` - The URI endpoint of the REST API resource.
- `{param}` - A query parameter (see the Query Parameters and Pagination Parameters lists below for parameter names, descriptions, and examples).
- `{paramSpec}` - The parameter specification of the preceding parameter.

Usage Considerations:

- The parameters list must be separated from the URL endpoint of the REST resources by a "?".
- Each parameter in the parameters list must be separated by an "&".
- Each parameter must be connected to its parameter specification by an "=".
- Parameters can appear in any order in the list.

Expand Query Parameter Examples

- `actionDefs`
 - Return the transaction and only the action definition items.

```http
Copy/rest/v15/commerceProcesses/transaction/documents/quote?expand=actionDefs
```
- `all`  - Expand and asset object and it's children.

```http
Copy/rest/v15/dynamicResource/assets?expand=all
```
- `attributes,attributes.menuItems,attributes.menuItems.translations`  - Return attributes, attribute menu items, and attribute menu item translations.

```http
Copy/rest/v15/commerceProcesses/transaction/documents/quote?expand=attributes,attributes.menuItems,attributes.menuItems.translations
```
- `childAssests.all`  - Expand a child asset object and its children.

```http
Copy/rest/v15/dynamicResource/assets?expand=childAssests.all
```
- `childAssets*.all&fields=childAssets.partNumber` - Recursively expand an asset object and all children assets.

```http
Copy/rest/v15/dynamicResource/assets?expand=childAssets*.all
```
- `childAssets.wrongname.all`  - Expand a non-existing object. Child wrongname at path childAssets.wrongname does not exist or is not accessible in childAssets object for current use.

```http
Copy/rest/v15/dynamic/assets?expand=childAssets.wrongname.all
```
