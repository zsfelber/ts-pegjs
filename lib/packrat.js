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
exports.EntryPointParser = exports.PackratRunner = exports.Packrat = exports.peg$SUCCESS = exports.peg$FAILED = void 0;
var _1 = require(".");
exports.peg$FAILED = {};
exports.peg$SUCCESS = {};
var Packrat;
(function (Packrat) {
})(Packrat = exports.Packrat || (exports.Packrat = {}));
// NOTE The only exported Parser is EntryPointParser
var Factory;
(function (Factory) {
    function createParser(node) {
        switch (node.kind) {
            case _1.PNodeKind.CHOICE:
                return new ChoiceParser(node);
            case _1.PNodeKind.SEQUENCE:
            case _1.PNodeKind.SINGLE:
                return new SequenceParser(node);
            case _1.PNodeKind.OPTIONAL:
                return new OptionalParser(node);
            case _1.PNodeKind.SEMANTIC_AND:
                return new SemanticAndParser(node);
            case _1.PNodeKind.SEMANTIC_NOT:
                return new SemanticNotParser(node);
            case _1.PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreParser(node);
            case _1.PNodeKind.ONE_OR_MORE:
                return new OneOrMoreParser(node);
            case _1.PNodeKind.RULE_REF:
                return new RuleRefParser(node);
            case _1.PNodeKind.TERMINAL_REF:
                return new TerminalRefParser(node);
            case _1.PNodeKind.RULE:
                return new EntryPointParser(node);
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
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleElementParser = /** @class */ (function () {
    function RuleElementParser(node) {
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
    RuleElementParser.prototype.checkConstructFailed = function () {
    };
    RuleElementParser.prototype.parse = function (stack) {
        var pos = stack.parser.pos;
        var r0 = this.parseImpl(stack);
        if (r0 === exports.peg$FAILED) {
            stack.parser.pos = pos;
            return r0;
        }
        else if (r0 === exports.peg$SUCCESS) {
            var r;
            if (this.node.action) {
                r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
            }
            else {
                r = stack.argsToLeft;
            }
            return r;
        }
        else {
            return r0;
        }
    };
    return RuleElementParser;
}());
// NOTE Not exported.  The only exported one is EntryPointParser
var ChoiceParser = /** @class */ (function (_super) {
    __extends(ChoiceParser, _super);
    function ChoiceParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ChoiceParser.prototype.parseImpl = function (stack) {
        this.children.forEach(function (n) {
            var r = n.parse(stack);
            if (r !== exports.peg$FAILED) {
                return r;
            }
        });
        return exports.peg$FAILED;
    };
    return ChoiceParser;
}(RuleElementParser));
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
    return SequenceParser;
}(RuleElementParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleCollectionParser = /** @class */ (function (_super) {
    __extends(SingleCollectionParser, _super);
    function SingleCollectionParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleCollectionParser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 1) {
            console.error("parser.children.length !== 1  " + this.node);
            return 1;
        }
        this.child = this.children[0];
    };
    return SingleCollectionParser;
}(RuleElementParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SingleParser = /** @class */ (function (_super) {
    __extends(SingleParser, _super);
    function SingleParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SingleParser.prototype.parse = function (stack) {
        var pos = stack.parser.pos;
        var r0 = this.parseImpl(stack);
        if (r0 === exports.peg$FAILED) {
            stack.parser.pos = pos;
            return r0;
        }
        else if (r0 === exports.peg$SUCCESS) {
            var r;
            if (this.node.action) {
                r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
            }
            else {
                r = stack.argsToLeft[0];
            }
            return r;
        }
        else {
            return r0;
        }
    };
    return SingleParser;
}(SingleCollectionParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var EmptyParser = /** @class */ (function (_super) {
    __extends(EmptyParser, _super);
    function EmptyParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyParser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 0) {
            console.error("parser.children.length !== 0  " + this.node);
            return 1;
        }
    };
    return EmptyParser;
}(RuleElementParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var OptionalParser = /** @class */ (function (_super) {
    __extends(OptionalParser, _super);
    function OptionalParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OptionalParser.prototype.parseImpl = function (stack) {
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
    return OneOrMoreParser;
}(SingleCollectionParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var RuleRefParser = /** @class */ (function (_super) {
    __extends(RuleRefParser, _super);
    function RuleRefParser(node) {
        var _this = _super.call(this, node) || this;
        _this.ruleEntryParser = Packrat.ruleTable[node.ruleIndex];
        return _this;
    }
    RuleRefParser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.ruleEntryParser) {
            console.error("no this.ruleEntryParser  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    RuleRefParser.prototype.parseImpl = function (stack) {
        // NOTE new entry point
        return stack.parser.run(this.ruleEntryParser);
    };
    return RuleRefParser;
}(EmptyParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var TerminalRefParser = /** @class */ (function (_super) {
    __extends(TerminalRefParser, _super);
    function TerminalRefParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TerminalRefParser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.terminal) {
            console.error("no this.node.terminal  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    TerminalRefParser.prototype.parseImpl = function (stack) {
        var token = stack.parser.next();
        if (token && token.tokenId === this.node.value) {
            return token;
        }
        else {
            return exports.peg$FAILED;
        }
    };
    return TerminalRefParser;
}(EmptyParser));
// NOTE Not exported.  The only exported one is EntryPointParser
var SemanticParser = /** @class */ (function (_super) {
    __extends(SemanticParser, _super);
    function SemanticParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SemanticParser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
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
            return exports.peg$FAILED;
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
            return exports.peg$FAILED;
        else
            return undefined;
    };
    return SemanticNotParser;
}(SingleParser));
//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the main entry point                     !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   r  o  c  e  s  s  o  r     object
//   !!
//
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
        var result = rule.child.parse(stack);
        this.peg$resultsCache[key] = { nextPos: this.pos, maxFailPos: ruleMaxFailPos, result: result };
    };
    return PackratRunner;
}());
exports.PackratRunner = PackratRunner;
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
    function EntryPointParser(node) {
        var _this = _super.call(this, node) || this;
        _this.index = node.index;
        return _this;
    }
    EntryPointParser.prototype.parseImpl = function (stack) {
        // NOTE new entry point   not implemented
    };
    return EntryPointParser;
}(SingleParser));
exports.EntryPointParser = EntryPointParser;
//# sourceMappingURL=packrat.js.map