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
exports.InterpreterRunner = exports.EntryPointInterpreter = exports.DeferredReduce = exports.Interpreters = exports.peg$SUCCESS = exports.peg$FAILED = void 0;
var _1 = require(".");
var packrat_1 = require("./packrat");
exports.peg$FAILED = {};
exports.peg$SUCCESS = {};
var Interpreters;
(function (Interpreters) {
})(Interpreters = exports.Interpreters || (exports.Interpreters = {}));
// NOTE The only exported Parser is EntryPointParser
var Factory;
(function (Factory) {
    function createParser(node) {
        switch (node.kind) {
            case _1.PNodeKind.CHOICE:
                return new ChoiceInterpreter(node);
            case _1.PNodeKind.SEQUENCE:
            case _1.PNodeKind.SINGLE:
                return new SequenceInterpreter(node);
            case _1.PNodeKind.OPTIONAL:
                return new OptionalInterpreter(node);
            case _1.PNodeKind.SEMANTIC_AND:
                return new SemanticAndInterpreter(node);
            case _1.PNodeKind.SEMANTIC_NOT:
                return new SemanticNotInterpreter(node);
            case _1.PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreInterpreter(node);
            case _1.PNodeKind.ONE_OR_MORE:
                return new OneOrMoreInterpreter(node);
            case _1.PNodeKind.RULE_REF:
                return new RuleRefInterpreter(node);
            case _1.PNodeKind.TERMINAL_REF:
                return new TerminalRefInterpreter(node);
            case _1.PNodeKind.RULE:
                return new EntryPointInterpreter(node);
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
// NOTE :
// We collect the reduced nodes but we don't actually reduce
// until the final state top node reached ! 
// We can omit calculation of the dead branches this way:
var DeferredReduce = /** @class */ (function () {
    function DeferredReduce(action, argsToLeft, pos) {
        this.action = action;
        this.fun = action ? action.fun : null;
        this.argsToLeft = argsToLeft;
        this.pos = pos;
    }
    DeferredReduce.prototype.calculateFromTop = function (parser) {
        var p = parser.owner;
        var savedPos = p.inputPos;
        var result = this.calculate(parser);
        p.inputPos = savedPos;
        return result;
    };
    DeferredReduce.prototype.calculate = function (parser) {
        var p = parser.owner;
        this.calculateArgs(parser);
        if (this.fun) {
            p.inputPos = this.pos;
            return this.fun.apply(parser, this.calculateArgs);
        }
        else {
            return this.calculatedArgs;
        }
    };
    DeferredReduce.prototype.calculateArgs = function (parser) {
        var _this = this;
        this.argsToLeft.forEach(function (arg) {
            var result;
            if (arg) {
                result = arg.calculate(parser);
            }
            else {
                result = arg;
            }
            _this.calculatedArgs.push(result);
        });
    };
    return DeferredReduce;
}());
exports.DeferredReduce = DeferredReduce;
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleElementInterpreter = /** @class */ (function () {
    function RuleElementInterpreter(node) {
        var _this = this;
        this.children = [];
        this.node = node;
        this.node.children.forEach(function (n) {
            _this.children.push(Factory.createParser(n));
        });
        if (this.checkConstructFailed()) {
            throw new Error("Ast construction failed.");
        }
    }
    RuleElementInterpreter.prototype.checkConstructFailed = function () {
    };
    RuleElementInterpreter.prototype.parse = function (stack) {
        var p = stack.parser.owner;
        var pos = p.inputPos;
        var r0 = this.parseImpl(stack);
        if (r0 === exports.peg$FAILED) {
            p.inputPos = pos;
            return r0;
        }
        else if (r0 === exports.peg$SUCCESS) {
            var r = new DeferredReduce(this.node.action, stack.argsToLeft, p.inputPos);
            return r;
        }
        else {
            return r0;
        }
    };
    return RuleElementInterpreter;
}());
// NOTE Not exported.  The only exported one is EntryPointParser
var ChoiceInterpreter = /** @class */ (function (_super) {
    __extends(ChoiceInterpreter, _super);
    function ChoiceInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ChoiceInterpreter.prototype.parseImpl = function (stack) {
        this.children.forEach(function (n) {
            var r = n.parse(stack);
            if (r !== exports.peg$FAILED) {
                return r;
            }
        });
        return exports.peg$FAILED;
    };
    return ChoiceInterpreter;
}(RuleElementInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SequenceInterpreter = /** @class */ (function (_super) {
    __extends(SequenceInterpreter, _super);
    function SequenceInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SequenceInterpreter.prototype.parseImpl = function (stack) {
        var args = [];
        stack = stack.push(stack, args);
        this.children.forEach(function (n) {
            var r = n.parse(stack);
            if (r === exports.peg$FAILED) {
                return exports.peg$FAILED;
            }
            else if (n.node.label) {
                args.push(r);
            }
        });
        return exports.peg$SUCCESS;
    };
    return SequenceInterpreter;
}(RuleElementInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleCollectionInterpreter = /** @class */ (function (_super) {
    __extends(SingleCollectionInterpreter, _super);
    function SingleCollectionInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleCollectionInterpreter.prototype.checkConstructFailed = function () {
        if (this.children.length !== 1) {
            console.error("parser.children.length !== 1  " + this.node);
            return 1;
        }
        this.child = this.children[0];
    };
    return SingleCollectionInterpreter;
}(RuleElementInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleInterpreter = /** @class */ (function (_super) {
    __extends(SingleInterpreter, _super);
    function SingleInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SingleInterpreter;
}(SingleCollectionInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var EmptyInterpreter = /** @class */ (function (_super) {
    __extends(EmptyInterpreter, _super);
    function EmptyInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyInterpreter.prototype.checkConstructFailed = function () {
        if (this.children.length !== 0) {
            console.error("parser.children.length !== 0  " + this.node);
            return 1;
        }
    };
    return EmptyInterpreter;
}(RuleElementInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var OptionalInterpreter = /** @class */ (function (_super) {
    __extends(OptionalInterpreter, _super);
    function OptionalInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OptionalInterpreter.prototype.parseImpl = function (stack) {
        var args = [];
        stack = stack.push(stack, args);
        var r = this.child.parse(stack);
        if (r === exports.peg$FAILED) {
            return null;
        }
        else {
            args.push(r);
        }
        return exports.peg$SUCCESS;
    };
    return OptionalInterpreter;
}(SingleInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var ZeroOrMoreInterpreter = /** @class */ (function (_super) {
    __extends(ZeroOrMoreInterpreter, _super);
    function ZeroOrMoreInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ZeroOrMoreInterpreter.prototype.parseImpl = function (stack) {
        var items = [];
        stack = stack.push(stack, items);
        while (true) {
            var r = this.child.parse(stack);
            if (r === exports.peg$FAILED) {
                break;
            }
            else {
                items.push(r);
            }
        }
        return exports.peg$SUCCESS;
    };
    return ZeroOrMoreInterpreter;
}(SingleCollectionInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var OneOrMoreInterpreter = /** @class */ (function (_super) {
    __extends(OneOrMoreInterpreter, _super);
    function OneOrMoreInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OneOrMoreInterpreter.prototype.parseImpl = function (stack) {
        var items = [];
        stack = stack.push(stack, items);
        var r = this.child.parse(stack);
        if (r === exports.peg$FAILED) {
            return exports.peg$FAILED;
        }
        items.push(r);
        while (true) {
            r = this.child.parse(stack);
            if (r === exports.peg$FAILED) {
                break;
            }
            else {
                items.push(r);
            }
        }
        return exports.peg$SUCCESS;
    };
    return OneOrMoreInterpreter;
}(SingleCollectionInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleRefInterpreter = /** @class */ (function (_super) {
    __extends(RuleRefInterpreter, _super);
    function RuleRefInterpreter(node) {
        return _super.call(this, node) || this;
    }
    Object.defineProperty(RuleRefInterpreter.prototype, "ruleEntryParser", {
        get: function () {
            if (!this._ruleEntryParser) {
                this._ruleEntryParser = Interpreters.ruleTable[this.node.ruleIndex];
                if (!this._ruleEntryParser) {
                    console.error("no this.ruleEntryParser  " + this.node);
                }
            }
            return this._ruleEntryParser;
        },
        enumerable: false,
        configurable: true
    });
    RuleRefInterpreter.prototype.parseImpl = function (stack) {
        // NOTE new entry point
        return stack.parser.run(this.ruleEntryParser);
    };
    return RuleRefInterpreter;
}(EmptyInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var TerminalRefInterpreter = /** @class */ (function (_super) {
    __extends(TerminalRefInterpreter, _super);
    function TerminalRefInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TerminalRefInterpreter.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.terminal) {
            console.error("no this.node.terminal  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    TerminalRefInterpreter.prototype.parseImpl = function (stack) {
        var p = stack.parser.owner;
        var token = p.next();
        if (token && token.tokenId === this.node.value) {
            return token;
        }
        else {
            p.fail(token);
            return exports.peg$FAILED;
        }
    };
    return TerminalRefInterpreter;
}(EmptyInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticInterpreter = /** @class */ (function (_super) {
    __extends(SemanticInterpreter, _super);
    function SemanticInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticInterpreter.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.action || !this.node.action.fun) {
            console.error("No parser.node.action or .action.fun");
            dirty = 1;
        }
        return dirty;
    };
    return SemanticInterpreter;
}(SingleInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticAndInterpreter = /** @class */ (function (_super) {
    __extends(SemanticAndInterpreter, _super);
    function SemanticAndInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticAndInterpreter.prototype.parseImpl = function (stack) {
        var boolres = this.node.action.fun.apply(stack.parser, stack);
        if (boolres)
            return undefined;
        else
            return exports.peg$FAILED;
    };
    return SemanticAndInterpreter;
}(SemanticInterpreter));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticNotInterpreter = /** @class */ (function (_super) {
    __extends(SemanticNotInterpreter, _super);
    function SemanticNotInterpreter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticNotInterpreter.prototype.parseImpl = function (stack) {
        var boolres = this.node.action.fun.apply(stack.parser, stack);
        if (boolres)
            return exports.peg$FAILED;
        else
            return undefined;
    };
    return SemanticNotInterpreter;
}(SingleInterpreter));
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
var EntryPointInterpreter = /** @class */ (function (_super) {
    __extends(EntryPointInterpreter, _super);
    function EntryPointInterpreter(node) {
        var _this = _super.call(this, node) || this;
        _this.index = node.index;
        _this.child = _this.children[0];
        return _this;
    }
    EntryPointInterpreter.prototype.parseImpl = function (stack) {
        // NOTE new entry point   not implemented
    };
    return EntryPointInterpreter;
}(RuleElementInterpreter));
exports.EntryPointInterpreter = EntryPointInterpreter;
var InterpreterRunner = /** @class */ (function () {
    function InterpreterRunner(owner) {
        this.owner = owner;
        this.packrat = new packrat_1.Packrat(owner);
        this.numRules = owner.numRules;
    }
    InterpreterRunner.prototype.run = function (rule) {
        var owner = this.owner;
        var cached = this.packrat.readCacheEntry(rule.node);
        if (cached.nextPos !== undefined) {
            owner.inputPos = cached.nextPos;
            return cached.result;
        }
        owner.currentRule = rule.node.index;
        var stack = new RuleProcessStack(this, null, []);
        // TODO
        var ruleMaxFailPos = 0;
        var result = rule.child.parse(stack);
        Object.assign(cached, { nextPos: owner.inputPos, maxFailPos: ruleMaxFailPos, result: result });
    };
    return InterpreterRunner;
}());
exports.InterpreterRunner = InterpreterRunner;
//# sourceMappingURL=interpreter.js.map