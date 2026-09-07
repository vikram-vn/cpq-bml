---
id: REST_Sort_Collections
title: "REST API Services for Oracle CPQ: Sort Collections"
sidebar_label: "REST_Sort_Collections"
description: "Reference for sorting collection items in Oracle CPQ REST APIs using the orderBy query parameter."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Sort.html
---

## Sort Collections

Sorting is another feature that makes it easier to work with data-heavy resources.

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

Sorting Sequence

Use asc for ascending order and desc for descending order. The default sequencing order is asc. Items returned in the response payload are sorted in a case-sensitive order.

Sorting string examples

To sort items by `documentId` in descending order, append the following string to an applicable REST endpoint:

`?orderby=documentId:desc`

- To sort items by `Deptno` in ascending order, append the following string to an applicable REST endpoint:

`?orderby=Deptno:asc`

Alternatively, you can simply append the following string, because asc is the default sorting order.

`?orderby=Deptno`
- If you include multiple fields in the query parameter, the order in which you specify the fields determines the sorting order.

For example, to sort items by `title` in ascending, and then sort by `dateAdded` in descending order, append the following string to an applicable REST endpoint:

`?orderby=title,dateAdded:desc`
