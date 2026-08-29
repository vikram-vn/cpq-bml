# Oracle CPQ BML Code Metrics: Architecture, Formulas & Control Flow Graphs

## Table of Contents
1. [Overview & High-Level Architecture](#1-overview--high-level-architecture)
2. [Metrics Analysis & Quality Report Lifecycle (CFG 1)](#2-metrics-analysis--quality-report-lifecycle-cfg-1)
3. [Cyclomatic Complexity Calculation (CFG 2)](#3-cyclomatic-complexity-calculation-cfg-2)
4. [Halstead Complexity & Effort Computation (CFG 3)](#4-halstead-complexity--effort-computation-cfg-3)
5. [Maintainability Index & Letter Grade Rating (CFG 4)](#5-maintainability-index--letter-grade-rating-cfg-4)
6. [Interactive Webview Dashboard Rendering (CFG 5)](#6-interactive-webview-dashboard-rendering-cfg-5)
7. [Mathematical Formulas & Rating Thresholds](#7-mathematical-formulas--rating-thresholds)

---

## 1. Overview & High-Level Architecture

The **BML Metrics Subsystem** analyzes BML source code to measure software complexity, code volume, maintainability, and architectural risk. It computes McCabe Cyclomatic Complexity, Halstead Software Science metrics, nesting depths, and Maintainability Index (MI), rendering an interactive visual quality dashboard:

```mermaid
graph LR
    subgraph Input
        SRC["BML Source Code"]
        AST["BML Abstract Syntax Tree"]
    end

    subgraph Metrics Engine
        CYCLO["Cyclomatic Analyzer<br/>complexity.js"]
        HALSTEAD["Halstead Science Analyzer<br/>complexity.js"]
        LINES["Line & Comment Counter<br/>complexity.js"]
        MAINT["Maintainability Calculator<br/>complexity.js"]
    end

    subgraph Reporting & Dashboard
        REPORT["JSON / Markdown Report<br/>report.js"]
        WEBVIEW["Visual Quality Dashboard<br/>reportWebview.js"]
        MCP_TOOL["MCP get_function_metrics<br/>mcp/tools/lifecycle.js"]
    end

    SRC --> LINES
    AST --> CYCLO
    AST --> HALSTEAD
    CYCLO --> MAINT
    HALSTEAD --> MAINT
    LINES --> MAINT

    MAINT --> REPORT
    MAINT --> WEBVIEW
    MAINT --> MCP_TOOL
```

---

## 2. Metrics Analysis & Quality Report Lifecycle (CFG 1)

This control flow graph shows how metrics are gathered and aggregated across a single script or entire workspace:

```mermaid
flowchart TD
    TriggerMetrics(["Trigger 'BML: Show Code Metrics' or MCP get_function_metrics"]) --> FetchCode["Load BML source code"]
    
    FetchCode --> ParseAST["Parse BML source into AST with Token Stream"]
    ParseAST --> CountLines["Compute Physical Lines, SLOC, Blank Lines, and Comment Lines"]

    CountLines --> CalcCyclomatic["Traverse AST to calculate Cyclomatic Complexity"]
    CalcCyclomatic --> CalcHalstead["Extract unique & total Operators and Operands"]
    CalcHalstead --> CalcNesting["Calculate Maximum Loop Depth and Condition Block Depth"]

    CalcNesting --> CalcMI["Compute Maintainability Index (MI) Score (0 to 100)"]
    CalcMI --> AssignGrade["Assign Letter Grade (A, B, C, D, or F) based on thresholds"]

    AssignGrade --> AssemblePayload["Assemble comprehensive Metrics JSON Object"]
    AssemblePayload --> RenderTarget{"Output destination?"}

    RenderTarget -->|"VS Code Webview"| LaunchDashboard["Render interactive HTML5 / CSS Dashboard (reportWebview.js)"]
    RenderTarget -->|"MCP Tool JSON"| ReturnMCPJSON["Return structured JSON payload to AI Agent"]
    RenderTarget -->|"Export Markdown"| SaveMarkdownReport["Save formatted metrics_report.md to workspace"]

    LaunchDashboard --> DoneMetrics(["Metrics Lifecycle Complete"])
    ReturnMCPJSON --> DoneMetrics
    SaveMarkdownReport --> DoneMetrics
```

---

## 3. Cyclomatic Complexity Calculation (CFG 2)

Calculates McCabe Cyclomatic Complexity based on decision nodes and boolean operators:

```mermaid
flowchart TD
    InitCyclo(["Initialize Cyclomatic Complexity = 1 (Base Path)"]) --> TraverseNodes["Traverse AST Nodes with Depth-First Search"]
    
    TraverseNodes --> CheckNodeType{"Inspect AST Node Type"}
    
    NodeType -->|"IfStatement (if)"| AddIfBranch["Complexity += 1"]
    NodeType -->|"ElifClause (elif)"| AddElifBranch["Complexity += 1"]
    NodeType -->|"ForStatement (for ... in)"| AddLoopBranch["Complexity += 1"]
    NodeType -->|"LogicalExpression (AND, OR)"| AddLogicalBranch["Complexity += 1 (Compound decision point)"]
    NodeType -->|"ConditionalExpression (? :)"| AddTernaryBranch["Complexity += 1"]
    NodeType -->|"Other Statement"| SkipNode["Complexity unchanged"]

    AddIfBranch --> MoreNodes{"More AST nodes to evaluate?"}
    AddElifBranch --> MoreNodes
    AddLoopBranch --> MoreNodes
    AddLogicalBranch --> MoreNodes
    AddTernaryBranch --> MoreNodes
    SkipNode --> MoreNodes

    MoreNodes -->|"Yes"| TraverseNodes
    MoreNodes -->|"No"| FinalComplexity(["Return Final Cyclomatic Complexity Score"])
```

---

## 4. Halstead Complexity & Effort Computation (CFG 3)

Measures operator/operand frequencies to calculate vocabulary, volume, difficulty, and programming effort:

```mermaid
flowchart TD
    InitHalstead(["Initialize Operators Map & Operands Map"]) --> ScanTokens["Scan all Tokens in Token Stream"]
    
    ScanTokens --> ClassifyToken{"Is Token an Operator or Operand?"}
    
    ClassifyToken -->|"Operator (+, -, *, /, ==, <>, if, for, AND, OR, return, etc.)"| RecordOperator["Increment Total Operators (N1) & Add to Distinct Operators Set (n1)"]
    ClassifyToken -->|"Operand (Identifiers, Literals, Numbers, Strings, Booleans)"| RecordOperand["Increment Total Operands (N2) & Add to Distinct Operands Set (n2)"]
    ClassifyToken -->|"Punctuation / Whitespace"| IgnoreToken["Ignore punctuation"]

    RecordOperator --> NextToken{"More tokens in stream?"}
    RecordOperand --> NextToken
    IgnoreToken --> NextToken

    NextToken -->|"Yes"| ScanTokens
    NextToken -->|"No"| ComputeDerived["Compute Derived Science Metrics"]

    ComputeDerived --> CalcLength["Program Length: N = N1 + N2"]
    CalcLength --> CalcVocab["Program Vocabulary: n = n1 + n2"]
    CalcVocab --> CalcVolume["Volume: V = N * log2(n)"]
    CalcVolume --> CalcDifficulty["Difficulty: D = (n1 / 2) * (N2 / n2)"]
    CalcDifficulty --> CalcEffort["Effort: E = D * V"]
    CalcEffort --> CalcTime["Estimated Time: T = E / 18 seconds"]
    CalcTime --> CalcBugs["Estimated Delivered Bugs: B = V / 3000"]
    
    CalcBugs --> ReturnHalstead(["Return Complete Halstead Metrics Object"])
```

---

## 5. Maintainability Index & Letter Grade Rating (CFG 4)

Combines Halstead Volume, Cyclomatic Complexity, and Source Lines of Code into a single quality score:

```mermaid
flowchart TD
    StartMI(["Calculate Maintainability Index (MI)"]) --> FormulaEvaluation["Evaluate standard SEI Maintainability Formula:<br/>MI = 171 - 5.2*ln(V) - 0.23*Cyclo - 16.2*ln(SLOC) + 50*sin(sqrt(2.4*CommentRatio))"]
    
    FormulaEvaluation --> ClampScore["Clamp score between 0 and 100: MI = Math.max(0, Math.min(100, MI))"]
    
    ClampScore --> EvaluateGrade{"Evaluate MI Score Threshold"}
    
    EvaluateGrade -->|"MI >= 80"| GradeA["Grade A (Excellent Maintainability - Low Risk)"]
    EvaluateGrade -->|"65 <= MI < 80"| GradeB["Grade B (Good Maintainability - Moderate Risk)"]
    EvaluateGrade -->|"50 <= MI < 65"| GradeC["Grade C (Fair Maintainability - Noticeable Complexity)"]
    EvaluateGrade -->|"35 <= MI < 50"| GradeD["Grade D (Poor Maintainability - High Refactor Priority)"]
    EvaluateGrade -->|"MI < 35"| GradeF["Grade F (Critical Risk - Immediate Refactoring Required)"]

    GradeA --> ReturnGradeRating(["Return Score & Grade Rating"])
    GradeB --> ReturnGradeRating
    GradeC --> ReturnGradeRating
    GradeD --> ReturnGradeRating
    GradeF --> ReturnGradeRating
```

---

## 6. Interactive Webview Dashboard Rendering (CFG 5)

Renders real-time visual progress gauges, complexity breakdown charts, and hotspot tables:

```mermaid
flowchart TD
    LaunchWebview(["Launch Metrics Webview Panel (reportWebview.js)"]) --> CompileData["Compile Cyclomatic, Halstead, Line Counts, and Nesting Depths"]
    
    CompileData --> GenerateHTML["Generate HTML5 structure with responsive CSS Cards"]
    
    GenerateHTML --> RenderScoreBadge["Render Overall Maintainability Grade Badge (Color-Coded: Green/Yellow/Red)"]
    RenderScoreBadge --> RenderSummaryGauges["Render Radial Gauges for Cyclomatic Complexity & SLOC"]
    RenderSummaryGauges --> RenderHotspotTable["Render Function Hotspot Table (Highlighting Loop Depth > 3 or Cyclo > 15)"]
    RenderSummaryGauges --> RenderHalsteadCard["Render Halstead Science Breakdown Card (Volume, Difficulty, Effort, Bugs)"]

    RenderHalsteadCard --> AttachExportHandlers["Attach Export Buttons ('Export JSON', 'Export Markdown', 'Copy Table')"]
    AttachExportHandlers --> DisplayPanel(["Display Quality Dashboard in VS Code Tab"])
```

---

## 7. Mathematical Formulas & Rating Thresholds

### Cyclomatic Complexity ($v(G)$)
$$v(G) = 1 + \text{Decision Nodes}$$
Where decision nodes include: `if`, `elif`, `for`, `AND`, `OR`, `? :`.

| Cyclomatic Complexity | Risk Level | Interpretation |
| :--- | :--- | :--- |
| **1 &ndash; 10** | Low Risk | Simple, easy to test and maintain. |
| **11 &ndash; 20** | Moderate Risk | Moderately complex; requires thorough unit tests. |
| **21 &ndash; 50** | High Risk | Complex; candidate for refactoring. |
| **> 50** | Untestable / Critical | Unstable and extremely difficult to verify. |

---

### Halstead Software Science Measures
- **Program Vocabulary**: $n = n_1 + n_2$
- **Program Length**: $N = N_1 + N_2$
- **Calculated Program Length**: $\hat{N} = n_1 \log_2(n_1) + n_2 \log_2(n_2)$
- **Volume**: $V = N \times \log_2(n)$
- **Difficulty**: $D = \frac{n_1}{2} \times \frac{N_2}{n_2}$
- **Effort**: $E = D \times V$
- **Time to Code**: $T = \frac{E}{18} \text{ (seconds)}$
- **Delivered Bugs**: $B = \frac{V}{3000}$

---

### Maintainability Index (MI)
$$\text{MI} = 171 - 5.2 \ln(V) - 0.23 \times v(G) - 16.2 \ln(\text{SLOC}) + 50 \times \sin\left(\sqrt{2.4 \times \text{Comment Ratio}}\right)$$

| MI Score | Grade | Color | Health Status |
| :--- | :---: | :---: | :--- |
| **80 &ndash; 100** | **A** | 🟢 Green | Highly maintainable, clean code. |
| **65 &ndash; 79** | **B** | 🟢 Green | Good health, standard maintenance. |
| **50 &ndash; 64** | **C** | 🟡 Yellow | Moderate complexity; monitor growth. |
| **35 &ndash; 49** | **D** | 🟠 Orange | High complexity; refactoring recommended. |
| **0 &ndash; 34** | **F** | 🔴 Red | Critical debt; urgent refactoring required. |
