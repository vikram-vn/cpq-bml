---
name: bml-language
description: >-
  Core BML language skill. Covers all syntax, data types, built-in functions, 
  BMQL, system variables, and coding conventions.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Language Core

### Data Types
- **Scalars**: `String`, `Integer`, `Float`, `Boolean`, `Date`
- **Collections**: `String[]`, `Integer[]`, `Float[]`, `Boolean[]`, `Date[]`, `String[][]`, `Integer[][]`
- **Data Structures**: `dict(type)`, `dict("anytype")`, `json()`, `jsonarray()`, `RecordSet`

### Operators
- **Logical**: `AND`, `OR`, `NOT(condition)` *(never use `&&`, `||`, `!`)*
- **Comparison**: `==`, `<>`, `<=`, `>=`, `<`, `>`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Concatenation**: `+`

### Control Flow
```bml
// Conditionals
if (condition) {
    statement;
} elif (otherCondition) {
    statement;
} else {
    statement;
}

// For Loop (Iterating Arrays / RecordSets)
for item in itemArray {
    print item;
}
```

### Array Literals, Sizing & Methods
```bml
// 1D Array Literal & Sized Declarations
colors = String[]{ "red", "green", "blue" };
buffer = String[10];

// 2D Array Literal & Sized Declarations
matrix = Integer[][]{ {1, 2}, {3, 4} };
grid = Float[5][5];

// Array Access (0-indexed)
firstColor = colors[0];
val = matrix[0][1];

// Common Array Functions
len = sizeofarray(colors);
idx = findinarray(colors, "green"); // returns -1 if not found
append(colors, "yellow");
remove(colors, 0); // removes element at index 0
sort(colors, "asc"); // "asc" or "desc"
reverse(colors);
intSeq = range(5); // [0, 1, 2, 3, 4]
```

### Core Built-in Functions
- **String**: `len(s)`, `substring(s, start, [end])`, `find(s, sub)`, `replace(s, old, new)`, `trim(s)`, `lower(s)`, `upper(s)`, `split(s, delim)`, `join(arr, delim)`, `atof(s)`, `atoi(s)`, `string(val)`, `startswith(s, sub)`, `endswith(s, sub)`, `formatascurrency(num)`.
- **Date**: `getdate([bool])`, `datetostr(d, [fmt], [tz])`, `strtojavadate(s, fmt, [tz])`, `adddays(d, n)`, `addmonths(d, n)`, `minusdays(d, n)`, `comparedates(d1, d2)`, `getdiffindays(d1, d2)`, `isleap(d)`, `isweekend(d)`, `getcurrenttimeinmillis()`.
- **Math**: `sqrt(x)`, `pow(x, y)`, `round(x, dec)`, `ceil(x)`, `fabs(x)`, `fmod(x, y)`, `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)`, `log(x)`, `ln(x)`, `exp(x)`, `hypot(x, y)`.

*For detailed reference docs, refer to the `references/` directory.*
