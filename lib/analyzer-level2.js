"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateParseTableStackBox = exports.GenerateParseTableStackMainGen = exports.CompressParseTable = void 0;
var _1 = require(".");
var CompressParseTable = /** @class */ (function () {
    function CompressParseTable(parseTable, allowReindexTransitions, log, info) {
        if (log === void 0) { log = true; }
        if (info === void 0) { info = ""; }
        this.log = true;
        this.info = "";
        this.serializedLeafStates = {};
        this.serializedStateCommons = {};
        this.parseTable = parseTable;
        this.allowReindexTransitions = allowReindexTransitions;
        this.log = log;
        this.info = info;
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
        this.lfidx0 = 1;
        this.cmnidx = this.sc0 + 1;
        this.cmnidx0 = 1;
        var changed = false;
        this.parseTable.allStates.forEach(function (state) {
            changed = state && (_this.prstate(state) || changed);
        });
        var sts = this.parseTable.allStates.length;
        _1.Analysis.totalStates += sts;
        if (!this.parseTable.packedIndex) {
            this.parseTable.packedIndex = _1.Analysis.serializedParseTablesCnt++;
        }
        _1.Analysis.serializedParseTables[this.parseTable.packedIndex] = {
            index: this.parseTable.packedIndex,
            output: this.parseTable.ser(_1.HyperGEnvType.ANALYZING)
        };
        if (this.log) {
            console.log((this.info ? this.info : this.parseTable.rule.rule) + "   Total: [ total states:" + _1.Analysis.totalStates + "  distinct:" + (this.lfidx) + "   distinct states/common:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "    rec shifts:" + _1.Analysis.varShReqs + "   jmp.tokens:" + _1.Analysis.varTkns + "   shift/tkns:" + _1.Analysis.varShs + "   stack deepness:" + _1.Analysis.varDeep + "   reduces:" + _1.Analysis.varRds + " ]");
        }
        return changed;
    };
    CompressParseTable.prototype.prstate = function (state) {
        if (state && !state.serializedTuple) {
            // lazy
            state.lazy(this.parseTable);
            var changed = this.prscmn(state.common);
            var rs1 = [0];
            changed = this.red(state.reduceActions, rs1) || changed;
            _1.Analysis.varRds.add(rs1[0]);
            var tuple = state.ser();
            var tkey = _1.CodeTblToHex(tuple).join("");
            var state0 = _1.Analysis.serializedLeafStates[tkey];
            if (state0) {
                var state00 = this.serializedLeafStates[tkey];
                // NOTE we keep old indeces for now because we should update all at once
                // on all dependent objects (like RTShift-s)
                state.packedIndex = state0.index;
                if (state00)
                    state.replacedIndex = state00.replacedIndex;
                else
                    state.replacedIndex = this.lfidx0++;
                state.serializedTuple = tuple;
                return true;
            }
            else {
                // NOTE we keep old indeces for now because we should update all at once
                // on all dependent objects (like RTShift-s)
                state.packedIndex = this.lfidx++;
                state.replacedIndex = this.lfidx0++;
                state.serializedTuple = tuple;
                _1.Analysis.serializedLeafStates[tkey] = { index: state.packedIndex, output: state.serializedTuple };
                this.serializedLeafStates[tkey] = state;
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
            var tuple = state.ser();
            var tkey = _1.CodeTblToHex(tuple).join("");
            var state0 = _1.Analysis.serializedStateCommons[tkey];
            if (state0) {
                var state00 = this.serializedStateCommons[tkey];
                state.packedIndex = state0.index;
                if (state00)
                    state.replacedIndex = state00.replacedIndex;
                else
                    state.replacedIndex = this.cmnidx0++;
                state.serializedTuple = tuple;
                return true;
            }
            else {
                state.packedIndex = this.cmnidx++;
                state.replacedIndex = this.cmnidx0++;
                state.serializedTuple = tuple;
                _1.Analysis.serializedStateCommons[tkey] = { index: state.packedIndex, output: state.serializedTuple };
                ;
                this.serializedStateCommons[tkey] = state;
                return changed;
            }
        }
        else {
            return false;
        }
    };
    CompressParseTable.prototype.tra = function (trans, maplen) {
        if (this.allowReindexTransitions) {
            trans = trans.fixedClone();
        }
        var shiftses = Object.entries(trans.map);
        if (shiftses.length) {
            var nonreq = 0;
            var nonreqtot = 0;
            var req = 0;
            var reqtot = 0;
            shiftses.forEach(function (_a) {
                var key = _a[0], shs = _a[1];
                shs.forEach(function (sh) {
                    _1.Analysis.varDeep.add(sh.stepIntoRecursive.length + 1);
                });
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
            trans.ser(buf);
            var encoded = _1.CodeTblToHex(buf).join("");
            var trans0 = _1.Analysis.serializedTransitions[encoded];
            if (trans0) {
                trans.index = trans0.index;
                return true;
            }
            else {
                trans.index = this.transidx++;
                _1.Analysis.serializedTransitions[encoded] = { index: trans.index, output: buf };
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
                _1.Analysis.serializedReduces[encred] = { index: rr.index, output: buf };
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
        var deepStats = 0;
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
                    if (_this.stack[_this.rule.rule] !== _this) {
                        throw new Error("this.stack[this.parseTable.rule.rule:'" + _this.rule.rule + "'] !== this   " + _this.stack[_this.parseTable.rule.rule] + " !== " + _this);
                    }
                    var forNode = new GenerateParseTableStackBox(_this, _this.parseTable, c, _this.stack);
                    _this.children.push(forNode);
                    if (c === _this.parseTable.startingState.common) {
                        _this.mainRuleBox = forNode;
                    }
                    forNode.generate(phase);
                });
                if (wasNon1st) {
                    if (!was1st) {
                        throw new Error("wasNon1st && !was1st");
                    }
                }
                break;
            case 1:
            case 2:
            case 4:
                this.children.forEach(function (child) {
                    child.generate(phase);
                });
                break;
            case 3:
                this.children.forEach(function (child) {
                    child.generate(phase);
                });
                if (top) {
                    var i;
                    for (i = 0; this.unresolvedRecursiveBoxes.length && i < 100; i++) {
                        var unresolvedRecursiveBoxesNow = this.unresolvedRecursiveBoxes;
                        this.unresolvedRecursiveBoxes = [];
                        var unresolvedRecursiveBoxesNowProc = _1.groupByIndexed(unresolvedRecursiveBoxesNow, function (a) {
                            return a[0][_1.UNIQUE_OBJECT_INDEX];
                        });
                        var childrenAffctd = 0;
                        Object.values(unresolvedRecursiveBoxesNowProc).forEach(function (group) {
                            var gimp = group[0][0];
                            // NOTE precondition ok : dependants updated
                            var tokens = Object.keys(gimp.allShifts).join(",");
                            var updateRequired = false;
                            Object.values(group).forEach(function (_a) {
                                var importer = _a[0], child = _a[1], recshift = _a[2], rr = _a[3];
                                if (gimp !== importer) {
                                    throw new Error("groupBy didn't work");
                                }
                                if (importer.appendChild(child, recshift, rr)) {
                                    updateRequired = true;
                                }
                            });
                            gimp.generateShifts(phase);
                            if (updateRequired) {
                                gimp.addAsUnresolved({});
                            }
                            else {
                                var tokens2 = Object.keys(gimp.allShifts).join(",");
                                if (tokens !== tokens2) {
                                    throw new Error("tokens !== tokens2    " + tokens + " !== " + tokens2);
                                }
                            }
                            childrenAffctd++;
                        });
                        if (deepStats) {
                            console.log("Phase " + phase + " " + this.rule.rule + "/" + i + ". Additional cyclic dependencies updated.  Affected : " +
                                childrenAffctd + "    With dependencies : " + unresolvedRecursiveBoxesNow.length + "    In next round : " +
                                this.unresolvedRecursiveBoxes.length);
                        }
                    }
                    if (i && deepStats) {
                        if (this.unresolvedRecursiveBoxes.length) {
                            console.log("Phase " + phase + " " + this.rule.rule + ", token sets growing in inifinite loop.  Still in next round : " + this.unresolvedRecursiveBoxes.length);
                        }
                        else {
                            console.log("Phase " + phase + " " + this.rule.rule + ", all cyclic token shifts updated successfully (in " + i + " round" + (i > 1 ? "s" : "") + ").");
                        }
                    }
                }
                break;
        }
        if (top) {
        }
        if (top && deepStats) {
            var sum = function () {
                return {
                    vShifts: new _1.IncVariator(),
                    vRecs: new _1.IncVariator(),
                    vTkn: new _1.IncVariator()
                };
            };
            var summ_1 = function (sums, shifts) {
                var es = Object.entries(shifts.map);
                sums.vTkn.add(es.length);
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
                                summ_1(sums, common.transitions);
                            }
                        }
                    }
                });
            };
            var sums = sum();
            summ2(sums, this.parseTable);
            console.log(this.indent + "Phase " + phase + " " + this.rule.rule + " : from parseTable   tokens:" + sums.vTkn + "  shifts:" + sums.vShifts + "  recursive deep shifts:" + sums.vRecs);
        }
        //console.log(this.indent + phase + "<" + this.rule.rule);
    };
    return GenerateParseTableStackMainGen;
}());
exports.GenerateParseTableStackMainGen = GenerateParseTableStackMainGen;
var GenerateParseTableStackBox = /** @class */ (function () {
    function GenerateParseTableStackBox(parent, parseTable, common, stack) {
        this.children = [];
        this[_1.UNIQUE_OBJECT_ID];
        this.parent = parent;
        this.top = parent.top;
        this.parseTable = parseTable;
        this.common = common;
        this.preGeneratedAndOrDefault = this.common.transitions;
        this.stack = stack;
        this.allShifts = {};
        this.allShiftsByToken = new _1.gGrammarParsingLeafStateTransitions();
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
                this.resetShitsToPreGenDef();
                // NOTE this ensures a processing order of dependants first :
                this.children.forEach(function (_a) {
                    var ruleMain = _a[0], shift = _a[1], rr = _a[2];
                    ruleMain.generate(phase);
                });
                // Trivial and pregenerated shifts copied  
                // but no additional recursion added anywhere after ROUND 1
                this.generateShifts(phase);
                break;
            default:
                this.resetShitsToPreGenDef();
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
    GenerateParseTableStackBox.prototype.resetShitsToPreGenDef = function () {
        var _this = this;
        this.allShifts = {};
        this.allShiftsByToken = new _1.gGrammarParsingLeafStateTransitions();
        var esths = Object.entries(this.preGeneratedAndOrDefault.map);
        esths.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var shift2 = new _1.gRTShift(shift.shiftIndex, shift.toStateIndex, tokenId, shift.stepIntoRecursive);
                _this.newShift(shift2);
            });
        });
    };
    GenerateParseTableStackBox.prototype.addAsUnresolved = function (stack) {
        // it is a starting node, which has dependencies required to update
        if (this === this.parent.mainRuleBox) {
            this.parent.addAsUnresolved(stack);
        }
    };
    GenerateParseTableStackBox.prototype.newShift = function (shift) {
        var updateRequired = false;
        var key = shift.shiftIndex + ":" + shift.tokenId;
        var oldshift = this.allShifts[key];
        if (oldshift) {
            if (oldshift.shiftIndex !== shift.shiftIndex) {
                throw new Error("oldshift.shiftIndex !== shift.shiftIndex   " + oldshift.shiftIndex + " !== " + shift.shiftIndex);
            }
            if (oldshift.tokenId !== shift.tokenId) {
                throw new Error("oldshift.tokenId !== shift.tokenId   " + oldshift.tokenId + " !== " + shift.tokenId);
            }
            var buf = [oldshift.toStateIndex];
            oldshift.serStackItms(buf);
            var srold = _1.CodeTblToHex(buf).join(",");
            buf = [shift.toStateIndex];
            shift.serStackItms(buf);
            var srnew = _1.CodeTblToHex(buf).join(",");
            if (srold !== srnew) {
                this.allShifts[key] = shift;
                this.allShiftsByToken.replace(shift);
                updateRequired = true;
            }
        }
        else {
            this.allShifts[key] = shift;
            this.allShiftsByToken.add(shift);
            updateRequired = true;
        }
        return updateRequired;
    };
    GenerateParseTableStackBox.prototype.generateShifts = function (phase) {
        var shifts = this.allShiftsByToken.clone();
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
        // after generateShifts
        var sm = child.mainRuleBox.common.serialStateMap;
        if (!(sm instanceof _1.gGrammarParsingLeafStateTransitions)) {
            throw new Error("Invalid class at generation time : " + sm.constructor.name);
        }
        var es = Object.values(sm.map);
        var updateRequired = false;
        es.forEach(function (childShifts) {
            var childShift = childShifts[0];
            var newImportShift = new _1.gRTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex, childShift.tokenId);
            var newStackItem = new _1.RTStackShiftItem(rr, childShift.toStateIndex);
            newImportShift.stepIntoRecursive =
                [newStackItem].concat(childShift.stepIntoRecursive);
            if (_this.newShift(newImportShift)) {
                updateRequired = true;
            }
        });
        return updateRequired;
    };
    return GenerateParseTableStackBox;
}());
exports.GenerateParseTableStackBox = GenerateParseTableStackBox;
//# sourceMappingURL=analyzer-level2.js.map
