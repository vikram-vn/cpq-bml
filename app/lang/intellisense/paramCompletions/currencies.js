const { buildStringParamItems } = require('./utils');

const CURRENCY_CODES = [
    { name: 'USD', detail: 'US Dollar ($)', doc: 'United States Dollar.' },
    { name: 'EUR', detail: 'Euro (€)', doc: 'Euro Currency.' },
    { name: 'GBP', detail: 'British Pound (£)', doc: 'British Pound Sterling.' },
    { name: 'JPY', detail: 'Japanese Yen (¥)', doc: 'Japanese Yen.' },
    { name: 'CAD', detail: 'Canadian Dollar (CA$)', doc: 'Canadian Dollar.' },
    { name: 'AUD', detail: 'Australian Dollar (A$)', doc: 'Australian Dollar.' },
    { name: 'CHF', detail: 'Swiss Franc (CHF)', doc: 'Swiss Franc.' },
    { name: 'CNY', detail: 'Chinese Yuan (CN¥)', doc: 'Chinese Yuan Renminbi.' },
    { name: 'INR', detail: 'Indian Rupee (₹)', doc: 'Indian Rupee.' },
    { name: 'BRL', detail: 'Brazilian Real (R$)', doc: 'Brazilian Real.' },
    { name: 'MXN', detail: 'Mexican Peso (MX$)', doc: 'Mexican Peso.' },
    { name: 'SGD', detail: 'Singapore Dollar (S$)', doc: 'Singapore Dollar.' },
    { name: 'HKD', detail: 'Hong Kong Dollar (HK$)', doc: 'Hong Kong Dollar.' },
    { name: 'NZD', detail: 'New Zealand Dollar (NZ$)', doc: 'New Zealand Dollar.' },
    { name: 'KRW', detail: 'South Korean Won (₩)', doc: 'South Korean Won.' },
    { name: 'SEK', detail: 'Swedish Krona (kr)', doc: 'Swedish Krona.' },
    { name: 'NOK', detail: 'Norwegian Krone (kr)', doc: 'Norwegian Krone.' },
    { name: 'ZAR', detail: 'South African Rand (R)', doc: 'South African Rand.' },
    { name: 'AED', detail: 'UAE Dirham (AED)', doc: 'United Arab Emirates Dirham.' },
    { name: 'SAR', detail: 'Saudi Riyal (SAR)', doc: 'Saudi Arabian Riyal.' }
];

function getCurrencyCodeCompletions(document, position) {
    return buildStringParamItems(CURRENCY_CODES, document, position);
}

module.exports = {
    CURRENCY_CODES,
    getCurrencyCodeCompletions
};
