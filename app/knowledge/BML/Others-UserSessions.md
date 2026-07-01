---
id: Others-UserSessions
title: "Other Functions"
sidebar_label: "Other Functions"
description: "Other Functions User Session Functions User session functions support setting, removing, and getting a key-value pair from the session cache in BML. T..."
tags: ['BML', 'CPQ', 'Functions']
---

# Other Functions

## User Session Functions

User session functions support setting, removing, and getting a key-value pair from the session cache in BML. The values are available as long as the user session is active. Values stored in the session cache are removed automatically when the user logs out, the session expires, or the server is restarted.

:::note
User session functions are not supported in a multi-node environment. Session variables set using user session functions are only available on the node the variable was set.
:::

![Closed](images/transparent.gif)usersessionget

This function retrieves a value for a given key from a user session. If
 the key is not found, null is returned.

Syntax:

<ValueType> usersessionget(String key [, String valueType])

Parameters:

| Parameter | Value Type     | Description                                                                           |
| --------- | -------------- | ------------------------------------------------------------------------------------- |
| key       | String         | The key corresponding to the stored value.                                            |
| valueType | String or JSON | (optional) The expected data type of the returned value. The default value is String. |

Examples:

```bml title="Examples"
//Set data in user session as below
jobj=json();
jsonput(jobj,"key1","mystring");
jsonput(jobj,"key2",10);
jsonput (jobj ,"key3",2.9);
usersessionset("sessionkey1",jobj);
usersessionset("sessionkey2","Hello");

//To get the value as string;
valstr=usersessionget("sessionkey1","string");
valstr1=usersessionget("sessionkey2","string");
valstr2=usersessionget("sessionkey2");

//To get the value as JSON object;
valstr=usersessionget("sessionkey1","json");
```

![Closed](images/transparent.gif)usersessionremove

This function removes a key-value pair from the user
 session. The function returns true if the key-value pair is successfully
 removed, and returns false if the key does not exist in the user session.

Syntax

Boolean usersessionremove(String key)

Parameters:

| Parameter | Value Type | Description                                                |
| --------- | ---------- | ---------------------------------------------------------- |
| key       | String     | The key corresponding to the key-value pair to be removed. |

Example:

```bml title="Example"
//Set data in user session as below
usersessionset("sessionkey1","value");

//To remove the key/value pair using a key
print usersessionremove("sessionkey1");

//Output: true
```

:::note
**Note:** The method would return false on trying to remove a key that does not exist in the user session.
:::

![Closed](images/transparent.gif)usersessionset

This function sets a key-value pair to the user session cache. The values are available as long as the user session is active. Values stored in the session cache are removed automatically when the user logs out, the session expires, or the server is restarted.

Syntax:

usersessionset(String key, <ValueType> value)

Parameters:

| Parameter | Value Type     | Description                                                      |
| --------- | -------------- | ---------------------------------------------------------------- |
| key       | String         | The key corresponding to the stored value.                       |
| value     | String or JSON | The value to be stored. The value can be of type String or Json. |

Sample Input:

```bml
jobj=json();
jsonput(jobj,"key1","mystring");
jsonput(jobj,"key2",10);
jsonput (jobj ,"key3",2.9);
usersessionset("sessionkey1",jobj);
usersessionset("sessionkey2","Hello");
```

Sample Return:

A key-value
 pair is set in the user session.

## Notes

:::warning
* NULL and blank Integer values are treated as separate values:
  * NULL= 0
  * Blank = ""

* Using NULL as an attribute value is strongly discouraged.

* If you use logic that tests for NULL values in rule conditions or BML, confirm that the logic takes this difference into account.
:::

:::note
Notes:

* Values stored in BML Cache via `usersessionset` and `usersessionget` are not available when using Collaborative Quoting.

* Beginning in Oracle 20A, there is a 25,000 character limit in each user's session cache. Depending on implementation, this may affect user session functions.
:::

## Related Topics

![Related Topics Link Icon](images/transparent.gif)See Also