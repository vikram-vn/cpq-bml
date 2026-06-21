const fs = require('fs');
const path = require('path');

// Pure, vscode-free helpers for the local "pull" file format:
//   <folder>/<variableName>.bml         - just scriptText
//   <folder>/<variableName>-meta.json   - everything else from the Get-one response
//
// Oracle's documented example response for "Get a Util Library Function" does
// not show a top-level "namespace" field (only "folderName"), even though
// "namespace" is clearly a real concept elsewhere (e.g. the deploy/debug
// request shapes, and entries in a function's own "libraryFunctions" array).
// To be robust to that inconsistency, namespaceOf() below falls back to
// folderName when namespace is absent.

const FUNCTIONS_API_TYPE = 'util'; // this endpoint family is the Util Library specifically

function bmlPathToMetaPath(bmlFilePath) {
    return bmlFilePath.replace(/\.bml$/i, '-meta.json');
}

// The library function's variableName is taken straight from the .bml
// filename (whatever folder it's in), e.g. "someFolder/allUpdate.bml" -> "allUpdate".
// This is how a file is matched up against the live CPQ library when there's
// no local -meta.json sidecar yet (see commands.js's resolveMetadataForFile).
function variableNameFromBmlPath(bmlFilePath) {
    return path.basename(bmlFilePath).replace(/\.bml$/i, '');
}

function namespaceOf(metadata) {
    return metadata.namespace || '';
}

function namespaceVariableNameFor(metadata) {
    const ns = namespaceOf(metadata);
    return ns ? `${ns}.${metadata.variableName}` : metadata.variableName;
}

// Splits a Get-one API response into { scriptText, metadata }, dropping
// server-only fields (links, referencesUrl) that aren't part of what we send
// back on update/validate/debug.
function splitFunctionResponse(functionResponse) {
    const { scriptText, links, referencesUrl, ...metadata } = functionResponse;
    return { scriptText: scriptText || '', metadata };
}

function readMetadata(metaFilePath) {
    if (!fs.existsSync(metaFilePath)) return null;
    return JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
}

function writeMetadata(metaFilePath, metadata) {
    fs.mkdirSync(path.dirname(metaFilePath), { recursive: true });
    fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), 'utf8');
}

function writeBmlFile(bmlFilePath, scriptText) {
    fs.mkdirSync(path.dirname(bmlFilePath), { recursive: true });
    fs.writeFileSync(bmlFilePath, scriptText, 'utf8');
}

const RETURN_TYPE_MAP = {
    'String': 1,
    'Float': 2,
    'Integer': 3,
    'Boolean': 4,
    'Date': 5,
    'String[]': 10,
    'Float[]': 9,
    'Integer[]': 8,
    'Boolean[]': 34,
    'Date[]': 26,
    'Json': 36,
    'JsonArray': 37,
    'ByteArray': 39,
    'StringBuilder': 42,
    'Integer[] Dictionary': 19,
    'Integer[][] Dictionary': 22,
    'Float Dictionary': 17,
    'Float[] Dictionary': 20,
    'Float[][] Dictionary': 23,
    'String Dictionary': 15,
    'String[] Dictionary': 18,
    'String[][] Dictionary': 21,
    'Boolean Dictionary': 24,
    'Date Dictionary': 25,
    'Date[] Dictionary': 28,
    'Date[][] Dictionary': 29,
    'String[][]': 12,
    'Float[][]': 14,
    'Integer[][]': 13,
    'Date[][]': 27,
    'Boolean[][]': 35,
    'Dictionary of String Dictionaries': 32,
    'Array of String Dictionaries': 33,
    'Anytype Dictionary': 41,
    'Dictionary of Anytype Dictionaries': 40,
    'Integer Dictionary': 16
};

const PARAM_DATA_TYPE_MAP = {
    'Boolean': 0,
    'String': 2,
    'Float': 4,
    'Date': 5,
    'Integer': 6,
    'Integer[]': 7,
    'Float[]': 8,
    'String[]': 9,
    'String[][]': 10,
    'Integer[][]': 11,
    'Float[][]': 12,
    'String Dictionary': 13,
    'Integer Dictionary': 14,
    'Float Dictionary': 15,
    'String[] Dictionary': 16,
    'Integer[] Dictionary': 17,
    'Float[] Dictionary': 18,
    'String[][] Dictionary': 19,
    'Integer[][] Dictionary': 20,
    'Float[][] Dictionary': 21,
    'Boolean Dictionary': 22,
    'Date Dictionary': 23,
    'Date[]': 24,
    'Date[][]': 25,
    'Date[] Dictionary': 26,
    'Date[][] Dictionary': 27,
    'Boolean[]': 28,
    'Boolean[][]': 29,
    'Dictionary of String Dictionaries': 30,
    'Json': 31,
    'JsonArray': 32,
    'ByteArray': 33,
    'Anytype Dictionary': 34,
    'Dictionary of Anytype Dictionaries': 35,
    'StringBuilder': 36
};

function normalizeReturnType(returnType) {
    if (!returnType) return { value: 1, displayValue: 'String' };
    if (typeof returnType === 'object') return returnType;
    const value = RETURN_TYPE_MAP[returnType] || 1;
    return { value, displayValue: returnType };
}

function normalizeParameters(parameters) {
    if (!parameters) return [];
    return parameters.map((p) => {
        const { type, ...rest } = p;
        let dataType = p.dataType || type;
        if (typeof dataType === 'string') {
            const value = PARAM_DATA_TYPE_MAP[dataType] || 2;
            dataType = { value, displayValue: dataType };
        }
        return {
            ...rest,
            dataType
        };
    });
}

function normalizeAttributes(attributes) {
    if (!attributes) return [];
    return attributes.map((attr) => {
        if (typeof attr === 'string') {
            return { name: attr };
        }
        return attr;
    });
}

function normalizeLibraryFunctions(libraryFunctions) {
    if (!libraryFunctions) return [];
    return libraryFunctions.map((item) => {
        if (item && typeof item === 'object') {
            return item;
        }
        if (typeof item === 'string') {
            const parts = item.split('.');
            if (parts[0] === 'commerce') {
                return {
                    variableName: parts.slice(1).join('.'),
                    type: 'COMMERCE'
                };
            } else if (parts[0] === 'util') {
                return {
                    variableName: parts.slice(2).join('.'),
                    type: 'UTIL_LIBRARY',
                    folderName: parts[1]
                };
            }
            return {
                variableName: item
            };
        }
        return item;
    });
}

// Builds the full function object payload expected by validate/update/debug,
// using the locally-edited scriptText rather than whatever was last pulled.
//
// Util and commerce functions need different treatment here: Util's PATCH
// schema always accepts testScript/libraryFunctions/attributes, so those are
// always sent (defaulting absent ones to '' / [] is harmless and confirmed
// working live). Commerce functions are stricter - Oracle's PATCH validation
// rejects a payload that includes a field the function's own Get-one response
// didn't have at all (confirmed live: sending "attributes": [] on a function
// whose GET never returns an "attributes" key fails with a generic "Invalid
// payload.", and sending "subDocAttributes": [] on a function with no
// sub-document scope fails with "Field subDocAttributes is not editable.").
// So for commerce, each of these optional fields is only included if it was
// actually present locally - mirroring whatever the last Get-one/pull saw.
function buildFunctionPayload(metadata, scriptText) {
    const payload = {
        variableName: metadata.variableName,
        name: metadata.name,
        description: metadata.description,
        returnType: normalizeReturnType(metadata.returnType),
        parameters: normalizeParameters(metadata.parameters),
        scriptText,
        useTestScript: metadata.useTestScript || false
    };

    const isCommerce = !!metadata.commerceDocument;

    if (isCommerce) {
        if (metadata.testScript !== undefined) payload.testScript = metadata.testScript;
        if (metadata.libraryFunctions !== undefined) payload.libraryFunctions = normalizeLibraryFunctions(metadata.libraryFunctions);
        if (metadata.attributes !== undefined) payload.attributes = normalizeAttributes(metadata.attributes);
        if (metadata.systemAttributes !== undefined) payload.systemAttributes = normalizeAttributes(metadata.systemAttributes);
        if (metadata.mainDocAttributes !== undefined) payload.mainDocAttributes = normalizeAttributes(metadata.mainDocAttributes);
        if (metadata.subDocAttributes !== undefined) payload.subDocAttributes = normalizeAttributes(metadata.subDocAttributes);
    } else {
        payload.testScript = metadata.testScript || '';
        payload.libraryFunctions = normalizeLibraryFunctions(metadata.libraryFunctions);
        payload.attributes = normalizeAttributes(metadata.attributes);
    }

    if (metadata.commerceProcess) payload.commerceProcess = metadata.commerceProcess;
    if (metadata.commerceDocument) payload.commerceDocument = metadata.commerceDocument;
    if (metadata.transactionId !== undefined && metadata.transactionId !== null) {
        payload.transactionId = metadata.transactionId;
    }

    return payload;
}

// Same as buildFunctionPayload, but merges a value into each parameter for the
// debug endpoint. parameterValues is a { [parameterName]: value } map.
function buildDebugPayload(metadata, scriptText, parameterValues) {
    const payload = buildFunctionPayload(metadata, scriptText);
    payload.parameters = payload.parameters.map((p) => ({
        ...p,
        value: parameterValues[p.name]
    }));
    return payload;
}

function buildDeployItem(metadata) {
    return {
        namespace: namespaceOf(metadata),
        type: FUNCTIONS_API_TYPE,
        variableName: metadata.variableName
    };
}

function inferCommerceFromPath(bmlFilePath) {
    const normalizedPath = (bmlFilePath || '').replace(/\\/g, '/');
    const segments = normalizedPath.split('/');
    const librariesIndex = segments.lastIndexOf('libraries');
    if (librariesIndex >= 2 && librariesIndex < segments.length - 2) {
        const commerceDocument = segments[librariesIndex - 1];
        const commerceProcess = segments[librariesIndex - 2];
        return { commerceProcess, commerceDocument };
    }
    return null;
}

module.exports = {
    FUNCTIONS_API_TYPE,
    bmlPathToMetaPath,
    variableNameFromBmlPath,
    namespaceOf,
    namespaceVariableNameFor,
    splitFunctionResponse,
    readMetadata,
    writeMetadata,
    writeBmlFile,
    buildFunctionPayload,
    buildDebugPayload,
    buildDeployItem,
    inferCommerceFromPath,
    normalizeLibraryFunctions,
    normalizeAttributes
};
