# Oracle CPQ BML Beautifier: Architecture & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [Top-Level Formatting Lifecycle (CFG 1)](#2-top-level-formatting-lifecycle-cfg-1)
3. [Tokenizer & Directive Processing (CFG 2)](#3-tokenizer--directive-processing-cfg-2)
4. [Statement-Level Indentation & Context State Machine (CFG 3)](#4-statement-level-indentation--context-state-machine-cfg-3)
5. [Array Literal vs Block Start Disambiguation (CFG 4)](#5-array-literal-vs-block-start-disambiguation-cfg-4)
6. [Operator Spacing & Unary vs Binary Disambiguation (CFG 5)](#6-operator-spacing--unary-vs-binary-disambiguation-cfg-5)
7. [Brace Style & Block Hugging Flow (CFG 6)](#7-brace-style--block-hugging-flow-cfg-6)
8. [Minimal Range Edit Diffing Optimizer (CFG 7)](#8-minimal-range-edit-diffing-optimizer-cfg-7)
9. [Configuration Options Reference](#9-configuration-options-reference)

---

## 1. Overview & High-Level Architecture

The **BML Beautifier** is a deterministic, high-performance source code formatter specifically built for Oracle CPQ's BML language. It operates in four modular stages:

```mermaid
graph LR
    subgraph Input
        SRC["BML Source Code"]
        CFG["Beautifier Options"]
    end

    subgraph Core Engine
        TOK["Tokenizer & Lexer<br/>tokenizer.js"]
        BEAUT["State Machine Beautifier<br/>beautifier.js"]
        OUT["Indentation & Line Buffer<br/>output.js"]
    end

    subgraph Optimization
        DIFF["Minimal Range Diff Optimizer<br/>index.js computeMinimalEdits"]
        RES["VS Code TextEdits / String"]
    end

    SRC --> TOK
    CFG --> TOK
    CFG --> BEAUT
    CFG --> OUT
    TOK --> BEAUT
    BEAUT --> OUT
    OUT --> DIFF
    SRC --> DIFF
    DIFF --> RES
```

---

## 2. Top-Level Formatting Lifecycle (CFG 1)

This control flow graph shows the entry-point execution path when a document is formatted (e.g. on manual format, format-on-save, or MCP tool call):

```mermaid
flowchart TD
    Start(["Start Beautify Document"]) --> CheckDisabled{"options.disabled == true?"}
    CheckDisabled -->|"Yes"| ReturnRaw["Return raw source text unmodified"]
    CheckDisabled -->|"No"| Tokenize["Run Tokenizer on source text"]

    Tokenize --> InitOutput["Initialize Output buffer with options & indent unit"]
    InitOutput --> InitStack["Initialize Context Stack and indent_level = 0"]
    InitStack --> FetchToken["Fetch next token from stream"]

    FetchToken --> TokenCheck{"Current Token is EOF?"}
    TokenCheck -->|"Yes"| Finalize["Output.get_code: trim trailing spaces & apply EOL"]
    Finalize --> DiffCheck{"computeMinimalEdits required?"}
    DiffCheck -->|"No"| ReturnString(["Return Formatted Code String"])
    DiffCheck -->|"Yes"| CalcDiff["Compute Minimal Character Range Slice"]
    CalcDiff --> ReturnEdits(["Return Minimal TextEdit Array"])

    TokenCheck -->|"No"| FlushComments["Flush comments before current token"]
    FlushComments --> HandleToken["Dispatch token to specialized handler"]
    HandleToken --> UpdateLast["Set last_token = current"]
    UpdateLast --> FetchToken
```

---

## 3. Tokenizer & Directive Processing (CFG 2)

The tokenizer converts the raw character stream into classified tokens (`WORD`, `RESERVED`, `OPERATOR`, `STRING`, `START_BLOCK`, `ARRAY_START`, `START_EXPR`, `SEMICOLON`, `COMMA`, `DOT`, `COMMENT`) while handling ignore directives (`/* beautify ignore:start */` ... `/* beautify ignore:end */`):

```mermaid
flowchart TD
    ScanChar(["Read Character from Source"]) --> CheckEOF{"EOF reached?"}
    CheckEOF -->|"Yes"| EmitEOF["Emit TOKEN.EOF"]
    CheckEOF -->|"No"| CheckIgnore{"Inside beautify ignore block?"}

    CheckIgnore -->|"Yes"| ScanIgnoreText["Accumulate raw characters until ignore:end"]
    ScanIgnoreText --> EmitRawComment["Emit raw unformatted block comment"]

    CheckIgnore -->|"No"| CheckWhitespace{"Is whitespace or newline?"}
    CheckWhitespace -->|"Yes"| RecordNewlines["Record newline count for indentation"]
    RecordNewlines --> ScanChar

    CheckWhitespace -->|"No"| CheckComment{"Starts with // or /* ?"}
    CheckComment -->|"Yes"| ParseComment["Parse line / block comment"]
    ParseComment --> CheckDir{"Contains beautify ignore:start?"}
    CheckDir -->|"Yes"| SetIgnoreFlag["Set is_inside_ignore = true"]
    CheckDir -->|"No"| AttachComment["Attach comment to comments_before buffer"]
    SetIgnoreFlag --> ScanChar
    AttachComment --> ScanChar

    CheckComment -->|"No"| CheckQuote{"Starts with double-quote?"}
    CheckQuote -->|"Yes"| ParseString["Scan complete string literal including escaped quotes"]
    ParseString --> EmitString["Emit TOKEN.STRING"]

    CheckQuote -->|"No"| CheckArrayBrace{"Is open-brace preceded by [] or within array literal?"}
    CheckArrayBrace -->|"Yes"| EmitArrayStart["Emit TOKEN.ARRAY_START"]
    CheckArrayBrace -->|"No"| CheckBlockBrace{"Is open-brace?"}
    CheckBlockBrace -->|"Yes"| EmitStartBlock["Emit TOKEN.START_BLOCK"]
    CheckBlockBrace -->|"No"| CheckCharKind["Classify identifier, operator, or punctuation"]
    CheckCharKind --> EmitClassified["Emit classified token"]
```

---

## 4. Statement-Level Indentation & Context State Machine (CFG 3)

The Beautifier maintains a strict context stack (`'block'`, `'array'`, `'paren'`, `'condition'`, `'index'`) to track nesting levels and calculate indentation:

```mermaid
flowchart TD
    DispatchToken(["Token Received at Statement Level"]) --> CheckLastToken{"Last token type?"}
    
    CheckLastToken -->|"SEMICOLON"| EnsureStatementNewline["Start fresh statement line with current indent_level"]
    CheckLastToken -->|"START_BLOCK"| IndentStatementBlock["Start fresh line with indent_level + 1"]
    CheckLastToken -->|"END_BLOCK"| CheckHug{"Is next token elif/else and collapse style?"}
    CheckHug -->|"Yes"| SpaceHug["Emit single space between closing brace and elif/else"]
    CheckHug -->|"No"| NewlineAfterBlock["Start fresh line at current indent_level"]

    CheckLastToken -->|"In-Expression Break"| CheckPreserve{"preserve_newlines && token.newlines > 0?"}
    CheckPreserve -->|"Yes"| IndentContinuation["Start continuation line with indent_level + 1"]
    CheckPreserve -->|"No"| SingleSpaceCheck{"needsSpaceBefore token?"}
    SingleSpaceCheck -->|"Yes"| AppendSpace["Append single space"]
    SingleSpaceCheck -->|"No"| DirectAppend["Append token text directly"]

    DirectAppend --> UpdateStack{"Token modifies nesting stack?"}
    AppendSpace --> UpdateStack
    EnsureStatementNewline --> UpdateStack
    IndentStatementBlock --> UpdateStack
    NewlineAfterBlock --> UpdateStack
    SpaceHug --> UpdateStack

    UpdateStack -->|"'(' or '['"| PushParen["Push paren / index to context stack"]
    UpdateStack -->|"'{' (Code Block)"| PushBlock["Push block, indent_level += 1"]
    UpdateStack -->|"'{' (Array Literal)"| PushArray["Push array, indent_level += 1"]
    UpdateStack -->|"'}'"| PopBlock["Pop stack, indent_level = Math.max(0, indent_level - 1)"]
    UpdateStack -->|"')' or ']'"| PopParen["Pop stack"]
    UpdateStack -->|"Other"| FinishToken(["Proceed to Next Token"])
    PushParen --> FinishToken
    PushBlock --> FinishToken
    PushArray --> FinishToken
    PopBlock --> FinishToken
    PopParen --> FinishToken
```

---

## 5. Array Literal vs Block Start Disambiguation (CFG 4)

BML supports 1D array literals (`String[]{ "a", "b" }`) and 2D nested array literals (`Integer[][]{ {1, 2}, {3, 4} }`). The beautifier disambiguates array braces from standard executable code blocks:

```mermaid
flowchart TD
    EncounterBrace(["Encounter open-brace in Tokenizer"]) --> CheckPreceding["Inspect preceding non-whitespace tokens"]
    
    CheckPreceding --> HasTypeArray{"Preceded by Type[] or Type[][] ?"}
    HasTypeArray -->|"Yes"| SetArrayLiteral["Classify as TOKEN.ARRAY_START"]
    
    HasTypeArray -->|"No"| InsideNestedArray{"Inside active 2D Array Literal context?"}
    InsideNestedArray -->|"Yes"| SetNestedArray["Classify as TOKEN.ARRAY_START for row group"]
    
    InsideNestedArray -->|"No"| StatementContext{"Preceded by condition ')', 'else', or statement start?"}
    StatementContext -->|"Yes"| SetBlockStart["Classify as TOKEN.START_BLOCK"]
    StatementContext -->|"No"| SetDefaultBlock["Classify as TOKEN.START_BLOCK"]

    SetArrayLiteral --> ArrayFormat["Format braces hugging array values without block linebreaks"]
    SetNestedArray --> ArrayFormat
    SetBlockStart --> BlockFormat["Format according to brace_style: collapse / expand"]
    SetDefaultBlock --> BlockFormat
```

---

## 6. Operator Spacing & Unary vs Binary Disambiguation (CFG 5)

BML operators (`==`, `<>`, `<=`, `>=`, `<`, `>`, `+`, `-`, `*`, `/`, `%`) and logical keywords (`AND`, `OR`, `NOT(c)`) are formatted with strict mathematical rules:

```mermaid
flowchart TD
    EncounterOp(["Encounter Operator Token +, -, *, /, ==, <>, ..."]) --> CheckPlusMinus{"Is + or - ?"}
    
    CheckPlusMinus -->|"No (Binary Op: *, /, %, ==, <>, <=, >=, AND, OR)"| BinarySpacing["Pad with single space before and after: a == b, x <> y"]
    
    CheckPlusMinus -->|"Yes"| CheckUnaryContext{"Preceded by '(', '{', '=', ',', operator, or reserved word?"}
    CheckUnaryContext -->|"Yes (Unary Context)"| UnaryFormat["Space before operator, NO space between operator and operand: -1, +10, -val"]
    
    CheckUnaryContext -->|"No (Binary Addition/Subtraction)"| BinaryPlusFormat["Space before and after: x + y, str1 + str2"]
    
    BinaryPlusFormat --> CheckWrapLength{"wrap_line_length > 0 && current_length > limit?"}
    CheckWrapLength -->|"Yes"| ForceContinuation["Wrap next operand to continuation line with indent_level + 1"]
    CheckWrapLength -->|"No"| DoneOp(["Emit operator"])
    UnaryFormat --> DoneOp
    BinarySpacing --> DoneOp
    ForceContinuation --> DoneOp
```

---

## 7. Brace Style & Block Hugging Flow (CFG 6)

The beautifier dynamically formats block braces and `elif` / `else` chains according to `brace_style`:

```mermaid
flowchart TD
    EncounterBlock(["START_BLOCK '{' or END_BLOCK '}' reached"]) --> CheckBraceType{"Is START_BLOCK or END_BLOCK?"}
    
    CheckBraceType -->|"START_BLOCK"| CheckStyleConfig{"options.brace_style"}
    CheckStyleConfig -->|"'collapse' (Default)"| CollapseStart["Hug condition on same line: if (cond) {"]
    CheckStyleConfig -->|"'expand' (Allman)"| ExpandStart["Emit newline and start open-brace on its own indented line"]
    CheckStyleConfig -->|"'preserve-inline'"| CheckInline{"Block is single-line in source?"}
    CheckInline -->|"Yes"| PreserveInline["Keep entire 'if (c) { return; }' on single line"]
    CheckInline -->|"No"| CollapseStart

    CheckBraceType -->|"END_BLOCK"| CheckNextToken{"Next token is elif or else?"}
    CheckNextToken -->|"Yes"| CheckHugStyle{"brace_style == 'collapse'?"}
    CheckHugStyle -->|"Yes"| HugElifElse["Format as '} elif (cond) {' or '} else {'"]
    CheckHugStyle -->|"No"| ExpandElifElse["Emit newline for closing-brace and newline for elif / else"]
    CheckNextToken -->|"No"| EndBlockNewline["Emit closing-brace on its own line and start next statement on fresh line"]
```

---

## 8. Minimal Range Edit Diffing Optimizer (CFG 7)

To prevent whole-document replacement, IDE lag, and cursor jumps on format-on-save, `computeMinimalEdits` isolates only the changed character range:

```mermaid
flowchart TD
    ReceiveOutput(["Formatted Output String Generated"]) --> CompareExact{"Formatted text === Current document text?"}
    
    CompareExact -->|"Yes"| ReturnZeroEdits["Return empty TextEdit array -> 0ms overhead"]
    
    CompareExact -->|"No"| ScanPrefix["Scan characters from start to find length of common prefix"]
    ScanPrefix --> ScanSuffix["Scan characters from end to find length of common suffix"]
    
    ScanSuffix --> CalcRange["Calculate minimal start Line/Char and end Line/Char in source"]
    CalcRange --> SliceReplacement["Extract replacement text slice from formatted output"]
    
    SliceReplacement --> BuildEdit["Construct single targeted vscode.TextEdit(range, sliceText)"]
    BuildEdit --> ApplyEdit(["Send minimal TextEdit to Editor Buffer"])
```

---

## 9. Configuration Options Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `indent_size` | `Integer` | `4` | Number of spaces or tab width for each indentation level. |
| `indent_char` | `String` | `' '` | Indentation character (`' '` or `'\t'`). |
| `indent_with_tabs` | `Boolean` | `false` | When `true`, uses tabs for indentation. |
| `brace_style` | `String` | `'collapse'` | `'collapse'` (1TBS/K&R style), `'expand'` (Allman style), or `'preserve-inline'`. |
| `space_before_conditional` | `Boolean` | `true` | When `true`, formats `if (condition)` instead of `if(condition)`. |
| `space_in_paren` | `Boolean` | `false` | When `true`, adds space inside parentheses: `( x )` vs `(x)`. |
| `space_in_empty_paren` | `Boolean` | `false` | When `true`, adds space in empty parentheses: `func( )` vs `func()`. |
| `preserve_newlines` | `Boolean` | `true` | Preserves developer-authored blank lines between logical sections. |
| `max_preserve_newlines` | `Integer` | `2` | Maximum consecutive blank lines allowed. |
| `end_with_newline` | `Boolean` | `true` | Ensures document ends with a trailing newline. |
| `wrap_line_length` | `Integer` | `0` | Maximum line length before wrapping binary `+` expression chains (`0` = disabled). |
| `enforce_semicolons` | `Boolean` | `false` | Strictly `false` during formatting to prevent automatic semantic modifications. |
| `uppercase_reserved_words`| `Boolean` | `true` | Normalizes logical keywords (`AND`, `OR`, `NOT`). |
