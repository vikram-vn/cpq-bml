const assert = require("assert");
const { lintText } = require("../linter/fixtures");

suite("BML Linter Test Suite - Enhanced Smart Spellchecker Morphology & Vocabulary", () => {
  test("Accepts regular plural and 3rd person inflections (-s, -es, -ies)", () => {
    const diagnostics = lintText(`
      // categories, configurations, deployments, processes, updates, fixes
      categoriesList = ["A", "B"];
      totalDeployments = 5;
      subdocumentCategories = dict();
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accepts past tense and participles (-ed, -d, -ied, double consonants)", () => {
    const diagnostics = lintText(`
      // formatted, processed, deployed, configured, modified, applied, initialized
      isFormatted = true;
      hasDeployed = false;
      appliedDiscount = 0.15;
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accepts present participles and gerunds (-ing, double consonants)", () => {
    const diagnostics = lintText(`
      // formatting, processing, calculating, creating, running, mapping
      isFormattingDone = true;
      processingOrder = true;
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accepts prefixes (re-, un-, pre-, post-, sub-, multi-, auto-)", () => {
    const diagnostics = lintText(`
      // recalculate, unformatted, precalculated, postprocessing, subdocument, multiselect, autocommit
      recalculateDiscount = true;
      subdocumentKey = "DOC123";
      multiselectOption = "val";
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accepts adverbs, agent nouns, and nominals (-ly, -tion, -able, -er, -or, -ment, -ness)", () => {
    const diagnostics = lintText(`
      // automatically, strictly, validator, formatter, parsable, configurable, deployment, readiness
      customValidator = "strict";
      xmlFormatter = "pretty";
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accepts modern developer, cloud, and programming terms", () => {
    const diagnostics = lintText(`
      // async, oauth, jwt, bearer, payload, crud, guid, regex, debounce, throttle, webhook, middleware, devkit, sdk, vsix
      payloadData = json();
      jwtBearerToken = "token";
      apiEndpointUri = "/rest/v17";
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    assert.deepStrictEqual(spellingErrors.map((e) => e.message), []);
  });

  test("Accurately flags real typos despite smart morphology", () => {
    const diagnostics = lintText(`
      // calclate, servcie, hiearchy, struture, proccess, recieved
      calclateTotal = 100;
      servcieStatus = "down";
      return "";
    `);
    const spellingErrors = diagnostics.filter((d) => d.code === "bml-spelling-error");
    const errorMessages = spellingErrors.map((e) => e.message);
    assert.ok(errorMessages.some((msg) => msg.includes("calclate")));
    assert.ok(errorMessages.some((msg) => msg.includes("servcie")));
    assert.ok(errorMessages.some((msg) => msg.includes("hiearchy")));
    assert.ok(errorMessages.some((msg) => msg.includes("struture")));
  });
});
