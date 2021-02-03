/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var analyzer_1 = require("../../lib/analyzer");
var lib_1 = require("../../lib");
// Generates parser JavaScript code.
function generateParseTable(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
    //options.returnTypes = {};
    var param0 = options.param0 ? options.param0 + ', ' : '';
    var grammar = ast.grammar;
    var ri = 0;
    var ruleMap = {};
    ast.rules.forEach(function (r) { ruleMap[r.name] = ri++; });
    var result = [];
    lib_1.Analysis.ruleTable = grammar.rules;
    options.allowedStartRules.forEach(function (r) {
        ri = ruleMap[r];
        var rule = grammar.children[ri];
        if (rule.rule !== r) {
            console.error("Something wrong '" + r + "' != '" + rule.rule + "'");
            throw new Error();
        }
        var traverser = new analyzer_1.EntryPointTraverser(null, rule);
        var parseTable = traverser.generateParseTreeTraversionTable();
        result.push("const Tbl" + r + ' = "' + lib_1.CodeTblToHex(parseTable.ser()).join('') + '";');
    });
    var fnm = options.tmppref + "_ParseTables.ts";
    fs.writeFileSync(fnm, result.join("\n"));
}
module.exports = generateParseTable;
//# sourceMappingURL=generateParseTable.js.map