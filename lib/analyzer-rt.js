"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarParsingLeafState = exports.GrammarParsingLeafStateCommon = exports.GrammarParsingLeafStateReduces = exports.GrammarParsingLeafStateTransitions = exports.RTReduce = exports.RTStackShiftItem = exports.RTShift = exports.ParseTable = void 0;
var _1 = require(".");
var parsers_1 = require("./parsers");
var index_1 = require("./index");
function slen(arr) {
    return arr ? arr.length : undefined;
}
function smlen(arr) {
    return arr ? Object.keys(arr).length : undefined;
}
function debuggerTrap(value) {
    return value;
}
var ParseTable = /** @class */ (function () {
    function ParseTable(rule, g) {
        var _this = this;
        this.packed = false;
        this.rule = rule;
        this.allStates = [];
        this.myCommons = [];
        if (g) {
            this.startingState = g.startingStateNode.generateState(this);
            g.allLeafStateNodes.forEach(function (s) { return s.generateState(_this); });
        }
    }
    ParseTable.prototype.fillStackOpenerTransitions = function (phase, log) {
        if (log === void 0) { log = true; }
        if (!this.openerTrans) {
            this.openerTrans = new GenerateParseTableStackMainGen(null, this);
        }
        this.openerTrans.generate(phase);
    };
    ParseTable.prototype.pack = function (log) {
        if (log === void 0) { log = true; }
        var result;
        if (!this.packed) {
            var comp = new CompressParseTable(this, log);
            result = comp.pack();
            this.packed = true;
        }
        return result;
    };
    ParseTable.prototype.packAgain = function (log) {
        if (log === void 0) { log = true; }
        if (this.packed) {
            this.allStates.forEach(function (s) {
                s.serializedTuple = null;
            });
            this.myCommons.forEach(function (s) {
                s.serializedTuple = null;
            });
            this.packed = false;
        }
        this.pack(log);
    };
    ParseTable.deserialize = function (rule, buf) {
        var result = _1.Analysis.parseTable(rule);
        var pos = result.deser(buf);
        if (pos !== buf.length)
            throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
        return result;
    };
    ParseTable.prototype.leafState = function (index) {
        if (!index)
            return null;
        var ls = this.allStates[index - 1];
        if (!ls) {
            this.allStates[index - 1] = ls = new GrammarParsingLeafState();
            ls.index = index;
        }
        return ls;
    };
    ParseTable.prototype.ser = function () {
        this.pack();
        var serStates = [];
        this.allStates.forEach(function (s) {
            s.ser(serStates);
        });
        var result = [this.rule.nodeIdx, this.allStates.length].concat(serStates);
        return result;
    };
    ParseTable.prototype.deser = function (buf) {
        var ridx = buf[0], stlen = buf[1];
        if (ridx !== this.rule.nodeIdx) {
            throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
        }
        var pos = 2;
        var st0 = this.leafState(1);
        pos = st0.deser(1, buf, pos);
        this.startingState = st0;
        for (var i = 2; i <= stlen; i++) {
            var st = this.leafState(i);
            pos = st.deser(i, buf, pos);
        }
        return pos;
    };
    ParseTable.prototype.diagnosticEqualityCheck = function (table) {
        if (this.rule !== table.rule) {
            return debuggerTrap(false);
        }
        else if (slen(this.allStates) !== slen(table.allStates)) {
            return debuggerTrap(false);
        }
        else if (!this.startingState.diagnosticEqualityCheck(table.startingState)) {
            return debuggerTrap(false);
        }
        else {
            for (var i = 0; i < this.allStates.length; i++) {
                var a = this.allStates[i];
                var b = table.allStates[i];
                var c = a.diagnosticEqualityCheck(b);
                if (!c) {
                    return debuggerTrap(false);
                }
            }
        }
        return debuggerTrap(true);
    };
    ParseTable.prototype.toString = function () {
        return "ParseTable/" + this.rule.rule + "/" + (this.allStates.length) + " states";
    };
    return ParseTable;
}());
exports.ParseTable = ParseTable;
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
            changed = _this.prstate(state) || changed;
        });
        var sts = this.parseTable.allStates.length;
        _1.Analysis.totalStates += sts;
        if (this.log) {
            console.log("Total: [ total states:" + _1.Analysis.totalStates + "  distinct:" + (this.lfidx) + "    total states/common:" + _1.Analysis.varShReqs.n + "   distinct:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "   jmp.tokens:" + _1.Analysis.varTkns.mean.toFixed(1) + "+-" + _1.Analysis.varTkns.sqrtVariance.toFixed(1) + "   shift/tkns:" + _1.Analysis.varShs.mean.toFixed(1) + "+-" + _1.Analysis.varShs.sqrtVariance.toFixed(1) + "   rec.shift:" + _1.Analysis.varShReqs.mean.toFixed(1) + "+-" + _1.Analysis.varShReqs.sqrtVariance.toFixed(1) + "  reduces:" + _1.Analysis.varRds.mean.toFixed(1) + "+-" + _1.Analysis.varRds.sqrtVariance.toFixed(1) + " ]");
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
            var stcmidx = state.common ? state.common.index : 0;
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
                state.index = state0.index;
                state.serializedTuple = tuple;
                return true;
            }
            else {
                state.index = this.cmnidx++;
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
        if (stack[this[index_1.UNIQUE_OBJECT_ID]]) {
            return;
        }
        stack[this[index_1.UNIQUE_OBJECT_ID]] = this;
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
        var _this = this;
        console.log(this.indent + phase + ">" + (this.rr ? this.rr : this.parseTable.rule + "#0") + " item:" + this.stack[this.rule.rule]);
        var top = !this.rr;
        switch (phase) {
            case 0:
                this.parseTable.allStates.forEach(function (s) {
                    s.lazy(_this.parseTable);
                });
                var was1st = 0, wasNon1st = 0;
                // Trivial items first :
                this.shifts = this.parseTable.startingState.common.transitions;
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
                            _this.shifts = forNode.shifts;
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
                if (top) {
                    if (this.unresolvedRecursiveBoxes.length) {
                        var unresolvedRecursiveItems = this.unresolvedRecursiveBoxes;
                        this.unresolvedRecursiveBoxes = [];
                        console.log("ROUND " + phase + ". Postifx adding unresolved rule refs : " + unresolvedRecursiveItems.length);
                        var childrenAffctd = [];
                        unresolvedRecursiveItems.forEach(function (tuple) {
                            tuple[0].postfixInsertUnresolvedRule(tuple[1], tuple[2], tuple[3]);
                            childrenAffctd.push(tuple[0]);
                        });
                        childrenAffctd = index_1.distinct(childrenAffctd);
                        console.log("Affected distinct : " + childrenAffctd.length + "  generating shifts again...");
                        childrenAffctd.forEach(function (chbox) {
                            chbox.generateShiftsAgain(phase);
                        });
                        if (this.unresolvedRecursiveBoxes.length) {
                            if (phase === 10) {
                                console.log("Stopped. Last phase reached. Still existing unresolved rule refs : " + unresolvedRecursiveItems.length);
                            }
                        }
                        else if (!unresolvedRecursiveItems.length) {
                            console.log("Finished. Not producing more stack shifts.");
                        }
                    }
                }
                break;
        }
        // Since it is processed,
        // there should not present any "recursive shift" action any more
        if (this.shifts.map[0]) {
            throw new Error("this.shifts.map[0]  len:" + Object.keys(this.shifts.map).length);
        }
        console.log(this.indent + phase + "<" + (this.rr ? this.rr : this.parseTable.rule));
    };
    return GenerateParseTableStackMainGen;
}());
var GenerateParseTableStackBox = /** @class */ (function () {
    function GenerateParseTableStackBox(parent, parseTable, common, stack) {
        this.children = [];
        this.parent = parent;
        this.top = parent.top;
        this.parseTable = parseTable;
        this.common = common;
        this.stack = stack;
        this.shifts = new GrammarParsingLeafStateTransitions();
        this.allShifts = {};
    }
    GenerateParseTableStackBox.prototype.generate = function (phase) {
        var _this = this;
        switch (phase) {
            case 0:
                this.recursiveShifts = this.common.recursiveShifts.map[0];
                if (this.recursiveShifts) {
                    this.recursiveShifts.forEach(function (rshift) {
                        _this.insertStackOpenShifts(phase, rshift);
                    });
                }
                break;
            case 1:
                var esths = Object.entries(this.common.transitions.map);
                esths.forEach(function (_a) {
                    var key = _a[0], shifts = _a[1];
                    var tokenId = Number(key);
                    shifts.forEach(function (shift) {
                        _this.newShift(shift.shiftIndex, [[tokenId, shift]]);
                    });
                });
                this.children.forEach(function (child) {
                    child[0].generate(phase);
                });
                // Trivial shifts only but no recursion everywhere after ROUND 1
                this.generateShifts(phase);
                break;
            case 2:
            case 3:
            case 4:
                this.children.forEach(function (child) {
                    child[0].generate(phase);
                });
                this.children.forEach(function (child) {
                    _this.appendChild(child[0], child[1], child[2]);
                });
                // maybe re-generated but duplicates are excluded
                this.generateShifts(phase);
                break;
        }
    };
    GenerateParseTableStackBox.prototype.generateShiftsAgain = function (phase) {
        var tokens = Object.keys(this.shifts.map).join(",");
        this.generateShifts(phase);
        var tokens2 = Object.keys(this.shifts.map).join(",");
        if (tokens !== tokens2) {
            this.addAsUnresolved({});
        }
    };
    GenerateParseTableStackBox.prototype.addAsUnresolved = function (stack) {
        // it is a starting node, which has dependencies required to update
        if (this.common === this.parent.parseTable.startingState.common) {
            this.parent.addAsUnresolved(stack);
        }
    };
    GenerateParseTableStackBox.prototype.newShift = function (expectedShiftIndex, theShifts) {
        var buf = [];
        theShifts.forEach(function (_a) {
            var tokenId = _a[0], shift = _a[1];
            if (shift.shiftIndex !== expectedShiftIndex) {
                throw new Error("shift.shiftIndex !== expectedShiftIndex   " + shift.shiftIndex + " !== " + expectedShiftIndex);
            }
            buf.push(tokenId);
            buf.push(shift.toStateIndex);
            shift.serStackItms(buf);
        });
        var key = _1.CodeTblToHex(buf).join("");
        var olditm = this.allShifts[key];
        if (olditm) {
            if (olditm[0] !== expectedShiftIndex) {
                throw new Error("Shift action already produced under another shiftIndex !   new shiftIndex:" + expectedShiftIndex + "  old shiftIndex:" + olditm[0]);
            }
            //throw new Error("Shift action already produced !   shiftIndex:"+oldShift.shiftIndex+"  old shiftIndex:"+olditm[0]);
        }
        else {
            this.allShifts[key] = [expectedShiftIndex, theShifts];
        }
    };
    GenerateParseTableStackBox.prototype.generateShifts = function (phase) {
        var _this = this;
        // doing it in-place to avoid updates over and over
        this.shifts.clear();
        var shiftvals = Object.values(this.allShifts);
        var shifstlen = shiftvals.length;
        shiftvals = index_1.distinct(shiftvals, function (a, b) {
            return a[0] - b[0];
        });
        if (shifstlen !== shiftvals.length) {
            throw new Error("shifstlen !== asvals.length   " + shifstlen + " !== " + shiftvals.length);
        }
        var shis = 0;
        shiftvals.forEach(function (_a) {
            var shi = _a[0], tkshs = _a[1];
            tkshs.forEach(function (tksh) {
                var tokenId = tksh[0];
                var shift = tksh[1];
                if (shift.shiftIndex !== shi) {
                    throw new Error("shift.shiftIndex !== shi   " + shift.shiftIndex + " !== " + shi);
                }
                shift.shiftIndex = shis;
                var shs = _this.shifts.map[tokenId];
                if (!shs) {
                    _this.shifts.map[tokenId] = shs = [];
                }
                shs.push(shift);
                shis++;
            });
        });
        this.common.replace(this.shifts);
    };
    GenerateParseTableStackBox.prototype.insertStackOpenShifts = function (phase, recursiveShift) {
        if (!recursiveShift.toStateIndex) {
            throw new Error("recursiveShift.toStateIndex   " + recursiveShift.toStateIndex);
        }
        var state = this.parseTable.allStates[recursiveShift.toStateIndex - 1];
        if (state.startingPoint.kind !== parsers_1.PNodeKind.RULE_REF) {
            throw new Error("state.startingPoint.kind !== PNodeKind.RULE_REF   " + state.startingPoint.kind + " !== " + parsers_1.PNodeKind.RULE_REF);
        }
        if (recursiveShift.toStateIndex !== state.index) {
            throw new Error("recursiveShift.toStateIndex !== state.index   " + recursiveShift.toStateIndex + " !== " + state.index);
        }
        switch (phase) {
            case 0:
                var rr = state.startingPoint;
                var ruleMain = this.stack[rr.rule];
                if (ruleMain) {
                    ruleMain.dependants.push([this, recursiveShift, rr]);
                    this.top.unresolvedRecursiveBoxes.push([this, ruleMain, recursiveShift, rr]);
                }
                else {
                    var importedTable = _1.Analysis.parseTables[rr.rule];
                    if (rr.rule !== importedTable.rule.rule) {
                        throw new Error("rr.rule !== importedTable.rule.rule   " + rr.rule + " !== " + importedTable.rule.rule);
                    }
                    ruleMain = new GenerateParseTableStackMainGen(this, importedTable, rr);
                    ruleMain.dependants.push([this, recursiveShift, rr]);
                    this.children.push([ruleMain, recursiveShift, rr]);
                    // phase 0:
                    ruleMain.generate(phase);
                }
                break;
            default:
                throw new Error("unexpected phase : " + phase);
        }
    };
    GenerateParseTableStackBox.prototype.postfixInsertUnresolvedRule = function (child, recursiveShift, rr) {
        this.appendChild(child, recursiveShift, rr);
    };
    GenerateParseTableStackBox.prototype.appendChild = function (child, recursiveShift, rr) {
        var es = Object.entries(child.shifts.map);
        var impshifts = [];
        es.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var newImportedShift = new RTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex);
                var newStackItem = new RTStackShiftItem(rr, shift.toStateIndex);
                newImportedShift.stepIntoRecursive.push(newStackItem);
                [].push(newImportedShift.stepIntoRecursive, shift.stepIntoRecursive);
                impshifts.push([tokenId, newImportedShift]);
            });
        });
        if (impshifts.length) {
            this.newShift(recursiveShift.shiftIndex, impshifts);
        }
    };
    return GenerateParseTableStackBox;
}());
var RTShift = /** @class */ (function () {
    function RTShift(shiftIndex, toStateIndex) {
        this.stepIntoRecursive = [];
        this.shiftIndex = shiftIndex;
        this.toStateIndex = toStateIndex;
    }
    RTShift.prototype.serStackItms = function (buf) {
        buf.push(this.stepIntoRecursive.length);
        [].push.apply(buf, this.stepIntoRecursive.map(function (item) { return item.toStateIndex; }));
    };
    RTShift.prototype.deserStackItms = function (buf, pos) {
        var itmlen = buf[pos++];
        var stp;
        for (var i = 0; i < itmlen; i++) {
            var tost = buf[pos++];
            stp = new RTStackShiftItem(null, tost);
            this.stepIntoRecursive.push(stp);
        }
        return pos;
    };
    RTShift.prototype.diagnosticEqualityCheck = function (table) {
        if (this.shiftIndex !== table.shiftIndex) {
            return debuggerTrap(false);
        }
        else if (this.toStateIndex !== table.toStateIndex) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return RTShift;
}());
exports.RTShift = RTShift;
var RTStackShiftItem = /** @class */ (function () {
    function RTStackShiftItem(enter, toStateIndex, parent) {
        this.enter = enter;
        this.toStateIndex = toStateIndex;
        this.parent = parent;
    }
    RTStackShiftItem.prototype.lazyRule = function (parseTable, shift0) {
        if (parseTable) {
            this.enter = parseTable.allStates[shift0.toStateIndex - 1].startingPoint;
        }
        else {
            parseTable = _1.Analysis.parseTables[this.parent.enter.rule];
            this.enter = parseTable.allStates[this.parent.toStateIndex - 1].startingPoint;
        }
    };
    return RTStackShiftItem;
}());
exports.RTStackShiftItem = RTStackShiftItem;
var RTReduce = /** @class */ (function () {
    function RTReduce(shiftIndex, node) {
        this.shiftIndex = shiftIndex;
        this.node = node;
    }
    RTReduce.prototype.diagnosticEqualityCheck = function (table) {
        if (this.shiftIndex !== table.shiftIndex) {
            return debuggerTrap(false);
        }
        else if (this.node !== table.node) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return RTReduce;
}());
exports.RTReduce = RTReduce;
var GrammarParsingLeafStateTransitions = /** @class */ (function () {
    function GrammarParsingLeafStateTransitions(copy) {
        this.map = {};
        if (copy) {
            this.index = copy.index;
            this.map = Object.assign({}, copy.map);
            this.alreadySerialized = [].concat(copy.alreadySerialized);
        }
    }
    GrammarParsingLeafStateTransitions.prototype.clear = function () {
        this.map = {};
        this.alreadySerialized = undefined;
    };
    GrammarParsingLeafStateTransitions.prototype.ser = function (buf) {
        var ord = [];
        var es = Object.entries(this.map);
        es.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var buf = [shift.shiftIndex, shift.toStateIndex, tokenId];
                shift.serStackItms(buf);
                ord.push(buf);
            });
        });
        ord.sort(function (a, b) {
            var r0 = a[0] - b[0];
            if (r0)
                return r0;
            throw new Error();
            //var r1 = a[1] - b[1];
            //if (r1) return r1;
            //var r2 = a[2] - b[2];
            //return r2;
        });
        //buf.push(es.length);
        buf.push(ord.length);
        var idx = 0;
        ord.forEach(function (numbers) {
            var shi = numbers[0];
            if (shi !== idx) {
                throw new Error("shi !== idx   " + shi + " !== " + idx);
            }
            // 0 - not
            for (var i = 1; i < numbers.length; i++) {
                buf.push(numbers[i]);
            }
            idx++;
        });
    };
    GrammarParsingLeafStateTransitions.prototype.deser = function (index, buf, pos) {
        this.index = index;
        var ordlen = buf[pos++];
        var idx = 0;
        for (var i = 0; i < ordlen; i++, idx++) {
            var sti = buf[pos++];
            var tki = buf[pos++];
            var shs = this.map[tki];
            if (!shs) {
                this.map[tki] = shs = [];
            }
            var shift = new RTShift(idx, sti);
            pos = shift.deserStackItms(buf, pos);
            shs.push(shift);
        }
        return pos;
    };
    GrammarParsingLeafStateTransitions.prototype.diagnosticEqualityCheck = function (table) {
        if (this.index !== table.index) {
            return debuggerTrap(false);
        }
        else {
            var keys1 = Object.keys(this.map);
            var keys2 = Object.keys(table.map);
            if (keys1.length !== keys2.length) {
                return debuggerTrap(false);
            }
            keys1.sort();
            keys2.sort();
            for (var i = 0; i < keys1.length; i++) {
                var k1 = keys1[i];
                var k2 = keys2[i];
                if (k1 !== k2) {
                    return debuggerTrap(false);
                }
                var shs1 = this.map[Number(k1)];
                var shs2 = table.map[Number(k1)];
                if (slen(shs1) !== slen(shs2)) {
                    return debuggerTrap(false);
                }
                for (var j = 0; j < shs1.length; j++) {
                    var a = shs1[j];
                    var b = shs2[j];
                    var c = a.diagnosticEqualityCheck(b);
                    if (!c) {
                        return debuggerTrap(false);
                    }
                }
            }
        }
        return debuggerTrap(true);
    };
    return GrammarParsingLeafStateTransitions;
}());
exports.GrammarParsingLeafStateTransitions = GrammarParsingLeafStateTransitions;
var GrammarParsingLeafStateReduces = /** @class */ (function () {
    function GrammarParsingLeafStateReduces() {
        this.reducedNodes = [];
    }
    GrammarParsingLeafStateReduces.prototype.ser = function (buf) {
        var buf2 = [];
        var tot = 0;
        this.reducedNodes.forEach(function (rs) {
            rs.forEach(function (r) {
                buf2.push(r.shiftIndex);
                buf2.push(r.node.nodeIdx);
                tot++;
            });
        });
        buf.push(tot);
        [].push.apply(buf, buf2);
    };
    GrammarParsingLeafStateReduces.prototype.deser = function (index, buf, pos) {
        this.index = index;
        var tot = buf[pos++];
        for (var i = 0; i < tot; i++) {
            var shi = buf[pos++];
            var nidx = buf[pos++];
            var node = _1.HyperG.nodeTable[nidx];
            var rs = this.reducedNodes[shi];
            if (!rs) {
                this.reducedNodes[shi] = rs = [];
            }
            rs.push(new RTReduce(shi, node));
        }
        return pos;
    };
    GrammarParsingLeafStateReduces.prototype.diagnosticEqualityCheck = function (table) {
        if (this.index !== table.index) {
            return debuggerTrap(false);
        }
        else if (slen(this.reducedNodes) !== slen(table.reducedNodes)) {
            return debuggerTrap(false);
        }
        else {
            for (var i = 0; i < this.reducedNodes.length; i++) {
                var a = this.reducedNodes[i];
                var b = table.reducedNodes[i];
                if (slen(a) !== slen(b)) {
                    return debuggerTrap(false);
                }
                else {
                    for (var j = 0; j < a.length; j++) {
                        var c = a[j].diagnosticEqualityCheck(b[j]);
                        if (!c) {
                            return debuggerTrap(false);
                        }
                    }
                }
            }
        }
        return debuggerTrap(true);
    };
    return GrammarParsingLeafStateReduces;
}());
exports.GrammarParsingLeafStateReduces = GrammarParsingLeafStateReduces;
var GrammarParsingLeafStateCommon = /** @class */ (function () {
    function GrammarParsingLeafStateCommon(startStateNode) {
        this.filledWithRecursive = false;
        if (startStateNode) {
            this.index = startStateNode.index;
        }
        this.startStateNode = startStateNode;
        this.reduceActions = null;
    }
    Object.defineProperty(GrammarParsingLeafStateCommon.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (!this._transitions) {
                if (this.serialStateMap) {
                    this._transitions = new GrammarParsingLeafStateTransitions();
                    this.recursiveShifts = new GrammarParsingLeafStateTransitions();
                    this.reduceActions = new GrammarParsingLeafStateReduces();
                    var shiftses = Object.entries(this.serialStateMap.map);
                    shiftses.forEach(function (_a) {
                        var key = _a[0], shs = _a[1];
                        var tki = Number(key);
                        if (tki) {
                            // nonreq
                            _this._transitions.map[tki] = shs;
                        }
                        else {
                            // req
                            _this.recursiveShifts.map[tki] = shs;
                        }
                    });
                }
                else {
                    this._transitions = new GrammarParsingLeafStateTransitions();
                    this.recursiveShifts = new GrammarParsingLeafStateTransitions();
                    this.serialStateMap = new GrammarParsingLeafStateTransitions();
                    this.reduceActions = new GrammarParsingLeafStateReduces();
                    var pushToMap_1 = function (s, tokenId, map) {
                        var ts = map.map[tokenId];
                        if (!ts) {
                            map.map[tokenId] = ts = [];
                        }
                        var shift = new RTShift(shiftIndex, s.item.stateNode.index);
                        ts.push(shift);
                    };
                    var shiftIndex = 0;
                    this.startStateNode.shiftsAndReduces.forEach(function (nextTerm) {
                        switch (nextTerm.kind) {
                            case _1.ShiftReduceKind.SHIFT:
                                var s = nextTerm;
                                pushToMap_1(s, s.item.node.value, _this._transitions);
                                pushToMap_1(s, s.item.node.value, _this.serialStateMap);
                                shiftIndex++;
                                break;
                            // these are the rule-ref recursive states
                            // these have unknown jumping-in tokens, so 
                            // we should handle more complex states in runtime 
                            case _1.ShiftReduceKind.SHIFT_RECURSIVE:
                                var sr = nextTerm;
                                pushToMap_1(sr, 0, _this.recursiveShifts);
                                pushToMap_1(sr, 0, _this.serialStateMap);
                                shiftIndex++;
                                break;
                            case _1.ShiftReduceKind.REDUCE:
                            case _1.ShiftReduceKind.REDUCE_RECURSIVE:
                                var r = nextTerm;
                                var rs = _this.reduceActions.reducedNodes[shiftIndex];
                                if (!rs) {
                                    _this.reduceActions.reducedNodes[shiftIndex] = rs = [];
                                }
                                rs.push(new RTReduce(shiftIndex, r.item.node));
                                break;
                            default:
                                throw new Error("222b  " + nextTerm);
                        }
                    });
                }
            }
            return this._transitions;
        },
        enumerable: false,
        configurable: true
    });
    GrammarParsingLeafStateCommon.prototype.replace = function (newSerialStateMap) {
        this._transitions = null;
        this.recursiveShifts = null;
        this.serialStateMap = newSerialStateMap;
    };
    GrammarParsingLeafStateCommon.prototype.ser = function (buf) {
        [].push.apply(buf, this.serializedTuple);
    };
    GrammarParsingLeafStateCommon.prototype.deser = function (index, buf, pos) {
        this.index = index;
        var _a = [buf[pos++], buf[pos++]], trind = _a[0], rdind = _a[1];
        this.serialStateMap = _1.Analysis.leafStateTransitionTables[trind];
        if (!this.serialStateMap)
            this.serialStateMap = new GrammarParsingLeafStateTransitions();
        this.reduceActions = _1.Analysis.leafStateReduceTables[rdind];
        if (!this.reduceActions)
            this.reduceActions = new GrammarParsingLeafStateReduces();
        // TODO separate _transitions and recursiveShifts
        return pos;
    };
    GrammarParsingLeafStateCommon.prototype.diagnosticEqualityCheck = function (table) {
        if (this.index !== table.index) {
            return debuggerTrap(false);
        }
        else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
            return debuggerTrap(false);
        }
        else if (!this.serialStateMap.diagnosticEqualityCheck(table.serialStateMap)) {
            return debuggerTrap(false);
        }
        else if (!this.recursiveShifts.diagnosticEqualityCheck(table.recursiveShifts)) {
            return debuggerTrap(false);
        }
        else if (!this._transitions.diagnosticEqualityCheck(table._transitions)) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return GrammarParsingLeafStateCommon;
}());
exports.GrammarParsingLeafStateCommon = GrammarParsingLeafStateCommon;
var GrammarParsingLeafState = /** @class */ (function () {
    function GrammarParsingLeafState(startStateNode, startingPoint) {
        if (startStateNode) {
            this.index = startStateNode.index;
        }
        this.startStateNode = startStateNode;
        this.startingPoint = startingPoint;
        this.reduceActions = null;
    }
    GrammarParsingLeafState.prototype.lazy = function (parseTable) {
        var _this = this;
        if (!this.reduceActions) {
            this.reduceActions = new GrammarParsingLeafStateReduces();
            if (this.startStateNode) {
                var shiftIndex = 0;
                this.startStateNode.reduces.forEach(function (nextTerm) {
                    switch (nextTerm.kind) {
                        case _1.ShiftReduceKind.REDUCE:
                        case _1.ShiftReduceKind.REDUCE_RECURSIVE:
                            var r = nextTerm;
                            var rs = _this.reduceActions.reducedNodes[shiftIndex];
                            if (!rs) {
                                _this.reduceActions.reducedNodes[shiftIndex] = rs = [];
                            }
                            rs.push(new RTReduce(shiftIndex, r.item.node));
                            break;
                        default:
                            throw new Error("223b  " + nextTerm);
                    }
                });
                if (this.startStateNode.common) {
                    this.common = _1.Analysis.leafStateCommon(parseTable, this.startStateNode.common.index);
                    if (!this.common.startStateNode) {
                        this.common.startStateNode = this.startStateNode.common;
                    }
                    // lazy
                    this.common.transitions;
                }
            }
            else {
                throw new Error("Uninitilized GrammarParsingLeafState");
            }
        }
    };
    GrammarParsingLeafState.prototype.ser = function (buf) {
        [].push.apply(buf, this.serializedTuple);
    };
    GrammarParsingLeafState.prototype.deser = function (index, buf, pos) {
        var _a = [buf[pos++], buf[pos++], buf[pos++]], spx = _a[0], rdind = _a[1], cmni = _a[2];
        this.index = index;
        this.startingPoint = spx ? _1.HyperG.nodeTable[spx] : null;
        this.reduceActions = _1.Analysis.leafStateReduceTables[rdind];
        this.common = _1.Analysis.leafStateCommons[cmni];
        if (!this.reduceActions)
            this.reduceActions = new GrammarParsingLeafStateReduces();
        return pos;
    };
    GrammarParsingLeafState.prototype.diagnosticEqualityCheck = function (table) {
        if (this.index !== table.index) {
            return debuggerTrap(false);
        }
        else if (this.startingPoint !== table.startingPoint) {
            return debuggerTrap(false);
        }
        else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return GrammarParsingLeafState;
}());
exports.GrammarParsingLeafState = GrammarParsingLeafState;
//# sourceMappingURL=analyzer-rt.js.map