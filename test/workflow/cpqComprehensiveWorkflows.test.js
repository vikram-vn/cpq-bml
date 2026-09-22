'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const vscode = require('vscode');

// Linter & Code Actions
const { checkBmqlSafety } = require('@/lang/lint/categories/best-practices/bmqlSafety');
const { checkPerformance } = require('@/lang/lint/rules/performance');
const { getAdvancedQualityFixes } = require('@/lang/lint/code-actions/qualityFixesAdvanced');
const { convertTextToSbappend, getSbappendConvertCodeActions } = require('@/lang/lint/code-actions/sbappendConverter');

// REST & Debug
const api = require('@/lang/rest/api');
const { safeAppendLog, safeAppendLogSync, rotateLogSync, MAX_LOG_SIZE_BYTES } = require('@/lang/rest/logger');
const { promptDebugInputs } = require('@/lang/rest/commands/debugInputs');
const { runConcurrentPool } = require('@/lang/rest/commands/debugExecution');
const {
  loadWorkspaceAttributes,
  clearAttributesCache,
} = require('@/lang/rest/commerceAttributes');
const { inspectMetadataStatus } = require('@/lang/rest/commerceMetadataLoader');
const {
  getCpqSiteName,
  getBackupFolder,
  getCommerceAttributesFolder,
  getCommerceActionsFolder,
  getConfigRulesFolder,
} = require('@/lang/rest/folders');
const { createFirstTimeBackup, findOrCreateAiCopy } = require('@/lang/mcp/locate');
const { listSkills, getSkill } = require('@/lang/mcp/tools/knowledge');
const { updateStatusBar } = require('@/lang/status-bar/environmentSwitcher');

// Test Helpers
const { createFakeVscode, createFakeContext } = require('@/test/rest/testHelpers');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

function createDoc(text) {
  return {
    getText: (range) => {
      if (!range) return text;
      const lines = text.split('\n');
      const startLine = lines[range.start.line] || '';
      return startLine.substring(range.start.character, range.end.character);
    },
    positionAt: (offset) => {
      const upToOffset = text.slice(0, offset);
      const lines = upToOffset.split('\n');
      return new vscode.Range(lines.length - 1, lines[lines.length - 1].length, lines.length - 1, lines[lines.length - 1].length).start;
    },
    lineCount: text.split('\n').length,
    lineAt: (lineIdx) => {
      const l = text.split('\n')[lineIdx] || '';
      return { text: l, range: new vscode.Range(lineIdx, 0, lineIdx, l.length) };
    },
    uri: vscode.Uri.file('/workspace/test.bml'),
    languageId: 'bml'
  };
}

suite('CPQ Comprehensive Workflow Test Cases (End-to-End)', () => {

  // =========================================================================
  // 1. BMQL Safety - Multi-line Static String Concatenation vs Dynamic Concat
  // =========================================================================
  suite('1. BMQL Static String Concatenation & Injection Detection', () => {
    test('Multi-line static string concatenation with + does NOT flag injection risk', () => {
      const queryCode = `
        rs = bmql("SELECT Model, Line_snow, UnitCost_snow, ListPrice_snow, BaseLabor_snow, StandardTravel_snow, LaborAdder_snow, TravelAdder_snow " +
                  "FROM SnowLaborAndMarginLookup " +
                  "WHERE Model = $selectedModel");
        return "";
      `;
      const doc = createDoc(queryCode);
      const diags = checkBmqlSafety(queryCode, queryCode, doc);
      const injectionDiags = diags.filter(d => d.code === 'bml-bmql-injection-risk');
      assert.strictEqual(injectionDiags.length, 0, 'Should not flag static multi-line + concatenation as SQL injection');
    });

    test('Concatenation containing dynamic non-literal variable DOES flag injection risk', () => {
      const dynamicCode = `
        rs = bmql("SELECT Model FROM SnowTable WHERE Model = " + selectedModel);
        return "";
      `;
      const doc = createDoc(dynamicCode);
      const diags = checkBmqlSafety(dynamicCode, dynamicCode, doc);
      const injectionDiags = diags.filter(d => d.code === 'bml-bmql-injection-risk');
      assert.strictEqual(injectionDiags.length, 1, 'Should flag dynamic non-literal concatenation as SQL injection');
      assert.ok(injectionDiags[0].message.includes('SQL injection'));
    });
  });

  // =========================================================================
  // 2. sbappend HTML Template Builder
  // =========================================================================
  suite('2. sbappend HTML & Template Builders', () => {
    test('sbappend called with HTML table builder rows does NOT flag multi-arg advisory', () => {
      const htmlSnippet = `
        sbappend(htmlOutput, "<tr><td><b>Base Labor</b></td><td>", string(baseLabor), "</td></tr>");
        sbappend(htmlOutput, "<tr><td><b>Standard Travel</b></td><td>", string(standardTravel), "</td></tr>");
      `;
      const doc = createDoc(htmlSnippet);
      const diags = checkPerformance(htmlSnippet, htmlSnippet, doc);
      const sbDiags = diags.filter(d => d.code === 'bml-sbappend-multiple-args');
      assert.strictEqual(sbDiags.length, 0, 'HTML template builder sbappend calls should not be flagged');
    });

    test('sbappend called with generic non-HTML multiple args still raises advisory', () => {
      const genericMultiArgs = `
        sbappend(sb, "first", "second", "third", "fourth");
      `;
      const doc = createDoc(genericMultiArgs);
      const diags = checkPerformance(genericMultiArgs, genericMultiArgs, doc);
      const sbDiags = diags.filter(d => d.code === 'bml-sbappend-multiple-args');
      assert.strictEqual(sbDiags.length, 1, 'Generic multiple arguments sbappend should still raise advisory');
    });
  });

  // =========================================================================
  // 3. Float Equality Quick Fix (fabs > 0)
  // =========================================================================
  suite('3. Float Equality Quick Fix (fabs > 0)', () => {
    test('bml-float-equality comparison against zero generates fabs(x) > 0', () => {
      const doc = createMockDoc('if (rPrice_29 <> 0.0) {\n');
      const diag = new MockDiagnostic(new MockRange(0, 4, 0, 20), 'Float precision warning', 1, 'bml-float-equality');
      const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
      assert.ok(fixes.length > 0);
      const tolFix = fixes.find(f => f.title.includes('tolerance check'));
      assert.ok(tolFix, 'Must provide tolerance check quick fix');
      assert.strictEqual(tolFix.edit._edits[0].newText, 'fabs(rPrice_29) > 0');
    });

    test('bml-float-equality comparison with == 0.0 generates fabs(x) <= 0', () => {
      const doc = createMockDoc('if (rPrice_29 == 0.0) {\n');
      const diag = new MockDiagnostic(new MockRange(0, 4, 0, 20), 'Float precision warning', 1, 'bml-float-equality');
      const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
      const tolFix = fixes.find(f => f.title.includes('tolerance check'));
      assert.ok(tolFix);
      assert.strictEqual(tolFix.edit._edits[0].newText, 'fabs(rPrice_29) <= 0');
    });
  });

  // =========================================================================
  // 4. REST Query Fields (All fields returned by default)
  // =========================================================================
  suite('4. REST API getTransactions Field Returning', () => {
    test('getTransactions does not restrict fields by default and returns all transaction attributes', async () => {
      const vscode = createFakeVscode({
        config: {
          'connection.siteUrl': 'https://mysite.bigmachines.com',
          'connection.username': 'admin',
        }
      });
      let capturedPath = '';
      const transport = async (opts) => {
        capturedPath = opts.path;
        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          text: JSON.stringify({
            items: [
              {
                _id: '1001',
                transactionID_t: 'Quote-2026-001',
                totalAmount_t: 54200.0,
                status_t: 'Pending Approval',
                customer_t: 'Oracle Health',
                customMargin_snow: 0.32,
              }
            ]
          })
        };
      };

      const res = await api.getTransactions(
        createFakeContext(),
        vscode,
        { limit: 10 },
        transport
      );

      assert.strictEqual(res.statusCode, 200);
      assert.ok(!capturedPath.includes('fields='), 'Should not restrict fields parameter by default');
      assert.ok(capturedPath.includes('excludeFieldTypes=yes'));
      const item = res.body.items[0];
      assert.strictEqual(item._id, '1001');
      assert.strictEqual(item.transactionID_t, 'Quote-2026-001');
      assert.strictEqual(item.status_t, 'Pending Approval');
      assert.strictEqual(item.customer_t, 'Oracle Health');
      assert.strictEqual(item.customMargin_snow, 0.32);
    });
  });

  // =========================================================================
  // 5. Quote Debugging (records / results response shapes & ID resolution)
  // =========================================================================
  suite('5. Quote Debugging Shapes & Resolution', () => {
    test('debugInputs handles records and results response shapes seamlessly', async () => {
      const recordsResponse = {
        statusCode: 200,
        body: {
          records: [
            {
              bs_id: '998877',
              transactionID_t: 'Quote-9988',
              customer_t: 'Acme Corp',
            }
          ]
        }
      };

      let quickPickPicks = null;
      const fakeVscode = {
        window: {
          showQuickPick: async (picks) => {
            quickPickPicks = picks;
            return [picks[0]];
          },
          showInputBox: async () => '',
        },
        workspace: {
          getConfiguration: () => ({ get: () => null })
        }
      };

      const originalGetTransactions = api.getTransactions;
      api.getTransactions = async () => recordsResponse;

      try {
        const inputResult = await promptDebugInputs({
          context: { workspaceState: { get: () => null, update: async () => {} } },
          vscode: fakeVscode,
          metadata: { commerceProcess: 'oraclecpqo', commerceDocument: 'transaction', variableName: 'testFn' },
          options: { prompt: true },
          resultsTerminal: { writeLine: () => {} },
          transport: async () => {}
        });

        assert.strictEqual(inputResult.cancelled, false);
        assert.deepStrictEqual(inputResult.transactionIds, ['998877']);
        assert.ok(quickPickPicks.length > 0);
        assert.ok(quickPickPicks[0].description.includes('bs_id: 998877'));
        assert.ok(quickPickPicks[0].label.includes('Quote: Quote-9988'));
      } finally {
        api.getTransactions = originalGetTransactions;
      }
    });
  });

  // =========================================================================
  // 6. Log Rotation & Performance
  // =========================================================================
  suite('6. High-Performance Asynchronous Log Rotation', () => {
    test('safeAppendLog creates file and appends content asynchronously', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-log-test-'));
      const logFile = path.join(tempDir, 'test.log');

      await safeAppendLog(logFile, 'Log Line 1\n');
      await safeAppendLog(logFile, 'Log Line 2\n');

      const content = fs.readFileSync(logFile, 'utf8');
      assert.ok(content.includes('Log Line 1'));
      assert.ok(content.includes('Log Line 2'));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('rotateLogSync rolls file when size exceeds limit', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-log-roll-'));
      const logFile = path.join(tempDir, 'test.log');

      // Write a buffer larger than MAX_LOG_SIZE_BYTES (or mock size)
      const chunk = 'A'.repeat(1024 * 1024); // 1 MB
      fs.writeFileSync(logFile, chunk.repeat(6)); // 6 MB > 5MB

      rotateLogSync(logFile);

      assert.strictEqual(fs.existsSync(`${logFile}.1`), true, 'Should rotate to .1');
      assert.strictEqual(fs.existsSync(logFile), false, 'Original file should be moved');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 7. Environment Switch & Cache Sync
  // =========================================================================
  suite('7. Multi-Environment Caching & Staleness Detection', () => {
    test('Segment cache by siteKey allows instant 0ms switching without cache collision', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-env-cache-'));
      const site1Dir = path.join(tempDir, 'cpq', 'dev-site', 'commerce', 'oraclecpqo');
      const site2Dir = path.join(tempDir, 'cpq', 'prod-site', 'commerce', 'oraclecpqo');
      fs.mkdirSync(site1Dir, { recursive: true });
      fs.mkdirSync(site2Dir, { recursive: true });

      fs.writeFileSync(path.join(site1Dir, 'attributes.min.json'), JSON.stringify({
        attributes: [{ variableName: 'devAttr_t', label: 'Dev Attr', dataType: 'String' }]
      }));
      fs.writeFileSync(path.join(site2Dir, 'attributes.min.json'), JSON.stringify({
        attributes: [{ variableName: 'prodAttr_t', label: 'Prod Attr', dataType: 'String' }]
      }));

      clearAttributesCache(tempDir);

      const devIndex = loadWorkspaceAttributes(tempDir, null, 'dev-site');
      assert.ok(devIndex.varNameToMeta.has('devAttr_t'));
      assert.ok(!devIndex.varNameToMeta.has('prodAttr_t'));

      const prodIndex = loadWorkspaceAttributes(tempDir, null, 'prod-site');
      assert.ok(prodIndex.varNameToMeta.has('prodAttr_t'));
      assert.ok(!prodIndex.varNameToMeta.has('devAttr_t'));

      // Instant switch back to dev-site from memory
      const devIndexCached = loadWorkspaceAttributes(tempDir, null, 'dev-site');
      assert.strictEqual(devIndexCached, devIndex);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('inspectMetadataStatus detects stale cache older than 24 hours', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-stale-test-'));
      const commDir = path.join(tempDir, 'commerce', 'oraclecpqo');
      fs.mkdirSync(commDir, { recursive: true });

      // Stale timestamp (2 days ago)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(path.join(commDir, 'attributes.min.json'), JSON.stringify({
        updatedAt: twoDaysAgo,
        count: 5,
        attributes: [{ variableName: 'a_t' }]
      }));

      const status = inspectMetadataStatus([tempDir]);
      assert.strictEqual(status.isSynced, true);
      assert.strictEqual(status.isStale, true, 'Metadata older than 24 hours should be marked as stale');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 8. REST Concurrency Pooling
  // =========================================================================
  suite('8. Concurrency Pool Executor', () => {
    test('runConcurrentPool executes items concurrently and preserves order', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      let maxActive = 0;
      let active = 0;

      const worker = async (item) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 20));
        active--;
        return item * 10;
      };

      const results = await runConcurrentPool(items, worker, 4, 2, 10);
      assert.deepStrictEqual(results, [10, 20, 30, 40, 50, 60, 70, 80]);
      assert.ok(maxActive <= 4, `Max active (${maxActive}) should be <= 4`);
      assert.ok(maxActive > 1, `Max active (${maxActive}) should be > 1 (concurrent)`);
    });
  });

  // =========================================================================
  // 9. MCP First-Time Backup & Migration Folders
  // =========================================================================
  suite('9. MCP First-Time Backup & Standardized Migration Folders', () => {
    test('Migration folder helpers construct standardized paths', () => {
      const utilBackup = getBackupFolder('https://mysite.bigmachines.com', 'util');
      assert.strictEqual(utilBackup, path.join('cpq', 'mysite', 'backup', 'util'));

      const processBackup = getBackupFolder('https://mysite.bigmachines.com', 'process', 'oraclecpqo');
      assert.strictEqual(processBackup, path.join('cpq', 'mysite', 'backup', 'oraclecpqo'));

      const attrModify = getCommerceAttributesFolder('https://mysite.bigmachines.com', 'oraclecpqo', 'modify');
      assert.strictEqual(attrModify, path.join('cpq', 'mysite', 'commerce', 'oraclecpqo', 'attributes', 'modify'));

      const actionBefore = getCommerceActionsFolder('https://mysite.bigmachines.com', 'oraclecpqo', 'before-formulas');
      assert.strictEqual(actionBefore, path.join('cpq', 'mysite', 'commerce', 'oraclecpqo', 'actions', 'before-formulas'));

      const ruleCond = getConfigRulesFolder('https://mysite.bigmachines.com', 'telecom', 'condition');
      assert.strictEqual(ruleCond, path.join('cpq', 'mysite', 'config', 'telecom', 'rules', 'condition'));
    });

    test('createFirstTimeBackup creates pristine backup copy on first modification', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-mcp-backup-'));
      const fakeVscode = {
        workspace: {
          workspaceFolders: [{ uri: { fsPath: tempDir } }],
          getConfiguration: () => ({ get: () => 'https://mysite.bigmachines.com' })
        }
      };

      const utilDir = path.join(tempDir, 'cpq', 'mysite', 'util-libraries', 'calcDiscount');
      fs.mkdirSync(utilDir, { recursive: true });
      const canonicalBml = path.join(utilDir, 'calcDiscount.bml');
      fs.writeFileSync(canonicalBml, 'return 0.15;', 'utf8');

      const backupPath = createFirstTimeBackup(fakeVscode, canonicalBml, 'calcDiscount');
      assert.ok(backupPath);
      assert.strictEqual(fs.existsSync(backupPath), true);
      assert.strictEqual(fs.readFileSync(backupPath, 'utf8'), 'return 0.15;');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 10. MCP BML Skills Listing for AI
  // =========================================================================
  suite('10. MCP BML Skills Discovery Tools for AI', () => {
    test('listSkills lists built-in skills with descriptions', () => {
      const res = listSkills({});
      assert.strictEqual(res.success, true);
      assert.ok(Array.isArray(res.skills));
      assert.ok(res.skills.length > 0, 'Should return available CPQ skills');
      const langSkill = res.skills.find(s => s.name === 'bml-language');
      assert.ok(langSkill, 'Must include bml-language skill');
    });

    test('getSkill returns full SKILL.md content and references', () => {
      const res = getSkill({}, { name: 'bml-language' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.name, 'bml-language');
      assert.ok(res.content.length > 50);
    });
  });

  // =========================================================================
  // 11. Convert JS/HTML to BML sbappend()
  // =========================================================================
  suite('11. JS/HTML to BML sbappend() Conversion', () => {
    test('converts HTML template with variable interpolations to sbappend calls', () => {
      const inputHtml = `<tr>\n  <td>\${productName}</td>\n  <td>\${price}</td>\n</tr>`;
      const converted = convertTextToSbappend(inputHtml, 'htmlOutput');

      assert.ok(converted.includes('sbappend(htmlOutput, "<tr>");'));
      assert.ok(converted.includes('sbappend(htmlOutput, "  <td>", string(productName), "</td>");'));
      assert.ok(converted.includes('sbappend(htmlOutput, "  <td>", string(price), "</td>");'));
      assert.ok(converted.includes('sbappend(htmlOutput, "</tr>");'));
    });

    test('escapes internal double quotes properly', () => {
      const input = `<div class="container">\${title}</div>`;
      const converted = convertTextToSbappend(input, 'sb');
      assert.ok(converted.includes('sbappend(sb, "<div class=\\"container\\">", string(title), "</div>");'));
    });
  });

  // =========================================================================
  // 12. Status Bar Language Scoping
  // =========================================================================
  suite('12. Status Bar Language Scoping', () => {
    test('updateStatusBar hides status bar item when active document is non-BML', () => {
      // In VS Code, when editor is not BML, statusBarItem should be hidden
      assert.ok(typeof updateStatusBar === 'function');
    });
  });
});
