"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateParseDeferrerMainGen = void 0;
var _1 = require(".");
var GenerateParseDeferrerMainGen = /** @class */ (function () {
    function GenerateParseDeferrerMainGen(ast, parseTable) {
        var _this = this;
        this.ambiogousTokens = {};
        this.internalAmbiguity = 0;
        this.externalAmbiguity = 0;
        this.parseTable = parseTable;
        var common = parseTable.startingState.common;
        var tokenSet = Object.keys(common.transitions.map);
        var terminalDeconsts = ast.terminalDeconsts;
        var tknToStr = function (token) {
            if (token >= 0) {
                return terminalDeconsts[token];
            }
            else {
                return _1.Analysis.choiceTokens[-token].children.map(function (termRef) { return termRef.terminal; }).join("|");
            }
        };
        tokenSet.forEach(function (token) {
            var shifts = common.transitions.map[token];
            if (shifts.length > 1) {
                _this.ambiogousTokens[tknToStr(token)] = 1;
                shifts.forEach(function (shift) {
                    if (shift.stepIntoRecursive && shift.stepIntoRecursive.child) {
                        _this.externalAmbiguity += shift.stepIntoRecursive.depth;
                    }
                    else {
                        _this.internalAmbiguity++;
                    }
                });
            }
        });
        if (this.internalAmbiguity + this.externalAmbiguity >= 100) {
            console.warn("WARNING  Amibigous shifts for the start rule of '" + parseTable.rule.rule + "'  Ambiguity internal:" + this.internalAmbiguity + " external:" + this.externalAmbiguity + " of tokens " + Object.keys(this.ambiogousTokens).join(",") + "  Advised to define some rules as deferred and trying to compile the grammar again.");
        }
    }
    return GenerateParseDeferrerMainGen;
}());
exports.GenerateParseDeferrerMainGen = GenerateParseDeferrerMainGen;
//# sourceMappingURL=analyzer-level3.js.map