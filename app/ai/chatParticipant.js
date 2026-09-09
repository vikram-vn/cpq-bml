const vscode = require('vscode');
const { auditBmlCode } = require('../lang/mcp/tools/audit');
const { lookupCommerceAttribute } = require('../lang/mcp/tools/lookup');

/**
 * Registers the native VS Code Copilot Chat participant '@bml' (id: cpqBml.bmlAssistant).
 * Supports slash commands: /bmql, /audit, /attr
 */
function registerChatParticipant(context) {
    if (!vscode.chat || typeof vscode.chat.createChatParticipant !== 'function') {
        return;
    }

    try {
        const handler = async (request, chatContext, stream, token) => {
            const command = request.command;
            const prompt = request.prompt.trim();

            if (command === 'audit') {
                stream.progress('Auditing BML code for security and performance issues...');
                const editor = vscode.window.activeTextEditor;
                const codeToAudit = prompt || (editor ? editor.document.getText() : '');

                if (!codeToAudit) {
                    stream.markdown('Please open a `.bml` file or provide code after `/audit` to inspect.');
                    return { metadata: { command: 'audit' } };
                }

                const result = auditBmlCode({ code: codeToAudit });
                stream.markdown(`### BML Security & Quality Score: **${result.score}/100**\n\n`);
                stream.markdown(`**Summary**: ${result.summary}\n\n`);

                if (result.issues && result.issues.length > 0) {
                    stream.markdown(`| Severity | Line | Issue | Recommendation |\n| :--- | :--- | :--- | :--- |\n`);
                    for (const issue of result.issues) {
                        const icon = issue.severity === 'CRITICAL' ? '🛑' : '⚠️';
                        stream.markdown(`| ${icon} ${issue.severity} | L${issue.line} | **${issue.type}**: ${issue.message} | ${issue.suggestion} |\n`);
                    }
                } else {
                    stream.markdown('✅ **Great job!** No BMQL injection, queries in loops, or memory anti-patterns found.\n');
                }
                return { metadata: { command: 'audit' } };
            }

            if (command === 'bmql') {
                stream.progress('Generating parameterized BMQL query...');
                stream.markdown(`### Oracle CPQ Parameterized BMQL Template\n\n`);
                stream.markdown(`When writing BMQL, always use parameterized \`$variables\` to ensure performance and prevent injection:\n\n`);
                stream.markdown(`\`\`\`bml\n// Parameterized BMQL Query for: ${prompt || 'Data Table Lookup'}\n`);
                stream.markdown(`recordSet = bmql("SELECT column_1, column_2 FROM DataTableName WHERE filter_column = $myVariable ORDER BY column_1 ASC");\n\n`);
                stream.markdown(`for record in recordSet {\n    val1 = get(record, "column_1");\n    val2 = get(record, "column_2");\n    // Process record...\n}\n\`\`\`\n\n`);
                stream.markdown(`> **Best Practice**: Never concatenate strings with \`+\` in the query string.`);
                return { metadata: { command: 'bmql' } };
            }

            if (command === 'attr') {
                stream.progress(`Looking up CPQ attribute: ${prompt}...`);
                if (!prompt) {
                    stream.markdown('Please provide an attribute variable name to look up: `@bml /attr <variableName>`');
                    return { metadata: { command: 'attr' } };
                }

                const result = await lookupCommerceAttribute(context, vscode, { variableName: prompt });
                if (result && result.success && result.attribute) {
                    const attr = result.attribute;
                    stream.markdown(`### Attribute: \`${attr.variableName}\`\n\n`);
                    stream.markdown(`- **Label**: ${attr.name || attr.label || 'N/A'}\n`);
                    stream.markdown(`- **Data Type**: \`${attr.dataType || 'string'}\`\n`);
                    stream.markdown(`- **Document**: \`${attr.document || 'transaction'}\`\n`);
                    if (attr.lookups && attr.lookups.length > 0) {
                        stream.markdown(`\n**Lookup Values (${attr.lookups.length})**:\n`);
                        stream.markdown(attr.lookups.slice(0, 10).map(l => `- \`${l.value}\` (${l.label})`).join('\n'));
                        if (attr.lookups.length > 10) {
                            stream.markdown(`\n*...and ${attr.lookups.length - 10} more.*`);
                        }
                    }
                } else {
                    stream.markdown(`Attribute \`${prompt}\` was not found in the local synced metadata cache. Run **Sync Metadata** in CPQ Settings to refresh.`);
                }
                return { metadata: { command: 'attr' } };
            }

            // Default general BML question handler
            stream.progress('Analyzing CPQ BML guidelines...');
            stream.markdown(`Hello! I am your **CPQ-BML Assistant**. I can help you write, debug, and optimize Oracle CPQ BML scripts.\n\n`);
            stream.markdown(`### Available Slash Commands:\n`);
            stream.markdown(`- \`@bml /audit\` — Scan active BML editor for security vulnerabilities and loop queries.\n`);
            stream.markdown(`- \`@bml /bmql <goal>\` — Generate safe parameterized BMQL queries.\n`);
            stream.markdown(`- \`@bml /attr <name>\` — Look up attribute data type and menu values from metadata.\n\n`);
            stream.markdown(`You asked: *${prompt || 'How can I assist you with CPQ BML today?'}*`);
            return { metadata: { command: 'default' } };
        };

        const participant = vscode.chat.createChatParticipant('cpqBml.bmlAssistant', handler);
        participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'app', 'icons', 'logo.png');
        context.subscriptions.push(participant);
    } catch (e) {
        console.warn('CPQ-BML: Failed to register chat participant:', e);
    }
}

module.exports = { registerChatParticipant };
