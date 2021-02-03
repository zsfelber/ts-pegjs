/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var analyzer_1 = require("../../lib/analyzer");
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
    var traverser = new analyzer_1.EntryPointTraverser(grammar.children[0]);
    var parseTable = traverser.generateParseTreeTraversionTable();
    parseTable.
        CodeTblToHex(rule.ser()).join('') +
    ;
}
module.exports = generateParseTable;
//# sourceMappingURL=generateParseTable.js.map