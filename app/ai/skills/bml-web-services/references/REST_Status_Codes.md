---
id: REST_Status_Codes
title: "REST API Services for Oracle CPQ: HTTP Status Codes & Error Handling"
sidebar_label: "REST_Status_Codes"
description: "Reference for HTTP status codes and error payload schemas returned by Oracle CPQ REST API services."
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Status_Codes.html
---

## Status Codes

When you call any REST resource, the response header returns one of the standard HTTP status codes listed in the following table. These status codes refer to a three-digit number in the response header that indicates the general classification of the response. For example, the codes indicate whether the request was successful (200s), or resulted in a client (400s) or server (500s) error. The 400 and 500 classes of status codes help in troubleshooting bad requests.

| HTTP Status Code | Description |
| --- | --- |
| `200 OK` | Success! A successful GET or POST method returns a 200 status code. |
| `201 Created` | Your request is successful and a new resource has been created. Response includes a Location header containing the canonical URI for the newly created resource. You receive a 201 status code from: - A synchronous resource creation - An asynchronous resource creation that completed before the response was returned |
| `202 Accepted` | The server has accepted your request for processing, but hasn't yet completed processing it. Your request might be accepted or rejected during processing. This code is useful in asynchronous resource creation or updates, such as a batch-oriented process that runs only once per day. It indicates that the server has accepted your request, so you don't need to wait or be connected until the process completes. The server delivers a response that contains a Location header of a job resource. Your client should poll this header to determine the job's completion state and status. |
| `204 No Content` | Your request is fulfilled by the server, but doesn't return a response body. This is a common response on a successful DELETE, signifying the resource/instance is no longer present. |
| `400 Bad Request: validation failures, schema violations` | Your request couldn't be processed because it contains missing or invalid information, such as a validation error on an input field, a missing required value, and so forth. |
| `401 Unauthorized` | Your request isn't authorized. The authentication credentials included with this request are missing or invalid. |
| `403 Forbidden` | You don't have authorization to perform this request. You may not have the necessary roles and privileges to use this REST resource. |
| `404 Not Found <Additional information about the object not found>` | Your request includes a resource URI that doesn't exist. |
| `405 Method Not Allowed` | HTTP action specified in the request (DELETE, GET, POST, PUT) isn't supported for this request URI. |
| `406 Not Acceptable` | Although the server understands and processes your request, your client can't understand the server response because it's unsupported. A client's request header indicates what data or media types are acceptable. For example, the client's Accept header requests that XML be returned, but the server can return only JSON. |
| `412 Precondition Failed` | Your request couldn't be processed because a precondition in the header failed. For example, the request failed to update as the resource id on the server changed since the last retrieval. |
| `413 Request Entity Too Large` | The bulk request exceeds the allowed maximum number of operations. |
| `415 Unsupported Media Type` | Indicates that the server refuses to accept the client request because the payload format is unsupported. In your client, the ContentType header isn't correct. For example, the client attempts to send the request in XML, but the server can accept only JSON. |
| `500 Internal Server Error` | The server encountered something unexpected that prevented it from completing the request. |
| `501 Not Implemented` | Indicates that the server doesn't support the method used in the request, and therefore it can't process the request. |
| `503 Service Unavailable` | Indicates that the server is unable to complete the request due to a server overload. This condition is usually temporary. |
| `504 Gateway Timeout` | The server acts as the gateway and doesn't receive a timely response from the upstream server to complete the request. |

For more information on the status codes, see the [Internet Engineering Task Force (IETF)](https://tools.ietf.org/html/rfc7231#page-48) website.
