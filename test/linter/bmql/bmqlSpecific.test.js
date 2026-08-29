const assert = require("assert");
const vscode = require("vscode");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - BMQL Exhaustive 3-Tier Suite (Positive, Negative, Destructive)", () => {
    // =========================================================================
    // 1. recordset() Function
    // =========================================================================
    suite('recordset() - RecordSet instantiation and usage', () => {
        suite('Positive', () => {
            test('0 arguments creates empty RecordSet', () => {
                const diags = lintText('rs = recordset(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('rs = recordset("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Iterate over empty recordset without crash', () => {
                const diags = lintText(`
                    rs = recordset();
                    for rec in rs {
                        print(get(rec, "col"));
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. bmql() Core Query Overloads & Dynamic Variables
    // =========================================================================
    suite('bmql() - Overloads, Dynamic Variables ($table, $columns, $where, fieldMap)', () => {
        suite('Positive', () => {
            test('1 argument: standard SELECT query with direct $variable and IN array conditions', () => {
                const diags = lintText(`
                    pno = "part123";
                    lead = integer[]{3, 4, 5};
                    rs = bmql("SELECT part_number FROM _parts WHERE part_number = $pno AND lead_time IN $lead");
                    for rec in rs {
                        p = get(rec, "part_number");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: query + contextOverride language dictionary', () => {
                const diags = lintText(`
                    lang = dict("string");
                    put(lang, "language", "de");
                    rs = bmql("SELECT description FROM _parts WHERE part_number = 'Translations'", lang);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: dynamic $table, $columns, $where with fieldMap dictionary', () => {
                const diags = lintText(`
                    tbl = "dataTableName";
                    cols = "columnName";
                    lang = dict("string");
                    fields = dict("string");
                    put(fields, "$field1", "6.08");
                    put(fields, "$field2", "2.03");
                    whereClause = "x = $field1 AND y = $field2";
                    rs = bmql("SELECT $cols FROM $tbl WHERE $whereClause", lang, fields);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('rs = bmql(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('rs = bmql("SELECT id FROM t", dict("string"), dict("string"), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Fully dynamic BMQL statement with all clauses dynamic', () => {
                const diags = lintText(`
                    fromTbl = "uploadXMLtable";
                    selCols = "string1,int1";
                    lang = dict("string");
                    fields = dict("string");
                    put(fields, "$field1", "6.08");
                    whereStr = "float1 = $field1";
                    rs = bmql("SELECT $selCols FROM $fromTbl WHERE $whereStr", lang, fields);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. Live Data Table Statements (INSERT, DELETE, UPDATE, MODIFY)
    // =========================================================================
    suite('Live Data Table Statements - INSERT, DELETE, UPDATE, MODIFY and error inspection', () => {
        suite('Positive', () => {
            test('INSERT into Live Data Table with records_error check', () => {
                const diags = lintText(`
                    results = bmql("INSERT INTO table1 (column1, column2) VALUES ('value1', 11), ('value2', 22)");
                    errMsg = get(results, "records_error");
                    for res in results {
                        insCount = getInt(res, "records_inserted");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-bmql-mutation-error-unchecked'), undefined);
            });

            test('UPDATE with SET and WHERE clause checking records_error', () => {
                const diags = lintText(`
                    results = bmql("UPDATE table1 SET column1 = 'new_val' WHERE column2 = $id");
                    errMsg = get(results, "records_error");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-bmql-mutation-error-unchecked'), undefined);
            });

            test('DELETE with WHERE clause', () => {
                const diags = lintText(`
                    results = bmql("DELETE FROM table1 WHERE column1 = 'old_val'");
                    for res in results {
                        delCount = getInt(res, "records_deleted");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-bmql-unbounded-delete'), undefined);
            });
        });

        suite('Negative', () => {
            test('Unchecked mutation flags bml-bmql-mutation-error-unchecked', () => {
                const diags = lintText(`
                    results = bmql("INSERT INTO table1 (column1) VALUES ('value1')");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-bmql-mutation-error-unchecked'));
            });

            test('UPDATE without WHERE flags bml-bmql-unbounded-mutation', () => {
                const diags = lintText(`
                    results = bmql("UPDATE table1 SET column1 = 'val'");
                    errMsg = get(results, "records_error");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-bmql-unbounded-mutation'));
            });

            test('DELETE without WHERE flags bml-bmql-unbounded-delete', () => {
                const diags = lintText(`
                    results = bmql("DELETE FROM table1");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-bmql-unbounded-delete'));
            });
        });

        suite('Destructive', () => {
            test('MODIFY statement updating records_updated and records_inserted', () => {
                const diags = lintText(`
                    results = bmql("MODIFY table1 SET col1 = 'v1' WHERE col2 = $targetId");
                    errMsg = get(results, "records_error");
                    for res in results {
                        u = getInt(res, "records_updated");
                        i = getInt(res, "records_inserted");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-bmql-mutation-error-unchecked'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. Result Extraction & Record Typed Readers (get, getint, getfloat, getboolean, getmessage, haserror)
    // =========================================================================
    suite('Result Extraction & Record Typed Readers - get, getint, getfloat, getboolean, getmessage, haserror', () => {
        suite('Positive', () => {
            test('Extracts String, Integer, Float, and Boolean columns from RecordSet rows', () => {
                const diags = lintText(`
                    rs = bmql("SELECT name, qty, price, active FROM parts_table WHERE status = 'ACTIVE'");
                    for rec in rs {
                        n = get(rec, "name");
                        q = getint(rec, "qty");
                        p = getfloat(rec, "price");
                        b = getboolean(rec, "active");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('gettransaction with 1 and 2 arguments (bsId, filterCriteria JSON)', () => {
                const diags = lintText(`
                    bsId = 12345;
                    filter = json("{\\"mainDoc\\":{\\"variableName\\":\\"quote\\",\\"returnSpecificAttributes\\":\\"quoteNum\\"}}");
                    xml1 = gettransaction(bsId);
                    xml2 = gettransaction(bsId, filter);
                    return xml1;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('getboolean with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = getboolean(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getint with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = getint(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getfloat with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = getfloat(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('haserror with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = haserror(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('gettransaction with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('xml = gettransaction(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('gettransaction with 4 args (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('xml = gettransaction(123, json("{}"), "p3", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('getmessage with haserror verification on failed query', () => {
                const diags = lintText(`
                    rs = bmql("SELECT id FROM table1 WHERE id = $id");
                    if (haserror(rs)) {
                        err = getmessage(rs);
                        print(err);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. Query Structure Rules (Injection Risk, JOINs, Loops, Deprecations)
    // =========================================================================
    suite('Query Architecture Rules & Anti-Patterns', () => {
        suite('Positive', () => {
            test('ANSI SQL JOINs across customer-defined tables with aliases and dotted notation', () => {
                const diags = lintText(`
                    rs = bmql("SELECT T1.name as empName, T2.name as mgrName FROM Employee T1 INNER JOIN Employee T2 ON T1.mgrId = T2.empId WHERE T1.active = 1 ORDER BY T1.name ASC");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-bmql-join-system-table'), undefined);
            });
        });

        suite('Negative', () => {
            test('Flags string concatenation inside bmql() (bml-bmql-injection-risk)', () => {
                const diags = lintText('rs = bmql("SELECT id FROM " + tblName); return "";');
                assert.ok(diags.find(d => d.code === 'bml-bmql-injection-risk'));
            });

            test('Flags bare variable as query (bml-bmql-full-substitution)', () => {
                const diags = lintText('rs = bmql(queryStrVar); return "";');
                assert.ok(diags.find(d => d.code === 'bml-bmql-full-substitution'));
            });

            test('Flags JOIN against system table _parts (bml-bmql-join-system-table)', () => {
                const diags = lintText('rs = bmql("SELECT a.id FROM table_a a JOIN _parts p ON a.id = p.id WHERE a.id = $id"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-bmql-join-system-table'));
            });

            test('Flags BMQL query inside loop (bml-bmql-in-loop)', () => {
                const diags = lintText(`
                    items = string[]{"A", "B"};
                    for item in items {
                        rs = bmql("SELECT price FROM parts WHERE id = $item");
                    }
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-bmql-in-loop'));
            });

            test('Flags deprecated gettabledata() and getpartsdata()', () => {
                const diags = lintText('t = gettabledata("tbl", string[1]); p = getpartsdata(string[1], string[1], "USD"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-gettabledata-fix'));
                assert.ok(diags.find(d => d.code === 'bml-getpartsdata-fix'));
            });
        });

        suite('Destructive', () => {
            test('BMQL Transaction query in configuration context', () => {
                const diags = lintText(`
                    rs = bmql("SELECT _document_number, opportunity_name FROM commerce.quote_process");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
