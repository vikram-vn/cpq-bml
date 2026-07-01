---
id: Others-GlobalDict
title: "Other Functions"
sidebar_label: "Other Functions"
description: "Other Functions Global Dictionary Functions Global dictionary functions support Asset-Based Ordering and are available for setting, getting, and remov..."
tags: ['BML', 'CPQ', 'Functions']
---

## Other Functions
Global Dictionary Functions
Global dictionary functions support Asset-Based Ordering and are available for setting, getting, and removing a key-value pair from the global dictionary in BML. Available across multiple sessions, the values are removed periodically when they exceed the minimum time to live specified while setting the value. There is no guarantee the global dictionary values are available after the minimum time to live.
globaldictget

This function returns a value stored in the global
 dictionary corresponding to the given key. If the key is not found in the
 global dictionary, null is returned.
Syntax: String globaldictget(String key [, Boolean updateTimeToLive])
Parameters:

Parameters
Data Type
Description

key

String 

The key corresponding to the value to be retrieved.

updateTimeToLive

Boolean 

If set to true, the minimum time to live is recalculated
 from the retrieved time.
If set to false, there is no change to minimum time
 to live.

Optional. The
 default value is false.

Example://Set data in global cache as below
globaldictset("globalkey1","some string1",100); 
globaldictset("globalkey2","some string2"); 
//To get the global cache value
valstr=globaldictget("globalkey1",true);//If true then re-calculate minimum time to live
print valstr;
//Output: some string1
valstr1=globaldictget("globalkey2",false);//No changes to minimum time to live 
print valstr1;
//Output: some string2

globaldictremove

This function removes a given key-value pair from the
 global dictionary. The function returns true if the key-value pair is successfully
 removed, and returns false if the key does not exist in the global dictionary.
Syntax: Boolean globaldictremove(String key)
Parameters:

Parameters
Data Type
Description

key

String 

The key corresponding to the key-value pair to be removed.

Example://Set data in global cache as below
globaldictset("globalkey1","some string",100); 
//To remove the key-value pair from global cache using a key
print globaldictremove("globalkey1");
//Output: true 

The method will return false when trying to remove a key that does not exist in the global cache.

globaldictset

This function adds or updates the key-value pair in the
 global dictionary.
Syntax: String globaldictset(String key, String value [, Integer minTimeToLive])
Parameters:


| Parameter | Data Type | Description |
| --- | --- | --- |
| `key` | String | If key is null or empty, a unique key is generated and added |
| `to the global dictionary. If the key provided is not present in the global` | dictionary, a key-value pair is added to the global dictionary. | value |
| `String` | If a key is | present, the value is updated for the |
| `corresponding key.` | minTimeToLive | Integer |
| `The minimum time, in minutes, the key-value` | pair is guaranteed in the global | dictionary. The value should be greater than 0 and less than 525600 minutes |
| `(365 days).` | Optional. The default value is 1440 minutes. | The minimum time to live setting does not indicate the a maximum duration for the value to be available. The maximum duration is defendant on the amount of time it takes  to clear the expired values for your site. |

Example:storedkey = globaldictset("key1", "value1"); //mintimeToLive will be defaulted to 1440print storedkey;//Output: key1storedkey2 = globaldictset("", "value2", 1000); // This record will be removed by the next scheduled batch that runs after 1000 minsprint storedkey2; // unique key will be generated and returned.
Oracle CPQ recommends not setting the same globaldict key with the same value using globaldictset parallelly with multiple user sessions.

Notes

NULL and blank Integer values are treated as separate values:NULL= 0Blank = ""
Using NULL as an attribute value is strongly discouraged.
If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account. 

Related Topics

See Also