const fs = require("fs");
const os = require("os");
const path = require("path");
const config = require("../../../app/lang/rest/config");
const { createFakeContext } = require("../test-helpers");

const SAMPLE_FUNCTION = {
  name: "ConcatString",
  variableName: "concatString",
  description: "Concatenates two strings.",
  folderName: "util",
  scriptText: 'return stringOne + " " + stringTwo;',
  testScript: "",
  useTestScript: false,
  returnType: { value: 1, displayValue: "String" },
  parameters: [
    { name: "stringOne", dataType: { value: 2, displayValue: "String" } },
    { name: "stringTwo", dataType: { value: 2, displayValue: "String" } },
  ],
  libraryFunctions: [],
  attributes: [],
  links: [],
};

function baseVscodeConfig(overrides) {
  return {
    "connection.siteUrl": "https://sitename.oracle.com",
    "connection.username": "alice",
    "rest.pullFolder": "library",
    ...overrides,
  };
}

function makeContext() {
  return createFakeContext({ [config.SECRET_PASSWORD]: "pw" });
}

function withTempDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rest-cmd-test-"));
  return Promise.resolve(fn(tmpDir)).finally(() =>
    fs.rmSync(tmpDir, { recursive: true, force: true }),
  );
}

function fakeResultsTerminal(lines = []) {
  return {
    writeLine: (l) => lines.push(l),
    show: () => {},
  };
}

module.exports = {
  SAMPLE_FUNCTION,
  baseVscodeConfig,
  makeContext,
  withTempDir,
  fakeResultsTerminal,
};
