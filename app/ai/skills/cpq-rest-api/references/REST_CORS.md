---
id: REST_CORS
title: "REST API Services for Oracle CPQ: Cross-Origin Resource Sharing (CORS)"
sidebar_label: "REST_CORS"
description: "Reference for CORS headers, preflight requests, and allowed origins in Oracle CPQ REST APIs."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/CORS.html
---

## CORS Access Control for REST APIs

Cross-Origin Resource Sharing (CORS) protocol allows web browsers to make requests to a server that is not in the same domain as the requesting web application. CORS enables secure communication when using a browser-based programming language, such as JavaScript, to access content from another domain using HTTPS requests. Without CORS access control, calls into Oracle CPQ REST endpoints from other domains in a browser context would be blocked.

In Oracle CPQ, trusted origins can access Oracle CPQ REST services and access-control headers can be included in Oracle CPQ REST responses. CORS enables better access control for Oracle CPQ REST APIs when invoked by external applications by providing support for CORS headers to be included in REST responses.

This functionality is not enabled by default. Customers wishing to enable CORS headers access control support for external applications should log a Service Request (SR) on [My Oracle Support](https://support.oracle.com/) to establish their allowlist of trusted origins, determine the necessary CORS headers and set their appropriate values.

Once enabled, you can modify values for CORS headers by logging a Service Request (SR) on [My Oracle Support](https://support.oracle.com/).

| CORS Headers | Purpose |
| --- | --- |
| Access-Control-Allow-Origin | Specifies a trusted origin that a client application can access resources from. Log a Service Request (SR) on [My Oracle Support](https://support.oracle.com/) to establish an allowlist of trusted origins or to update the allowlist. For example: `http://example.com` Note: An origin value must be provided for this header to enable CORS. |
| Access-Control-Max-Age | Specifies the duration of storing the results of a request in the preflight result cache. The maximum value allowed is 7200 seconds. For example: 60 seconds |
| Access-Control-Allow-Methods | Contains a list of permitted HTTPS methods supported in an Oracle CPQ REST API request. For example: GET, HEAD, POST, PUT, PATCH, DELETE |
| Access-Control-Allow-Headers | Contains a list of permitted preflight headers which can be accessed in an Oracle CPQ REST request. For example: Authorization, Content-Type Note: "Authorization" must be included in the list of allowed headers. |
| Access-Control-Exposed-Headers | Contains a list of permitted headers which can be exposed in an Oracle CPQ REST request. AFor example: Authorization, Content-Type Note: "Authorization" must be included in the list of allowed headers. |
| Access-Control-Allow-Credentials | Specifies whether a client application can send user credentials with a request. |

Note:

Customers who use JavaScript in cross-site requests can be CORS compliant by including the sites involved in the cross-site request in the CORS compliance allowed list. To update the allowlist, log a Service Request (SR) on [My Oracle Support](https://support.oracle.com/).
