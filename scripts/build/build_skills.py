"""Builds the AI skills directory from the scratch knowledge base.

The app/ai/skills/ directory is git-ignored and generated at build time.
This ensures the massive reference markdown files are bundled in the VSIX
without polluting the git repository.
"""
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_KNOWLEDGE_DIR = os.path.join(ROOT, "knowledge", "BML")
DEST_SKILLS_DIR = os.path.join(ROOT, "app", "ai", "skills")

# Embedded SKILL.md templates
SKILL_TEMPLATES = {
    "bml-language": """---
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

Please see the `references/` directory for detailed documentation on Arrays, Strings, Math, Dates, Conditionals, and Best Practices.
""",
    "bml-db-access": """---
name: bml-db-access
description: >-
  Advanced BMQL and Direct Database Access in Oracle CPQ BML. Use when querying
  system tables or Data Tables, or performing CRUD operations.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# Direct DB Access & BMQL

Please see the `references/` directory for detailed documentation on BMQL syntax, Dynamic Variables, and Direct DB Access.
""",
    "bml-web-services": """---
name: bml-web-services
description: >-
  Interact with external web services using HTTP REST (urldata), SOAP, and XML.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# Web Services & XML

Please see the `references/` directory for detailed documentation on URL Access (urldata), XML parsing, and SOAP.
""",
    "bml-json-dict": """---
name: bml-json-dict
description: >-
  Advanced JSON and Dictionary manipulation in Oracle CPQ BML.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# JSON & Dictionaries

Please see the `references/` directory for detailed documentation on Json, JsonArray, and Dictionaries.
""",
    "cpq-domain": """---
name: cpq-domain
description: >-
  Understand Oracle CPQ concepts like Commerce, Configuration, BOM, and System Variables.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# CPQ Domain Knowledge

Please see the `references/` directory for detailed documentation on BOM, Constants, Global Dicts, System Configs, User Sessions, and Package Lifecycle.
""",
    "bml-editor-workflow": """---
name: bml-editor-workflow
description: >-
  Understand the CPQ BML Function Editor, Function to Function calls, and Library Functions.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Editor Workflow

Please see the `references/` directory for detailed documentation on the BML Editor, Function Wizards, and Library Functions.
""",
    "bml-pitfalls": """---
name: bml-pitfalls
description: >-
  Critical BML anti-patterns to avoid, including security, performance, and syntax issues.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# BML Pitfalls

- **Do NOT use `var`, `let`, or `const`**. BML has no declaration keywords. Just assign: `myVar = "value";`.
- **Use `==` and `<>`, NOT `===` and `!=`**.
- **Always terminate statements with `;`**.
- **Do NOT concatenate unvalidated parameters into BMQL** (SQL injection risk).
""",
    "cpq-mcp-workflow": """---
name: cpq-mcp-workflow
description: >-
  Step-by-step guidance for the AI on how to effectively use CPQ-BML MCP tools.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.0"
---
# CPQ MCP Workflow

You have access to tools to interact directly with CPQ BML code via the MCP Server:
1. `pull`: Pull BML from the environment.
2. `edit`: Edit the BML.
3. `lint`/`validate`: Verify the BML syntax.
4. `save`/`deploy`: Save to the CPQ environment.
"""
}

# Map of skill names to their required reference files in scratch/knowledge/BML
SKILL_REFERENCES = {
    "bml-language": [
        "Arrays.md", "ArraysOverview.md", "String.md", "Math.md", 
        "Date.md", "Conditional.md", "BMLOverview.md", "BMLCodingBestPractices.md"
    ],
    "bml-db-access": [
        "BMQL.md", "DynamicBMQLVariables.md", "DirectDBAccess.md"
    ],
    "bml-web-services": [
        "URLAccess.md", "XML.md", "UseSOAPwithBML.md"
    ],
    "bml-json-dict": [
        "Json.md", "Dictionary.md"
    ],
    "cpq-domain": [
        "Others.md", "Others-BOM.md", "Others-Constants.md", "Others-GlobalDict.md",
        "Others-SysConfig.md", "Others-UserSessions.md", "PackageLifecycleManagement.md"
    ],
    "bml-editor-workflow": [
        "BML_Editor.md", "FunctionEditorBasics.md", "FunctionWizard.md", 
        "BMLFunctionsList.md", "Library_Functions.md", 
        "UtilBmlLibraryFunctionsList.md", "DebugUtilFunctions.md"
    ],
    "bml-pitfalls": [],
    "cpq-mcp-workflow": []
}

def build_skills():
    print(f"Building AI Skills in {DEST_SKILLS_DIR}...")
    
    # 1. Clean existing directory
    if os.path.exists(DEST_SKILLS_DIR):
        shutil.rmtree(DEST_SKILLS_DIR)
    os.makedirs(DEST_SKILLS_DIR, exist_ok=True)

    # 2. Generate each skill
    for skill_name, refs in SKILL_REFERENCES.items():
        skill_dir = os.path.join(DEST_SKILLS_DIR, skill_name)
        os.makedirs(skill_dir, exist_ok=True)
        
        # Write SKILL.md from embedded template
        skill_content = SKILL_TEMPLATES.get(skill_name, "")
        if skill_content:
            with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as f:
                f.write(skill_content)
        
        # Copy references
        if refs:
            refs_dir = os.path.join(skill_dir, "references")
            os.makedirs(refs_dir, exist_ok=True)
            for ref in refs:
                src_ref = os.path.join(SRC_KNOWLEDGE_DIR, ref)
                if os.path.exists(src_ref):
                    shutil.copy2(src_ref, refs_dir)
                else:
                    print(f"Warning: Reference file {ref} not found for skill {skill_name}")

    print("AI Skills build complete.")

if __name__ == "__main__":
    build_skills()
