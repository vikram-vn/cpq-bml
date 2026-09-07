---
id: REST_Resource_Methods
title: "REST API Services for Oracle CPQ: Resource Methods"
sidebar_label: "REST_Resource_Methods"
description: "Reference for supported HTTP methods (GET, POST, PUT, PATCH, DELETE) and delta update semantics in Oracle CPQ REST APIs."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Resource_Methods.html
---

## Supported HTTP Methods

The HTTP methods used in CPQ are `GET`, `DELETE`, `PATCH`, `POST`, and `PUT`. The building blocks of REST APIs, these methods define actions applied to REST resources using their URLs.

| HTTP Method | Description |
| --- | --- |
| GET | Retrieve information about the specified resource. Refer to [Manage Collections](Collections.html) for parameters that can be used with multi-level resources. |
| POST | Request to invoke an operation, create a resource instance, or modify the specified resource. |
| DELETE | Request to delete the specified resource. |
| PUT | Request to update the specified resource. Note: In v11 CPQ standardized REST APIs that use the PUT method to update CPQ resources. When using PUT method REST APIs to update a CPQ resource, any parameters that are not explicitly included in the request body will be set to the default value. If you are not sending all parameters in the PUT method REST API request, you should use an alternate REST API that uses the PATCH method to avoid clearing unspecified properties. |
| PATCH | Request to modify the specified resource by importing new or modified attributes. |

Note:

- Oracle recommends that you periodically review if your REST request requirements have changed. Also check with your service administrator if any capacity adjustments or other changes are required in your service configuration.
- Child resources usually inherit security privileges from their parent resource. Therefore, to use a method on a child resource, you may need to have access to use that method on the parent resource. However, there may be some child resources with different privilege requirements to access them.
- Create, read, update, and delete (CRUD) operations that can be performed on each exposed Oracle CPQ service resource may vary. See each individual resource page for a full list of available CRUD operations.
