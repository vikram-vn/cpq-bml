"use strict";
// Fast, Docusaurus-aware offline help viewer.
//
// Replaces the previous `markdown.showPreview` command, which (a) doesn't
// understand the ":::note"/":::warning" admonition syntax used by the
// crawled BML docs - it just prints the literal "::: " text - and (b) pays
// VS Code's built-in Markdown Preview extension's own activation/webview
// startup cost on every single open.
//
// This module renders with markdown-it directly into a single reused
// webview panel: the panel is created once and revealed on subsequent
// opens, and rendered HTML is cached per file (keyed by mtime) so
// re-opening the same doc - e.g. hovering different functions that link
// into the same page - skips re-parsing entirely.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const MarkdownIt = require("markdown-it");
const container = require("markdown-it-container");
const { getNonce, buildCsp } = require("../settingsPanel/html");

const ADMONITIONS = {
    note: { label: "Note", icon: "📝", color: "#448aff" },
    tip: { label: "Tip", icon: "💡", color: "#00bfa5" },
    info: { label: "Info", icon: "ℹ️", color: "#448aff" },
    warning: { label: "Warning", icon: "⚠️", color: "#ffb300" },
    danger: { label: "Danger", icon: "🚫", color: "#e53935" },
};

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

let panel = null;
let md = null;

// Rendered <body> HTML cache, keyed by absolute file path.
// { mtimeMs, body, title } - invalidated whenever the file's mtime changes.
const renderCache = new Map();

function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getMarkdownRenderer() {
    if (md) return md;

    md = new MarkdownIt({ html: false, linkify: true, breaks: false });

    for (const [type, { label, icon }] of Object.entries(ADMONITIONS)) {
        md.use(container, type, {
            render(tokens, idx) {
                if (tokens[idx].nesting === 1) {
                    return `<div class="admonition admonition-${type}"><div class="admonition-heading">${icon} ${escapeHtml(label)}</div><div class="admonition-body">\n`;
                }
                return `</div></div>\n`;
            },
        });
    }

    // Add GitHub/Docusaurus-style slug ids to headings so #fragment
    // navigation (e.g. jumping straight to a specific function) works.
    md.renderer.rules.heading_open = (tokens, idx, options, env, slf) => {
        const inline = tokens[idx + 1];
        const text = inline ? inline.content : "";
        let slug = slugify(text);
        const used = env.usedSlugs;
        const count = used.get(slug) || 0;
        used.set(slug, count + 1);
        if (count > 0) slug = `${slug}-${count}`;
        tokens[idx].attrSet("id", slug);
        return slf.renderToken(tokens, idx, options);
    };

    // Rewrite local image paths (e.g. "images/acos__BML.png") into
    // webview-safe URIs via the resolver supplied per-render through env.
    md.renderer.rules.image = (tokens, idx, options, env, slf) => {
        const token = tokens[idx];
        const src = token.attrGet("src");
        if (src && env.resolveImageUri) {
            token.attrSet("src", env.resolveImageUri(src));
        }
        token.attrSet("alt", slf.renderInlineAsText(token.children, options, env));
        return slf.renderToken(tokens, idx, options);
    };

    return md;
}

function extractTitle(markdownBody, fallback) {
    const m = markdownBody.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : fallback;
}

function renderFile(filePath, webview) {
    const stat = fs.statSync(filePath);
    const cached = renderCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const body = raw.replace(FRONTMATTER_RE, "");
    const title = extractTitle(body, path.basename(filePath, ".md"));

    const resolveImageUri = (src) => {
        if (/^https?:\/\//i.test(src)) return src;
        const abs = path.isAbsolute(src) ? src : path.join(path.dirname(filePath), src);
        try {
            return webview.asWebviewUri(vscode.Uri.file(abs)).toString();
        } catch {
            return src;
        }
    };

    const renderer = getMarkdownRenderer();
    const html = renderer.render(body, { usedSlugs: new Map(), resolveImageUri });

    const result = { mtimeMs: stat.mtimeMs, html, title };
    renderCache.set(filePath, result);
    return result;
}

const STYLE = `
body {
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    padding: 24px 32px 64px;
    line-height: 1.6;
    max-width: 900px;
    margin: 0 auto;
}
h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 1.6em; margin-bottom: 0.5em; }
h1 { font-size: 1.8em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
h2 { font-size: 1.4em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.2em; }
a { color: var(--vscode-textLink-foreground); }
a:hover { color: var(--vscode-textLink-activeForeground); }
code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textCodeBlock-background);
    padding: 0.1em 0.35em;
    border-radius: 3px;
}
pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
}
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid var(--vscode-panel-border); padding: 6px 10px; text-align: left; }
th { background: var(--vscode-textCodeBlock-background); }
blockquote {
    margin: 0.8em 0;
    padding: 0.2em 1em;
    border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-panel-border));
    background: var(--vscode-textBlockQuote-background, transparent);
}
img { max-width: 100%; border-radius: 4px; }
hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 2em 0; }
.admonition {
    margin: 1em 0;
    border-radius: 6px;
    border: 1px solid var(--admonition-color);
    border-left-width: 4px;
    overflow: hidden;
}
.admonition-heading {
    font-weight: 600;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--admonition-color) 18%, var(--vscode-editor-background));
}
.admonition-body { padding: 4px 14px 10px; }
.admonition-body p:first-child { margin-top: 0.4em; }
${Object.entries(ADMONITIONS).map(([type, { color }]) => `.admonition-${type} { --admonition-color: ${color}; }`).join("\n")}
`;

function buildHtml(webview, rendered, fragment) {
    const nonce = getNonce();
    const csp = buildCsp(nonce, webview.cspSource);
    const scrollScript = fragment
        ? `<script nonce="${nonce}">window.addEventListener('load', () => { document.getElementById(${JSON.stringify(fragment)})?.scrollIntoView(); });</script>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(rendered.title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
${rendered.html}
${scrollScript}
</body>
</html>`;
}

/**
 * Open (or reveal + update) the shared help preview panel for a given
 * Markdown file, scrolling to `fragment` (a heading slug) if provided.
 */
function openHelpTopic(context, filePath, fragment) {
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`Help topic not found: ${filePath}`);
        return;
    }

    if (!panel) {
        panel = vscode.window.createWebviewPanel(
            "cpqBmlHelp",
            "BML Offline Help",
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "app", "knowledge"))],
            }
        );
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "app", "images", "logo.png");
        panel.onDidDispose(() => {
            panel = null;
        });
        // Cached HTML embeds asWebviewUri() links tied to this specific
        // webview instance's origin; a freshly created panel gets a new
        // origin, so any cache from a prior (now-disposed) panel is stale.
        renderCache.clear();
    } else {
        panel.reveal(vscode.ViewColumn.Beside, true);
    }

    const rendered = renderFile(filePath, panel.webview);
    panel.title = rendered.title;
    panel.webview.html = buildHtml(panel.webview, rendered, fragment);
}

module.exports = { openHelpTopic };
