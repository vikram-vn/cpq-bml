# URL Access Functions

## Functions

These functions can be used to send and receive data from external systems.

makeurlparam

This function is used to convert a series of name-value pairs into a query string, which can be appended to a URL.

Syntax:

String makeurlparam( {String 'name1' : String "value1", [String 'name2' : String "value2", ...]})

Parameters:

| Parameter | Data Type | Description                 |
| --------- | --------- | --------------------------- |
| 'name'    | String    | The name of the parameter.  |
| "value"   | String    | The value of the parameter. |

Return Type: String

Example:

urldata

This function sends and receives data from a URL  using HTTP GET, POST, PUT, or PATCH  methods.
The HTTP DELETE method can also be used to delete data from a URL

> [!NOTE]
> **Note:** urldata functions can be used to make internal SOAP and REST calls to Oracle CPQ web services. This is generally not recommended and declarative features should be used when possible.

Syntax:

urldata(String url, String httpMethod, [Dictionary headers], [String body], [Integer timeout]);

Parameters:

| Parameter  | Data Type  | Description                                                                                                                                                                                                                              |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url        | String     | The location of the data you are trying to access. You can add additional query string parameters to the URL as needed. Refer to the `[makeurlparam](../../makeUrlParam.md)` function for additional details on query string parameters. |
| httpMethod | String     | Supported methods: GET, DELETE, PATCH, POST, or PUT                                                                                                                                                                                      |
| headers    | Dictionary | Headers will commonly specify the content type of the body, the authentication details, and the desired media type of the response.                                                                                                      |
| body       | String     | Optional: Include the message body for the request you wish to send. GET and DELETE requests often omit this. Common content types for the message body are JSON and XML.                                                                |
| timeout    | Integer    | Optional: Specify a timeout value for the request. Refer to [Timeout Parameter](../../timeoutParameter.md) for more information.                                                                                                         |

**Return Type:** Dictionary

**Example Response**: The urldata() function returns a dictionary which contains the HTTP response from the external resource.

The key-value pairs in the table below are an example of a simple response.

| Key            | Value            |
| -------------- | ---------------- |
| Status-Code    | 200 OK           |
| Content-Type   | application/json |
| Content-Length | 2                |
| Message-Body   | {}               |

Response Handling Example

```
response = urldata(url, method, headers);
print(get(response, "Status-Code")); // print the status code
print(get(response, httpHeaderName)); // print the value of the header named httpHeaderName
print(get(response, "Message-Body")); // print the message body
```

> [!NOTE]
> **Note:** For information about working with dictionaries, refer to the [Dictionaries](Dictionary.md)  topic.

**Examples using urldata:**

Send a GET request without a header

```
response=urldata("http://<hostname>/<path>","GET");
```

Send a GET request with a header and a timeout

```
headers=dict("string");
put(headers, "content-type", "application/json");
response=urldata("http://<hostname>/<path>", "GET",headers,"", 5000);
```

Sample error message response during timeout:

```
{Status-Code=-1, Error-Message=Read timed out}
```

Send a PUT request with a header

```
headers=dict("string");
put(headers, "content-type", "application/json");
response=urldata("http://<hostname>/<path>","PUT",headers,jsonBody);
```

Send a DELETE  request with headers that specify Basic authentication

```
headers=dict("string");
encodecredential = encodebase64("<username>:<password>"); // for Authentication 
authstring="Basic " + encodecredential;
put(headers, "Authorization", authstring); //optional if service is from the same site
response=urldata("http://<hostname>/<path>","DELETE",headers);
```

Send a GET request with headers that specify Bearer authentication

```
headers=dict("string");
put(headers, "Authorization", "Bearer $_acess_token_dynamics365");
response=urldata(http://<hostname>/<path>",GET, headers);
```

> [!NOTE]
> **Note:** This example uses a bearer token for Microsoft Dynamics 365. Please see the [OAuth Provider](../../Integrating_With_BigMachines/Integration_Center/OAuthIntegration.md) Integration topic for more information.

Send a PATCH request using headers that specify Basic authentication

```
headers=dict("string");
encodecredential = encodebase64("<username>:<password>"); // for Authentication
authstring="Basic " + encodecredential;
put(headers, "Authorization", authstring); //optional if service is from the same site
put(headers, "content-type", "application/json");
response=urldata("http://<hostname>/<path>","PATCH",headers,jsonBody);
```

urldatabyget

This function retrieves data from a URL address by the HTTP Get Method. It is used for RESTful Web Services and is faster than the POST method.

Syntax:

String urldatabyget(String url, String parameters, String defaultValue,[Integer timeout])

| Integration Criteria         | Value                       |
| ---------------------------- | --------------------------- |
| Size                         | Varies, but generally small |
| Frequency                    | Triggered during workflow   |
| Format                       | Passes arguments as a URL   |
| Transmission Synchronization | Synchronous                 |

Parameters:

| Parameter    | Data Type | Description                                                                                                                                                  |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| url          | String    | The location of the data you are trying to access.                                                                                                           |
| parameters   | String    | A string function used to extract real-time data from an external system * Refer to the `[makeurlparam](../../makeUrlParam.md)` function for format details. |
| defaultValue | String    | This is the default value (or error message) displayed if the data cannot be accessed.                                                                       |
| timeout      | Integer   | Function timeout value * Refer to the [Timeout Parameter](../../timeoutParameter.md) section for more information.                                           |

**Return Type:** String

Example:

urldatabypost

This function retrieves data from a URL address by the HTTP  POST Method.

* This function passes parameters separately from the URL.  It is useful when handling sensitive data and/or larger requests.  It allows for encrypted requests.  This is used for SOAP Web Services. For more information, see the topic [Using SOAP with BML](../UseSOAPwithBML.md).

* Refer to [Same Server Authentication](../../Same_Server_Authentication.md) for information on authorization for internal RESTful web services calls.

Syntax:

String urldatabypost(String url, String parameters, String defaultValue, [Integer timeout]]])

| Integration Criteria         | Value                               |
| ---------------------------- | ----------------------------------- |
| Size                         | Varies, but generally small         |
| Frequency                    | Triggered during workflow           |
| Format                       | Passes arguments as XML (generally) |
| Transmission Synchronization | Synchronous                         |

Best Practice is to use the File Manager to hold the data from POST.

Parameters:

| Parameter    | Data Type | Description                                                                                                                                                  |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| url          | String    | The location of the data you are trying to access.                                                                                                           |
| parameters   | String    | A string function used to extract real-time data from an external system * Refer to the `[makeurlparam](../../makeUrlParam.md)` function for format details. |
| defaultValue | String    | This is the default value (or error message) displayed if the data cannot be accessed.                                                                       |
| timeout      | Integer   | Function timeout value * Refer to the [Timeout Parameter](../../timeoutParameter.md) section for more information.                                           |

Additional parameters

Oracle CPQ allows additional parameters that can be passed to `urldatabypost` to pass header values.

```
headers = dict("string");
put(headers, "SoapAction Key", "SoapAction Value");
return urldatabypost("https://cpluto.oracle.com/httpreceiver", "", "", headers);
```

**Return Type:** String

Example of urldatabypost:

As the function suggests, this information is not available.

Sample Request

urldatabypostasync

Retrieves data asynchronously from a URL using HTTP POST to submit parameters (see the makeurlparam function for formatting).

Syntax:

String urldatabypostasync(String url, String parameters, String defaultValue, String callbackActionVarName, [Dictionary headers, [Boolean returnErrorResponse,[Integer timeout]]])

Custom HTTP headers can be applied by passing a Dictionary of Strings in the optional headers parameter.

Parameters:

| Parameter             | Data Type  | Description                                                                                                                                                  |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| url                   | String     | The URL location of the data you are trying to access.                                                                                                       |
| parameters            | String     | A string function used to extract real-time data from an external system * Refer to the `[makeurlparam](../../makeUrlParam.md)` function for format details. |
| defaultValue          | String     | This is the default value (or error message) displayed if the data cannot be accessed.                                                                       |
| callbackActionVarName | String     | The variable name of the CPQ action that will be invoked by the external system.                                                                             |
| headers               | Dictionary | The message headers                                                                                                                                          |
| returnErrorResponse   | Boolean    | **Optional:** The value response, based on the key specified in the dictionary.                                                                              |
| timeout               | Integer    | Function timeout value * Refer to the [Timeout Parameter](../../timeoutParameter.md) section for more information.                                           |

1. On success, the function returns the response String.

2. If the function fails and the optional returnErrorResponse parameter is set to True, the function returns a specific HTTP error code message.

3. Otherwise, the function returns the defaultValue.

> [!NOTE]
> A Request Soap Message should contain $_BM_ASYNC_ADDRESSING_TOKEN$ in the header.

**Return Type:** String

Examples of urldatabypostasync:

```
urldatabypostasync("http://www.example.com", "a1=v1&a2=v2", "error message", "callbackActionVarName");
```

```
urldatabypostasync("http://www.example.com", "a1=v1&a2=v2", "error message", "callbackActionVarName", myHeaders); //Uses custom HTTP headers
```

```
urldatabypostasync("http://www.example.com", "a1=v1&a2=v2", "", "callbackActionVarName", dict("string"), true); //Uses the HTTP error code message (without custom headers)
```

```
urldatabypostasync("http://www.example.com", "a1=v1&a2=v2", "", "callbackActionVarName", myHeaders, true); //Uses both custom headers and the error code message
```

```
//SENDING ASYNC REQUEST- SAMPLE BML

endPoint="https://endpoint.customer.com" //where call is sent
headerValues = dict("string");
put(headerValues, "Content-Type", "text/xml; charset=utf-8");
put(headerValues,"replyinfo","$_BM_ASYNC_ADDRESSING_TOKEN$");//will contain info for transaction to call back
errorString = "Error in async invocation"; //error message if cannot connect successfully with external system
callback="AsyncResponseAction";//variable name of the CPQ action that will be invoked by the external system
soapbody=""<soap:Body> <more>otherinfor</more> </soap:Body>" ;" //other information that external system may need

callasync= urldatabypostasync(endPoint , soapbody ,errorString,callback,headerValues,true); // sends the soap call and returns response to variable.

return "done";

//SAMPLE OF $_BM_ASYNC_ADDRESSING_TOKEN$ where MessageID has particular info, and Address is endpoint
<wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">
uuid:276653d6cd0b486a9907428102cc8dd8
</wsa:MessageID>
<wsa:ReplyTo xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" soap:mustUnderstand="1">
<wsa:Address> https://mycpqsite.com/v2_0/receiver/callback </wsa:Address>
</wsa:ReplyTo>

//SAMPLE ASYNC RESPONSE.
<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
<soapenv:Header>
<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
<wsse:UsernameToken>
<wsse:Username>WS_USER</wsse:Username>
<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">password</wsse:Password>
</wsse:UsernameToken>
</wsse:Security>
<wsa:relatesTo
xmlns:wsa="http://www.w3.org/2005/08/addressing">uuid:95d133028f0b4fb59903dbd888fcac22</wsa:relatesTo>
</soapenv:Header>
<soapenv:Body/>
</soapenv:Envelope>

//SAMPLE PARSING IN THE CALLBACK ACTION
//information from external system will be in _system_async_payload variable
path = "//orderNumber";
orderNumber = readxmlsingle(_system_async_payload, path);

return "1~orderNumber~" + orderNumber;
```

urlmultipartbypost

This function supports remote approvals by sending multi-part messages with attachments.

> [!NOTE]
> Notes:
> 
> 
> 
> 
> * This function is only intended to be used with external API calls.
> 
> * This function sends raw JSON. The receiving server needs to interpret the JSON into a multipart call.

Syntax:

Dictionary urlmultipartbypost(String url, String payload, [Dictionary headers, [Dictionary attachments,[Integer timeout]]])

Custom HTTP headers can be applied by passing a Dictionary of Strings in the optional headers parameter.

Parameters:

| Parameter   | Data Type  | Description                                                                                                        |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| url         | String     | The URL location of the data you are trying to access.                                                             |
| payload     | String     | The payload                                                                                                        |
| headers     | Dictionary | The message header                                                                                                 |
| attachments | Dictionary | Optional                                                                                                           |
| timeout     | Integer    | Function timeout value * Refer to the [Timeout Parameter](../../timeoutParameter.md) section for more information. |

Sample Input:

`url`: *<request url>*

payload:

```
{
   "processDefId": "default~CPQApproval!1.0~QuoteApprovalProcess",
   "serviceName": "QuoteApprovalProcess.service",
   "operation": "start",
   "payload": "<quot: start xmlns:quot='http://xmlns.oracle.com/bpmn/bpmnCloudProcess/CPQApprovalDemo/QuoteApprovalProcess'> <requestor>Suyog</requestor> <quoteId>123456</quoteId> <quoteTotal>12567</quoteTotal> <discountPercentage>23</discountPercentage> <requestorEmail>approve_pCSsubmit</requestorEmail> </quot:start>",
   "action": "Submit"
}
```

Sample Return

On success, a Dictionary representation of the http response, such as âStatus-Codeâ, âContent-Typeâ, âMessage-Bodyâ, etc., is returned.

### Additional Information

Same Server Authentication

Authorization is optional when making a web services call that is internal to CPQ. You can omit the authorization string in the header when using urldata() and urldatabypost() functions. When no authorization string is provided the current user's login credentials are used.

> [!NOTE]
> **Note:** Making self-SOAP and self-REST calls using urldata functions is not recommended. Use declarative functionality where possible.

Example  using urldatabypost():

```
headers=dict("string");
//Authorization is not required when calling an Oracle CPQ web service that is on the same site
put(headers, "Content-Type", "application/json");
response=urldatabypost("http://<mycpqsite>.oracle.com/<Oracle CPQ endpoint>, jsonBody, "", headers);
```

Timeout Parameter

An optional timeout parameter can be set on the `urldata`, `urldatabyget`,`urldatabypost`, `urldatabypostsync`, and `urlmulitpartbypost` functions.

* The timeout value is in milliseconds.

* This parameter overrides the General Site Option "BML URL Function Timeout".

* If a timeout occurs,  a dictionary representation of the error response is returned with Status-Code and Error-Message as keys.

## Notes

**Note:** BML functions that access remote content (e.g., urldata, urldatabyget, urldatabypost) no longer allow request key/value pairs that contain illegal characters. Any attempt to use those illegal characters will cause the request (and thus potentially the entire BML function) to fail. Administrators can find the offending KEY identified in the error log.

If you are retrieving File Manager static resources/files, use the HTTP GET protocol. 

## Related Topics

See Also