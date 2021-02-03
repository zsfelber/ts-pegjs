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
exports.EntryPointTraverser = exports.GrammarAnalysisState = exports.ParseTable = exports.Analysis = void 0;
var _1 = require(".");
var Analysis;
(function (Analysis) {
})(Analysis = exports.Analysis || (exports.Analysis = {}));
var Factory;
(function (Factory) {
    Factory.allTerminals = [];
    Factory.maxTokenId = 0;
    function createTraverser(parent, node) {
        switch (node.kind) {
            case _1.PNodeKind.CHOICE:
                return new ChoiceTraverser(parent, node);
            case _1.PNodeKind.SEQUENCE:
            case _1.PNodeKind.SINGLE:
                return new SequenceTraverser(parent, node);
            case _1.PNodeKind.OPTIONAL:
                return new OptionalTraverser(parent, node);
            case _1.PNodeKind.SEMANTIC_AND:
                return new SemanticAndTraverser(parent, node);
            case _1.PNodeKind.SEMANTIC_NOT:
                return new SemanticNotTraverser(parent, node);
            case _1.PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreTraverser(parent, node);
            case _1.PNodeKind.ONE_OR_MORE:
                return new OneOrMoreTraverser(parent, node);
            case _1.PNodeKind.RULE_REF:
                return new RuleRefTraverser(parent, node);
            case _1.PNodeKind.TERMINAL_REF:
                return new TerminalRefTraverser(parent, node);
            case _1.PNodeKind.RULE:
                return new EntryPointTraverser(parent, node);
        }
    }
    Factory.createTraverser = createTraverser;
})(Factory || (Factory = {}));
function hex3(c) {
    if (c < 16)
        return '00' + c.toString(16).toUpperCase();
    else if (c < 256)
        return '0' + c.toString(16).toUpperCase();
    else if (c < 4096)
        return '' + c.toString(16).toUpperCase();
    else
        return "???";
}
function hex2(c) {
    if (c < 16)
        return '0' + c.toString(16).toUpperCase();
    else if (c < 256)
        return '' + c.toString(16).toUpperCase();
    else
        return "??";
}
var ParseTable = /** @class */ (function () {
    function ParseTable(startingState, allTerminals, maxTokenId) {
        var _this = this;
        // Map  Leaf parser nodeIdx -> 
        this.allStates = [];
        this.startingState = startingState;
        allTerminals.forEach(function (t) {
            t.state.index = _this.allStates.length;
            _this.allStates.push(t.state);
        });
        this.maxTokenId = maxTokenId;
    }
    ParseTable.prototype.ser = function () {
        var _this = this;
        var serStates = [];
        this.allStates.forEach(function (s) {
            serStates = serStates.concat(s.ser(_this.maxTokenId));
        });
        var result = [this.allStates.length, this.maxTokenId].concat(serStates);
        return result;
    };
    return ParseTable;
}());
exports.ParseTable = ParseTable;
var GrammarAnalysisState = /** @class */ (function () {
    function GrammarAnalysisState(startingPointTraverser, steps) {
        this.startingPoint = startingPointTraverser ? startingPointTraverser.node : null;
        this.steps = steps;
    }
    Object.defineProperty(GrammarAnalysisState.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (this._transitions) {
                return this._transitions;
            }
            else {
                this._transitions = new Map;
                this.steps.forEach(function (nextTerm) {
                    if (!_this.transitions.get(nextTerm.node.value)) {
                        _this.transitions.set(nextTerm.node.value, nextTerm.state);
                    }
                });
            }
        },
        enumerable: false,
        configurable: true
    });
    GrammarAnalysisState.prototype.ser = function (maxTknId) {
        var toTknIds = [];
        toTknIds[maxTknId] = 0;
        this.transitions.forEach(function (trans, tokenId) {
            toTknIds[tokenId] = trans.index;
        });
        return toTknIds;
    };
    return GrammarAnalysisState;
}());
exports.GrammarAnalysisState = GrammarAnalysisState;
// NOTE Not exported.  The only exported one is EntryPointTraverser
var RuleElementTraverser = /** @class */ (function () {
    function RuleElementTraverser(parent, node) {
        var _this = this;
        this.children = [];
        this.parent = parent;
        this.node = node;
        this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
        if (this.parent) {
            var loopNode = this.parent.findFirstLoop(this.node);
            if (loopNode && loopNode[0]) {
                if (loopNode[1])
                    console.error("Infinitely recursive ast construction is not supported. Loop found :\n" + loopNode[1].chainToString().map(function (itm) { return "   " + itm; }).join("\n"));
                else
                    console.error("Infinitely recursive ast construction is not supported. Loop found ?:\n" + loopNode[0].chainToString().map(function (itm) { return "   " + itm; }).join("\n"));
                throw new Error("Ast validation error.");
            }
        }
        this.node.children.forEach(function (n) {
            _this.children.push(Factory.createTraverser(_this, n));
        });
        if (this.checkConstructFailed()) {
            throw new Error("Ast construction failed.");
        }
    }
    RuleElementTraverser.prototype.checkConstructFailed = function () {
    };
    RuleElementTraverser.prototype.possibleNextSteps = function (stepsFromTerminal, fromChild) {
        this.parent.possibleNextSteps(stepsFromTerminal, this);
    };
    RuleElementTraverser.prototype.findFirstLoop = function (node) {
        if (node === this.node) {
            if (this.parent) {
                var loop1st = this.parent.findFirstLoop(node);
                if (loop1st && loop1st[0]) {
                    if (loop1st[1]) {
                        return loop1st;
                    }
                    else {
                        return [loop1st[0], this];
                    }
                }
            }
            return [this];
        }
        else if (this.parent) {
            return this.parent.findFirstLoop(node);
        }
        else {
            return null;
        }
    };
    RuleElementTraverser.prototype.chainToString = function () {
        var result = [];
        if (this.parent) {
            result = result.concat(this.parent.chainToString());
        }
        else {
            result = [this.node.toString()];
        }
        return result;
    };
    return RuleElementTraverser;
}());
// NOTE Not exported.  The only exported one is EntryPointTraverser
var ChoiceTraverser = /** @class */ (function (_super) {
    __extends(ChoiceTraverser, _super);
    function ChoiceTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ChoiceTraverser.prototype.possibleFirstSteps = function (firstSteps) {
        this.children.forEach(function (ch) {
            ch.possibleFirstSteps(firstSteps);
        });
    };
    return ChoiceTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SequenceTraverser = /** @class */ (function (_super) {
    __extends(SequenceTraverser, _super);
    function SequenceTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SequenceTraverser.prototype.checkConstructFailed = function () {
        if (!this.children.length) {
            console.error("!parser.children.length (empty sequence)  " + this.node);
            return 1;
        }
    };
    SequenceTraverser.prototype.possibleFirstSteps = function (firstSteps) {
        this.children[0].possibleFirstSteps(firstSteps);
    };
    SequenceTraverser.prototype.possibleNextSteps = function (stepsFromTerminal, fromChild) {
        var ind = this.children.indexOf(fromChild) + 1;
        if (ind < this.children.length) {
            this.children[ind].possibleFirstSteps(stepsFromTerminal);
        }
        else {
            this.parent.possibleNextSteps(stepsFromTerminal, this);
        }
    };
    return SequenceTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SingleCollectionTraverser = /** @class */ (function (_super) {
    __extends(SingleCollectionTraverser, _super);
    function SingleCollectionTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleCollectionTraverser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 1) {
            console.error("parser.children.length !== 1  " + this.node);
            return 1;
        }
        this.child = this.children[0];
    };
    SingleCollectionTraverser.prototype.possibleFirstSteps = function (firstSteps) {
        this.child.possibleFirstSteps(firstSteps);
    };
    return SingleCollectionTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SingleTraverser = /** @class */ (function (_super) {
    __extends(SingleTraverser, _super);
    function SingleTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SingleTraverser;
}(SingleCollectionTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var EmptyTraverser = /** @class */ (function (_super) {
    __extends(EmptyTraverser, _super);
    function EmptyTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyTraverser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 0) {
            console.error("parser.children.length !== 0  " + this.node);
            return 1;
        }
    };
    EmptyTraverser.prototype.possibleFirstSteps = function (firstSteps) {
    };
    return EmptyTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var OptionalTraverser = /** @class */ (function (_super) {
    __extends(OptionalTraverser, _super);
    function OptionalTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return OptionalTraverser;
}(SingleTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var ZeroOrMoreTraverser = /** @class */ (function (_super) {
    __extends(ZeroOrMoreTraverser, _super);
    function ZeroOrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ZeroOrMoreTraverser.prototype.possibleNextSteps = function (stepsFromTerminal, fromChild) {
        this.possibleFirstSteps(stepsFromTerminal);
        this.parent.possibleNextSteps(stepsFromTerminal, this);
    };
    return ZeroOrMoreTraverser;
}(SingleCollectionTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var OneOrMoreTraverser = /** @class */ (function (_super) {
    __extends(OneOrMoreTraverser, _super);
    function OneOrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OneOrMoreTraverser.prototype.possibleNextSteps = function (stepsFromTerminal, fromChild) {
        this.possibleFirstSteps(stepsFromTerminal);
        this.parent.possibleNextSteps(stepsFromTerminal, this);
    };
    return OneOrMoreTraverser;
}(SingleCollectionTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var RuleRefTraverser = /** @class */ (function (_super) {
    __extends(RuleRefTraverser, _super);
    function RuleRefTraverser(parent, node) {
        var _this = _super.call(this, parent, node) || this;
        // we duplicate rule refs in traverser because each and 
        // its descandacts are having another states in every 
        // position it is linked :
        _this.ruleEntryTraverserDup = new EntryPointTraverser(_this, Analysis.ruleTable[node.ruleIndex]);
        return _this;
    }
    RuleRefTraverser.prototype.possibleFirstSteps = function (firstSteps) {
        this.ruleEntryTraverserDup.possibleFirstSteps(firstSteps);
    };
    return RuleRefTraverser;
}(EmptyTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var TerminalRefTraverser = /** @class */ (function (_super) {
    __extends(TerminalRefTraverser, _super);
    function TerminalRefTraverser(parent, node) {
        var _this = _super.call(this, parent, node) || this;
        _this.stepsFromTerminal = [];
        Factory.allTerminals.push(_this);
        if (_this.node && _this.node.value > Factory.maxTokenId)
            Factory.maxTokenId = _this.node.value;
        return _this;
    }
    TerminalRefTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.terminal) {
            console.error("no this.node.terminal  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    TerminalRefTraverser.prototype.possibleFirstSteps = function (firstSteps) {
        firstSteps.push(this);
    };
    TerminalRefTraverser.prototype.possibleNextSteps = function (stepsFromTerminal, fromChild) {
        this.parent.possibleNextSteps(this.stepsFromTerminal, this);
        this.state = new GrammarAnalysisState(this, this.stepsFromTerminal);
    };
    return TerminalRefTraverser;
}(EmptyTraverser));
var EntryPointTraverser = /** @class */ (function (_super) {
    __extends(EntryPointTraverser, _super);
    function EntryPointTraverser(parent, node) {
        var _this = _super.call(this, parent, node) || this;
        _this.index = node.index;
        return _this;
    }
    EntryPointTraverser.prototype.generateParseTreeTraversionTable = function () {
        Factory.allTerminals = [];
        var firstSteps = [];
        this.possibleFirstSteps(firstSteps);
        firstSteps.forEach(function (terminal) {
            terminal.possibleNextSteps(null, null);
        });
        var step0 = new GrammarAnalysisState(null, firstSteps);
        var result = new ParseTable(step0, Factory.allTerminals, Factory.maxTokenId);
        return result;
    };
    return EntryPointTraverser;
}(SingleTraverser));
exports.EntryPointTraverser = EntryPointTraverser;
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SemanticTraverser = /** @class */ (function (_super) {
    __extends(SemanticTraverser, _super);
    function SemanticTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.action || !this.node.action.fun) {
            console.error("No parser.node.action or .action.fun");
            dirty = 1;
        }
        return dirty;
    };
    return SemanticTraverser;
}(SingleTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SemanticAndTraverser = /** @class */ (function (_super) {
    __extends(SemanticAndTraverser, _super);
    function SemanticAndTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SemanticAndTraverser;
}(SemanticTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SemanticNotTraverser = /** @class */ (function (_super) {
    __extends(SemanticNotTraverser, _super);
    function SemanticNotTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SemanticNotTraverser;
}(SingleTraverser));
//# sourceMappingURL=analyzer.js.map