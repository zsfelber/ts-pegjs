"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarParsingLeafState = exports.GrammarParsingLeafStateCommon = exports.GrammarParsingLeafStateReduces = exports.GrammarParsingLeafStateTransitions = exports.RTReduce = exports.RTShift = exports.ParseTable = void 0;
var _1 = require(".");
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
    function ParseTable(rule, startingState, allStates) {
        this.rule = rule;
        this.startingState = startingState;
        this.allStates = allStates;
    }
    ParseTable.prototype.pack = function () {
        if (this.allStates.length > _1.Analysis.uniformMaxStateId) {
            throw new Error("State id overflow. Grammar too big. uniformMaxStateId:" + _1.Analysis.uniformMaxStateId + "  Too many states:" + this.allStates.length);
        }
        // !
        _1.Analysis.leafStates = [];
        var t0 = Object.keys(_1.Analysis.serializedTransitions).length;
        var r0 = Object.keys(_1.Analysis.serializedReduces).length;
        var sc0 = Object.keys(_1.Analysis.serializedStateCommons).length;
        // indexes
        // 1 based
        // 0 means empty
        var transidx = t0 + 1;
        var redidx = r0 + 1;
        var cmnidx = sc0 + 1;
        prstate(this.startingState);
        this.allStates.forEach(function (state) {
            prstate(state);
        });
        var tp = Object.keys(_1.Analysis.serializedTuples).length;
        var sts = 1 + this.allStates.length;
        _1.Analysis.totalStates += sts;
        console.log(this.rule.rule + "   states:" + (sts) + "     Total: [ total states:" + _1.Analysis.totalStates + "  distinct:" + (tp) + "    total states/common:" + varShReqs.n + "   distinct:" + (cmnidx) + "    distinct transitions:" + (transidx) + "    distinct reduces:" + (redidx) + "   jmp.tokens:" + varTkns.mean.toFixed(1) + "+-" + varTkns.sqrtVariance.toFixed(1) + "   shift/tkns:" + varShs.mean.toFixed(1) + "+-" + varShs.sqrtVariance.toFixed(1) + "   rec.shift:" + varShReqs.mean.toFixed(1) + "+-" + varShReqs.sqrtVariance.toFixed(1) + "  reduces:" + varRds.mean.toFixed(1) + "+-" + varRds.sqrtVariance.toFixed(1) + " ]");
        function prstate(state) {
            // lazy
            state.lazy();
            var tots = [0, 0, 0, 0];
            prscmn(state.common);
            var rs1 = red(state.reduceActions);
            varRds.add(rs1);
            var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
            var stcmidx = state.common ? state.common.index : 0;
            var tuple = [spidx, state.reduceActions.index, stcmidx];
            var tkey = _1.CodeTblToHex(tuple).join("");
            var tuple0 = _1.Analysis.serializedTuples[tkey];
            if (tuple0) {
                state.serializedTuple = tuple0;
            }
            else {
                state.serializedTuple = tuple;
                _1.Analysis.serializedTuples[tkey] = tuple;
            }
        }
        function prscmn(state) {
            if (state && !state.serializedTuple) {
                // lazy
                state.transitions;
                var tots = [0, 0, 0, 0];
                tra(state.serialStateMap, tots);
                var nonreq = tots[0], nonreqtot = tots[1], req = tots[2], reqtot = tots[3];
                if (nonreq) {
                    varTkns.add(nonreq);
                    varShs.add(nonreqtot / nonreq);
                }
                if (req) {
                    if (req !== 1) {
                        throw new Error("req !== 1  " + req + " !== " + 1);
                    }
                }
                varShReqs.add(reqtot);
                var rs1 = red(state.reduceActions);
                varRds.add(rs1);
                var tuple = [state.serialStateMap.index, state.reduceActions.index];
                var tkey = _1.CodeTblToHex(tuple).join("");
                var state0 = _1.Analysis.serializedStateCommons[tkey];
                if (state0) {
                    state.index = state0.index;
                    state.serializedTuple = tuple;
                }
                else {
                    state.index = cmnidx++;
                    state.serializedTuple = tuple;
                    _1.Analysis.serializedStateCommons[tkey] = state;
                }
            }
        }
        function tra(trans, maplen) {
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
                }
                else {
                    trans.index = transidx++;
                    _1.Analysis.serializedTransitions[encoded] = trans;
                }
            }
            else {
                trans.index = 0;
            }
            return shiftses.length;
        }
        function red(rr) {
            var rlen = rr.reducedNodes.length;
            if (rlen) {
                var buf = [];
                rr.alreadySerialized = null;
                rr.ser(buf);
                rr.alreadySerialized = buf;
                var encred = _1.CodeTblToHex(buf).join("");
                var rr0 = _1.Analysis.serializedReduces[encred];
                if (rr0) {
                    rr.index = rr0.index;
                }
                else {
                    rr.index = redidx++;
                    _1.Analysis.serializedReduces[encred] = rr;
                }
            }
            else {
                rr.index = 0;
            }
            return rlen;
        }
    };
    ParseTable.deserialize = function (rule, buf) {
        var result = new ParseTable(rule, null, []);
        var pos = result.deser(buf);
        if (pos !== buf.length)
            throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
        return result;
    };
    ParseTable.prototype.ser = function () {
        this.pack();
        var serStates = [];
        this.startingState.ser(serStates);
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
        var st0 = _1.Analysis.leafState(1);
        pos = st0.deser(1, buf, pos);
        this.startingState = st0;
        stlen++;
        for (var i = 2; i <= stlen; i++) {
            var st = _1.Analysis.leafState(i);
            pos = st.deser(i, buf, pos);
            this.allStates.push(st);
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
        return "ParseTable/" + this.rule.rule + "/" + (1 + this.allStates.length) + " states";
    };
    return ParseTable;
}());
exports.ParseTable = ParseTable;
var RTShift = /** @class */ (function () {
    function RTShift(shiftIndex, toState) {
        this.shiftIndex = shiftIndex;
        this.toState = toState;
    }
    RTShift.prototype.diagnosticEqualityCheck = function (table) {
        if (this.shiftIndex !== table.shiftIndex) {
            return debuggerTrap(false);
        }
        else if (this.toState !== table.toState) {
            return debuggerTrap(false);
        }
        return debuggerTrap(true);
    };
    return RTShift;
}());
exports.RTShift = RTShift;
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
    function GrammarParsingLeafStateTransitions() {
        this.map = {};
    }
    GrammarParsingLeafStateTransitions.prototype.ser = function (buf) {
        var ord = [];
        var es = Object.entries(this.map);
        es.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var dti = shift.toState.index;
                ord.push([shift.shiftIndex, dti, tokenId]);
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
        ord.forEach(function (_a) {
            var shi = _a[0], sti = _a[1], tki = _a[2];
            if (shi !== idx) {
                throw new Error("shi !== idx   " + shi + " !== " + idx);
            }
            buf.push(sti);
            buf.push(tki);
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
            var state = _1.Analysis.leafState(sti);
            var shift = new RTShift(idx, state);
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
                        var shift = new RTShift(shiftIndex, s.item.stateNode.generateState());
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
    GrammarParsingLeafState.prototype.lazy = function () {
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
                    this.common = _1.Analysis.leafStateCommon(this.startStateNode.common.index);
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
var IncVariator = /** @class */ (function () {
    function IncVariator() {
        this.K = 0;
        this.n = 0;
        this.Ex = 0;
        this.Ex2 = 0;
    }
    IncVariator.prototype.add = function (x) {
        if (this.n === 0)
            this.K = x;
        this.n++;
        this.Ex += x - this.K;
        this.Ex2 += (x - this.K) * (x - this.K);
    };
    Object.defineProperty(IncVariator.prototype, "mean", {
        get: function () {
            return this.K + this.Ex / this.n;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "variance", {
        get: function () {
            return (this.Ex2 - (this.Ex * this.Ex) / this.n) / (this.n - 1);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "sqrtVariance", {
        get: function () {
            return Math.sqrt(this.variance);
        },
        enumerable: false,
        configurable: true
    });
    return IncVariator;
}());
var varShs = new IncVariator();
var varShReqs = new IncVariator();
var varTkns = new IncVariator();
var varRds = new IncVariator();
//# sourceMappingURL=analyzer-rt.js.map