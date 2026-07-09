function getWebviewContent(xmlName, xsltName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            font-family: var(--vscode-font-family, sans-serif);
            background-color: var(--vscode-editor-background, #fff);
            color: var(--vscode-editor-foreground, #333);
        }
        #toolbar {
            height: 36px;
            background-color: var(--vscode-sideBar-background, #f3f3f3);
            border-bottom: 1px solid var(--vscode-panel-border, #ccc);
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-size: 0.9rem;
            color: var(--vscode-descriptionForeground, #666);
            overflow: hidden;
            gap: 10px;
        }
        .btn {
            background-color: var(--vscode-button-secondaryBackground, #e1e1e1);
            color: var(--vscode-button-secondaryForeground, #333);
            border: 1px solid var(--vscode-button-border, #ccc);
            padding: 4px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground, #d1d1d1);
        }
        #error-container {
            display: none;
            background-color: var(--vscode-inputValidation-errorBackground, #fde8e8);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #f05252);
            color: var(--vscode-inputValidation-errorForeground, #9b1c1c);
            padding: 15px;
            border-radius: 4px;
            margin: 15px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family, monospace);
        }
        #content-wrapper {
            flex: 1;
            position: relative;
            background: white;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
        }
    </style>
</head>
<body>
    <div id="toolbar">
        <div><strong>XSLT Live Preview</strong></div>
        <button class="btn" onclick="vscode.postMessage({ command: 'switchFile' })">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3.5L1.5 6.5l3 3V7H9V6H4.5V3.5zm7 9L14.5 9.5l-3-3V9H7v1h4.5v2.5z"/></svg>
            Switch File
        </button>
        <button class="btn" onclick="vscode.postMessage({ command: 'refresh' })">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M13.6 2.4C12.2 1 10.2.2 8 .2 3.7.2.2 3.7.2 8s3.5 7.8 7.8 7.8c3.9 0 7.2-2.9 7.7-6.8h-1.1c-.5 3.3-3.3 5.8-6.6 5.8-3.7 0-6.8-3.1-6.8-6.8s3.1-6.8 6.8-6.8c1.9 0 3.6.8 4.8 2.1L10.5 7h5.3V1.7l-2.2 2.2z"/></svg>
            Refresh
        </button>
        <div style="margin-left: auto;">
            XML: <strong>${xmlName}</strong> | XSLT: <strong>${xsltName}</strong>
        </div>
    </div>
    <div id="error-container"></div>
    <div id="content-wrapper">
        <iframe id="preview-iframe"></iframe>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const errorContainer = document.getElementById('error-container');
        const iframe = document.getElementById('preview-iframe');

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                transform(message.xml, message.xslt);
            } else if (message.type === 'highlightSourceLine') {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage(message, '*');
                }
            }
        });

        window.addEventListener('message', event => {
            if (event.source === iframe.contentWindow) {
                vscode.postMessage(event.data);
            }
        });

        const iframeScript = \`
            <script>
                (function() {
                    var hlStyle = document.createElement('style');
                    hlStyle.textContent = '.xslt-preview-line-highlight{outline:3px solid #AB47BC!important;box-shadow:0 0 0 2px rgba(171,71,188,0.45);z-index:2;position:relative;}';
                    if (document.head) document.head.appendChild(hlStyle);
                    var previewLineHighlighted = [];

                    function clearPreviewLineHighlight() {
                        previewLineHighlighted.forEach(function(el) {
                            el.classList.remove('xslt-preview-line-highlight');
                        });
                        previewLineHighlighted = [];
                    }

                    function highlightPreviewForSourceLine(lineNum) {
                        clearPreviewLineHighlight();
                        if (!lineNum || lineNum < 1) return;
                        var els = [];
                        var fallbackLine = lineNum;
                        while (fallbackLine >= 1) {
                            var sel = '[data-source-line="' + String(fallbackLine) + '"]';
                            els = document.querySelectorAll(sel);
                            if (els.length) break;
                            fallbackLine--;
                        }
                        if (!els.length) return;
                        for (var i = 0; i < els.length; i++) {
                            els[i].classList.add('xslt-preview-line-highlight');
                            previewLineHighlighted.push(els[i]);
                        }
                        try {
                            els[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                        } catch (err) {}
                    }

                    window.addEventListener('message', function(e) {
                        var d = e.data;
                        if (d && d.type === 'highlightSourceLine') {
                            if (d.line == null || d.line === '') {
                                clearPreviewLineHighlight();
                                return;
                            }
                            var n = parseInt(d.line, 10);
                            if (isNaN(n)) {
                                clearPreviewLineHighlight();
                                return;
                            }
                            highlightPreviewForSourceLine(n);
                        }
                    });

                    var hoveredEl = null, hoveredParent = null;
                    var tip = document.createElement('div');
                    tip.style.cssText = 'position:fixed;z-index:99999;padding:4px 8px;background:rgba(0,0,0,0.85);color:#fff;font-size:12px;font-family:sans-serif;border-radius:4px;pointer-events:none;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:none;';
                    document.body.appendChild(tip);

                    function showTip(el) {
                        tip.textContent = el.offsetWidth + ' × ' + el.offsetHeight;
                        tip.style.display = 'block';
                        var r = el.getBoundingClientRect();
                        var topVal = r.top - tip.offsetHeight - 4;
                        if (topVal < 8) topVal = r.bottom + 4;
                        tip.style.left = Math.max(4, r.left + (r.width / 2) - (tip.offsetWidth / 2)) + 'px';
                        tip.style.top = topVal + 'px';
                    }

                    function hideTip() { tip.style.display = 'none'; }

                    function clearHover() {
                        if (hoveredEl) { hoveredEl.style.outline = ''; hoveredEl = null; }
                        if (hoveredParent) { hoveredParent.style.outline = ''; hoveredParent = null; }
                        hideTip();
                    }

                    document.addEventListener('mouseover', function(e) {
                        var t = e.target.closest('[data-source-line]');
                        if (!t) return;
                        var parentWithLine = t.parentElement ? t.parentElement.closest('[data-source-line]') : null;
                        clearHover();
                        hoveredEl = t;
                        hoveredParent = parentWithLine;
                        t.style.outline = '2px solid orange';
                        if (parentWithLine) parentWithLine.style.outline = '2px dashed rgba(255,165,0,0.45)';
                        showTip(t);
                    });

                    document.addEventListener('mouseout', function(e) {
                        var t = e.target.closest('[data-source-line]');
                        if (!t) return;
                        var parentWithLine = t.parentElement ? t.parentElement.closest('[data-source-line]') : null;
                        if (e.relatedTarget && (t.contains(e.relatedTarget) || (parentWithLine && parentWithLine.contains(e.relatedTarget)))) return;
                        clearHover();
                    });

                    document.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var target = e.target.closest('[data-source-line]');
                        if (target) {
                            var line = target.getAttribute('data-source-line');
                            window.parent.postMessage({ command: 'jumpToCode', line: line }, '*');
                        }
                    });
                })();
            </script>
        \`;

        function transform(xmlStr, xsltStr) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';

            try {
                const parser = new DOMParser();

                // Parse XML
                const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
                const xmlError = xmlDoc.querySelector('parsererror');
                if (xmlError) {
                    throw new Error('XML Parsing Error:\\n' + xmlError.textContent);
                }

                // Parse XSLT
                const xsltDoc = parser.parseFromString(xsltStr, 'text/xml');
                const xsltError = xsltDoc.querySelector('parsererror');
                if (xsltError) {
                    throw new Error('XSLT Parsing Error:\\n' + xsltError.textContent);
                }

                // Perform Transformation
                const processor = new XSLTProcessor();
                processor.importStylesheet(xsltDoc);

                const resultDoc = processor.transformToDocument(xmlDoc);
                if (!resultDoc) {
                    throw new Error('XSLT Transformation failed (returned null).');
                }

                const isHtml = resultDoc.documentElement && resultDoc.documentElement.nodeName.toLowerCase() === 'html';
                let renderedHtml = '';

                if (isHtml) {
                    renderedHtml = resultDoc.documentElement.outerHTML;
                } else {
                    const serializer = new XMLSerializer();
                    const serialized = serializer.serializeToString(resultDoc);
                    renderedHtml = '<!DOCTYPE html><html><body style="margin:20px;font-family:monospace;white-space:pre-wrap;">' +
                        serialized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                        '</body></html>';
                }

                if (renderedHtml.includes('</body>')) {
                    iframe.srcdoc = renderedHtml.replace('</body>', iframeScript + '</body>');
                } else {
                    iframe.srcdoc = renderedHtml + iframeScript;
                }
            } catch (err) {
                errorContainer.style.display = 'block';
                errorContainer.textContent = err.message;
                iframe.srcdoc = '';
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };
