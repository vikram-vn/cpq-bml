---
name: cpq-mcp-workflow
description: >-
  Step-by-step guidance for the AI on how to effectively use CPQ-BML MCP tools,
  including the mandatory human-approval deployment flow.
compatibility: Designed for VS Code with CPQ-BML extension
metadata:
  author: cpq-bml
  version: "1.1"
---
# CPQ MCP Workflow

You have access to tools to interact directly with CPQ BML code via the MCP Server:
1. `get_connection_status`: Check if credentials and CPQ connection are configured and working (`testConnection: true`).
2. `global_search_bml`: Search text across all remote BML scripts (libraries, rules, attributes) on CPQ.
3. `pull_function`: Pull remote BML into the local AI working copy (`<variableName>_ai.bml`).
4. `edit`: Modify the local working copy.
5. `lint_function` / `validate_function`: Verify syntax locally and compile remotely on CPQ without saving.
6. `debug_function`: Run remote tests with input parameters (`parameters: { ... }`, `printOnly: true`).
7. `save_function`: Save the working copy changes to CPQ (`variableName: "..."`).
8. `deploy_function` / `mass_deploy_util_functions` / `deploy_commerce_process`:
   - **MANDATORY HUMAN APPROVAL**: Deploying pushes changes directly to the live CPQ environment.
   - Calling deployment tools without `confirm: true` returns an error requiring human permission.
   - **Protocol**: You MUST ask the human user for explicit approval in chat first (e.g. "Do you approve deploying <function> to the live CPQ environment?").
   - Once the user explicitly approves in chat, re-invoke the tool with `confirm: true` (e.g. `{"variableName": "...", "confirm": true}`).
