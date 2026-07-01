# Direct DB Access Functions

## Functions

This group of functions allows direct access to data stored in Oracle CPQ databases.

bmql

This function returns a Record Set containing the results of the SQL query. Oracle CPQ can query system tables and user-create Data Tables from within BML, using a SQL-like syntax.

For more information about this function, see [BigMachines Query Language (BMQL)](BMQL.md).

getboolean

Returns the boolean value in the Record for the provided field name.

**Syntax:** `Boolean getboolean(Record record, String fieldName)`

Example:

```bml
rows = bmql("select intcol... ");
for row in rows {
val = getboolean(row, "intcol");
if(val); // can do boolean operations. Useful in if conditions
}
```

getdate

This BMQL function returns the date value in the Record for the provided field name.

**Syntax:** `Date getdate(Record record, String fieldName)`

Example:

```bml
rows = bmql("select datecol... ");
for row in rows {
val = getdate(row, "datecol");
isweekend(val); // can do date operations. Date functions can be applied
}
```

getfloat

Returns the float value in the Record for the provided field name.

**Syntax:** `Float getfloat(Record record, String fieldName)`

Example:

```bml
rows = bmql("select intcol... ");
for row in rows {
val = getfloat(row, "intcol");
val2 = val * 0.1; // can do float operations
}
```

getint

Returns the integer value in the Record for the provided field name.

**Syntax:** `Integer getint(Record record, String fieldName)`

Example:

```bml
rows = bmql("select intcol... ");
for row in rows {
val = getint(row, "intcol");
val2 = val + 10; // can do integer operations
}
```

getmessage

Returns the error message in the given Record Set if it has errors with query execution; empty otherwise.

* Returns the error message if the query execution failed and the Record Set has errors.

* Returns empty string if there are no errors.

**Syntax:**`String getmessage(RecordSet recordSet)`

Example:

```bml
rows = bmql("select col... ");
if(haserror(rows)) {
msg = getmessage(rows); // msg has the error message why the query failed
}
```

getpartsdata

:::warning
This function is deprecated, and no longer supported. Use [BMQL()](BMQL.md) instead.

This function is vulnerable to SQL injection.
:::

This function returned a 2-D array of String containing parts data for valid Part Numbers passed in.

gettabledata

:::warning
This function is deprecated, and no longer supported. Use [BMQL()](BMQL.md) instead.

This function is vulnerable to SQL injection.
:::

This function returned a 2-D array of String containing Data Table data matching the condition specified.

gettransaction

The function `gettransaction(bsId)` simplifies access to stored transaction information. It retrieves, as a string, the transaction XML for a given Transaction ID. Beginning in 21A, Oracle CPQ provides the ability to filter data when running this BML function.

**Syntax:** `gettransaction(bsId [, filterCriteria])`

Parameters:

| Parameter      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bsId           | Transaction ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| filterCriteria | Optional JSON format parameter used to return specific attributes for the main document and sub document respectively. If this parameter is not included, the entire transaction is returned in the transaction XML. Sample JSON format for `filterCriteria`: `json("{\"mainDoc\":{\"variableName\":\"quote\",\"returnSpecificAttributes\":\"quoteNum,quoteTotal\"},\"subDoc\":{\"variableName\":\"lineItem\",\"returnSpecificAttributes\":\"_price_quantity,_price_subtotal\",\"returnSpecificDocumentNumbers\":\"4,8,10\"}}")` If the optional `filterCriteria` parameter is included, the `mainDoc variableName` is required. If the `filterCriteria` includes the subDoc, the `subDoc variableName` is also required. The specific attributes to be included in the transaction XML should be specified under`returnSpecificAttributes`. The specific document numbers that have to be returned in the transaction XML should be specified under`returnSpecificDocumentNumbers`. :::note The `filterCriteria` optional parameter is supported in Oracle CPQ 21A and later. ::: |

Return Type: String

Example:

```bml
transactionXML = gettransaction(12345); // 12345 is a transaction id (bs id)
```

The transaction XML is contained in the <transaction> node. The result string looks like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<transaction><category>bm_cm_bs_data</category>...<num_transitions>5</num_transitions></transaction>
```

Example with `filterCriteria`:

```bml
bsId = 3022201826;
//Valid filterCriteria
filterCriteria = json("{\"mainDoc\":{\"variableName\":\"quote\",\"returnSpecificAttributes\":\"quoteNum,quoteTotal\"},\"subDoc\":{\"variableName\":\"lineItem\",\"returnSpecificAttributes\":\"_price_quantity,_price_subtotal\",\"returnSpecificDocumentNumbers\":\"2,3\"}}");
transactionXML = gettransaction(bsId, filterCriteria);
print transactionXML;
return "";
```

:::tip
If a Transaction with the given Id doesn't exist, the formula throws an exception.
:::

:::note
* Oracle CPQ 20B implements XML Translation Line Limits or the `gettransaction` XML response to prevent performance issues that could occur when generating XML for transactions with an extremely large number of transaction lines.

* The following attributes are not supported with the `gettransaction` BML function JSON filter criteria:

  * Rich Text

  * HTML & Read Only

  * Approval History
:::

haserror

Returns true if fetching the given Record Set failed and has errors with query execution; false otherwise.

**Syntax:** `Boolean haserror(RecordSet recordSet)`

Example :

```bml
rows = bmql("select col... ");
if(haserror(rows)) {
... ; // comes in here if the query execution failed
}
```

recordset()

Returns a new Record Set to be used for later assignments. It is a collection of dictionaries. It can also be used as a function in conjunction with BMQL.

**Syntax:** `RecordSet recordset()`

**Return Type:** record set

Example):

```bml
rs = recordset();
if(...) {
rs = bmql(query1);
} else {
rs = bmql(query2);
}
```

:::note
There is no way to return a recordSet result in a Util library function.
:::

recordset and SQL Queries

Returns a Record Set containing the results of the SQL query.

Syntax:

RecordSet bmql(String sqlQuery [, String Dictionary contextOverride, String Dictionary fieldMap])

Example:

```sql
results = bmql("select part_number from _parts where part_number = 'part%'");
for result in results {
partno = get(result, "part_number");
...
}
```

* BMQL returns 'results', which contains the list of data that matched the query.

* Use the ‘for’ loop on 'results' to go through all the rows of data returned.

* Use the 'get' function to get the specific column from each iterated row.

For more information on using variables in a query, see [Dynamic BMQL Variables](DynamicBMQLVariables.md).

## Notes

:::note
BMQL does not support a parts query that retrieves more than 500 parts from a non-default price book.
:::

## Related Topics

See Also