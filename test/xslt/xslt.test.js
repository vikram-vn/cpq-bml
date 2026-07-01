const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { runPreviewXslt, getWebviewContent } = require("../../app/lang/xslt");
const { createFakeVscode, createFakeContext } = require("../rest/testHelpers");

suite("BML REST commands - XSLT Preview", () => {
  let tempXmlPath;
  let tempXsltPath;

  setup(() => {
    tempXmlPath = path.join(__dirname, "temp_test_data.xml");
    tempXsltPath = path.join(__dirname, "temp_test_style.xsl");
    fs.writeFileSync(tempXmlPath, "<root><item>Hello</item></root>");
    fs.writeFileSync(
      tempXsltPath,
      `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
        <xsl:template match="/">
          <html><body><xsl:value-of select="/root/item"/></body></html>
        </xsl:template>
      </xsl:stylesheet>`
    );
  });

  teardown(() => {
    if (fs.existsSync(tempXmlPath)) fs.unlinkSync(tempXmlPath);
    if (fs.existsSync(tempXsltPath)) fs.unlinkSync(tempXsltPath);
  });

  test("getWebviewContent generates HTML with file names", () => {
    const html = getWebviewContent("data.xml", "style.xsl");
    assert.ok(html.includes("data.xml"));
    assert.ok(html.includes("style.xsl"));
    assert.ok(html.includes("XSLTProcessor"));
  });

  test("runPreviewXslt opens Webview and posts content", async () => {
    const context = createFakeContext();
    
    let webviewHtml = "";
    let postedMessage = null;
    let registeredOnDidSaveListener = null;

    const vscode = createFakeVscode({
      window: {
        activeTextEditor: {
          document: {
            languageId: "xml",
            uri: { fsPath: tempXmlPath },
          },
        },
        onDidChangeTextEditorSelection: () => {
          return { dispose: () => {} };
        },
        showOpenDialog: async () => [{ fsPath: tempXsltPath }],
        createWebviewPanel: (viewType, title, showOptions, options) => {
          return {
            webview: {
              set html(val) {
                webviewHtml = val;
              },
              get html() {
                return webviewHtml;
              },
              postMessage: async (msg) => {
                postedMessage = msg;
              },
              onDidReceiveMessage: () => {
                return { dispose: () => {} };
              },
            },
            onDidDispose: () => {},
          };
        },
      },
      workspace: {
        onDidSaveTextDocument: (listener) => {
          registeredOnDidSaveListener = listener;
          return { dispose: () => {} };
        },
      },
    });

    await runPreviewXslt(context, vscode);

    assert.ok(webviewHtml.includes("temp_test_data.xml"));
    assert.ok(webviewHtml.includes("temp_test_style.xsl"));
    assert.ok(postedMessage);
    assert.strictEqual(postedMessage.type, "update");
    assert.ok(postedMessage.xml.includes("<root>"));
    assert.ok(postedMessage.xslt.includes("<xsl:stylesheet"));

    // Verify workspaceState pairing
    const pairXmlKey = `xslt-pair:${tempXmlPath}`;
    const pairXsltKey = `xslt-pair:${tempXsltPath}`;
    assert.strictEqual(context.workspaceState.get(pairXmlKey), tempXsltPath);
    assert.strictEqual(context.workspaceState.get(pairXsltKey), tempXmlPath);
  });

  test("formatXml formats XML/XSLT with indentation and keeps simple tags on a single line", () => {
    const { formatXml } = require("../../app/lang/xslt");
    const unformatted = `<root><item id="1">Hello</item><nested><child>Value</child></nested><empty/></root>`;
    const expected = `<root>
  <item id="1">Hello</item>
  <nested>
    <child>Value</child>
  </nested>
  <empty/>
</root>`;
    assert.strictEqual(formatXml(unformatted), expected);
  });

  test("tryFindLinkedStylesheet detects stylesheet link in XML file", () => {
    const { tryFindLinkedStylesheet } = require("../../app/lang/xslt");
    const xmlWithLinkPath = path.join(__dirname, "temp_test_linked.xml");
    
    fs.writeFileSync(
      xmlWithLinkPath,
      `<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="temp_test_style.xsl"?><root/>`
    );
    
    try {
      const detected = tryFindLinkedStylesheet(xmlWithLinkPath);
      assert.strictEqual(detected, tempXsltPath);
    } finally {
      if (fs.existsSync(xmlWithLinkPath)) fs.unlinkSync(xmlWithLinkPath);
    }
  });

  test("runSwitchXsltFile opens the paired file", async () => {
    const context = createFakeContext();
    context.workspaceState.update(`xslt-pair:${tempXmlPath}`, tempXsltPath);

    let openedDocPath = null;
    const vscode = createFakeVscode({
      window: {
        activeTextEditor: {
          document: {
            uri: { fsPath: tempXmlPath },
          },
        },
        showTextDocument: async (doc) => {
          openedDocPath = doc.uri.fsPath;
        },
      },
      workspace: {
        openTextDocument: async (filePath) => {
          return { uri: { fsPath: filePath } };
        },
      },
    });

    const { runSwitchXsltFile } = require("../../app/lang/xslt");
    await runSwitchXsltFile(context, vscode);

    assert.strictEqual(openedDocPath, tempXsltPath);
  });
});
