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
    Analysis.ERRORS = 0;
})(Analysis = exports.Analysis || (exports.Analysis = {}));
var Factory;
(function (Factory) {
    Factory.parseTables = {};
    function createTraverser(parser, parent, node) {
        switch (node.kind) {
            case _1.PNodeKind.CHOICE:
                return new ChoiceTraverser(parser, parent, node);
            case _1.PNodeKind.SEQUENCE:
            case _1.PNodeKind.SINGLE:
                return new SequenceTraverser(parser, parent, node);
            case _1.PNodeKind.OPTIONAL:
                return new OptionalTraverser(parser, parent, node);
            case _1.PNodeKind.SEMANTIC_AND:
                return new SemanticAndTraverser(parser, parent, node);
            case _1.PNodeKind.SEMANTIC_NOT:
                return new SemanticNotTraverser(parser, parent, node);
            case _1.PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreTraverser(parser, parent, node);
            case _1.PNodeKind.ONE_OR_MORE:
                return new OneOrMoreTraverser(parser, parent, node);
            case _1.PNodeKind.RULE_REF:
                return new RuleRefTraverser(parser, parent, node);
            case _1.PNodeKind.TERMINAL_REF:
                return new TerminalRefTraverser(parser, parent, node);
            case _1.PNodeKind.RULE:
                return new EntryPointTraverser(parser, parent, node);
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
    function ParseTable(rule) {
        var _this = this;
        // Map  Leaf parser nodeIdx -> 
        this.allStates = [];
        this.allRuleReferences = [];
        this.allTerminalReferences = [];
        this.childRules = {};
        this.allNodes = {};
        this.rule = rule;
        var traverser = new EntryPointTraverser(this, null, rule);
        // loads all :)
        while (this.allRuleReferences.some(function (ruleRef) { return ruleRef.lazy(); }))
            ;
        this.firstSteps = [];
        traverser.possibleFirstSteps([], this.firstSteps);
        this.allTerminalReferences.forEach(function (previousStep) {
            previousStep.possibleNextSteps(null, null);
        });
        var startingState = new GrammarAnalysisState(null, this.firstSteps);
        //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
        //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
        this.startingState = startingState;
        this.allTerminalReferences.forEach(function (t) {
            t.state.index = _this.allStates.length;
            _this.allStates.push(t.state);
        });
        console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.childRules).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   terminal nodes:" + this.allTerminalReferences.length + "  states:" + this.allStates.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);
    }
    ParseTable.createForRule = function (rule) {
        var parseTable = Factory.parseTables[rule.rule];
        if (!parseTable) {
            parseTable = new ParseTable(rule);
            Factory.parseTables[rule.rule] = parseTable;
        }
        return parseTable;
    };
    ParseTable.prototype.getReferencedRule = function (node) {
        var rule;
        rule = this.childRules[node.rule];
        if (!rule) {
            rule = new EntryPointTraverser(this, null, node);
            this.childRules[node.rule] = rule;
        }
        return rule;
    };
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
            if (!this._transitions) {
                this._transitions = {};
                this.steps.forEach(function (nextTerm) {
                    if (!_this._transitions[nextTerm.node.value]) {
                        _this._transitions[nextTerm.node.value] = nextTerm.state;
                    }
                });
            }
            return this._transitions;
        },
        enumerable: false,
        configurable: true
    });
    GrammarAnalysisState.prototype.ser = function (maxTknId) {
        var toTknIds = [];
        toTknIds[maxTknId] = 0;
        Object.entries(this.transitions).forEach(function (_a) {
            var key = _a[0], trans = _a[1];
            var tokenId = Number(key);
            toTknIds[tokenId] = trans.index;
        });
        return toTknIds;
    };
    return GrammarAnalysisState;
}());
exports.GrammarAnalysisState = GrammarAnalysisState;
// NOTE Not exported.  The only exported one is EntryPointTraverser
var RuleElementTraverser = /** @class */ (function () {
    function RuleElementTraverser(parser, parent, node) {
        var _this = this;
        this.children = [];
        this.parent = parent;
        this.parser = parser;
        this.node = node;
        this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
        this.parser.allNodes[this.node.nodeIdx] = this;
        this.node.children.forEach(function (n) {
            _this.children.push(Factory.createTraverser(parser, _this, n));
        });
        //if (this.checkConstructFailed()) {
        //  throw new Error("Ast construction failed.");
        //}
    }
    RuleElementTraverser.prototype.checkConstructFailed = function () {
    };
    RuleElementTraverser.prototype.possibleNextSteps = function (nextStepsFromTerminal, fromChild) {
        if (this.parent)
            this.parent.possibleNextSteps(nextStepsFromTerminal, this);
    };
    RuleElementTraverser.prototype.findParent = function (node, incl) {
        if (incl === void 0) { incl = false; }
        if (node === this.node && incl) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findParent(node, true);
        }
        else {
            return null;
        }
    };
    RuleElementTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    return RuleElementTraverser;
}());
// NOTE Not exported.  The only exported one is EntryPointTraverser
var ChoiceTraverser = /** @class */ (function (_super) {
    __extends(ChoiceTraverser, _super);
    function ChoiceTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ChoiceTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        this.children.forEach(function (ch) {
            ch.possibleFirstSteps(traversionPath, firstSteps);
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
    SequenceTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        this.children[0].possibleFirstSteps(traversionPath, firstSteps);
    };
    SequenceTraverser.prototype.possibleNextSteps = function (nextStepsFromTerminal, fromChild) {
        var ind = this.children.indexOf(fromChild) + 1;
        if (ind < this.children.length) {
            this.children[ind].possibleFirstSteps([], nextStepsFromTerminal);
        }
        else if (this.parent) {
            this.parent.possibleNextSteps(nextStepsFromTerminal, this);
        }
    };
    return SequenceTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var SingleCollectionTraverser = /** @class */ (function (_super) {
    __extends(SingleCollectionTraverser, _super);
    function SingleCollectionTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.child = _this.children[0];
        return _this;
    }
    SingleCollectionTraverser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 1) {
            console.error("this.children.length:" + this.children.length + " !== 1  " + this.node);
            return 1;
        }
    };
    SingleCollectionTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        this.child.possibleFirstSteps(traversionPath, firstSteps);
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
            console.error("this.children.length !== 0  " + this.node);
            return 1;
        }
    };
    EmptyTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
    };
    return EmptyTraverser;
}(RuleElementTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var OptionalTraverser = /** @class */ (function (_super) {
    __extends(OptionalTraverser, _super);
    function OptionalTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OptionalTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        this.child.possibleFirstSteps(traversionPath, firstSteps);
        if (this.parent)
            this.parent.possibleNextSteps(firstSteps, this);
    };
    return OptionalTraverser;
}(SingleTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var ZeroOrMoreTraverser = /** @class */ (function (_super) {
    __extends(ZeroOrMoreTraverser, _super);
    function ZeroOrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ZeroOrMoreTraverser.prototype.possibleNextSteps = function (nextStepsFromTerminal, fromChild) {
        this.possibleFirstSteps([], nextStepsFromTerminal);
        if (this.parent)
            this.parent.possibleNextSteps(nextStepsFromTerminal, this);
    };
    ZeroOrMoreTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        this.child.possibleFirstSteps(traversionPath, firstSteps);
        if (this.parent)
            this.parent.possibleNextSteps(firstSteps, this);
    };
    return ZeroOrMoreTraverser;
}(SingleCollectionTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var OneOrMoreTraverser = /** @class */ (function (_super) {
    __extends(OneOrMoreTraverser, _super);
    function OneOrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OneOrMoreTraverser.prototype.possibleNextSteps = function (nextStepsFromTerminal, fromChild) {
        this.possibleFirstSteps([], nextStepsFromTerminal);
        if (this.parent)
            this.parent.possibleNextSteps(nextStepsFromTerminal, this);
    };
    return OneOrMoreTraverser;
}(SingleCollectionTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var RuleRefTraverser = /** @class */ (function (_super) {
    __extends(RuleRefTraverser, _super);
    function RuleRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.parser.allRuleReferences.push(_this);
        _this.targetRule = Analysis.ruleTable[_this.node.ruleIndex];
        _this.recursive = !!_this.findRuleNodeParent(_this.node.rule);
        return _this;
    }
    RuleRefTraverser.prototype.lazy = function () {
        if (this.linkedRuleEntry) {
            return false;
        }
        else {
            this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
            return true;
        }
    };
    RuleRefTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
        if (!this.targetRule) {
            console.error("no this.targetRule  " + this.node);
            dirty = 1;
        }
        this.recursive = !!this.findRuleNodeParent(this.node.rule);
        if (this.recursive) {
            console.warn("recursive : " + this.node);
        }
        return dirty;
    };
    RuleRefTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        // we don't create cycle
        // also, it is semantically correct...
        if (traversionPath[this.targetRule.nodeIdx]) {
            //console.warn("backward jump : " + this.node+"->"+this.parser.allNodes.get(this.targetRule.nodeIdx).node);
        }
        else {
            this.linkedRuleEntry.possibleFirstSteps(traversionPath, firstSteps);
        }
    };
    RuleRefTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (incl && rule === this.node.rule) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    return RuleRefTraverser;
}(EmptyTraverser));
// NOTE Not exported.  The only exported one is EntryPointTraverser
var TerminalRefTraverser = /** @class */ (function (_super) {
    __extends(TerminalRefTraverser, _super);
    function TerminalRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.nextStepsFromTerminal = [];
        parser.allTerminalReferences.push(_this);
        if (_this.node && _this.node.value > parser.maxTokenId)
            parser.maxTokenId = _this.node.value;
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
    TerminalRefTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        firstSteps.push(this);
    };
    TerminalRefTraverser.prototype.possibleNextSteps = function (nextStepsFromTerminal, fromChild) {
        if (this.parent)
            this.parent.possibleNextSteps(this.nextStepsFromTerminal, this);
        this.state = new GrammarAnalysisState(this, this.nextStepsFromTerminal);
    };
    return TerminalRefTraverser;
}(EmptyTraverser));
var EntryPointTraverser = /** @class */ (function (_super) {
    __extends(EntryPointTraverser, _super);
    function EntryPointTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.index = node.index;
        return _this;
    }
    EntryPointTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (incl && rule === this.node.rule) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    EntryPointTraverser.prototype.possibleFirstSteps = function (traversionPath, firstSteps) {
        traversionPath[this.node.nodeIdx] = this;
        this.child.possibleFirstSteps(traversionPath, firstSteps);
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
            console.error("No parser.node.action or .action.fun   " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    return SemanticTraverser;
}(EmptyTraverser));
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