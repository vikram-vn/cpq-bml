---
id: REST_Pagination
title: "REST API Services for Oracle CPQ: Collection Pagination"
sidebar_label: "REST_Pagination"
description: "Reference for pagination in Oracle CPQ REST APIs using limit, offset, and totalResults parameters."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Paginate.html
---

## Collection Pagination

Most collection resources need some kind of pagination. Without it, a simple search could return millions of records, bringing your network to a crawl. So, instead of receiving all the records of a collection resource, you can limit the number of records that are displayed on a page in the REST client response.

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

Pagination Request Parameters

To limit the number of records returned, set the following parameters in the request payload:

| Request Parameters | Description |
| --- | --- |
| `limit` | Used to specify the paging size, up to 1000. If no limit is specified or if a limit greater than 1000 is specified, a pagination limit of 1000 will be used. |
| `offset` | Used to specify the starting point from which the resources are returned. This parameter is usually used in conjunction with `limit` to obtain the next set of record. Note: - When `limit=1`, the offset parameter is ignored in the query specifications. - When you specify the limit and offset parameters, the paginated result isn't ordered. If you update the collection resource between paging requests, the records displayed in each page may vary. |
| `totalResults` | Used to set to true to include the total number of search records that match the query. The default value is 'false', which will not include the total count of search records. Note: - This parameter is only effective when limit or `offset` are specified - If `totalResults` is not specified, the total count of records will not be included in the response. |

Example Requests

- To return records 11 through 30, append the following string to an applicable REST endpoint:

`?offset=10&limit=20`
- To query for records where the `lastName` is 'Jones' and return records 1 through 10, append the following string to an applicable REST endpoint:

`?q=lastName LIKE 'Jones%'&limit=10`
- To query for records where the `lastName` is 'Jones' and return records 26 through 50, append the following string to an applicable REST endpoint:

`?q=lastName LIKE 'Jones%'&offset=25`
- To return records 1 through 20, and include the record count that matches the query, append the following string to an applicable REST endpoint:

`?totalResults=true&limit=20`

Pagination Response Parameters

The following pagination fields are returned in the response payload:

| Request Parameters | Description |
| --- | --- |
| `count` | The number of records included in the response. |
| `hasMore` | Indicates if there are more records to be returned from the collection. - Set to 'true' when there are more records to be returned. - Set to 'false' when this is the last set of records retrieved. |
| `totalResults` | The total number of records in the collection |

Example Responses

- If the client runs a GET command on an accounts resource. The server stores 100 accounts and the current request returns only 25. To indicate that there are more records to retrieve, the server sets the read-only `hasMore` field to 'true'.

```json
Copy{"items": [
   ...
 ],
  "count": 25,
  "hasMore": true,
  "limit": 25,
  "offset": 0,
  "links": [
    {
      ...
    }
  ]
}
```
- If you set the `totalResults` parameter to true in the request, the response includes the `totalResults` field to indicate the total number of records that match your search criteria. After retrieving all the records as indicated by the `totalResults` value, the server sets `hasMore` to 'false'.

```json
Copy{
  "items": [
   ...
  ],
  "totalResults": 100,
  "count": 25,
  "hasMore": true,
  "limit": 25,
  "offset": 0,
  "links": [
    {
	...
    }
  ]
}
```
