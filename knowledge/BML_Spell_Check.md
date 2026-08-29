# Oracle CPQ BML Spell Check: Architecture, Lexicons & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [Document Spell Check Lifecycle (CFG 1)](#2-document-spell-check-lifecycle-cfg-1)
3. [Brotli Dictionary Loading & Caching Flow (CFG 2)](#3-brotli-dictionary-loading--caching-flow-cfg-2)
4. [Identifier & Comment Word Segmentation Flow (CFG 3)](#4-identifier--comment-word-segmentation-flow-cfg-3)
5. [Typo Detection & Levenshtein Suggestion Flow (CFG 4)](#5-typo-detection--levenshtein-suggestion-flow-cfg-4)
6. [Quick Fix & Custom Dictionary Addition Flow (CFG 5)](#6-quick-fix--custom-dictionary-addition-flow-cfg-5)
7. [Lexicons & Configuration Reference](#7-lexicons--configuration-reference)

---

## 1. Overview & High-Level Architecture

The **BML Spell Checker** is an offline, domain-aware spell checking engine designed specifically for Oracle CPQ developers. It validates words inside comments, string literals, and identifiers against both standard English and CPQ/BML domain dictionaries:

```mermaid
graph LR
    subgraph Compressed Lexicons
        ENG["English Dictionary<br/>english-words.txt.br"]
        BML_DICT["BML & CPQ Domain Words<br/>bml-words.txt.br"]
        CUSTOM["Workspace Custom Words<br/>settings.json"]
    end

    subgraph Core Engine
        LOADER["Brotli Decompressor & Trie Cache<br/>spellingDict.js"]
        PARSER["Token & Word Segmenter<br/>spelling.js"]
        LEVEN["Levenshtein Distance Suggester<br/>spelling.js"]
    end

    subgraph Editor Output
        DIAG["Spelling Diagnostics<br/>(Info / Hint Squiggles)"]
        ACTION["Code Action Provider<br/>(Change to / Add to Dict)"]
    end

    ENG --> LOADER
    BML_DICT --> LOADER
    CUSTOM --> LOADER
    LOADER -->|"Fast Lookup Sets"| PARSER
    PARSER -->|"Misspelled Tokens"| LEVEN
    LEVEN --> DIAG
    LEVEN --> ACTION
```

---

## 2. Document Spell Check Lifecycle (CFG 1)

This control flow graph shows how documents are scanned for spelling errors:

```mermaid
flowchart TD
    TriggerScan(["Document Opened / Keystroke Debounce in Editor"]) --> CheckEnabled{"Spell checker enabled in settings?"}
    
    CheckEnabled -->|"No"| ClearDiagnostics["Clear spelling diagnostics & exit"]
    CheckEnabled -->|"Yes"| EnsureDictLoaded["Ensure Brotli dictionaries are decompressed and loaded in memory"]

    EnsureDictLoaded --> ScanTokens["Scan document tokens (Comments, String Literals, Identifiers)"]
    ScanTokens --> FilterIgnored{"Is token a URL, Base64 string, or Regex pattern?"}
    
    FilterIgnored -->|"Yes"| SkipToken["Skip token without checking"]
    FilterIgnored -->|"No"| SegmentToken["Split token into individual candidate words (camelCase / snake_case)"]

    SegmentToken --> CheckWordInDict{"Is candidate word in Dictionary, Extra Allowed, or Custom Words?"}
    CheckWordInDict -->|"Yes"| NextWord["Proceed to next candidate word"]
    
    CheckWordInDict -->|"No"| CheckMorphology{"Matches Morphological Affixation (plurals, -ed, -ing, -ly, -tion, prefixes)?"}
    CheckMorphology -->|"Yes (Valid Inflection)"| NextWord
    CheckMorphology -->|"No (Misspelling)"| GenerateSuggestions["Compute closest matches using Levenshtein distance & edit operations"]

    GenerateSuggestions --> BuildDiagnostic["Construct vscode.Diagnostic(wordRange, 'Spelling: Misspelled word', Information)"]
    BuildDiagnostic --> AttachCodeActions["Attach QuickFix actions: Suggestion replacements + 'Add to Dictionary'"]

    AttachCodeActions --> NextWord
    NextWord --> MoreWords{"More words in document?"}
    MoreWords -->|"Yes"| SegmentToken
    MoreWords -->|"No"| PublishDiagnostics(["Publish Diagnostics Collection to Editor Buffer"])
```

---

## 3. Brotli Dictionary Loading & Caching Flow (CFG 2)

Efficient startup initialization and memory caching of Brotli-compressed dictionary assets:

```mermaid
flowchart TD
    InitLoader(["Initialize spellingDict.js on extension activate"]) --> CheckCache{"Are dictionaries already in memory cache?"}
    
    CheckCache -->|"Yes"| ReturnCachedDict["Return existing Set / Trie instances"]
    CheckCache -->|"No"| ReadBrotliFiles["Read english-words.txt.br and bml-words.txt.br from disk"]

    ReadBrotliFiles --> DecompressBrotli["Decompress byte buffers using Node zlib / BrotliDecompress"]
    DecompressBrotli --> ParseWordList["Split decompressed text by newline into String array"]

    ParseWordList --> PopulateSet["Populate fast in-memory Set & Case-Insensitive Lookup Maps"]
    PopulateSet --> MergeCustomWords["Merge custom words defined in workspace settings.json"]
    
    MergeCustomWords --> StoreCache["Store merged dictionary in memory cache (zero disk reads on future scans)"]
    StoreCache --> ReturnCachedDict
    ReturnCachedDict --> LoaderReady(["Dictionary Loader Ready for High-Speed Lookups"])
```

---

## 4. Identifier & Comment Word Segmentation Flow (CFG 3)

Breaks complex code symbols into natural language words:

```mermaid
flowchart TD
    InputToken(["Raw Token (e.g. 'calculateDiscountRate', 'total_amount_val', 'bml_util_fxn')"]) --> CheckCommentOrString{"Is token inside a Comment or String Literal?"}
    
    CheckCommentOrString -->|"Comment / String"| StripPunctuation["Strip Markdown / HTML / punctuation markers: *, #, @, etc."]
    CheckCommentOrString -->|"Code Identifier"| StripPrefix["Strip leading underscores '_' (e.g. '_document_number')"]

    StripPunctuation --> SplitWhitespace["Split into words by whitespace and hyphens"]
    StripPrefix --> SplitSnakeCase["Split by underscore '_' delimiter into segments"]

    SplitSnakeCase --> SplitCamelCase["Apply Regex: split on lowercase-to-uppercase transitions (camelCase / PascalCase)"]
    SplitWhitespace --> SplitCamelCase

    SplitCamelCase --> FilterMinLength{"Word length >= 3 characters?"}
    FilterMinLength -->|"No"| IgnoreShortWord["Ignore 1-2 character tokens"]
    FilterMinLength -->|"Yes"| NormalizeWord["Normalize word (lowercase and preserve original range for diagnostics)"]

    NormalizeWord --> EmitCandidate(["Emit candidate word for dictionary validation"])
```

---

## 5. Typo Detection & Levenshtein Suggestion Flow (CFG 4)

Computes top suggested corrections for misspelled words:

```mermaid
flowchart TD
    MisspelledWord(["Misspelled Candidate Word Detected (e.g. 'funtion')"]) --> InitSuggestions["Initialize Suggestions Priority Queue"]
    
    InitSuggestions --> ScanDictionary["Scan candidate words from dictionary sharing first character"]
    ScanDictionary --> CalcDistance["Compute Damerau-Levenshtein Edit Distance (Insertions, Deletions, Substitutions, Transpositions)"]

    CalcDistance --> DistanceCheck{"Edit distance <= 2?"}
    DistanceCheck -->|"Yes"| AddToQueue["Add candidate word to Priority Queue sorted by lowest distance"]
    DistanceCheck -->|"No"| NextDictWord["Proceed to next dictionary word"]

    AddToQueue --> NextDictWord
    NextDictWord --> FinishedScan{"Scanned all candidate dictionary entries?"}
    
    FinishedScan -->|"No"| ScanDictionary
    FinishedScan -->|"Yes"| TopKMatches["Extract Top 5 closest suggested corrections"]
    TopKMatches --> MatchCasing["Preserve original word casing (Uppercase / TitleCase / lowercase)"]
    
    MatchCasing --> ReturnSuggestions(["Return Ranked Suggestions Array"])
```

---

## 6. Quick Fix & Custom Dictionary Addition Flow (CFG 5)

Applies single-click corrections or adds words to the user/workspace dictionary:

```mermaid
flowchart TD
    ClickLightbulb(["User clicks Lightbulb or presses Cmd+. / Ctrl+. on misspelled word"]) --> ShowActions["Display available CodeActions in QuickFix menu"]
    
    ShowActions --> UserSelect{"User Action Selected"}
    
    UserSelect -->|"Select Suggestion (e.g. 'function')"| ApplyReplacement["Create vscode.WorkspaceEdit with replacement range"]
    UserSelect -->|"Add to Workspace Dictionary"| AddWorkspaceDict["Append word to 'cpq-bml.spellcheck.customWords' in settings.json"]
    UserSelect -->|"Add to User Settings"| AddUserDict["Append word to Global VS Code Settings"]
    UserSelect -->|"Ignore Word"| IgnoreSession["Add word to current session ignore set"]

    ApplyReplacement --> ApplyEdit["Apply text replacement directly to document buffer"]
    AddWorkspaceDict --> TriggerReload["Hot-reload in-memory dictionary cache"]
    AddUserDict --> TriggerReload
    IgnoreSession --> TriggerReload

    ApplyEdit --> ClearSquiggle["Clear spelling diagnostic squiggle in editor"]
    TriggerReload --> ClearSquiggle
    ClearSquiggle --> CompleteFix(["Word Corrected / Dictionary Updated"])
```

---

## 7. Lexicons & Configuration Reference

| Lexicon Asset | Uncompressed / Compressed Size | Purpose |
| :--- | :--- | :--- |
| **`english-words.txt.br`** | 281 KB &rarr; 74.2 KB | Standard English vocabulary (~25,000+ words). |
| **`bml-words.txt.br`** | 38.5 KB &rarr; 12.3 KB | Oracle CPQ, BML built-ins, BMQL keywords, and domain terminology. |
| **Workspace Settings** | User-defined | Project-specific abbreviations, acronyms, and product codes. |

### Configuration Properties

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bml.spellcheck.enabled` | `Boolean` | `true` | Enables or disables live spell checking. |
| `bml.spellcheck.checkComments` | `Boolean` | `true` | Enables spell checking inside line (`//`) and block (`/* */`) comments. |
| `bml.spellcheck.checkStrings` | `Boolean` | `true` | Enables spell checking inside double-quoted string literals. |
| `bml.spellcheck.checkIdentifiers` | `Boolean` | `false` | Enables spell checking for variable and function names (split by camelCase/snake_case). |
| `bml.spellcheck.customWords` | `Array<String>` | `[]` | List of user-approved custom words. |
| `bml.spellcheck.minWordLength` | `Integer` | `3` | Minimum character length before a word is spell checked. |

---

## 8. Practical Usage Examples & Quick Fix Workflows

### Example 1: Smart Morphology In Action (Zero False Positives)

The spell checker automatically accepts regular inflections and compound prefixes without flagging them:

```javascript
// Accepted naturally via Smart Morphology (root word derived):
// • categories (plural of category)
// • recalculating (prefix 're-' + root 'calculate' + '-ing')
// • unformatted (prefix 'un-' + root 'format' + '-ed')
// • configurable (root 'configure' + '-able')
// • deployment (root 'deploy' + '-ment')
// • subdocumentKey (prefix 'sub-' + 'document' + 'key')
categoriesList = ["Enterprise", "MidMarket"];
recalculatingTotal = true;
isConfigurableItem = true;
```

---

### Example 2: Typo Detection & Lightbulb Quick Fix

#### Problematic Code:
```javascript
// SQUIGGLE ON: 'calclate', 'servcie', 'struture'
calclateDiscount = 0.15;
servcieStatus = "ACTIVE";
docStruture = dict();
```

#### Quick Fix Lightbulb Actions (`Ctrl+.` or `Cmd+.`):
* `calclate` &rarr; Select `"Change to 'calculate'"`
* `servcie` &rarr; Select `"Change to 'service'"`
* `struture` &rarr; Select `"Change to 'structure'"`

#### Corrected Code:
```javascript
calculateDiscount = 0.15;
serviceStatus = "ACTIVE";
docStructure = dict();
```

---

### Example 3: Adding Custom Workspace Terms

When a project uses custom company terms or model codes (e.g. `XPS9500`, `OptiPlex`, `SaaS`):

1. Put cursor on the flagged word.
2. Press `Ctrl+.` / `Cmd+.`.
3. Select `"Add 'SaaS' to workspace dictionary"`.
4. The term is automatically appended to `.vscode/settings.json`:

```json
{
  "cpqBml.spelling.userWords": [
    "saas",
    "xps9500",
    "optiplex"
  ]
}
```

