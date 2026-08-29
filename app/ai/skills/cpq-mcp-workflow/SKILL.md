---
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
1. `pull`: Pull BML from the environment (`pull_function`).
2. `edit`: Edit the BML AI working copy.
3. `lint`/`validate`: Verify the BML syntax (`lint_function`, `validate_function`).
4. `debug`: Test execution remotely (`debug_function` - supports `printOnly: true` to inspect debug print output only).
5. `save`/`deploy`: Save and deploy to the CPQ environment (`save_function`, `deploy_function`).
