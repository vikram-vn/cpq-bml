// MCP and AI related message handlers for the CPQ Settings Webview

async function handleMcpMessage(type, _message, context, vscode, CPQ_SECTION, post, sendState) {
  switch (type) {
    case "getMcpHealth": {
      let healthy = false;
      let port = 47821;
      try {
        const { getMcpServerStatus } = require("@/lang/mcp/server");
        const status = getMcpServerStatus();
        healthy = !!status.running;
        port = status.port || port;
      } catch {
        const cfg = vscode.workspace.getConfiguration(CPQ_SECTION);
        healthy = cfg.get("mcp.enable", false);
        port = cfg.get("mcp.port", 47821);
      }
      post({ type: "mcpHealth", healthy, port });
      return true;
    }

    case "getAiToolsStatus": {
      const { getAiToolsStatus } = require("@/ai/setup/mcpAutoRegister");
      const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;
      post({ type: "aiToolsStatus", tools: getAiToolsStatus(wsRoot) });
      return true;
    }

    case "getMcpTraffic": {
      const { getMcpTraffic } = require("@/lang/mcp/traffic");
      post({ type: "mcpTraffic", traffic: getMcpTraffic() });
      return true;
    }

    case "clearMcpTraffic": {
      const { clearMcpTraffic } = require("@/lang/mcp/traffic");
      clearMcpTraffic();
      post({ type: "mcpTraffic", traffic: [] });
      post({ type: "toast", message: "MCP traffic history cleared" });
      return true;
    }

    case "runAiDiagnostics": {
      const checks = [];
      let overall = "healthy";

      // 1. MCP Server Status
      const { getMcpServerStatus } = require("@/lang/mcp/server");
      const mcpStatus = getMcpServerStatus();
      if (mcpStatus.running) {
        checks.push({
          name: "Local MCP Server",
          status: "pass",
          detail: `Bound to 127.0.0.1:${mcpStatus.port}`,
        });
      } else {
        overall = "warning";
        checks.push({
          name: "Local MCP Server",
          status: "warn",
          detail: "Server stopped. Enable MCP Server to activate local tool execution.",
        });
      }

      // 2. CPQ Site URL & Authentication
      const cpqConfig = vscode.workspace.getConfiguration(CPQ_SECTION);
      const siteUrl = cpqConfig.get("connection.siteUrl", "");
      if (siteUrl && siteUrl.trim()) {
        checks.push({
          name: "CPQ Environment",
          status: "pass",
          detail: `Configured for ${siteUrl.trim()}`,
        });
      } else {
        checks.push({
          name: "CPQ Environment",
          status: "warn",
          detail: "Site URL not configured yet. Offline BML tools remain active.",
        });
      }

      // 3. Metadata Attribute Cache
      const { getWorkspaceRoot, getMetadataStatus } = require("@/lang/rest/commerceAttributes");
      const wsRoot = getWorkspaceRoot(vscode);
      const meta = getMetadataStatus(context, wsRoot, vscode);
      if (meta && meta.isSynced) {
        checks.push({
          name: "Synced Attributes",
          status: "pass",
          detail: `${meta.commerceCount || 0} commerce, ${meta.configCount || 0} config attributes cached`,
        });
      } else {
        checks.push({
          name: "Synced Attributes",
          status: "warn",
          detail: "No metadata synced. Run 'Sync Metadata' to unlock offline attribute lookups.",
        });
      }

      // 4. Native AI Client Registrations
      const { getAiToolsStatus } = require("@/ai/setup/mcpAutoRegister");
      const aiTools = getAiToolsStatus(wsRoot);
      const configuredCount = aiTools.filter((t) => t.registered).length;
      const detectedCount = aiTools.filter((t) => t.installed).length;
      if (configuredCount > 0) {
        checks.push({
          name: "AI Desktop Apps",
          status: "pass",
          detail: `${configuredCount} active AI client(s) configured (${detectedCount} detected)`,
        });
      } else if (detectedCount > 0) {
        checks.push({
          name: "AI Desktop Apps",
          status: "warn",
          detail: `${detectedCount} AI client(s) detected. Click 'Register MCP' to connect them.`,
        });
      } else {
        checks.push({
          name: "AI Desktop Apps",
          status: "warn",
          detail: "No native AI clients detected. Standard MCP endpoint available for custom clients.",
        });
      }

      post({ type: "aiDiagnosticsResult", overall, checks });
      return true;
    }

    case "registerMcp": {
      const { registerMcpWithAllTools } = require("@/ai/setup/mcpAutoRegister");
      const cpqConfig = vscode.workspace.getConfiguration(CPQ_SECTION);
      const port = cpqConfig.get("mcp.port", 47821);
      const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;
      const { registered, skipped, errors } = registerMcpWithAllTools(port, wsRoot);
      const msg = registered.length > 0
        ? `Registered with ${registered.length} AI tool(s): ${registered.join(", ")} (Skipped ${skipped.length} not found)`
        : `No native AI tool configs found on machine (Skipped ${skipped.length})`;
      post({ type: "toast", message: msg });
      post({
        type: "mcpActionResult",
        action: "register",
        registered,
        skipped,
        errors,
        port,
      });
      await sendState();
      return true;
    }

    case "deregisterMcp": {
      const { deregisterMcpFromAllTools } = require("@/ai/setup/mcpAutoRegister");
      const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;
      const { deregistered, errors } = deregisterMcpFromAllTools(wsRoot);
      const msg = deregistered.length > 0
        ? `Deregistered MCP from: ${deregistered.join(", ")}`
        : `No registered MCP configurations were found to remove.`;
      post({ type: "toast", message: msg });
      post({
        type: "mcpActionResult",
        action: "deregister",
        deregistered,
        errors,
      });
      await sendState();
      return true;
    }

    case "syncBmlSkills": {
      const { syncGlobalAgySkills } = require("@/ai/setup/globalSkillSync");
      const { synced, errors } = syncGlobalAgySkills(context.extensionPath);
      const msg = errors.length === 0
        ? `Successfully synced ${synced} BML skills to IDE.`
        : `Synced ${synced} BML skills with ${errors.length} warnings.`;
      post({ type: "toast", message: msg });
      post({
        type: "bmlSkillsSyncResult",
        success: errors.length === 0,
        synced,
        errors,
      });
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handleMcpMessage };
