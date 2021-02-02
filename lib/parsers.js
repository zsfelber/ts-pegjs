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
exports.EntryPointParser = exports.PackratRunner = exports.PConss = exports.PCallArg = exports.PFunction = exports.PSemanticNot = exports.PSemanticAnd = exports.PTerminalRef = exports.PRuleRef = exports.PRef = exports.PValueNode = exports.PLogicNode = exports.PTerminal = exports.PRule = exports.PGrammar = exports.PActContainer = exports.PNode = exports.SerDeser = exports.PActionKind = exports.PNodeKind = void 0;
var peg$FAILED = {};
var Codes = [], Strings = [];
var PNodeKind;
(function (PNodeKind) {
    PNodeKind["GRAMMAR"] = "grammar";
    PNodeKind["RULE"] = "rule";
    PNodeKind["TERMINAL"] = "terminal";
    PNodeKind["CHOICE"] = "choice";
    PNodeKind["SEQUENCE"] = "sequence";
    PNodeKind["OPTIONAL"] = "optional";
    PNodeKind["ONE_OR_MORE"] = "one_or_more";
    PNodeKind["ZERO_OR_MORE"] = "zero_or_more";
    PNodeKind["EMPTY"] = "empty";
    PNodeKind["SINGLE"] = "single";
    PNodeKind["SEMANTIC_AND"] = "semantic_and";
    PNodeKind["SEMANTIC_NOT"] = "semantic_not";
    PNodeKind["RULE_REF"] = "rule_ref";
    PNodeKind["TERMINAL_REF"] = "terminal_ref";
})(PNodeKind = exports.PNodeKind || (exports.PNodeKind = {}));
Codes[PNodeKind.GRAMMAR] = 0;
Codes[PNodeKind.RULE] = 1;
Codes[PNodeKind.TERMINAL] = 2;
Codes[PNodeKind.CHOICE] = 3;
Codes[PNodeKind.SEQUENCE] = 4;
Codes[PNodeKind.OPTIONAL] = 5;
Codes[PNodeKind.ONE_OR_MORE] = 6;
Codes[PNodeKind.ZERO_OR_MORE] = 7;
Codes[PNodeKind.EMPTY] = 8;
Codes[PNodeKind.SINGLE] = 9;
Codes[PNodeKind.SEMANTIC_AND] = 10;
Codes[PNodeKind.SEMANTIC_NOT] = 11;
Codes[PNodeKind.RULE_REF] = 12;
Codes[PNodeKind.TERMINAL_REF] = 13;
Strings[0] = PNodeKind.GRAMMAR;
Strings[1] = PNodeKind.RULE;
Strings[2] = PNodeKind.TERMINAL;
Strings[3] = PNodeKind.CHOICE;
Strings[4] = PNodeKind.SEQUENCE;
Strings[5] = PNodeKind.OPTIONAL;
Strings[6] = PNodeKind.ONE_OR_MORE;
Strings[7] = PNodeKind.ZERO_OR_MORE;
Strings[8] = PNodeKind.EMPTY;
Strings[9] = PNodeKind.SINGLE;
Strings[10] = PNodeKind.SEMANTIC_AND;
Strings[11] = PNodeKind.SEMANTIC_NOT;
Strings[12] = PNodeKind.RULE_REF;
Strings[13] = PNodeKind.TERMINAL_REF;
var PActionKind;
(function (PActionKind) {
    PActionKind["RULE"] = "RULE";
    PActionKind["PREDICATE"] = "PREDICATE";
})(PActionKind = exports.PActionKind || (exports.PActionKind = {}));
var SerDeser;
(function (SerDeser) {
})(SerDeser = exports.SerDeser || (exports.SerDeser = {}));
var PNode = /** @class */ (function () {
    function PNode(parent) {
        this.children = [];
        this.parent = parent;
        if (parent)
            parent.children.push(this);
    }
    PNode.deseralize = function (arr) {
        var res = [null];
        var pos = PNode.desone(arr, res, 0);
        if (pos !== arr.length)
            throw new Error("pos:" + pos + " !== " + arr.length);
        return res[0];
    };
    PNode.prototype.ser = function () {
        return [Codes[this.kind]].concat(this.serchildren());
    };
    PNode.prototype.deser = function (arr, pos) {
        pos = this.deschildren(arr, pos);
        return pos;
    };
    PNode.prototype.serchildren = function () {
        var r = [this.children.length];
        this.children.forEach(function (itm) {
            r = r.concat(itm.ser());
        });
        return r;
    };
    PNode.desone = function (arr, res, pos) {
        var kind = arr[pos];
        var ekind = Strings[kind];
        var cons = exports.PConss[ekind];
        var node = new cons(null);
        res[0] = node;
        pos = node.deser(arr, pos);
        return pos;
    };
    PNode.prototype.deschildren = function (arr, pos) {
        var length = arr[pos];
        pos++;
        var r = [];
        for (var i = 0; i < length; i++) {
            var cs = [null];
            pos = PNode.desone(arr, cs, pos);
            this.children.push(cs[0]);
        }
        return pos;
    };
    PNode.prototype.as = function (cons) {
        if (this["__proto"] === cons) {
            return this;
        }
        else {
            return null;
        }
    };
    PNode.prototype.ass = function (cons) {
        if (this["__proto"] === cons) {
            return this;
        }
        else {
            throw new Error("Invalid class cast from : " + this);
        }
    };
    PNode.prototype.toString = function () {
        return "" + this.kind;
    };
    PNode.xkind = PNodeKind.GRAMMAR;
    return PNode;
}());
exports.PNode = PNode;
var PActContainer = /** @class */ (function (_super) {
    __extends(PActContainer, _super);
    function PActContainer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(PActContainer.prototype, "symbol", {
        get: function () {
            return null;
        },
        enumerable: false,
        configurable: true
    });
    PActContainer.prototype.toString = function () {
        return this.kind + " " + this.symbol;
    };
    PActContainer.prototype.ser = function () {
        return _super.prototype.ser.call(this).concat([this.index]);
    };
    PActContainer.prototype.deser = function (arr, pos) {
        pos = _super.prototype.deser.call(this, arr, pos);
        this.index = arr[pos++];
        return pos;
    };
    return PActContainer;
}(PNode));
exports.PActContainer = PActContainer;
var PGrammar = /** @class */ (function (_super) {
    __extends(PGrammar, _super);
    function PGrammar() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.GRAMMAR;
        return _this;
    }
    return PGrammar;
}(PActContainer));
exports.PGrammar = PGrammar;
var PRule = /** @class */ (function (_super) {
    __extends(PRule, _super);
    function PRule(parent, index) {
        var _this = _super.call(this, parent) || this;
        _this.kind = PNodeKind.RULE;
        _this.index = index;
        return _this;
    }
    Object.defineProperty(PRule.prototype, "symbol", {
        get: function () {
            return this.rule;
        },
        enumerable: false,
        configurable: true
    });
    return PRule;
}(PActContainer));
exports.PRule = PRule;
var PTerminal = /** @class */ (function (_super) {
    __extends(PTerminal, _super);
    function PTerminal() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.TERMINAL;
        return _this;
    }
    Object.defineProperty(PTerminal.prototype, "symbol", {
        get: function () {
            return this.terminal;
        },
        enumerable: false,
        configurable: true
    });
    return PTerminal;
}(PActContainer));
exports.PTerminal = PTerminal;
var PLogicNode = /** @class */ (function (_super) {
    __extends(PLogicNode, _super);
    function PLogicNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PLogicNode.prototype.ser = function () {
        return _super.prototype.ser.call(this).concat([this.action ? this.action.index : -1]);
    };
    PLogicNode.prototype.deser = function (arr, pos) {
        pos = _super.prototype.deser.call(this, arr, pos);
        var actidx = arr[pos++];
        if (actidx !== -1) {
            var fun = SerDeser.functionTable[actidx];
            this.action = new PFunction();
            this.action.fun = fun;
        }
        return pos;
    };
    return PLogicNode;
}(PNode));
exports.PLogicNode = PLogicNode;
var PValueNode = /** @class */ (function (_super) {
    __extends(PValueNode, _super);
    function PValueNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PValueNode.prototype.toString = function () {
        return this.kind + (this.label ? " " + this.label : "");
    };
    return PValueNode;
}(PLogicNode));
exports.PValueNode = PValueNode;
var PRef = /** @class */ (function (_super) {
    __extends(PRef, _super);
    function PRef() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(PRef.prototype, "symbol", {
        get: function () {
            return null;
        },
        enumerable: false,
        configurable: true
    });
    PRef.prototype.toString = function () {
        return this.kind + (this.label ? " " + this.label : "") + " " + this.symbol;
    };
    return PRef;
}(PValueNode));
exports.PRef = PRef;
var PRuleRef = /** @class */ (function (_super) {
    __extends(PRuleRef, _super);
    function PRuleRef() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.RULE_REF;
        return _this;
    }
    Object.defineProperty(PRuleRef.prototype, "symbol", {
        get: function () {
            return this.rule;
        },
        enumerable: false,
        configurable: true
    });
    PRuleRef.prototype.ser = function () {
        return _super.prototype.ser.call(this).concat([this.ruleIndex]);
    };
    PRuleRef.prototype.deser = function (arr, pos) {
        pos = _super.prototype.deser.call(this, arr, pos);
        this.ruleIndex = arr[pos++];
        this.rule = SerDeser.ruleTable[this.ruleIndex].rule;
        return pos;
    };
    return PRuleRef;
}(PRef));
exports.PRuleRef = PRuleRef;
var PTerminalRef = /** @class */ (function (_super) {
    __extends(PTerminalRef, _super);
    function PTerminalRef() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.TERMINAL_REF;
        return _this;
    }
    Object.defineProperty(PTerminalRef.prototype, "symbol", {
        get: function () {
            return this.terminal;
        },
        enumerable: false,
        configurable: true
    });
    PTerminalRef.prototype.ser = function () {
        return _super.prototype.ser.call(this).concat([this.value]);
    };
    PTerminalRef.prototype.deser = function (arr, pos) {
        pos = _super.prototype.deser.call(this, arr, pos);
        this.value = arr[pos++];
        return pos;
    };
    return PTerminalRef;
}(PRef));
exports.PTerminalRef = PTerminalRef;
var PSemanticAnd = /** @class */ (function (_super) {
    __extends(PSemanticAnd, _super);
    function PSemanticAnd() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.SEMANTIC_AND;
        return _this;
    }
    return PSemanticAnd;
}(PLogicNode));
exports.PSemanticAnd = PSemanticAnd;
var PSemanticNot = /** @class */ (function (_super) {
    __extends(PSemanticNot, _super);
    function PSemanticNot() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.SEMANTIC_NOT;
        return _this;
    }
    return PSemanticNot;
}(PLogicNode));
exports.PSemanticNot = PSemanticNot;
var PFunction = /** @class */ (function () {
    function PFunction() {
    }
    return PFunction;
}());
exports.PFunction = PFunction;
var PCallArg = /** @class */ (function () {
    function PCallArg() {
    }
    return PCallArg;
}());
exports.PCallArg = PCallArg;
exports.PConss = {
    "grammar": PGrammar,
    "rule": PRule,
    "choice": PValueNode,
    "sequence": PValueNode,
    "optional": PValueNode,
    "one_or_more": PValueNode,
    "zero_or_more": PValueNode,
    "semantic_and": PSemanticAnd,
    "semantic_not": PSemanticNot,
    "terminal": PTerminal,
    "empty": PValueNode,
    "single": PValueNode,
    "rule_ref": PRuleRef,
    "terminal_ref": PTerminalRef
};
// NOTE The only exported Parser is EntryPointParser
var Factory;
(function (Factory) {
    function createParser(parser, node) {
        switch (node.kind) {
            case PNodeKind.CHOICE:
                return new ChoiceParser(parser, node);
            case PNodeKind.SEQUENCE:
            case PNodeKind.SINGLE:
                return new SequenceParser(parser, node);
            case PNodeKind.OPTIONAL:
                return new OptionalParser(parser, node);
            case PNodeKind.SEMANTIC_AND:
                return new SemanticAndParser(parser, node);
            case PNodeKind.SEMANTIC_NOT:
                return new SemanticNotParser(parser, node);
            case PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreParser(parser, node);
            case PNodeKind.ONE_OR_MORE:
                return new OneOrMoreParser(parser, node);
            case PNodeKind.RULE_REF:
                return new RuleRefParser(parser, node);
            case PNodeKind.TERMINAL_REF:
                return new TerminalRefParser(parser, node);
            case PNodeKind.RULE:
                return new EntryPointParser(parser, node);
        }
    }
    Factory.createParser = createParser;
})(Factory || (Factory = {}));
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleProcessStack = /** @class */ (function () {
    function RuleProcessStack(parser, parent, argsToLeft) {
        this.parser = parser;
        this.parent = parent;
        this.argsToLeft = argsToLeft;
    }
    RuleProcessStack.prototype.push = function (stack, newArgs) {
        var result = new RuleProcessStack(this.parser, this, newArgs);
        return result;
    };
    return RuleProcessStack;
}());
var PackratRunner = /** @class */ (function () {
    function PackratRunner() {
        this.peg$resultsCache = {};
    }
    PackratRunner.prototype.init = function () {
        this._numRules = this.numRules;
    };
    PackratRunner.prototype.run = function (rule) {
        var key = this.cacheKey(rule);
        var cached = this.peg$resultsCache[key];
        if (cached) {
            this.pos = cached.nextPos;
        }
        if (cached) {
            return cached.result;
        }
        var stack = new RuleProcessStack(this, null, []);
        // TODO
        var ruleMaxFailPos = 0;
        var result = rule.child.parseImpl(stack);
        this.peg$resultsCache[key] = { nextPos: this.pos, maxFailPos: ruleMaxFailPos, result: result };
    };
    return PackratRunner;
}());
exports.PackratRunner = PackratRunner;
//
// TODO for graph traverser parse tree generator
// As I was thinking it is possible / even trivial 
// !!!
//export abstract class CollectJumpStatesRunner implements IParseRunner {
//}
//
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleParser = /** @class */ (function () {
    function RuleParser(parser, node) {
        var _this = this;
        this.children = [];
        this.parser = parser;
        this.node = node;
        this.node.children.forEach(function (n) {
            _this.children.push(Factory.createParser(parser, n));
        });
        if (this.checkConstructFailed(parser)) {
            throw new Error("Ast construction failed.");
        }
    }
    RuleParser.prototype.checkConstructFailed = function (parser) {
    };
    RuleParser.prototype.getResult = function (stack) {
        var r;
        if (this.node.action) {
            r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
        }
        else {
            r = stack.argsToLeft;
        }
        return r;
    };
    return RuleParser;
}());
// NOTE Not exported.  The only exported one is EntryPointParser
var ChoiceParser = /** @class */ (function (_super) {
    __extends(ChoiceParser, _super);
    function ChoiceParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ChoiceParser.prototype.parseImpl = function (stack) {
        this.children.forEach(function (n) {
            var r = n.parseImpl(stack);
            if (r !== peg$FAILED) {
                return r;
            }
        });
        return peg$FAILED;
    };
    return ChoiceParser;
}(RuleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SequenceParser = /** @class */ (function (_super) {
    __extends(SequenceParser, _super);
    function SequenceParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SequenceParser.prototype.parseImpl = function (stack) {
        var args = [];
        stack = stack.push(stack, args);
        this.children.forEach(function (n) {
            var r = n.parseImpl(stack);
            if (r === peg$FAILED) {
                return peg$FAILED;
            }
            else if (n.node.label) {
                args.push(r);
            }
        });
        var r = this.getResult(stack);
        return r;
    };
    return SequenceParser;
}(RuleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleCollectionParser = /** @class */ (function (_super) {
    __extends(SingleCollectionParser, _super);
    function SingleCollectionParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleCollectionParser.prototype.checkConstructFailed = function (parser) {
        if (this.children.length !== 1) {
            console.error("parser.children.length !== 1  " + this.node);
            return 1;
        }
        this.child = this.children[0];
    };
    return SingleCollectionParser;
}(RuleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleParser = /** @class */ (function (_super) {
    __extends(SingleParser, _super);
    function SingleParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleParser.prototype.getResult = function (stack) {
        var r;
        if (this.node.action) {
            r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
        }
        else {
            r = stack.argsToLeft[0];
        }
        return r;
    };
    return SingleParser;
}(SingleCollectionParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var EmptyParser = /** @class */ (function (_super) {
    __extends(EmptyParser, _super);
    function EmptyParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyParser.prototype.checkConstructFailed = function (parser) {
        if (this.children.length !== 0) {
            console.error("parser.children.length !== 0  " + this.node);
            return 1;
        }
    };
    return EmptyParser;
}(RuleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var OptionalParser = /** @class */ (function (_super) {
    __extends(OptionalParser, _super);
    function OptionalParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OptionalParser.prototype.parseImpl = function (stack) {
        var args = [];
        stack = stack.push(stack, args);
        var r = this.child.parseImpl(stack);
        if (r === peg$FAILED) {
            return null;
        }
        else {
            args.push(r);
        }
        var r = this.getResult(stack);
        return r;
    };
    return OptionalParser;
}(SingleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var ZeroOrMoreParser = /** @class */ (function (_super) {
    __extends(ZeroOrMoreParser, _super);
    function ZeroOrMoreParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ZeroOrMoreParser.prototype.parseImpl = function (stack) {
        var items = [];
        stack = stack.push(stack, items);
        while (true) {
            var r = this.child.parseImpl(stack);
            if (r === peg$FAILED) {
                break;
            }
            else {
                items.push(r);
            }
        }
        var r = this.getResult(stack);
        return r;
    };
    return ZeroOrMoreParser;
}(SingleCollectionParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var OneOrMoreParser = /** @class */ (function (_super) {
    __extends(OneOrMoreParser, _super);
    function OneOrMoreParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OneOrMoreParser.prototype.parseImpl = function (stack) {
        var items = [];
        stack = stack.push(stack, items);
        var r = this.child.parseImpl(stack);
        if (r === peg$FAILED) {
            return peg$FAILED;
        }
        items.push(r);
        while (true) {
            r = this.child.parseImpl(stack);
            if (r === peg$FAILED) {
                break;
            }
            else {
                items.push(r);
            }
        }
        var r = this.getResult(stack);
        return r;
    };
    return OneOrMoreParser;
}(SingleCollectionParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleRefParser = /** @class */ (function (_super) {
    __extends(RuleRefParser, _super);
    function RuleRefParser(parser, node) {
        var _this = _super.call(this, parser, node) || this;
        _this.rule0 = parser.rule(node.ruleIndex);
        return _this;
    }
    RuleRefParser.prototype.checkConstructFailed = function (parser) {
        var dirty = _super.prototype.checkConstructFailed.call(this, parser);
        if (this.rule0) {
            this.ruleEntryParser = Factory.createParser(parser, this.rule0);
        }
        else {
            console.error("no this.rule  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    RuleRefParser.prototype.parseImpl = function (stack) {
        // NOTE new entry point
        return this.parser.run(this.ruleEntryParser);
    };
    return RuleRefParser;
}(EmptyParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var TerminalRefParser = /** @class */ (function (_super) {
    __extends(TerminalRefParser, _super);
    function TerminalRefParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TerminalRefParser.prototype.checkConstructFailed = function (parser) {
        var dirty = _super.prototype.checkConstructFailed.call(this, parser);
        if (!this.node.terminal) {
            console.error("no this.node.terminal  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    TerminalRefParser.prototype.parseImpl = function (stack) {
        var token = stack.parser.next();
        if (token.tokenId === this.node.value) {
            return token;
        }
        else {
            return peg$FAILED;
        }
    };
    return TerminalRefParser;
}(EmptyParser));
//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the only exported Parser                 !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   A   R   S   E   R
//   !!
//
var EntryPointParser = /** @class */ (function (_super) {
    __extends(EntryPointParser, _super);
    function EntryPointParser(parser, node) {
        var _this = _super.call(this, parser, node) || this;
        _this.index = node.index;
        return _this;
    }
    EntryPointParser.prototype.parseImpl = function (stack) {
        // NOTE new entry point   not implemented
    };
    return EntryPointParser;
}(SingleParser));
exports.EntryPointParser = EntryPointParser;
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticParser = /** @class */ (function (_super) {
    __extends(SemanticParser, _super);
    function SemanticParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticParser.prototype.checkConstructFailed = function (parser) {
        var dirty = _super.prototype.checkConstructFailed.call(this, parser);
        if (!this.node.action || !this.node.action.fun) {
            console.error("No parser.node.action or .action.fun");
            dirty = 1;
        }
        return dirty;
    };
    return SemanticParser;
}(SingleParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticAndParser = /** @class */ (function (_super) {
    __extends(SemanticAndParser, _super);
    function SemanticAndParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticAndParser.prototype.parseImpl = function (stack) {
        var boolres = this.node.action.fun.apply(stack.parser, stack);
        if (boolres)
            return undefined;
        else
            return peg$FAILED;
    };
    return SemanticAndParser;
}(SemanticParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticNotParser = /** @class */ (function (_super) {
    __extends(SemanticNotParser, _super);
    function SemanticNotParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticNotParser.prototype.parseImpl = function (stack) {
        var boolres = this.node.action.fun.apply(stack.parser, stack);
        if (boolres)
            return peg$FAILED;
        else
            return undefined;
    };
    return SemanticNotParser;
}(SingleParser));
//# sourceMappingURL=parsers.js.map