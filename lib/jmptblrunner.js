"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JumpTableRunner = exports.JumpTables = void 0;
var lib_1 = require("../lib");
var analyzer_1 = require("./analyzer");
var interpreter_1 = require("./interpreter");
var packrat_1 = require("./packrat");
var lib_2 = require("../lib");
var JumpTables;
(function (JumpTables) {
})(JumpTables = exports.JumpTables || (exports.JumpTables = {}));
var JumpTableRunner = /** @class */ (function () {
    function JumpTableRunner(owner, parseTable, packrat) {
        this.owner = owner;
        this.parseTable = parseTable;
        this.packrat = packrat ? packrat : new packrat_1.Packrat(owner);
        this.numRules = owner.numRules;
        this.reduce = [];
    }
    Object.defineProperty(JumpTableRunner.prototype, "result", {
        get: function () {
            // maybe rolling up
            //return this.reduce[this.parseTable.rule.nodeIdx];
            return this.reduce[this.parseTable.rule.children[0].nodeIdx];
        },
        enumerable: false,
        configurable: true
    });
    JumpTableRunner.prototype.reduceBefore = function (currentState) {
        var _this = this;
        currentState.reduceActions.reducedNodes.forEach(function (node) {
            var r = node;
            var args = r.action.args.map(function (arg) { return _this.reduce[arg.evaluate.nodeIdx]; });
            var reduce = new interpreter_1.DeferredReduce(r.action, args, _this.owner.inputPos);
            _this.reduce[r.nodeIdx] = reduce;
        });
    };
    // Not necessary to call, it's just a diagnostical feature
    JumpTableRunner.prototype.reduceEmptyAfter = function (newState) {
        newState.epsilonReduceActions.reducedNodes.forEach(function (node) {
            // ...
        });
    };
    JumpTableRunner.prototype.run = function (withToken) {
        var This = this;
        var owner = this.owner;
        var parseTable = this.parseTable;
        var token;
        if (withToken)
            token = withToken;
        else
            token = owner.next();
        owner.currentRule = parseTable.rule.index;
        // TODO
        var ruleMaxFailPos = 0;
        var currentStates = [parseTable.startingState];
        var stack = [];
        var i = 0;
        var _loop_1 = function () {
            var _a;
            var pushShift = function (newShifts, stack, action) {
                stack.push([currentStates, token, i + 1, owner.inputPos, action]);
                currentStates = newShifts.map(function (shift) { return shift.toState; });
                token = owner.next();
                i = 0;
            };
            var hasRecursionSucceeded = function (rsh) {
                var reqstate = rsh.toState;
                var rr = reqstate.startingPoint;
                var cached = This.packrat.readCacheEntry(lib_1.SerDeser.ruleTable[rr.ruleIndex]);
                if (cached.nextPos !== undefined) {
                    if (cached.result === lib_2.peg$FAILED) {
                        // TODO failures
                        return false;
                    }
                    else {
                        // TODO
                        // REDUCE cached.result;
                        return true;
                    }
                }
                else {
                    var ruleRefTbl = JumpTables.parseTables[rr.ruleIndex];
                    var childRunner = new JumpTableRunner(owner, ruleRefTbl, This.packrat);
                    // TODO deferred( with {} parser) / immedate ( with regular parser )
                    if (childRunner.run(token)) {
                        // TODO result
                        Object.assign(cached, {
                            nextPos: owner.inputPos,
                            maxFailPos: ruleMaxFailPos, result: childRunner.result
                        });
                        return true;
                    }
                    else {
                        // ok skip
                        // FIXME ?? rewind to pos0 here or in ruleRefAutom.run() ??
                    }
                }
                return false;
            };
            var conditionalRecursion = function (rsh, stack) {
                if (hasRecursionSucceeded(rsh)) {
                    pushShift([rsh], stack);
                    return true;
                }
                else {
                    return false;
                }
            };
            for (; i < currentStates.length; i++) {
                currentState = currentStates[i];
                // !! :)  !!
                this_1.reduceBefore(currentState);
                newShifts = currentState.transitions.map[token.tokenId];
                // TODO now multiple
                rshs = currentState.recursiveShifts;
                if (newShifts) {
                    if (!rshs)
                        rshs = new analyzer_1.GrammarParsingLeafStateTransitions();
                    reverseSubStack = [];
                    statesAfterReq = [];
                    nscur = 0;
                    var Lj = rshs[0].length - 1;
                    for (var j = 0; j <= Lj; j++) {
                        rsh = rshs[0][j];
                        // if recursiveShift split to 2 parts:
                        // before and after recursiveShift :
                        statesBeforeReq = [];
                        for (; nscur < newShifts.length; nscur++) {
                            shift = newShifts[nscur];
                            if (shift.shiftIndex < rsh.shiftIndex) {
                                statesBeforeReq.push(shift);
                            }
                            else if (j === Lj) {
                                statesAfterReq.push(shift);
                            }
                            else {
                                break;
                            }
                        }
                        // Then:
                        // First   statesBeforeReq
                        // Second  recursive state
                        // Third   shift to recursive if succeeded / statesAfterReq if recursion failed
                        pushShift(statesBeforeReq, reverseSubStack);
                        pushShift([], reverseSubStack, { fun: conditionalRecursion, args: [rsh, stack] });
                        if (j === Lj) {
                            pushShift(statesAfterReq, reverseSubStack);
                        }
                    }
                    reverseSubStack.reverse();
                    stack = stack.concat(reverseSubStack);
                    // pop
                }
                else if (rshs) {
                    if (!conditionalRecursion(rsh, stack)) {
                        return "continue-maincyc";
                    } // else pop
                }
            }
            if (stack.length) {
                _a = stack.pop(), currentStates = _a[0], token = _a[1], i = _a[2], inputPos = _a[3], action = _a[4];
                owner.inputPos = inputPos;
                if (action) {
                    action.fun.call(this_1, action.args);
                }
            }
            else {
                return "break";
            }
        };
        var this_1 = this, currentState, newShifts, rshs, reverseSubStack, statesAfterReq, nscur, rsh, statesBeforeReq, shift, inputPos, action;
        // NOTE to avoid recursion for each stepping forward one single step  
        maincyc: while (token) {
            var state_1 = _loop_1();
            if (state_1 === "break")
                break;
            switch (state_1) {
                case "continue-maincyc": continue maincyc;
            }
        }
        // TODO better from reduce
        return !token;
    };
    return JumpTableRunner;
}());
exports.JumpTableRunner = JumpTableRunner;
//# sourceMappingURL=jmptblrunner.js.map