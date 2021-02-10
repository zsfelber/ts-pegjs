"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JumpTableRunner = exports.JumpTables = void 0;
var lib_1 = require("../lib");
var interpreter_1 = require("./interpreter");
var packrat_1 = require("./packrat");
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
        currentState.reduceActions.forEach(function (node) {
            var r = node;
            var args = r.action.args.map(function (arg) { return _this.reduce[arg.evaluate.nodeIdx]; });
            var reduce = new interpreter_1.DeferredReduce(r.action, args, _this.owner.inputPos);
            _this.reduce[r.nodeIdx] = reduce;
        });
    };
    // Not necessary to call, it's just a diagnostical feature
    JumpTableRunner.prototype.reduceEmptyAfter = function (newState) {
        newState.epsilonReduceActions.forEach(function (node) {
            // ...
        });
    };
    JumpTableRunner.prototype.run = function (withToken) {
        var _a;
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
        // NOTE to avoid recursion for each stepping forward one single step  
        maincyc: while (token) {
            for (; i < currentStates.length; i++) {
                var currentState = currentStates[i];
                // !! :)  !!
                this.reduceBefore(currentState);
                var newShifts = currentState.transitions[token.tokenId];
                var rsh;
                if (newShifts) {
                    stack.push([currentStates, token, i + 1, owner.inputPos]);
                    currentStates = newShifts.map(function (shift) { return shift.toState; });
                    token = owner.next();
                    i = 0;
                    continue maincyc;
                }
                else if (rsh = currentState.recursiveShift) {
                    var reqstate = rsh.toState;
                    var rr = reqstate.startingPoint;
                    var cached = this.packrat.readCacheEntry(lib_1.SerDeser.ruleTable[rr.ruleIndex]);
                    if (cached.nextPos !== undefined) {
                        stack.push([currentStates, token, i + 1, owner.inputPos]);
                        currentStates = [reqstate];
                        token = owner.next();
                        i = 0;
                        // TODO
                        // REDUCE cached.result;
                        continue maincyc;
                    }
                    else {
                        var ruleRefTbl = JumpTables.parseTables[rr.ruleIndex];
                        var childRunner = new JumpTableRunner(owner, ruleRefTbl, this.packrat);
                        // TODO deferred( with {} parser) / immedate ( with regular parser )
                        if (childRunner.run(token)) {
                            stack.push([currentStates, token, i + 1, owner.inputPos]);
                            currentStates = [reqstate];
                            token = owner.next();
                            i = 0;
                            // TODO result
                            Object.assign(cached, { nextPos: owner.inputPos,
                                maxFailPos: ruleMaxFailPos, result: childRunner.result });
                            continue maincyc;
                        }
                        else {
                            // ok skip
                            // FIXME ?? rewind to pos0 here or in ruleRefAutom.run() ??
                        }
                    }
                }
            }
            if (stack.length) {
                var inputPos;
                _a = stack.pop(), currentStates = _a[0], token = _a[1], i = _a[2], inputPos = _a[3];
                owner.inputPos = inputPos;
            }
            else {
                break;
            }
        }
        // TODO better from reduce
        return !token;
    };
    return JumpTableRunner;
}());
exports.JumpTableRunner = JumpTableRunner;
//# sourceMappingURL=jmptblrunner.js.map