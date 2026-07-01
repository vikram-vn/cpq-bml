---
id: Others-BOM
title: "Other Functions"
sidebar_label: "Other Functions"
description: "Other Functions BOM Mapping Functions applybom Apply the delta BOM from an open order to construct the projected BOM. All of the BOMs used in the appl..."
tags: ['BML', 'CPQ', 'Functions']
---

## Other Functions
BOM Mapping Functions
applybom

Apply the delta BOM from an open order to construct the projected BOM. 
All of the BOMs used in the applybom function are all flattened BOMs for out-of-the-box ABO implementations, but this function is capable of handling hierarchical BOMs
Syntax:
Json applybom(Json baseBom, Json oneBomToApply [, Json setting])
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `baseBOM` | JSON | The BOM object from an asset, an initial order of new configuration before it is fulfilled, or the result of an earlier applybom call to apply the changes from an open order with an earlier date. |
| `oneBomToApply` | JSON | The delta BOM loaded from and open order line from a getBom or getConfigBom call. |
| `setting` | JSON | (Optional) The JSON setting parameter is used to define delta BOM service settings. |
| `For more information, refer to the Oracle CPQ Asset-Based Ordering Implementation Guide >  Appendix J: Default JSON Context File.` | Sample Input// This baseBom contains sample root, sample child and sample grand child.baseBom = json("{\"children\":[{\"id\":\"BOM_ABOSampleChild\",\"parentId\":\"BOM_ABOSampleRoot\",\"quantity\":1,\"partNumber\":\"part12\",\"fields\":{\"itemInstanceName_l\":\"part12-20983113-2\",\"itemInstanceId_l\":\"abo_644cc4ff-7267-4c9a-9c53-70fae13618b0\"},\"explodedQuantity\":2},{\"id\":\"BOM_ABOSampleGrandChild\",\"parentId\":\"BOM_ABOSampleChild\",\"quantity\":4,\"partNumber\":\"part14\",\"fields\":{\"itemInstanceName_l\":\"part14-20983113-3\",\"itemInstanceId_l\":\"abo_72a356b4-f80c-4b23-bb5a-b80a286b4917\"},\"explodedQuantity\":8}],\"id\":\"BOM_ABOSampleRoot\",\"parentId\":null,\"quantity\":2,\"partNumber\":\"part11\",\"fields\":{\"itemInstanceName_l\":\"part11-20983113-1\",\"itemInstanceId_l\":\"abo_09eecd85-e659-4fdf-bbbc-a6e940f6bf05\"},\"explodedQuantity\":2}");// In oneBomToApply, the grand child is deleted and quantity of root is changed to 5.oneBomToApply = json("{\"partNumber\":\"part11\",\"quantity\":5,\"isModel\":true,\"id\":\"BOM_ABOSampleRoot\",\"parentId\":\"\",\"fields\":{\"itemInstanceId_l\":\"abo_09eecd85-e659-4fdf-bbbc-a6e940f6bf05\",\"itemInstanceName_l\":\"part11-20983113-1\",\"requestDate_l\":\"\",\"oRCL_ABO_ActionCode_l\":\"UPDATE\"},\"explodedQuantity\":5,\"category\":\"sales\",\"currencyCode\":\"\",\"children\":[{\"partNumber\":\"part14\",\"quantity\":4,\"isModel\":false,\"id\":\"BOM_ABOSampleGrandChild\",\"parentId\":\"BOM_ABOSampleChild\",\"fields\":{\"itemInstanceId_l\":\"abo_72a356b4-f80c-4b23-bb5a-b80a286b4917\",\"itemInstanceName_l\":\"part14-20983113-3\",\"requestDate_l\":\"\",\"oRCL_ABO_ActionCode_l\":\"DELETE\"},\"explodedQuantity\":20,\"children\":[]},{\"partNumber\":\"part12\",\"quantity\":1,\"isModel\":false,\"id\":\"BOM_ABOSampleChild\",\"parentId\":\"BOM_ABOSampleRoot\",\"fields\":{\"itemInstanceId_l\":\"abo_644cc4ff-7267-4c9a-9c53-70fae13618b0\",\"itemInstanceName_l\":\"part12-20983113-2\",\"requestDate_l\":\"\",\"oRCL_ABO_ActionCode_l\":\"UPDATE\"},\"explodedQuantity\":5,\"sequenceIndex\":0,\"conditionIndex\":0,\"children\":[]}]}");result = applybom(baseBom, oneBomToApply);// The resultant bom contains sample root, sample child. The quantity of root is updated to 5return jsontostr(result); | calculateconfiguration |
| `This function applies a delta configuration set from open lines on top of the asset configuration to produce the projected configuration for all configuration attributes including attributes that are not mapped to the configurator.` | Notes: | Notice there is not a BML function to calculate the delta Configuration since this logic is conducted in code. |
| `Both the baseConfigurationKey input parameter and return value are a key to a global cache entry, whose value is an unpublished JSON structure used to store the configuration for a root asset and its content including internal fields and all configuration attributes including unmapped attributes.` | Notice all the entries must belong to the same root asset, otherwise the call will be ignored or throw an error. There could be more than one internal or external order but they should be in the ascending order of the requestDate, since the order in the array is the order the delta configuration item get applied. | For the same reason if the asset is present it should be the first item in the array since it is the starting point. In addition, the other baseConfiguration input should be blank for this use case of passing the asset in the linesToApply array. |
| `Syntax:` | calculateconfiguration(String baseConfigurationKey, JsonArray linesToApply) | Parameters: |
| `Parameters` | Data Type | Description |
| `baseConfigurationKey` | String | The baseBOM can come from the following items: an asset, an initial order of new configuration before it is fulfilled, or the result of an earlier applybom call to apply the changes from an open order with an earlier date. |
| `When the configuration key is empty, it means there is not any configuration information (i.e. the configuration is blank).` | linesToApply | JSON Array |

Example:line1 = "{\"type\":\"internalOrder\",\"_bs_id\":21002021,\"_document_number\": 2}";
line2 = "{\"type\":\"internalOrder\",\"_bs_id\":21002021,\"_document_number\": 6}";
linesToApply = jsonArray();
lines = json(line1);
jsonarrayappend(linesToApply, lines);
lines1 = json(line2);
jsonarrayappend(linesToApply, lines1);
configurationKey = calculateconfiguration("", linesToApply);
return configurationKey;

calculatedeltabom

This function compares the prior BOM with current BOM and then returns the difference between the two with appropriate action code for each item.

Note: Calculate Delta BOM is invoked from the abo_delta function when a user clicks Add to Transaction or Update Transaction to exit the configurator.  The comparison is mainly between prior BOM and current BOM, but if the item exists in both current and input BOMs and doesn’t exist in prior BOM, it will reuse most information from input BOM, especially the asset key.
All of the BOMs used in the caculatedeltaBom function are all flattened BOMs for out-of-the-box ABO implementations, but this function is capable of handling hierarchical BOMs.

Syntax:
Json calculatedeltabom(Json priorBom, Json currentBom, Json inputBom [, Json setting])
Parameters:

Parameter
Data Type
Description

priorBOM

JSON

(also known as the PacBom) this is the base against which delta calculation will be conducted.

currentBom

JSON

The currentBom is often called the configBom and it corresponds to the configuration selections when the user exits the configurator.

inputBom

JSON

The BOM that is passed to the Configurator to launch the UI.

setting

JSON

(Optional) The JSON setting parameter is used to define delta BOM service settings. 
For more information, refer to the Oracle CPQ Asset-Based Ordering Implementation Guide > Appendix G: BML System Functions and Variables for ABO - Calculate Delta BOM Function.

Sample InputpriorBom = json("{\"partNumber\":\"part11\",\"quantity\":5,\"isModel\":true,\"id\":\"BOM_ABOSampleRoot\",\"parentId\":\"\",\"fields\":{\"itemInstanceName_l\":\"part11-20983113-1\",\"itemInstanceId_l\":\"abo_09eecd85-e659-4fdf-bbbc-a6e940f6bf05\",\"requestDate_l\":\"\"},\"explodedQuantity\":5,\"category\":\"sales\",\"currencyCode\":\"\",\"children\":[{\"partNumber\":\"part14\",\"quantity\":4,\"isModel\":false,\"id\":\"BOM_ABOSampleGrandChild\",\"parentId\":\"BOM_ABOSampleChild\",\"fields\":{\"itemInstanceId_l\":\"abo_072a975f-7ccc-4c18-9699-3d5fa073d7f9\",\"itemInstanceName_l\":\"part14-20983113-3\",\"requestDate_l\":\"\"},\"explodedQuantity\":20,\"variableName\":\"ABOSampleGrandChild\",\"sequenceIndex\":0,\"conditionIndex\":0,\"definition\":{\"Optional\":\"N\",\"ItemType\":\"Standard Item\",\"includedInBasePrice\":\"\",\"ItemId\":\"ID\",\"SequenceNum\":4},\"children\":[],\"unconfiguredBomVarname\":\"ABOSampleGrandChild\",\"unconfiguredPartNumber\":\"part14\"},{\"partNumber\":\"part12\",\"quantity\":1,\"isModel\":false,\"id\":\"BOM_ABOSampleChild\",\"parentId\":\"BOM_ABOSampleRoot\",\"fields\":{\"itemInstanceName_l\":\"part12-20983113-2\",\"itemInstanceId_l\":\"abo_644cc4ff-7267-4c9a-9c53-70fae13618b0\",\"requestDate_l\":\"\"},\"explodedQuantity\":5,\"sequenceIndex\":0,\"conditionIndex\":0,\"children\":[]}]}");
curBom = json("{\"partNumber\":\"part11\",\"quantity\":7,\"isModel\":true,\"id\":\"BOM_ABOSampleRoot\",\"parentId\":\"\",\"fields\":{\"itemInstanceId_l\":\"abo_09eecd85-e659-4fdf-bbbc-a6e940f6bf05\",\"itemInstanceName_l\":\"part11-20983113-1\",\"requestDate_l\":\"\"},\"explodedQuantity\":7,\"category\":\"sales\",\"variableName\":\"ABOSampleRoot\",\"currencyCode\":\"USD\",\"sequenceIndex\":0,\"conditionIndex\":0,\"definition\":{\"Optional\":\"N\",\"ItemType\":\"Standard Item\",\"includedInBasePrice\":\"\",\"ItemId\":\"ID\",\"SequenceNum\":1},\"children\":[{\"partNumber\":\"part14\",\"quantity\":9,\"isModel\":false,\"id\":\"BOM_ABOSampleGrandChild\",\"parentId\":\"BOM_ABOSampleChild\",\"fields\":{\"itemInstanceId_l\":\"abo_072a975f-7ccc-4c18-9699-3d5fa073d7f9\",\"itemInstanceName_l\":\"part14-20983113-3\",\"requestDate_l\":\"\"},\"explodedQuantity\":63,\"variableName\":\"ABOSampleGrandChild\",\"sequenceIndex\":0,\"conditionIndex\":0,\"definition\":{\"Optional\":\"N\",\"ItemType\":\"Standard Item\",\"includedInBasePrice\":\"\",\"ItemId\":\"ID\",\"SequenceNum\":4},\"children\":[],\"unconfiguredBomVarname\":\"ABOSampleGrandChild\",\"unconfiguredPartNumber\":\"part14\"},{\"partNumber\":\"part12\",\"quantity\":1,\"isModel\":false,\"id\":\"BOM_ABOSampleChild\",\"parentId\":\"BOM_ABOSampleRoot\",\"fields\":{\"itemInstanceId_l\":\"abo_644cc4ff-7267-4c9a-9c53-70fae13618b0\",\"itemInstanceName_l\":\"part12-20983113-2\",\"requestDate_l\":\"\"},\"explodedQuantity\":7,\"variableName\":\"ABOSampleChild\",\"sequenceIndex\":0,\"conditionIndex\":0,\"definition\":{\"Optional\":\"N\",\"ItemType\":\"Standard Item\",\"includedInBasePrice\":\"\",\"ItemId\":\"ID\",\"SequenceNum\":2},\"children\":[],\"unconfiguredBomVarname\":\"ABOSampleChild\",\"unconfiguredPartNumber\":\"part12\"}]}");
inputBom = json("{\"partNumber\":\"part11\",\"quantity\":5,\"isModel\":true,\"id\":\"BOM_ABOSampleRoot\",\"parentId\":\"\",\"fields\":{\"itemInstanceName_l\":\"part11-20983113-1\",\"itemInstanceId_l\":\"abo_09eecd85-e659-4fdf-bbbc-a6e940f6bf05\",\"requestDate_l\":\"\"},\"explodedQuantity\":5,\"category\":\"sales\",\"currencyCode\":\"\",\"children\":[{\"partNumber\":\"part14\",\"quantity\":4,\"isModel\":false,\"id\":\"BOM_ABOSampleGrandChild\",\"parentId\":\"BOM_ABOSampleChild\",\"fields\":{\"itemInstanceId_l\":\"abo_072a975f-7ccc-4c18-9699-3d5fa073d7f9\",\"itemInstanceName_l\":\"part14-20983113-3\",\"requestDate_l\":\"\"},\"explodedQuantity\":20,\"variableName\":\"ABOSampleGrandChild\",\"sequenceIndex\":0,\"conditionIndex\":0,\"definition\":{\"Optional\":\"N\",\"ItemType\":\"Standard Item\",\"includedInBasePrice\":\"\",\"ItemId\":\"ID\",\"SequenceNum\":4},\"children\":[],\"unconfiguredBomVarname\":\"ABOSampleGrandChild\",\"unconfiguredPartNumber\":\"part14\"},{\"partNumber\":\"part12\",\"quantity\":1,\"isModel\":false,\"id\":\"BOM_ABOSampleChild\",\"parentId\":\"BOM_ABOSampleRoot\",\"fields\":{\"itemInstanceName_l\":\"part12-20983113-2\",\"itemInstanceId_l\":\"abo_644cc4ff-7267-4c9a-9c53-70fae13618b0\",\"requestDate_l\":\"\"},\"explodedQuantity\":5,\"sequenceIndex\":0,\"conditionIndex\":0,\"children\":[]}]}");
result = calculatedeltabom(priorBom, curBom, inputBom);
return jsontostr(result);

convertbomtoflat

This function converts a hierarchical BOM
 into a flattened BOM. A flat BOM stores all descendants as direct children,
 including children, grandchildren, etc. Flattened BOMs are easier to process. 
The input "bomJson" is not modified and will remain in a hierarchical BOM format.
Syntax:
Json convertbomtoflat(Json bomJson)
Parameters:

Parameters
Data Type
Description

bomJson

JSON

Use this parameter to hold the JSON target.

Sample Input{
   "partNumber": "part1",
   "quantity": 1,
   "id": "Bom1",
   "parentId": "",
   "children": [{
         "partNumber": "part2",
         "quantity": 2,
         "id": "Bom2",
         "parentId": "",
         "children": [{
               "partNumber": "part4",
               "quantity": 4,
               "id": "Bom4",
               "parentId": ""
            }, {
               "partNumber": "part5",
               "quantity": 5,
               "id": "Bom5",
               "parentId": ""
            }
         ]
      }, {
         "partNumber": "part3",
         "quantity": 3,
         "id": "Bom3",
         "parentId": ""
      }
   ]
}
Sample Return{
   "partNumber": "testbed:systemConfiguration:rootSystem",
   "quantity": 1,
   "isModel": true,
   "id": "BOM_SysConfigRoot",
   "parentId": "",
   "explodedQuantity": 1,
   "category": "sales",
   "children": [{
         "partNumber": "testbed:systemConfiguration:conditionalChildren",
         "quantity": 1,
         "isModel": true,
         "id": "BOM_SysConfigNestKid3",
         "parentId": "BOM_SysConfigNest",
         "explodedQuantity": 1
      }, {
         "partNumber": "testbed:systemConfiguration:noBOMRule",
         "quantity": 1,
         "isModel": true,
         "id": "BOM_SysConfigNestKid2",
         "parentId": "BOM_SysConfigNest",
         "explodedQuantity": 1
      }, {
         "partNumber": "testbed:systemConfiguration:differentConfiguration",
         "quantity": 1,
         "isModel": true,
         "id": "BOM_SysConfigNestKid1",
         "parentId": "BOM_SysConfigNest",
         "explodedQuantity": 1
      }, {
         "partNumber": "testbed:systemConfiguration:nestedHierarchies",
         "quantity": 1,
         "isModel": true,
         "id": "BOM_SysConfigNest",
         "parentId": "BOM_SysConfigRoot",
         "explodedQuantity": 1
      }
   ]
}

convertbomtohier

This function converts a flattened BOM
 into a hierarchical BOM. Occasionally, administrators flatten hierarchical
 BOMs for easier processing; this function returns the processed flattened BOM
 back into a hierarchical BOM.
The input "bomJson" is not modified and will remain in a hierarchical BOM format.
Syntax:
Json convertbomtohier(Json bomJson)
Parameters:

Parameters
Data Type
Description

bomJson

JSON

Use this parameter to hold the JSON target.

Sample Input:{
  "partNumber": "part1",
  "quantity": 1,
  "id": "Bom1",
  "parentId": "",
  "children": [{
      "partNumber": "part2",
      "quantity": 2,
      "id": "Bom2",
      "parentId": "Bom1"
    }, {
      "partNumber": "part3",
      "quantity": 3,
      "id": "Bom3",
      "parentId": "Bom1"
    }, {
      "partNumber": "part4",
      "quantity": 4,
      "id": "Bom4",
      "parentId": "Bom2"
    }, {
      "partNumber": "part5",
      "quantity": 5,
      "id": "Bom5",
      "parentId": "Bom2"
    }
  ]
}
Sample Return:{
  "partNumber": "testbed:systemConfiguration:rootSystem",
  "quantity": 1,
  "isModel": true,
  "id": "BOM_SysConfigRoot",
  "parentId": "",
  "explodedQuantity": 1,
  "category": "sales",
  "children": [{
      "partNumber": "testbed:systemConfiguration:nestedHierarchies",
      "quantity": 1,
      "isModel": true,
      "id": "BOM_SysConfigNest",
      "parentId": "",
      "explodedQuantity": 1,
      "children": [{
          "partNumber": "testbed:systemConfiguration:conditionalChildren",
          "quantity": 1,
          "isModel": true,
          "id": "BOM_SysConfigNestKid3",
          "parentId": "",
          "explodedQuantity": 1
        }, {
          "partNumber": "testbed:systemConfiguration:noBOMRule",
          "quantity": 1,
          "isModel": true,
          "id": "BOM_SysConfigNestKid2",
          "parentId": "",
          "explodedQuantity": 1
        }, {
          "partNumber": "testbed:systemConfiguration:differentConfiguration",
          "quantity": 1,
          "isModel": true,
          "id": "BOM_SysConfigNestKid1",
          "parentId": "",
          "explodedQuantity": 1
        }
      ]
    }
  ]
}

getbom

For fulfillment system
 integrations, the getbom function retrieves the saved sales BOM or
 manufacturing BOM from a transaction, to submit to the fulfillment system for order
 fulfillment.
For Asset-Based Ordering,
 the getbom function retrieves the saved sales BOM from open orders.
Syntax:
Json getbom(Integer bsId, Integer lineNumber [, String[] lineFields [, Boolean validateBomModel [, Boolean flattenChildProducts [, Boolean isSalesBom]]]])
Parameters:

Parameter
Data Type
Description

bsId

Integer

Use this parameter to specify the Commerce Transaction ID.

lineNumber

Integer

Use this parameter to specify the document number of the model
 line. The line number also represents the root BOM line in the transaction.

lineFields

String

Use this parameter to identify additional line attributes
 fetched from the transaction line, then stored in the returned BOM instance.

Optional, the default value is null if not provided.

validateBomModel

Boolean

Use this parameter to validate the returned BOM against
 the latest BOM item definition. Validation will:

  Verify the BOM instance tree (parts and
 hierarchy) against the BOM item definition.
  Populate the BOM item variable names.

  Correct the BOM instance hierarchy according
 to the latest definition.

  Exclude items that no longer exist in the
 latest definition.

Optional, the default value is true if not provided.

flattenChildProducts

Boolean

Use this parameter to flatten child items and return
 all descendant BOM items as direct children of the root BOM item.

Optional, the default value is false if not provided.

isSalesBom

Boolean
This
 parameter returns a sales BOM if true, and a manufacturing BOM if false.

Optional, the default is true if not provided.

Example:bsId=18430319;
jObj = getbom(bsId, 2);
print jObj;
//Output : {"partNumber":"part49","quantity":10,"id":"BOM_root","parentId":"","attributes":{},"fields":{"_line_bom_level":"0"},"explodedQuantity":10,"category":"sales","variableName":"root","definition":{"SequenceNum":814,"ItemId":"814","ItemType":"Standard Item","Optional":"Y"},"children":[{"partNumber":"part50","quantity":5,"id":"BOM_text_bom","parentId":"BOM_root","attributes":{},"fields":{"_line_bom_level":"1"},"explodedQuantity":50,"variableName":"text_bom","definition":{"SequenceNum":815,"ItemId":"815","ItemType":"Standard Item","Optional":"Y"}}]}

getconfigurationbom

Retrieves the configbom stored via the saveConfigBom API and the configBom created via an external client application Configurator UI session. The library function extracts and returns a client integration BOM instance from the Oracle CPQ configBomInstance resource using the "configId".
Syntax:
getconfigbom(configId [, flattenChildProducts])
Parameters:

Parameter
Data Type
Description

configId

Integer

The Configuration ID for the client side integration action
This is not the same as the configuration_id system attribute.

For UI integrations, the client side integration action returns the config_id in the response JSON.
For other actions such as Terminate, Renew, Suspend, and Resume order, RESTful calls generated from the saveBomConfig BML function return the lineId.

flattenChildProducts

Boolean

(optional) Use this parameter to flatten child items and return
 all descendant BOM items as direct children of the root BOM item.
The default value is false if not provided.

savebom

This  function saves a BOM into a transaction without
 Configuration attributes and returns the document number of the saved transaction.
 For Asset-Based Ordering, the savebom function saves discontinued assets
 into a transaction.
Do not invoke this function from the transaction modify action; as
 the modify action and savebom function will compete to update the same transaction.
 Use reconfigure for the saved BOM instance.
Syntax:
Integer savebom(Integer bsId, Json bomJson [,String  configurationKey])
Parameters:

Parameter
Data Type
Description

bsID

Integer

Use this parameter to specify the Commerce Transaction ID.

bomJson

JSON

Use this parameter to hold the BOM instance JSON data.

configurationKey

String
(Optional) Use this parameter of configurationKey is projected configuration returned from calculatedeltabom, right now it only helps with some bookkeeping, should either not pass value or only pass the valid projected configuration key.

Example:testjson = json("{\"partNumber\":\"part49\",\"quantity\":10,\"id\":\"BOM_root\",\"parentId\":\"\",\"attributes\":{},\"fields\":{\"_line_bom_level\":\"0\"},\"explodedQuantity\":10,\"category\":\"sales\",\"variableName\":\"root\",\"definition\":{\"SequenceNum\":814,\"ItemId\":\"814\",\"ItemType\":\"Standard Item\",\"Optional\":\"Y\"},\"children\":[{\"partNumber\":\"part50\",\"quantity\":5,\"id\":\"BOM_text_bom\",\"parentId\":\"BOM_root\",\"attributes\":{},\"fields\":{\"_line_bom_level\":\"1\"},\"explodedQuantity\":50,\"variableName\":\"text_bom\",\"definition\":{\"SequenceNum\":815,\"ItemId\":\"815\",\"ItemType\":\"Standard Item\",\"Optional\":\"Y\"}}]} ");
bsId=18430319;
docNum = savebom(bsId, testjson);
print docNum;
//Output: 5

saveconfigbom

Saves a client integration BOM instance (I.e. configBomInstance) and returns the configId.
Syntax:
saveconfigbom(Json configBomJson [,Dictionary instanceAttributes [, configurationKey]])
Parameters:

Parameter
Data Type
Description

configBomJson

JSON

The configuration BOM json to save.
For actions such as Terminate, Renew, Suspend, and Resume order, RESTful calls generated from the saveBomConfig BML function return the lineId.

instanceAttributes

JSON

Input attributes (e.g. sourceIdentifer, transactionDate, and transactionId) for the asset REST action initiated by the saveconfigBom call.
The instanceAttributes contents are saved into the configBomInstance so the original request context can be used to re-instantiate the session when the returned configId is used in an external reconfiguration process.

configurationKey

String
(Optional) Use this parameter of configurationKey is projected configuration returned from calculatedeltabom, right now it only helps with some bookkeeping, should either not pass value or only pass the valid projected configuration key.

Notes

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

Related Topics

See Also