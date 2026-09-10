const { Beautifier } = require('@/lang/beautify/bml/beautifier');
const { Options } = require('@/lang/beautify/bml/options');

/**
 * Beautify BML source code.
 * @param {string} sourceText - The BML source text.
 * @param {object} options - Beautifier options.
 * @returns {string} - The formatted code.
 */
function bml_beautify(sourceText, options) {
  const beautifier = Beautifier(sourceText, options);
  return beautifier.beautify();
}

/**
 * Get default beautifier options.
 * @type {() => any}
 */
bml_beautify.defaultOptions = function () {
  return Options();
};

module.exports = bml_beautify;
