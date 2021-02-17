"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateParseTableStackBox = exports.GenerateParseTableStackMainGen = exports.CompressParseTable = void 0;
var _1 = require(".");
var CompressParseTable = /** @class */ (function () {
    function CompressParseTable(parseTable, log) {
        if (log === void 0) { log = true; }
        this.log = true;
        this.parseTable = parseTable;
        this.log = log;
        if (parseTable.allStates.length > _1.Analysis.uniformMaxStateId) {
            throw new Error("State id overflow. Grammar too big. uniformMaxStateId:" + _1.Analysis.uniformMaxStateId + "  Too many states:" + parseTable.allStates.length);
        }
    }
    CompressParseTable.prototype.pack = function () {
        var _this = this;
        this.t0 = Object.keys(_1.Analysis.serializedTransitions).length;
        this.r0 = Object.keys(_1.Analysis.serializedReduces).length;
        this.sl0 = Object.keys(_1.Analysis.serializedLeafStates).length;
        this.sc0 = Object.keys(_1.Analysis.serializedStateCommons).length;
        // indexes
        // 1 based
        // 0 means empty
        this.transidx = this.t0 + 1;
        this.redidx = this.r0 + 1;
        this.lfidx = this.sl0 + 1;
        this.cmnidx = this.sc0 + 1;
        var changed = false;
        this.parseTable.allStates.forEach(function (state) {
            changed = state && (_this.prstate(state) || changed);
        });
        var sts = this.parseTable.allStates.length;
        _1.Analysis.totalStates += sts;
        if (this.log) {
            console.log("Total: [ total states:" + _1.Analysis.totalStates + "  distinct:" + (this.lfidx) + "   distinct states/common:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "    rec shifts:" + _1.Analysis.varShReqs + "   jmp.tokens:" + _1.Analysis.varTkns + "   shift/tkns:" + _1.Analysis.varShs + "  reduces:" + _1.Analysis.varRds + " ]");
        }
        return changed;
    };
    CompressParseTable.prototype.prstate = function (state) {
        if (state && !state.serializedTuple) {
            // lazy
            state.lazy(this.parseTable);
            var tots = [0, 0, 0, 0];
            var changed = this.prscmn(state.common);
            var rs1 = [0];
            changed = this.red(state.reduceActions, rs1) || changed;
            _1.Analysis.varRds.add(rs1[0]);
            var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
            var stcmidx = state.common ? state.common.globindex : 0;
            var tuple = [spidx, state.reduceActions.index, stcmidx];
            var tkey = _1.CodeTblToHex(tuple).join("");
            var state0 = _1.Analysis.serializedLeafStates[tkey];
            if (state0) {
                // NOTE we keep old indeces for now because we should update all at once
                // on all dependent objects (like RTShift-s)
                state.packedIndex = state0.packedIndex;
                state.serializedTuple = tuple;
                return true;
            }
            else {
                // NOTE we keep old indeces for now because we should update all at once
                // on all dependent objects (like RTShift-s)
                state.packedIndex = this.lfidx++;
                state.serializedTuple = tuple;
                _1.Analysis.serializedLeafStates[tkey] = state;
                return changed;
            }
        }
        else {
            return false;
        }
    };
    CompressParseTable.prototype.prscmn = function (state) {
        if (state && !state.serializedTuple) {
            // lazy
            state.transitions;
            var tots = [0, 0, 0, 0];
            var changed = this.tra(state.serialStateMap, tots);
            var nonreq = tots[0], nonreqtot = tots[1], req = tots[2], reqtot = tots[3];
            if (nonreq) {
                _1.Analysis.varTkns.add(nonreq);
                _1.Analysis.varShs.add(nonreqtot / nonreq);
            }
            if (req) {
                if (req !== 1) {
                    throw new Error("req !== 1  " + req + " !== " + 1);
                }
            }
            _1.Analysis.varShReqs.add(reqtot);
            var rs1 = [0];
            changed = this.red(state.reduceActions, rs1) || changed;
            _1.Analysis.varRds.add(rs1[0]);
            var tuple = [state.serialStateMap.index, state.reduceActions.index];
            var tkey = _1.CodeTblToHex(tuple).join("");
            var state0 = _1.Analysis.serializedStateCommons[tkey];
            if (state0) {
                state.globindex = state0.globindex;
                state.serializedTuple = tuple;
                return true;
            }
            else {
                state.globindex = this.cmnidx++;
                state.serializedTuple = tuple;
                _1.Analysis.serializedStateCommons[tkey] = state;
                return changed;
            }
        }
        else {
            return false;
        }
    };
    CompressParseTable.prototype.tra = function (trans, maplen) {
        var shiftses = Object.entries(trans.map);
        if (shiftses.length) {
            var nonreq = 0;
            var nonreqtot = 0;
            var req = 0;
            var reqtot = 0;
            shiftses.forEach(function (_a) {
                var key = _a[0], shs = _a[1];
                var tki = Number(key);
                if (tki) {
                    nonreq++;
                    nonreqtot += shs.length;
                }
                else {
                    req++;
                    reqtot += shs.length;
                }
            });
            maplen[0] = nonreq;
            maplen[1] = nonreqtot;
            maplen[2] = req;
            maplen[3] = reqtot;
            var buf = [];
            trans.alreadySerialized = null;
            trans.ser(buf);
            trans.alreadySerialized = buf;
            var encoded = _1.CodeTblToHex(buf).join("");
            var trans0 = _1.Analysis.serializedTransitions[encoded];
            if (trans0) {
                trans.index = trans0.index;
                return true;
            }
            else {
                trans.index = this.transidx++;
                _1.Analysis.serializedTransitions[encoded] = trans;
                return false;
            }
        }
        else if (trans.index !== 0) {
            trans.index = 0;
            return true;
        }
        else {
            return false;
        }
    };
    CompressParseTable.prototype.red = function (rr, maplen) {
        var rlen = rr.reducedNodes.length;
        maplen[0] = rlen;
        if (rlen) {
            var buf = [];
            rr.alreadySerialized = null;
            rr.ser(buf);
            rr.alreadySerialized = buf;
            var encred = _1.CodeTblToHex(buf).join("");
            var rr0 = _1.Analysis.serializedReduces[encred];
            if (rr0) {
                rr.index = rr0.index;
                return true;
            }
            else {
                rr.index = this.redidx++;
                _1.Analysis.serializedReduces[encred] = rr;
                return false;
            }
        }
        else if (rr.index !== 0) {
            rr.index = 0;
            return true;
        }
        else {
            return false;
        }
    };
    return CompressParseTable;
}());
exports.CompressParseTable = CompressParseTable;
var GenerateParseTableStackMainGen = /** @class */ (function () {
    function GenerateParseTableStackMainGen(parent, parseTable, rr) {
        this.indent = "";
        this.unresolvedRecursiveBoxes = [];
        this.children = [];
        this.dependants = [];
        this.parseTable = parseTable;
        this.rr = rr;
        this.rule = rr ? rr : parseTable.rule;
        this.stack = {};
        this.stack[this.rule.rule] = this;
        if (parent) {
            this.parent = parent;
            this.top = parent.top;
            Object.setPrototypeOf(this.stack, parent.stack);
            this.indent = parent.parent.indent + "  ";
        }
        else {
            this.top = this;
        }
        this.top.stack[this.rule.rule] = this;
    }
    GenerateParseTableStackMainGen.prototype.addAsUnresolved = function (stack) {
        var _this = this;
        // infinite-loop-anti-maker
        if (stack[this[_1.UNIQUE_OBJECT_ID]]) {
            return;
        }
        stack[this[_1.UNIQUE_OBJECT_ID]] = this;
        this.dependants.forEach(function (_a) {
            var importer = _a[0], recshift = _a[1], rr = _a[2];
            _this.top.unresolvedRecursiveBoxes.push([importer, _this, recshift, rr]);
        });
        this.dependants.forEach(function (_a) {
            var importer = _a[0], recshift = _a[1], rr = _a[2];
            importer.addAsUnresolved(stack);
        });
    };
    GenerateParseTableStackMainGen.prototype.generate = function (phase) {
        //console.log(this.indent + phase + ">" + (this.rr ? this.rr : this.parseTable.rule+"#0"));
        var _this = this;
        var top = !this.rr;
        var deepStats = 1;
        this.parseTable.allStates.forEach(function (s) {
            if (s)
                s.lazy(_this.parseTable);
        });
        this.parseTable.myCommons.forEach(function (s) {
            if (s) {
                // lazy
                s.transitions;
            }
        });
        switch (phase) {
            case 0:
                var was1st = 0, wasNon1st = 0;
                this.parseTable.myCommons.forEach(function (c) {
                    if (c === _this.parseTable.startingState.common) {
                        was1st = 1;
                    }
                    else {
                        wasNon1st = 1;
                    }
                    if (!c.filledWithRecursive) {
                        if (_this.stack[_this.rule.rule] !== _this) {
                            throw new Error("this.stack[this.parseTable.rule.rule:'" + _this.rule.rule + "'] !== this   " + _this.stack[_this.parseTable.rule.rule] + " !== " + _this);
                        }
                        var forNode = new GenerateParseTableStackBox(_this, _this.parseTable, c, _this.stack);
                        _this.children.push(forNode);
                        if (c === _this.parseTable.startingState.common) {
                            _this.mainRuleBox = forNode;
                        }
                        forNode.generate(phase);
                    }
                });
                if (wasNon1st) {
                    if (!was1st) {
                        throw new Error("wasNon1st && !was1st");
                    }
                }
                break;
            case 1:
            case 2:
            case 3:
            case 4:
                this.children.forEach(function (child) {
                    child.generate(phase);
                });
                break;
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
                this.children.forEach(function (child) {
                    child.generate(phase);
                });
                if (top) {
                    if (this.unresolvedRecursiveBoxes.length) {
                        var unresolvedRecursiveBoxesNow = this.unresolvedRecursiveBoxes;
                        this.unresolvedRecursiveBoxes = [];
                        var childrenAffctd = [];
                        unresolvedRecursiveBoxesNow.forEach(function (_a) {
                            var importer = _a[0], child = _a[1], recshift = _a[2], rr = _a[3];
                            // NOTE precondition ok : dependants updated
                            importer.appendChild(child, recshift, rr);
                            childrenAffctd.push(importer);
                        });
                        childrenAffctd = _1.distinct(childrenAffctd);
                        if (deepStats) {
                            console.log("Phase " + phase + " " + this.rule.rule + ". Affected distinct : " + childrenAffctd.length + "  generating shifts again...");
                        }
                        childrenAffctd.forEach(function (chbox) {
                            chbox.generateShiftsAgain(phase);
                        });
                        console.log("Phase " + phase + " " + this.rule.rule + ". Additional cyclic dependencies fixed : " + unresolvedRecursiveBoxesNow.length + "    In next round : " + this.unresolvedRecursiveBoxes.length);
                    }
                }
                break;
        }
        if (top && deepStats) {
            var sum = function () {
                return {
                    vShifts: new _1.IncVariator(),
                    vRecs: new _1.IncVariator(),
                    vPrep: new _1.IncVariator()
                };
            };
            var summ_1 = function (sums, shifts, box) {
                var es = Object.entries(shifts.map);
                if (box) {
                    sums.vPrep.add(Object.keys(box.allShifts).length);
                }
                es.forEach(function (_a) {
                    var key = _a[0], shifts = _a[1];
                    sums.vShifts.add(shifts.length);
                    shifts.forEach(function (shift) {
                        sums.vRecs.add(shift.stepIntoRecursive.length);
                    });
                });
            };
            var summ2 = function (sums, parseTable) {
                var stack = {};
                parseTable.allStates.forEach(function (state) {
                    if (state) {
                        var common = state.common;
                        if (!common) {
                            state.lazy(parseTable);
                            common = state.common;
                        }
                        if (common) {
                            if (!stack[common[_1.UNIQUE_OBJECT_ID]]) {
                                stack[common[_1.UNIQUE_OBJECT_ID]] = 1;
                                summ_1(sums, common.transitions, null);
                            }
                        }
                    }
                });
            };
            var sums = sum();
            summ2(sums, this.parseTable);
            console.log(this.indent + "Phase " + phase + " " + this.rule.rule + " : from parseTable  tokens:" + " shifts:" + sums.vShifts + "  recursive deep shifts:" + sums.vRecs);
        }
        //console.log(this.indent + phase + "<" + this.rule.rule);
    };
    return GenerateParseTableStackMainGen;
}());
exports.GenerateParseTableStackMainGen = GenerateParseTableStackMainGen;
var GenerateParseTableStackBox = /** @class */ (function () {
    function GenerateParseTableStackBox(parent, parseTable, common, stack) {
        this.cntGenerationSecondaryIndex = 0;
        this.children = [];
        this.parent = parent;
        this.top = parent.top;
        this.parseTable = parseTable;
        this.common = common;
        this.trivial = this.common.transitions;
        this.stack = stack;
        this.allShifts = {};
        this.allShiftsByToken = {};
    }
    GenerateParseTableStackBox.prototype.generate = function (phase) {
        var _this = this;
        switch (phase) {
            case 0:
                // lazy
                this.common.transitions;
                this.recursiveShifts = this.common.recursiveShifts.map[0];
                if (this.recursiveShifts) {
                    this.recursiveShifts.forEach(function (rshift) {
                        _this.insertStackOpenShifts(phase, rshift);
                    });
                }
                break;
            case 1:
                this.resetShitsToTrivial();
                // NOTE this ensures a processing order of dependants first :
                this.children.forEach(function (_a) {
                    var ruleMain = _a[0], shift = _a[1], rr = _a[2];
                    ruleMain.generate(phase);
                });
                // Trivial shifts copied  but no recursion anywhere after ROUND 1
                this.generateShifts(phase);
                break;
            default:
                this.resetShitsToTrivial();
                // NOTE this ensures a processing order of dependants first :
                this.children.forEach(function (_a) {
                    var ruleMain = _a[0], shift = _a[1], rr = _a[2];
                    ruleMain.generate(phase);
                });
                this.children.forEach(function (_a) {
                    var ruleMain = _a[0], shift = _a[1], rr = _a[2];
                    // NOTE precondition ok : dependants updated
                    _this.appendChild(ruleMain, shift, rr);
                });
                this.generateShifts(phase);
                break;
        }
    };
    GenerateParseTableStackBox.prototype.resetShitsToTrivial = function () {
        var _this = this;
        this.allShifts = {};
        this.allShiftsByToken = {};
        this.cntGenerationSecondaryIndex = 0;
        if (this.trivial["$$generated$$"]) {
            throw new Error("serialStateMap should be the original one here");
        }
        var esths = Object.entries(this.trivial.map);
        esths.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                shift = new _1.RTShift(shift.shiftIndex, shift.toStateIndex);
                shift.generationSecondaryIndex = _this.cntGenerationSecondaryIndex++;
                _this.newShift(shift.shiftIndex, tokenId, shift);
            });
        });
    };
    GenerateParseTableStackBox.prototype.generateShiftsAgain = function (phase) {
        var tokens = Object.keys(this.common.serialStateMap.map).join(",");
        this.generateShifts(phase);
        var tokens2 = Object.keys(this.common.serialStateMap.map).join(",");
        if (tokens !== tokens2) {
            this.addAsUnresolved({});
        }
    };
    GenerateParseTableStackBox.prototype.addAsUnresolved = function (stack) {
        // it is a starting node, which has dependencies required to update
        if (this === this.parent.mainRuleBox) {
            this.parent.addAsUnresolved(stack);
        }
    };
    GenerateParseTableStackBox.prototype.newShift = function (oldShiftIndexAsSlotId, tokenId, shift) {
        var key = oldShiftIndexAsSlotId + ":" + tokenId;
        var olditm = this.allShifts[key];
        if (olditm) {
            var os = olditm[1];
            if (os.shiftIndex !== oldShiftIndexAsSlotId) {
                throw new Error("tokenId !== olditm[0] ||  os.shiftIndex !== shiftIndex   " + tokenId + " !== " + olditm[0] + " ||  " + os.shiftIndex + " !== " + oldShiftIndexAsSlotId);
            }
            var buf = [os.toStateIndex];
            os.serStackItms(buf);
            var srold = _1.CodeTblToHex(buf).join(",");
            buf = [shift.toStateIndex];
            shift.serStackItms(buf);
            var srnew = _1.CodeTblToHex(buf).join(",");
            if (srold !== srnew) {
                throw new Error("srold !== srnew   " + srold + " !== " + srnew);
            }
        }
        else {
            this.allShifts[key] = [tokenId, shift];
            var tshs = this.allShiftsByToken[tokenId];
            if (!tshs) {
                this.allShiftsByToken[tokenId] = tshs = [shift];
            }
            else {
                tshs.push(shift);
                var n = tshs.length;
                this.allShiftsByToken[tokenId] = tshs = _1.distinct(tshs, function (a, b) {
                    return a.shiftIndex - b.shiftIndex;
                });
                if (tshs.length !== n) {
                    throw new Error("tshs.length !== n   " + tshs.length + " !== " + n);
                }
            }
        }
    };
    GenerateParseTableStackBox.prototype.generateShifts = function (phase) {
        var shifts = new _1.GrammarParsingLeafStateTransitions();
        shifts["$$generated$$"] = 1;
        var es = Object.entries(this.allShiftsByToken);
        var shi = 0;
        es.forEach(function (_a) {
            var key = _a[0], shs = _a[1];
            var tokenId = Number(key);
            var shs = shifts.map[tokenId];
            if (!shs) {
                shifts.map[tokenId] = shs = [];
            }
            shs.forEach(function (sh) {
                var sh2 = new _1.RTShift(sh.generationSecondaryIndex, sh.toStateIndex, sh.stepIntoRecursive);
                shs.push(sh2);
                if (shi !== sh2.shiftIndex) {
                    throw new Error("shi !== sh2.shiftIndex   " + shi + " !== " + sh2.shiftIndex);
                }
                shi++;
            });
        });
        this.common.replace(shifts);
    };
    GenerateParseTableStackBox.prototype.insertStackOpenShifts = function (phase, recursiveShift) {
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
        switch (phase) {
            case 0:
                var rr = state.startingPoint;
                var importedRuleMain = this.stack[rr.rule];
                if (importedRuleMain) {
                    importedRuleMain.dependants.push([this, recursiveShift, rr]);
                    this.top.unresolvedRecursiveBoxes.push([this, importedRuleMain, recursiveShift, rr]);
                }
                else {
                    var importedTable = _1.Analysis.parseTables[rr.rule];
                    if (rr.rule !== importedTable.rule.rule) {
                        throw new Error("rr.rule !== importedTable.rule.rule   " + rr.rule + " !== " + importedTable.rule.rule);
                    }
                    importedRuleMain = new GenerateParseTableStackMainGen(this, importedTable, rr);
                    importedRuleMain.dependants.push([this, recursiveShift, rr]);
                    this.children.push([importedRuleMain, recursiveShift, rr]);
                    // phase 0:
                    importedRuleMain.generate(phase);
                }
                break;
            default:
                throw new Error("unexpected phase : " + phase);
        }
    };
    // NOTE precondition : dependants updated
    GenerateParseTableStackBox.prototype.appendChild = function (child, recursiveShift, rr) {
        var _this = this;
        var byTokenId = child.mainRuleBox.allShiftsByToken;
        var es = Object.entries(byTokenId);
        es.forEach(function (_a) {
            var key = _a[0], childShifts = _a[1];
            var tokenId = Number(key);
            var min = _1.minimum(childShifts, function (a, b) {
                return a.generationSecondaryIndex - b.generationSecondaryIndex;
            });
            var childShift = min[1];
            var newImportShift = new _1.RTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex);
            newImportShift.generationSecondaryIndex = _this.cntGenerationSecondaryIndex++;
            var newStackItem = new _1.RTStackShiftItem(rr, childShift.toStateIndex);
            newImportShift.stepIntoRecursive =
                [newStackItem].concat(childShift.stepIntoRecursive);
            _this.newShift(recursiveShift.shiftIndex, tokenId, newImportShift);
        });
    };
    return GenerateParseTableStackBox;
}());
exports.GenerateParseTableStackBox = GenerateParseTableStackBox;
//# sourceMappingURL=analyzer-level2.js.map