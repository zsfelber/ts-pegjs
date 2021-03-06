"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarParsingLeafState = exports.GrammarParsingLeafStateCommon = exports.GrammarParsingLeafStateReduces = exports.gGrammarParsingLeafStateTransitions = exports.GrammarParsingLeafStateTransitions = exports.RTReduce = exports.RTStackShiftItem = exports.gRTShift = exports.RTShift = exports.ParseTable = void 0;
var hyperg_1 = require("./hyperg");
var _1 = require(".");
function slen(arr) {
    return arr ? arr.length : undefined;
}
function sobj(obj) {
    return obj ? 1 : 0;
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
        this.choiceTokenMap = [];
        this.packed = false;
        this.rule = rule;
        this.allStates = [];
        this.myCommons = [];
        this.choiceTokenMap = _1.Analysis.choiceTokenMap;
        if (g) {
            this.startingState = g.startingStateNode.generateState(this);
            g.allLeafStateNodes.forEach(function (s) { return s.generateState(_this); });
        }
    }
    ParseTable.prototype.resetOptimization = function (log) {
        if (log === void 0) { log = true; }
        this.openerTrans = null;
        this.packed = false;
        this.allStates.forEach(function (s) {
            if (s) {
                s.common = null;
                s.reduceActions = null;
                s.serializedTuple = null;
            }
        });
        this.myCommons.forEach(function (s) {
            if (s) {
                s.packedIndex = undefined;
                s.serializedTuple = null;
                s.reduceActions = null;
                s.replace(null);
            }
        });
    };
    ParseTable.prototype.fillStackOpenerTransitions = function (phase, log) {
        if (log === void 0) { log = true; }
        if (!this.openerTrans) {
            this.openerTrans = new _1.GenerateParseTableStackMainGen(null, this);
        }
        this.openerTrans.generate(phase);
    };
    ParseTable.prototype.pack = function (allowReindexTransitions, log, info) {
        if (log === void 0) { log = true; }
        if (info === void 0) { info = ""; }
        var result;
        if (!this.packed) {
            var comp = new _1.CompressParseTable(this, allowReindexTransitions, log, info);
            result = comp.pack();
            this.packed = true;
        }
        return result;
    };
    ParseTable.deserialize = function (rule, buf) {
        var result = _1.Analysis.parseTable(rule);
        var pos = result.deser(buf, 0);
        if (pos !== buf.length)
            throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
        return result;
    };
    ParseTable.prototype.leafStateCommon = function (index) {
        if (!index)
            return null;
        var ls = this.myCommons[index];
        if (!ls) {
            this.myCommons[index] = ls = new GrammarParsingLeafStateCommon();
            ls.index = index;
        }
        return ls;
    };
    ParseTable.prototype.leafState = function (index) {
        if (!index)
            return null;
        var ls = this.allStates[index];
        if (!ls) {
            this.allStates[index] = ls = new GrammarParsingLeafState();
            ls.index = index;
        }
        return ls;
    };
    ParseTable.prototype.ser = function (mode) {
        var b;
        if (b = _1.Analysis.serializedParseTables[this.packedIndex]) {
            return b.output;
        }
        var serStates = [];
        var myc;
        var als;
        switch (mode) {
            case _1.HyperGEnvType.ANALYZING:
                myc = _1.distinct(this.myCommons, function (a, b) { return (a.replacedIndex - b.replacedIndex); });
                als = _1.distinct(this.allStates, function (a, b) { return (a.replacedIndex - b.replacedIndex); });
                break;
            default:
                myc = Object.values(this.myCommons);
                als = Object.values(this.allStates);
                break;
        }
        for (var i = 0; i < myc.length;) {
            var s = myc[i++];
            if (s.replacedIndex !== undefined && s.replacedIndex !== i) {
                throw new Error("s.replacedIndex replacedIndex !== i   " + s.replacedIndex + " !== " + i);
            }
            if (s) {
                serStates.push(s.packedIndex);
            }
            else {
                serStates.push(0);
            }
        }
        for (var i = 0; i < als.length;) {
            var s = als[i++];
            if (s.replacedIndex !== undefined && s.replacedIndex !== i) {
                throw new Error("s.replacedIndex replacedIndex !== i   " + s.replacedIndex + " !== " + i);
            }
            if (s) {
                serStates.push(s.packedIndex);
            }
            else {
                serStates.push(0);
            }
        }
        var result = [this.rule.nodeIdx, myc.length, als.length].concat(serStates);
        return result;
    };
    ParseTable.prototype.deser = function (buf, pos) {
        var ridx = buf[0], cmlen = buf[1], stlen = buf[2];
        if (ridx !== this.rule.nodeIdx) {
            throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
        }
        pos = 3;
        for (var i = 1; i <= cmlen; i++) {
            var packedIdx = buf[pos++];
            _1.Analysis.leafStateCommon(this, i, packedIdx);
        }
        for (var i = 1; i <= stlen; i++) {
            var packedIdx = buf[pos++];
            _1.Analysis.leafState(this, i, packedIdx);
        }
        this.startingState = this.allStates[1];
        if (!this.startingState) {
            throw new Error(this.rule.rule + "  !this.startingState");
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
        else if (slen(this.myCommons) !== slen(table.myCommons)) {
            return debuggerTrap(false);
        }
        else if (!this.startingState.diagnosticEqualityCheck(table.startingState)) {
            return debuggerTrap(false);
        }
        else {
            for (var i = 0; i < this.allStates.length; i++) {
                var a = this.allStates[i];
                var b = table.allStates[i];
                if (sobj(a) !== sobj(b)) {
                    return debuggerTrap(false);
                }
                if (a) {
                    var c = a.diagnosticEqualityCheck(b);
                    if (!c) {
                        return debuggerTrap(false);
                    }
                }
            }
            for (var i = 0; i < this.myCommons.length; i++) {
                var a = this.myCommons[i];
                var b = table.myCommons[i];
                if (sobj(a) !== sobj(b)) {
                    return debuggerTrap(false);
                }
                if (a) {
                    var c = a.diagnosticEqualityCheck(b);
                    if (!c) {
                        return debuggerTrap(false);
                    }
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
var RTShift = /** @class */ (function () {
    function RTShift(shiftIndex, stepIntoRecursive) {
        this.shiftIndex = shiftIndex;
        this.stepIntoRecursive = stepIntoRecursive;
    }
    Object.defineProperty(RTShift.prototype, "toStateIndex", {
        get: function () {
            return this.stepIntoRecursive.toStateIndex;
        },
        enumerable: false,
        configurable: true
    });
    RTShift.prototype.diagnosticEqualityCheck = function (table) {
        if (this.shiftIndex !== table.shiftIndex) {
            return debuggerTrap(false);
        }
        else if (this.stepIntoRecursive !== table.stepIntoRecursive) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return RTShift;
}());
exports.RTShift = RTShift;
var gRTShift = /** @class */ (function (_super) {
    __extends(gRTShift, _super);
    function gRTShift(shiftIndex, tokenId, stepIntoRecursive) {
        var _this = _super.call(this, shiftIndex, stepIntoRecursive) || this;
        _this[_1.UNIQUE_OBJECT_ID];
        _this.tokenId = tokenId;
        return _this;
    }
    return gRTShift;
}(RTShift));
exports.gRTShift = gRTShift;
var RTStackShiftItem = /** @class */ (function () {
    function RTStackShiftItem(enter, toStateIndex, child) {
        this.depth = 1;
        this.enter = enter;
        this.toStateIndex = toStateIndex;
        this._child = child;
        if (child) {
            this.depth = child.depth + 1;
        }
    }
    Object.defineProperty(RTStackShiftItem.prototype, "child", {
        get: function () {
            if (!this._child && this.childIndex) {
                this._child = _1.Analysis.stackShiftNodes[this.childIndex];
                this.depth = this._child.depth + 1;
            }
            return this._child;
        },
        enumerable: false,
        configurable: true
    });
    RTStackShiftItem.prototype.lazy = function (parseTable, enter) {
        if (!this.enter) {
            this.enter = enter;
        }
        if (!this.child.enter) {
            this.child.enter = parseTable.allStates[this.toStateIndex].startingPoint;
        }
    };
    Object.defineProperty(RTStackShiftItem.prototype, "tuple", {
        get: function () {
            if (this.child) {
                return [this.toStateIndex, this.child.index];
            }
            else {
                return [this.toStateIndex, 0];
            }
        },
        enumerable: false,
        configurable: true
    });
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
        }
    }
    GrammarParsingLeafStateTransitions.prototype.clear = function () {
        this.map = {};
    };
    GrammarParsingLeafStateTransitions.prototype.slotsByNonUniqueShiftIndex = function () {
        var slots = _1.groupBy2Indexed(this.map, function (a) {
            return a.shiftIndex;
        });
        return slots;
    };
    GrammarParsingLeafStateTransitions.prototype.fixedClone = function () {
        throw new Error("Default shifts not fixable");
    };
    GrammarParsingLeafStateTransitions.prototype.ser = function (buf) {
        var ord = [];
        var es = Object.entries(this.map);
        es.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var buf = [shift.shiftIndex, tokenId,
                    shift.stepIntoRecursive ? shift.stepIntoRecursive.index : 0];
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
            buf.push(numbers[1]);
            buf.push(numbers[2]);
            idx++;
        });
    };
    GrammarParsingLeafStateTransitions.prototype.deser = function (index, buf, pos) {
        this.index = index;
        var ordlen = buf[pos++];
        var idx = 0;
        for (var i = 0; i < ordlen; i++, idx++) {
            var tki = buf[pos++];
            var shs = this.map[tki];
            if (!shs) {
                this.map[tki] = shs = [];
            }
            var shift = new RTShift(idx);
            var rsti = buf[pos++];
            shift.stepIntoRecursive = _1.Analysis.stackShiftNodes[rsti];
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
var gGrammarParsingLeafStateTransitions = /** @class */ (function (_super) {
    __extends(gGrammarParsingLeafStateTransitions, _super);
    function gGrammarParsingLeafStateTransitions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.map = {};
        return _this;
    }
    gGrammarParsingLeafStateTransitions.prototype.add = function (shift) {
        var tshs = this.map[shift.tokenId];
        if (!tshs) {
            this.map[shift.tokenId] = tshs = [];
        }
        tshs.push(shift);
    };
    gGrammarParsingLeafStateTransitions.prototype.replace = function (shift) {
        var tshs = this.map[shift.tokenId];
        if (!tshs) {
            throw new Error("Replace very nothing");
        }
        var rs = hyperg_1.removeArrayItemMore(tshs, shift, function (a, b) {
            return a.shiftIndex - b.shiftIndex;
        });
        if (rs !== 1) {
            throw new Error("Replace cnt not 1 : " + rs);
        }
        tshs.push(shift);
    };
    gGrammarParsingLeafStateTransitions.prototype.clone = function (fixIds) {
        if (fixIds === void 0) { fixIds = false; }
        var fixIdCnt = 0;
        var slots = this.slotsByNonUniqueShiftIndex();
        var result = new gGrammarParsingLeafStateTransitions();
        Object.values(slots).forEach(function (slot) {
            slot.forEach(function (shift) {
                var shidx = fixIds ? fixIdCnt++ : shift.shiftIndex;
                var dupWithFixedId = new gRTShift(shidx, shift.tokenId, shift.stepIntoRecursive);
                result.add(dupWithFixedId);
            });
        });
        return result;
    };
    gGrammarParsingLeafStateTransitions.prototype.fixedClone = function () {
        return this.clone(true);
    };
    return gGrammarParsingLeafStateTransitions;
}(GrammarParsingLeafStateTransitions));
exports.gGrammarParsingLeafStateTransitions = gGrammarParsingLeafStateTransitions;
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
        else if (this.reducedNodes) {
            for (var i = 0; i < this.reducedNodes.length; i++) {
                var a = this.reducedNodes[i];
                var b = table.reducedNodes[i];
                if (slen(a) !== slen(b)) {
                    return debuggerTrap(false);
                }
                else if (a) {
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
    function GrammarParsingLeafStateCommon() {
        this.reduceActions = null;
    }
    Object.defineProperty(GrammarParsingLeafStateCommon.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (!this._transitions) {
                if (this.serialStateMap) {
                    this._transitions = new GrammarParsingLeafStateTransitions();
                    this.recursiveShifts = new GrammarParsingLeafStateTransitions();
                    if (!this.reduceActions) {
                        this.reduceActions = new GrammarParsingLeafStateReduces();
                    }
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
                    var chkUniqShi = {};
                    var pushToMap_1 = function (s, tokenId, map, chkUniqShi) {
                        if (chkUniqShi) {
                            if (chkUniqShi[s.item.stateNode.index]) {
                                throw new Error("state index not unique : " + s.item.stateNode.index);
                            }
                            chkUniqShi[s.item.stateNode.index] = 1;
                        }
                        var ts = map.map[tokenId];
                        if (!ts) {
                            map.map[tokenId] = ts = [];
                        }
                        var stk = _1.Analysis.createStackShiftNode(s.item.stateNode.index, null);
                        var shift = new RTShift(shiftIndex, stk);
                        ts.push(shift);
                    };
                    var shiftIndex = 0;
                    this.startStateNode.shiftsAndReduces.forEach(function (nextTerm) {
                        switch (nextTerm.kind) {
                            case _1.ShiftReduceKind.SHIFT:
                                var s = nextTerm;
                                pushToMap_1(s, s.item.node.tokenId, _this._transitions);
                                pushToMap_1(s, s.item.node.tokenId, _this.serialStateMap, chkUniqShi);
                                shiftIndex++;
                                break;
                            // these are the rule-ref recursive states
                            // these have unknown jumping-in tokens, so 
                            // we should handle more complex states in runtime 
                            case _1.ShiftReduceKind.SHIFT_RECURSIVE:
                                var sr = nextTerm;
                                pushToMap_1(sr, 0, _this.recursiveShifts);
                                pushToMap_1(sr, 0, _this.serialStateMap, chkUniqShi);
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
        if (newSerialStateMap && !this.reduceActions) {
            throw new Error("Invalid state...");
        }
        this._transitions = null;
        this.recursiveShifts = null;
        this.serialStateMap = newSerialStateMap;
    };
    GrammarParsingLeafStateCommon.prototype.ser = function () {
        var smx = this.serialStateMap ? this.serialStateMap.index : 0;
        var rdx = this.reduceActions ? this.reduceActions.index : 0;
        var tuple = [smx, rdx];
        return tuple;
    };
    GrammarParsingLeafStateCommon.prototype.deser = function (packedIndex, buf, pos) {
        this.packedIndex = packedIndex;
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
        this.transitions;
        table.transitions;
        if (this.packedIndex !== table.packedIndex) {
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
        else if (!this.transitions.diagnosticEqualityCheck(table.transitions)) {
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
    GrammarParsingLeafState.prototype.lazyCommon = function (parseTable) {
        if (!this.common) {
            if (this.commonIndex) {
                this.common = parseTable.leafStateCommon(this.commonIndex);
            }
            else if (this.startStateNode) {
                if (this.startStateNode.common) {
                    this.common = parseTable.leafStateCommon(this.startStateNode.common.index);
                    if (!this.common.startStateNode) {
                        this.common.startStateNode = this.startStateNode.common;
                    }
                }
            }
            else {
                console.warn("Uninitilized GrammarParsingLeafState");
            }
        }
    };
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
            }
            else {
                console.warn("Uninitilized GrammarParsingLeafState");
            }
        }
        this.lazyCommon(parseTable);
        if (this.common) {
            // lazy
            this.common.transitions;
        }
    };
    GrammarParsingLeafState.prototype.ser = function () {
        var spidx = this.startingPoint ? this.startingPoint.nodeIdx : 0;
        var rdx = this.reduceActions ? this.reduceActions.index : 0;
        var stcmidx = this.commonIndex ? this.commonIndex
            : (this.common ? this.common.replacedIndex : 0);
        var tuple = [spidx, rdx, stcmidx];
        return tuple;
    };
    GrammarParsingLeafState.prototype.deser = function (packedIndex, buf, pos) {
        var _a = [buf[pos++], buf[pos++], buf[pos++]], spx = _a[0], rdind = _a[1], cmni = _a[2];
        this.packedIndex = packedIndex;
        this.startingPoint = spx ? _1.HyperG.nodeTable[spx] : null;
        this.reduceActions = _1.Analysis.leafStateReduceTables[rdind];
        this.commonIndex = cmni;
        if (!this.reduceActions)
            this.reduceActions = new GrammarParsingLeafStateReduces();
        return pos;
    };
    GrammarParsingLeafState.prototype.diagnosticEqualityCheck = function (table) {
        if (this.packedIndex !== table.packedIndex) {
            return debuggerTrap(false);
        }
        else if (this.commonIndex !== table.commonIndex) {
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