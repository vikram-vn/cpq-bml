const assert = require("assert");
const fs = require("fs");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../test-helpers");
const { baseVscodeConfig, makeContext, withTempDir } = require("./fixtures");

suite("BML REST commands - scaffold", () => {
  test("creates utility BML function with boilerplate template and sidecar metadata", () =>
    withTempDir(async (tmpDir) => {
      const inputs = [
        "testUtil", // variableName
        "Test Util Custom", // displayName
        "My util description", // description
      ];
      let inputIdx = 0;

      const pickSequence = [
        { label: "Utility Library Function", id: "util" }, // Type pick
        { label: "Float", description: "Returns a floating point decimal" } // Return type pick
      ];
      let pickIdx = 0;

      const openedDocuments = [];
      const shownDocuments = [];
      const infos = [];

      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        window: {
          showQuickPick: async (items) => {
            const expectedPick = pickSequence[pickIdx++];
            return items.find((item) => item.label === expectedPick.label);
          },
          showInputBox: async (options) => {
            // If it suggests a display name and we are on that step
            if (options.value && inputIdx === 1) {
              assert.strictEqual(options.value, "Test Util");
            }
            return inputs[inputIdx++];
          },
          showInformationMessage: (msg) => {
            infos.push(msg);
          }
        }
      });

      // Stub workspace functions
      vscode.workspace.openTextDocument = async (filePath) => {
        openedDocuments.push(filePath);
        return { uri: { fsPath: filePath } };
      };
      vscode.window.showTextDocument = async (doc) => {
        shownDocuments.push(doc.uri.fsPath);
      };

      await commands.runCreateBmlFunction(makeContext(), vscode);

      assert.strictEqual(inputIdx, 3, "Should have requested all inputs");
      assert.strictEqual(pickIdx, 2, "Should have requested all pick lists");

      const bmlPath = path.join(
        tmpDir,
        "library",
        "testUtil",
        "testUtil.bml"
      );
      const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

      // Verify file exists
      assert.ok(fs.existsSync(bmlPath), "BML file should be created");
      assert.ok(fs.existsSync(metaPath), "Metadata file should be created");

      // Verify file contents
      const scriptContent = fs.readFileSync(bmlPath, "utf8");
      assert.strictEqual(scriptContent, "return 0.0;");

      const metaContent = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      assert.strictEqual(metaContent.name, "Test Util Custom");
      assert.strictEqual(metaContent.variableName, "testUtil");
      assert.strictEqual(metaContent.description, "My util description");
      assert.strictEqual(metaContent.folderName, "");
      assert.deepStrictEqual(metaContent.returnType, { value: 2, displayValue: "Float" });
      assert.deepStrictEqual(metaContent.parameters, []);

      // Verify IDE integration
      assert.strictEqual(openedDocuments.length, 1);
      assert.strictEqual(openedDocuments[0], bmlPath);
      assert.strictEqual(shownDocuments.length, 1);
      assert.strictEqual(shownDocuments[0], bmlPath);
      assert.ok(infos[0].includes("created function \"testUtil\" successfully"));
    }));

  test("creates commerce BML function with boilerplate template and sidecar metadata", () =>
    withTempDir(async (tmpDir) => {
      const inputs = [
        "calculatePricing", // variableName
        "Calculate Pricing", // displayName
        "My commerce description", // description
      ];
      let inputIdx = 0;

      const pickSequence = [
        { label: "Commerce Library Function", id: "commerce" }, // Type pick
        { label: "Boolean", description: "Returns true/false" } // Return type pick
      ];
      let pickIdx = 0;

      const openedDocuments = [];
      const shownDocuments = [];
      const infos = [];

      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        window: {
          showQuickPick: async (items) => {
            const expectedPick = pickSequence[pickIdx++];
            return items.find((item) => item.label === expectedPick.label);
          },
          showInputBox: async (options) => {
            return inputs[inputIdx++];
          },
          showInformationMessage: (msg) => {
            infos.push(msg);
          }
        }
      });

      // Stub workspace functions
      vscode.workspace.openTextDocument = async (filePath) => {
        openedDocuments.push(filePath);
        return { uri: { fsPath: filePath } };
      };
      vscode.window.showTextDocument = async (doc) => {
        shownDocuments.push(doc.uri.fsPath);
      };

      await commands.runCreateBmlFunction(makeContext(), vscode);

      assert.strictEqual(inputIdx, 3, "Should have requested all inputs");
      assert.strictEqual(pickIdx, 2, "Should have requested all pick lists");

      const bmlPath = path.join(
        tmpDir,
        "library",
        "oraclecpqo",
        "transaction",
        "libraries",
        "calculatePricing",
        "calculatePricing.bml"
      );
      const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

      // Verify file exists
      assert.ok(fs.existsSync(bmlPath), "BML file should be created");
      assert.ok(fs.existsSync(metaPath), "Metadata file should be created");

      // Verify file contents
      const scriptContent = fs.readFileSync(bmlPath, "utf8");
      assert.strictEqual(scriptContent, "return false;");

      const metaContent = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      assert.strictEqual(metaContent.name, "Calculate Pricing");
      assert.strictEqual(metaContent.variableName, "calculatePricing");
      assert.strictEqual(metaContent.description, "My commerce description");
      assert.strictEqual(metaContent.commerceProcess, "oraclecpqo");
      assert.strictEqual(metaContent.commerceDocument, "transaction");
      assert.deepStrictEqual(metaContent.returnType, { value: 4, displayValue: "Boolean" });
      assert.deepStrictEqual(metaContent.parameters, []);

      // Verify IDE integration
      assert.strictEqual(openedDocuments.length, 1);
      assert.strictEqual(openedDocuments[0], bmlPath);
      assert.strictEqual(shownDocuments.length, 1);
      assert.strictEqual(shownDocuments[0], bmlPath);
      assert.ok(infos[0].includes("created function \"calculatePricing\" successfully"));
    }));
});
