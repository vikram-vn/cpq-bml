---
id: UseSOAPwithBML
title: "Using SOAP with BML"
sidebar_label: "Using SOAP with BML"
description: "Using SOAP with BML Administration Before using SOAP as a solution, confirm there isn't another way to implement the solution with standard functionality. Determine which type of SOAP call you need. C..."
tags: ['BML', 'CPQ']
---

# Using SOAP with BML


## Administration


:::warning
Before using SOAP as a solution, confirm there isn't another way to implement the solution with standard functionality.
:::


1. Determine which type of SOAP call you need.

2. Click **Admin** to go to the Admin Home Page.

3. Click **Web Services** under the **Integration Platform** section.


The **Web Services Test** page opens.


* Record the Receiver URL (SOAP URL)

  * Generate a Sample SOAP Call and copy the sample data into a text editor


4. Replace all dynamic data with holder text.


:::tip
The holder text should be alpha-numeric and in all capital letters. The only special characters allowed are underscores (_). In the example below, SESSION_ID and TRANSACTION_ID are the holder text.
:::


1. Example of a `getTransaction`Commerce SOAP API:


```xml title="Example of a getTransaction Commerce SOAP API"
<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soap env="http://schemas.xmlsoap.org/soap/envelope/">
<soapenv:Header>
<bm:userInfo xmlns:bm="urn:soap.oracle.com">
<bm:sessionId>FBA46BAE5D5DF082B4EC1B13E62DA32A</bm:sessionId></bm:userInfo>
<bm:category xmlns:bm="urn:soap.oracle.com">Commerce</bm:category>
<bm:schemaLocation>http://bigideas2010.oracle.com/bmfsweb/bigideas2010/schema/v1_0/commerce/quotes_process_bmClone_24.xsd</bm:schemaLocation>
</bm:xsdInfo>
</soapenv:Header>
<soapenv:Body>
<bm:getTransaction xmlns:bm="urn:soap.oracle.com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<bm:transaction>
<bm:id/>
</bm:transaction>
</bm:getTransaction>
</soapenv:Body>
</soapenv:Envelope>
```

2. Save file with .xml extension to File Manager under SOAP folder, make sure that the file name is descriptive. In the example above, the file would be saved as getTransaction.xml.


:::note
It is important that the file is well formed.
:::


1. In BML editor:  (This example gets a transaction and returns the SOAP call, which could be used in configuration).


```xml title="In BML editor"
/*Gathers quote fields and posts them externally, returns the XML response from the external system.*/
soapResponseXML = "";
//Prepare xml string to be used in WS request.
//Pull dynamic content from one or more quote and/or line level commerce attributes
dynamicQuoteContent="";
dynamicLineContent="";
//Populate the quote content directly
dynamicQuoteContent = "<quote:someQuoteAttribute1>" + someQuoteAttribute1_quote + "</quote:someQuoteAttribute1>" + "<quote:someQuoteAttribute2>" + someQuoteAttribute2_quote + "</quote:someQuoteAttribute2>" ;
//Loop over lines to populate the line content.  Could use conditional logic to only use certain lines (not shown here).
for line in line_process
{
dynamicLineContent=dynamicLineContent+"<item1:ItemNumber>"+someLineAttribute1_line+"</item1:ItemNumber>";
}
//Get a skeleton XML file that you've built used for this particular integration. Store it in the file manager and access it from BML as follows.
getTransactionURL = "https://"+ lower(_system_supplier_company_name) +".oracle.com/bmfsweb/"+ lower(_system_supplier_company_name) +"/image/folderName/xmlFileName.xml";  //XML SOAP Request file location
getTransactionFile = urldatabypost(getTransactionURL,"","");  // Gets XML file.
//Replace placeholder content in the XML with the dynamic content gathered earlier.
getTransactionFile = replace(getTransactionFile,"$DYNAMICQUOTECONTENT$", dynamicQuoteContent);
getTransactionFile = replace(getTransactionFile,"$DYNAMICLINECONTENT$", dynamicLineContent);
//Set up the call to the external system
//Store the URL and the Action for the call in a data table to avoid URL hardcoding.  Also makes the different sites (dev, test, prod) interact with corresponding receiver URL's, and the URL's get passed around in site migrations & refreshes without manual updating.
externalURL = "";
SOAPAction = "";
//Set up the site and the integration that's being performed
siteNameStr = lower(_system_supplier_company_name);
integrationType = "sampleType";
//Grab the URL and action name from the table. There should only be one corresponding row; this logic just takes the first record.
soapURLRecs = bmql("select URL, SoapAction from SiteInfo where SiteName = $siteNameStr and Integration = $integrationType");
for eachRec in soapURLRecs{
externalURL =  get(eachRec, "URL");
SOAPAction =  get(eachRec, "SoapAction");
break;
}
//Put the SOAP Action into a dictionary for the post call
headerDict = dict("string");
put(headerDict, "SOAPAction", SOAPAction);
//Send the soap call and return the response to variable.
soapResponseXML= urldatabypost(externalURL, getTransactionFile ,"FAIL",headerdict);
return soapResponseXML;//The code that called this function can now parse this XML string and use its content for whatever it needs.
```


## Notes


:::note
CDATA tags are used when data should be ignored and not parsed. This is useful when the data contains special characters like: & and <.


For this example, the cdata isn't really needed because **Session ID** and **Transaction ID** should never contain special characters. Here they are used as a precaution, but when using other SOAP APIs they are necessary. <![CDATA [data goes here] ]>
:::


## Related Topics


## See Also
