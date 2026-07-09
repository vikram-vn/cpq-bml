const assert = require("assert");
const { TAB_LABELS, titleForTab } = require("../../app/lang/settings-panel/tabTitles");

suite("settings-panel tabTitles", () => {
  test("returns a CPQ-BML prefixed title for each known tab", () => {
    for (const [tab, label] of Object.entries(TAB_LABELS)) {
      assert.strictEqual(titleForTab(tab), `CPQ-BML: ${label}`);
    }
  });

  test("falls back to the connection tab's title for an unknown tab", () => {
    assert.strictEqual(titleForTab("notARealTab"), `CPQ-BML: ${TAB_LABELS.connection}`);
    assert.strictEqual(titleForTab(undefined), `CPQ-BML: ${TAB_LABELS.connection}`);
  });
});
