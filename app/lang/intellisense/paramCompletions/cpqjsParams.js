const { buildStringParamItems } = require('./utils');

const CPQJS_TABLE_NAMES = [
    { name: 'lineItemGrid', detail: 'CPQ Line Item Grid', doc: 'Line item grid table variable name in CPQJS.' }
];

const CPQJS_ACTIONS = [
    { name: 'saveAction', detail: 'Save Action Variable', doc: 'Standard Save action variable name.' },
    { name: 'submitQuote', detail: 'Submit Action Variable', doc: 'Standard Submit Quote action variable name.' },
    { name: 'recalculate', detail: 'Recalculate Action Variable', doc: 'Standard Recalculate action variable name.' },
    { name: 'deleteAction', detail: 'Delete Action Variable', doc: 'Standard Delete action variable name.' }
];

const CPQJS_ATTRIBUTES = [
    { name: 'quantity', detail: 'Quantity Attribute', doc: 'Standard Quantity attribute variable name.' },
    { name: 'price', detail: 'Price Attribute', doc: 'Standard Price attribute variable name.' },
    { name: 'discount', detail: 'Discount Attribute', doc: 'Standard Discount attribute variable name.' },
    { name: 'totalPrice', detail: 'Total Price Attribute', doc: 'Standard Total Price attribute variable name.' }
];

function getCpqjsTableCompletions(document, position) {
    return buildStringParamItems(CPQJS_TABLE_NAMES, document, position);
}

function getCpqjsActionCompletions(document, position) {
    return buildStringParamItems(CPQJS_ACTIONS, document, position);
}

function getCpqjsAttributeCompletions(document, position) {
    return buildStringParamItems(CPQJS_ATTRIBUTES, document, position);
}

module.exports = {
    CPQJS_TABLE_NAMES,
    CPQJS_ACTIONS,
    CPQJS_ATTRIBUTES,
    getCpqjsTableCompletions,
    getCpqjsActionCompletions,
    getCpqjsAttributeCompletions
};
