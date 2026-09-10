const fs = require('fs');
const path = require('path');

/**
 * Parses BML doc comments and generates a modern, searchable
 * static documentation website and Markdown API reference.
 */
class DocSiteGenerator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.functions = [];
  }

  static parseDocBlock(comment) {
    const lines = comment.split('\n');
    let description = '';
    const params = [];
    let returns = null;
    let example = null;

    let inDesc = true;
    for (const rawLine of lines) {
      const line = rawLine.replace(/^\s*\/?\*+\/?\s?/, '').trim();
      if (!line) continue;

      if (line.startsWith('@param')) {
        inDesc = false;
        const match = line.match(/@param\s*(?:\{([^}]+)\})?\s*([a-zA-Z0-9_]+)?\s*(.*)/);
        if (match) {
          params.push({
            type: match[1] || 'Any',
            name: match[2] || 'param',
            desc: match[3] || ''
          });
        }
      } else if (line.startsWith('@return')) {
        inDesc = false;
        const match = line.match(/@return(?:s)?\s*(?:\{([^}]+)\})?\s*(.*)/);
        if (match) {
          returns = {
            type: match[1] || 'Any',
            desc: match[2] || ''
          };
        }
      } else if (line.startsWith('@example')) {
        inDesc = false;
        example = line.replace('@example', '').trim();
      } else if (inDesc) {
        description += (description ? ' ' : '') + line;
      }
    }

    return { description, params, returns, example };
  }

  static parseFunctionSignature(content) {
    // Matches: ReturnType functionName(param1, param2)
    const sigRegex = /(?:^|\n)\s*(String|Integer|Float|Boolean|Date|String\[\]|Integer\[\]|Float\[\]|Boolean\[\]|Date\[\]|dict|json|jsonarray)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;
    const match = sigRegex.exec(content);
    if (match) {
      const paramsList = match[3]
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => {
          const parts = p.split(/\s+/);
          return parts.length >= 2 ? { type: parts[0], name: parts[1] } : { type: 'Any', name: p };
        });

      return {
        returnType: match[1],
        name: match[2],
        params: paramsList
      };
    }
    return null;
  }

  scanWorkspace(dir = this.workspaceRoot) {
    if (!dir || !fs.existsSync(dir)) return;

    const findBml = (target) => {
      const results = [];
      const entries = fs.readdirSync(target, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const full = path.join(target, entry.name);
        if (entry.isDirectory()) {
          results.push(...findBml(full));
        } else if (entry.isFile() && entry.name.endsWith('.bml') && !entry.name.endsWith('.test.bml')) {
          results.push(full);
        }
      }
      return results;
    };

    const files = findBml(dir);
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(this.workspaceRoot, file).replace(/\\/g, '/');
        const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
        const docInfo = docMatch ? DocSiteGenerator.parseDocBlock(docMatch[1]) : null;
        const sig = DocSiteGenerator.parseFunctionSignature(content);

        const name = sig ? sig.name : path.basename(file, '.bml');
        const returnType = sig ? sig.returnType : (docInfo && docInfo.returns ? docInfo.returns.type : 'Any');
        const params = (docInfo && docInfo.params.length > 0) ? docInfo.params : (sig ? sig.params : []);

        const category = relPath.startsWith('util') ? 'util' : (relPath.startsWith('commerce') ? 'commerce' : 'general');

        this.functions.push({
          name,
          category,
          relPath,
          returnType,
          params,
          description: docInfo ? docInfo.description : 'No documentation provided.',
          example: docInfo ? docInfo.example : null,
          hasDoc: Boolean(docInfo)
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  generateHtml() {
    const dataJson = JSON.stringify(this.functions).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CPQ BML Workspace Documentation</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --text: #c9d1d9;
      --heading: #58a6ff;
      --border: #30363d;
      --badge-bg: #21262d;
      --accent: #238636;
      --code-bg: #0b0e14;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    #sidebar { width: 300px; background: var(--card-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .side-header { padding: 16px; border-bottom: 1px solid var(--border); }
    .side-header h2 { font-size: 16px; color: var(--heading); margin-bottom: 8px; }
    #search { width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); outline: none; }
    .func-list { flex: 1; overflow-y: auto; padding: 8px; list-style: none; }
    .func-item { padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 13px; }
    .func-item:hover, .func-item.active { background: #1f242c; }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; background: var(--badge-bg); border: 1px solid var(--border); color: #8b949e; }
    #content { flex: 1; overflow-y: auto; padding: 32px 48px; }
    .doc-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .doc-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
    .doc-title { font-size: 22px; color: var(--heading); font-family: monospace; }
    .return-type { font-size: 14px; color: #7ee787; font-family: monospace; }
    .file-path { font-size: 12px; color: #8b949e; margin-bottom: 16px; }
    .doc-desc { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
    th { color: #8b949e; font-weight: 600; }
    code { font-family: Consolas, monospace; background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    pre { background: var(--code-bg); padding: 12px; border-radius: 6px; border: 1px solid var(--border); overflow-x: auto; font-family: Consolas, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div class="side-header">
      <h2>📖 BML API Docs</h2>
      <input type="text" id="search" placeholder="Search functions..." oninput="filterFuncs()">
    </div>
    <ul class="func-list" id="funcList"></ul>
  </div>
  <div id="content">
    <div id="docViewer">
      <div style="text-align: center; margin-top: 100px; opacity: 0.5;">
        Select a function from the sidebar to view its API documentation.
      </div>
    </div>
  </div>

  <script>
    const functions = ${dataJson};
    let activeName = '';

    function renderList(list) {
      const ul = document.getElementById('funcList');
      ul.innerHTML = list.map(f => \`
        <li class="func-item \${f.name === activeName ? 'active' : ''}" onclick="selectFunc('\${f.name}')">
          <span style="font-family: monospace;">\${f.name}</span>
          <span class="badge">\${f.category}</span>
        </li>
      \`).join('');
    }

    function selectFunc(name) {
      activeName = name;
      const f = functions.find(x => x.name === name);
      if (!f) return;
      renderList(functions);

      const paramsHtml = f.params && f.params.length > 0 ? \`
        <h3>Parameters</h3>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            \${f.params.map(p => \`<tr><td><code>\${p.name}</code></td><td><code>\${p.type}</code></td><td>\${p.desc || '-'}</td></tr>\`).join('')}
          </tbody>
        </table>
      \` : '<p style="font-size:13px; margin-bottom:16px; opacity:0.6;">No parameters required.</p>';

      const exampleHtml = f.example ? \`
        <h3>Example</h3>
        <pre><code>\${f.example}</code></pre>
      \` : '';

      document.getElementById('docViewer').innerHTML = \`
        <div class="doc-card">
          <div class="doc-header">
            <h1 class="doc-title">\${f.name}</h1>
            <span class="return-type">-> \${f.returnType}</span>
          </div>
          <div class="file-path">📁 \${f.relPath}</div>
          <p class="doc-desc">\${f.description}</p>
          \${paramsHtml}
          \${exampleHtml}
        </div>
      \`;
    }

    function filterFuncs() {
      const q = document.getElementById('search').value.toLowerCase();
      const filtered = functions.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
      renderList(filtered);
    }

    renderList(functions);
    if (functions.length > 0) selectFunc(functions[0].name);
  </script>
</body>
</html>`;
  }

  generateMarkdown() {
    let md = `# CPQ BML Workspace API Reference\n\n`;
    md += `*Generated automatically on ${new Date().toISOString().split('T')[0]}*\n\n`;
    md += `## Table of Contents\n\n`;

    for (const f of this.functions) {
      md += `- [${f.name}](#${f.name.toLowerCase()}) \`(${f.returnType})\` - *${f.relPath}*\n`;
    }
    md += `\n---\n\n`;

    for (const f of this.functions) {
      md += `### ${f.name}\n\n`;
      md += `**Signature:** \`${f.returnType} ${f.name}(${f.params.map(p => `${p.type} ${p.name}`).join(', ')})\`\n\n`;
      md += `**Location:** \`${f.relPath}\`\n\n`;
      md += `${f.description}\n\n`;

      if (f.params.length > 0) {
        md += `#### Parameters\n\n`;
        md += `| Name | Type | Description |\n`;
        md += `|---|---|---|\n`;
        for (const p of f.params) {
          md += `| \`${p.name}\` | \`${p.type}\` | ${p.desc || '-'} |\n`;
        }
        md += `\n`;
      }

      if (f.example) {
        md += `#### Example\n\n\`\`\`bml\n${f.example}\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    }

    return md;
  }

  generate(outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const htmlPath = path.join(outputDir, 'index.html');
    const mdPath = path.join(outputDir, 'API.md');

    fs.writeFileSync(htmlPath, this.generateHtml(), 'utf8');
    fs.writeFileSync(mdPath, this.generateMarkdown(), 'utf8');

    const documentedCount = this.functions.filter(f => f.hasDoc).length;
    const totalCount = this.functions.length;
    const percent = totalCount > 0 ? Math.round((documentedCount / totalCount) * 100) : 100;

    return {
      outputDir,
      htmlPath,
      mdPath,
      totalCount,
      documentedCount,
      percent
    };
  }
}

module.exports = { DocSiteGenerator };
