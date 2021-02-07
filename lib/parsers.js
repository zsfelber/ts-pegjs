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
exports.PConss = exports.PCallArg = exports.PFunction = exports.PSemanticNot = exports.PSemanticAnd = exports.PTerminalRef = exports.PRuleRef = exports.PRef = exports.PValueNode = exports.PLogicNode = exports.PTerminal = exports.PRule = exports.PGrammar = exports.PActContainer = exports.PNode = exports.SerDeser = exports.PActionKind = exports.PNodeKind = void 0;
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
    PNodeKind["PREDICATE_AND"] = "predicate_and";
    PNodeKind["PREDICATE_NOT"] = "predicate_not";
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
Codes[PNodeKind.PREDICATE_AND] = 12;
Codes[PNodeKind.PREDICATE_NOT] = 13;
Codes[PNodeKind.RULE_REF] = 14;
Codes[PNodeKind.TERMINAL_REF] = 15;
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
Strings[12] = PNodeKind.PREDICATE_AND;
Strings[13] = PNodeKind.PREDICATE_NOT;
Strings[14] = PNodeKind.RULE_REF;
Strings[15] = PNodeKind.TERMINAL_REF;
var PActionKind;
(function (PActionKind) {
    PActionKind["RULE"] = "RULE";
    PActionKind["PREDICATE"] = "PREDICATE";
})(PActionKind = exports.PActionKind || (exports.PActionKind = {}));
var SerDeser;
(function (SerDeser) {
    SerDeser.cnt = 0;
})(SerDeser = exports.SerDeser || (exports.SerDeser = {}));
var PNode = /** @class */ (function () {
    function PNode(parent) {
        this.children = [];
        this.parent = parent;
        if (parent)
            parent.children.push(this);
    }
    PNode.deseralize = function (arr) {
        SerDeser.cnt = 0;
        var res = [null];
        var pos = PNode.desone(arr, res, 0);
        if (pos !== arr.length)
            throw new Error("pos:" + pos + " !== " + arr.length);
        return res[0];
    };
    PNode.prototype.ser = function () {
        if (this.nodeIdx != (++SerDeser.cnt)) {
            //console.warn("Invalid nodeIdx : "+this+"  this.nodeIdx:"+this.nodeIdx+" != "+SerDeser.cnt);
            this.nodeIdx = SerDeser.cnt;
        }
        return [Codes[this.kind]].concat(this.serchildren());
    };
    PNode.prototype.deser = function (arr, pos) {
        this.nodeIdx = ++SerDeser.cnt;
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
    PNode.desone = function (arr, res, pos) {
        var kind = arr[pos];
        var ekind = Strings[kind];
        var cons = exports.PConss[ekind];
        var node = new cons(null);
        res[0] = node;
        pos = node.deser(arr, pos + 1);
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
    Object.defineProperty(PNode.prototype, "optionalNode", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
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
        return _super.prototype.ser.call(this).concat([this.action ? this.action.index + 1 : 0]);
    };
    PLogicNode.prototype.deser = function (arr, pos) {
        pos = _super.prototype.deser.call(this, arr, pos);
        var actidx = arr[pos++] - 1;
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
    Object.defineProperty(PValueNode.prototype, "optionalNode", {
        get: function () {
            return this.kind === PNodeKind.EMPTY || this.kind === PNodeKind.OPTIONAL ||
                this.kind === PNodeKind.ZERO_OR_MORE;
        },
        enumerable: false,
        configurable: true
    });
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
    "predicate_and": PValueNode,
    "predicate_not": PValueNode,
    "terminal": PTerminal,
    "empty": PValueNode,
    "single": PValueNode,
    "rule_ref": PRuleRef,
    "terminal_ref": PTerminalRef
};
//# sourceMappingURL=parsers.js.map