const assert = require('assert');
const { BmlLexer, TokenType } = require('../../app/lang/ast/bmlLexer');
const { BmlParser } = require('../../app/lang/ast/bmlParser');

describe('BML Lexer & AST Parser', () => {
    it('tokenizes BML keywords, operators and literals', () => {
        const source = 'for item in items { print item; }';
        const lexer = new BmlLexer(source);
        const tokens = lexer.tokenize();

        assert.strictEqual(tokens[0].type, TokenType.KEYWORD);
        assert.strictEqual(tokens[0].value, 'for');
        assert.strictEqual(tokens[1].type, TokenType.IDENTIFIER);
        assert.strictEqual(tokens[1].value, 'item');
        assert.strictEqual(tokens[2].type, TokenType.KEYWORD);
        assert.strictEqual(tokens[2].value, 'in');
    });

    it('recognizes BML logical operators AND, OR, NOT and comparison <>', () => {
        const source = 'if (active AND price <> 0.0 OR NOT(flag)) { return true; }';
        const lexer = new BmlLexer(source);
        const tokens = lexer.tokenize();

        const andToken = tokens.find(t => t.value.toLowerCase() === 'and');
        const notToken = tokens.find(t => t.value.toLowerCase() === 'not');
        const neToken = tokens.find(t => t.value === '<>');

        assert.ok(andToken, 'Should find AND token');
        assert.ok(notToken, 'Should find NOT token');
        assert.ok(neToken, 'Should find <> token');
    });

    it('parses for loop into AST structure', () => {
        const source = 'for x in records { print x; }';
        const ast = BmlParser.parse(source);

        assert.strictEqual(ast.type, 'Program');
        assert.strictEqual(ast.body.length, 1);
        const loop = ast.body[0];
        assert.strictEqual(loop.type, 'ForLoop');
        assert.strictEqual(loop.iterator, 'x');
        assert.strictEqual(loop.collection.name, 'records');
    });

    it('parses if-elif-else conditional blocks', () => {
        const source = 'if (x == 1) { return 10; } elif (x == 2) { return 20; } else { return 30; }';
        const ast = BmlParser.parse(source);

        assert.strictEqual(ast.body.length, 1);
        const ifStmt = ast.body[0];
        assert.strictEqual(ifStmt.type, 'IfStatement');
        assert.ok(ifStmt.consequent);
        assert.ok(ifStmt.alternate);
        assert.strictEqual(ifStmt.alternate.type, 'IfStatement');
    });

    it('parses BMQL statement into AST node', () => {
        const source = 'bmql select sku, price from Parts where active == 1;';
        const ast = BmlParser.parse(source);

        assert.strictEqual(ast.body.length, 1);
        const bmqlStmt = ast.body[0];
        assert.strictEqual(bmqlStmt.type, 'BMQLStatement');
        assert.ok(bmqlStmt.query.includes('Parts'));
    });
});
