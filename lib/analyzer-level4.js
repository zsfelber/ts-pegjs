"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateParseLookaheadsCommon = exports.GenerateParseLookaheadsLeaf = exports.GenerateParseLookaheadsMainGen = void 0;
var _1 = require(".");
var GenerateParseLookaheadsMainGen = /** @class */ (function () {
    function GenerateParseLookaheadsMainGen(parent, parseTable) {
        var _this = this;
        this.leafs = [];
        this.commons = [];
        parseTable.allStates.forEach(function (c) {
            var child = new GenerateParseLookaheadsLeaf(_this, parseTable, c);
            _this.leafs.push(child);
        });
    }
    GenerateParseLookaheadsMainGen.prototype.common = function (common) {
        var result = this.commons[common.index];
        if (!result) {
            this.commons[common.index] = result = new GenerateParseLookaheadsCommon(this, this.parseTable, common);
        }
        return result;
    };
    return GenerateParseLookaheadsMainGen;
}());
exports.GenerateParseLookaheadsMainGen = GenerateParseLookaheadsMainGen;
var GenerateParseLookaheadsLeaf = /** @class */ (function () {
    function GenerateParseLookaheadsLeaf(parent, parseTable, leaf) {
        this.common = parent.common(leaf.common);
    }
    return GenerateParseLookaheadsLeaf;
}());
exports.GenerateParseLookaheadsLeaf = GenerateParseLookaheadsLeaf;
var GenerateParseLookaheadsCommon = /** @class */ (function () {
    function GenerateParseLookaheadsCommon(parent, parseTable, common) {
        var _this = this;
        this.children = [];
        var recursiveShifts = common.recursiveShifts.map[0];
        if (recursiveShifts) {
            recursiveShifts.forEach(function (rshift) {
                _this.insertImported(rshift);
            });
        }
    }
    GenerateParseLookaheadsCommon.prototype.insertImported = function (recursiveShift) {
        if (!recursiveShift.toStateIndex) {
            throw new Error("recursiveShift.toStateIndex   " + recursiveShift.toStateIndex);
        }
        var state = this.parseTable.allStates[recursiveShift.toStateIndex];
        if (state.startingPoint.kind !== _1.PNodeKind.RULE_REF) {
            throw new Error("state.startingPoint.kind !== PNodeKind.RULE_REF   " + state.startingPoint.kind + " !== " + _1.PNodeKind.RULE_REF);
        }
        if (recursiveShift.toStateIndex !== state.index) {
            throw new Error("recursiveShift.toStateIndex !== state.index   " + recursiveShift.toStateIndex + " !== " + state.index);
        }
    };
    return GenerateParseLookaheadsCommon;
}());
exports.GenerateParseLookaheadsCommon = GenerateParseLookaheadsCommon;
//# sourceMappingURL=analyzer-level4.js.map