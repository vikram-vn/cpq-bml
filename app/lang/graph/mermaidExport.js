'use strict';

/**
 * Exports dependency graph model to Mermaid flowchart syntax.
 * @param {object} model 
 * @returns {string}
 */
function exportToMermaid(model) {
    if (!model || !model.graph) return 'flowchart LR\n';

    const lines = ['flowchart LR'];
    lines.push('    %% Styling classes');
    lines.push('    classDef focal fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;');
    lines.push('    classDef caller fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#fff;');
    lines.push('    classDef action fill:#ea580c,stroke:#c2410c,stroke-width:2px,color:#fff;');
    lines.push('    classDef callee fill:#0891b2,stroke:#0e7490,stroke-width:2px,color:#fff;');
    lines.push('    classDef table fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;');
    lines.push('    classDef attribute fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;');
    lines.push('    classDef api fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;');
    lines.push('');

    const nodeSanitize = (id) => id.replace(/[^a-zA-Z0-9_]/g, '_');

    for (const node of (model.graph.nodes || [])) {
        const safeId = nodeSanitize(node.id);
        let shapeOpen = '["';
        let shapeClose = '"]';
        let icon = '';

        if (node.type === 'action') { shapeOpen = '{{"'; shapeClose = '"}}'; icon = '⚡ '; }
        else if (node.type === 'attribute') { shapeOpen = '(["'; shapeClose = '"])'; icon = '🏷 '; }
        else if (node.type === 'table') { shapeOpen = '[("'; shapeClose = '")]'; icon = '🗄 '; }
        else if (node.type === 'focal') { shapeOpen = '[["'; shapeClose = '"]]'; icon = '🎯 '; }
        else if (node.type === 'caller') { shapeOpen = '["'; shapeClose = '"]'; icon = '💥 '; }
        else if (node.type === 'callee') { shapeOpen = '["'; shapeClose = '"]'; icon = '📦 '; }
        else if (node.type === 'api') { shapeOpen = '["'; shapeClose = '"]'; icon = '🌐 '; }

        lines.push(`    ${safeId}${shapeOpen}${icon}${node.label}\\n(${node.subtitle})${shapeClose}:::${node.type}`);
    }

    lines.push('');
    for (const edge of (model.graph.edges || [])) {
        const src = nodeSanitize(edge.source);
        const tgt = nodeSanitize(edge.target);
        lines.push(`    ${src} -->|"${edge.label}"| ${tgt}`);
    }

    return lines.join('\n');
}

module.exports = { exportToMermaid };
