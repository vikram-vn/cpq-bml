---
id: REST_Query_Collections
title: "REST API Services for Oracle CPQ: Query Collections"
sidebar_label: "REST_Query_Collections"
description: "Comprehensive reference for filtering collections in Oracle CPQ REST APIs using the q query parameter and MongoDB-style query operators."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Query.html
---

## Query Collections

You can use the q parameter to query and filter a collection resource. The q parameter declares a query specification expression in MongoDB format.

Use the following syntax to specify parameters.

`{resourceURI}?{param}={paramSpec}&{param}={paramSpec}&{param}={paramSpec}`

- `{resourceURI}` - The URI endpoint of the REST API resource.
- `{param}` - A query parameter (see the Query Parameters and Pagination Parameters lists below for parameter names, descriptions, and examples).
- `{paramSpec}` - The parameter specification of the preceding parameter.

Usage Considerations:

- The parameters list must be separated from the URI endpoint of the REST resources by a "?".
- Each parameter in the parameters list must be separated by an "&".
- Each parameter must be connected to its parameter specification by an "=".
- Parameters can appear in any order in the list.

Query Parameters and Operators

CPQ Supports the following parameters and operators for applicable REST API services:

| Query Parameter | Description |
| --- | --- |
| `fields` | Force-active fields are always included in the response. Example `?fields=node,eventDate,applicationVersion` |
| `excludeFieldTypes` | Specifies a comma-separated list of fields to be excluded in the response. Valid field types: boolean, currency. date, fileAttachment, float, history, integer, language, menu, readOnlyText or HTML, richText, secureText, text, textArea, composite, customerId, sequenceNumber, and system. Example `?excludeFieldTypes=fileAttachment,readOnlyTextOrHtml` |
| `finder` | Used as a predefined finder to search the collection. Format: `?finder=<finderName>;<VarName>=<variableValue>` Example `?finder=findByKeyword;keyword=Customer` |
| `onlyData` | The resource item payload will be filtered in order to contain only data (no links section, for example). Example `?onlyData=true` |
| `q` | Declares a query specification expression in MongoDB format. See [MongoDB Query Specifications](https://docs.mongodb.com/manual/tutorial/query-documents/) for more information. Example `?q={createdBy:'Matt'}` |

Comparison Operators

| Comparison Operator | Description | Example |
| --- | --- | --- |
| `$eq` | Equals (=) | The following query will return all items created by Matt `?q={createdBy:{$eq: 'Matt'}}` |
| `$ne` | Not equals (<>) | The following query will return all items not created by Matt `?q={createdBy:{$ne:'Matt'}}` |
| `$gt` | Greater than (>) | The following query will return all items with a quantity greater than 100 `?q={quantity:{$gt:'100'}}` |
| `$gte` | Greater than or equals (>=) | The following query will return all items with a quantity greater than or equal to 100 `?q={quantity:{$gte:'100'}}` |
| `$lt` | Less than (<) | The following query will return all items with a quantity less than 100 `?q={quantity:{$lt:'100'}}` |
| `$lte` | Less than or equals (<=) | The following query will return all items with a quantity less than or equal to 100 `?q={quantity:{$lte:'100'}}` |
| `$exist` | - $exists:true equals is not null - $exists:false equals is null | The following query will return items where the createdBy field is null `?q={createdBy:{$exists:false}}` Note: Boolean values must be enclosed in quotes when using the "exists" operator in a query to filter dynamic menu options (i.e. Single Select Pick Lists). `?q=status_t:{$exists:'true'}` |

Logical Operators

Logical operators are used to join multiple clauses.

- $and - This operator will only include filtered values that match all the query clauses.
 

The following query will return items where the quantity is less than 100 and the discount is not null

```json
Copy?q=$and:[{quantity:{$lt:100}},{discount:{$exists:true}}]
```
- $or - This operator will include any of the filtered values that match the query clauses.
 

The following query will return items where the customer Id is 764589 or are created by Matt

```json
Copy?q=$and:[{customerId:{$eq:764589}},{createdBy:{$eq:'Matt'}}]
```

Note:

- $and and $or are the only MongoDB conjunction operators that can be interpreted by CPQ.
- For more information on MongoDB syntax, see [MongoDB's Query Documents](https://docs.mongodb.com/manual/tutorial/query-documents/).
