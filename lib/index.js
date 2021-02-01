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
exports.PCallArg = exports.PFunction = exports.PSemanticNot = exports.PSemanticAnd = exports.PTerminalRef = exports.PRuleRef = exports.PRef = exports.PValueNode = exports.PLogicNode = exports.PTerminal = exports.PRule = exports.PGrammar = exports.PActContainer = exports.PNode = exports.PActionKind = exports.PNodeKind = exports.JSstringEscape = exports.SourceFilePosUtil = exports.PegjsParseStream = exports.DefaultTracer = exports.SyntaxError = exports.PegjsParseErrorInfo = exports.mergeLocalFailures = exports.mergeFailures = exports.ACCEPT_TOKEN = exports.MATCH_TOKEN = void 0;
exports.MATCH_TOKEN = 40;
exports.ACCEPT_TOKEN = 41;
function mergeFailures(into, other) {
    if (other.absoluteFailPos < into.absoluteFailPos) {
        return;
    }
    if (other.absoluteFailPos > into.absoluteFailPos) {
        into.absoluteFailPos = other.absoluteFailPos;
        into.maxFailExpected = [];
        into.found = other.found;
    }
    into.maxFailExpected = into.maxFailExpected.concat(other.maxFailExpected);
}
exports.mergeFailures = mergeFailures;
function mergeLocalFailures(into, other) {
    if (other.localFailPos < into.localFailPos) {
        return;
    }
    if (other.localFailPos > into.localFailPos) {
        into.localFailPos = other.localFailPos;
        into.maxFailExpected = [];
    }
    into.maxFailExpected = into.maxFailExpected.concat(other.maxFailExpected);
}
exports.mergeLocalFailures = mergeLocalFailures;
var PegjsParseErrorInfo = /** @class */ (function () {
    function PegjsParseErrorInfo(input, message, expected, found, absolutePosition) {
        this.input = input;
        this.message0 = message;
        this.expected = expected;
        this.found = found;
        this.absolutePosition = absolutePosition;
        this.name = "SyntaxError";
        //if (typeof (Error as any).captureStackTrace === "function") {
        //  (Error as any).captureStackTrace(this, SyntaxError);
        //}
    }
    PegjsParseErrorInfo.buildMessage = function (input, expected, found) {
        function hex(ch) {
            return ch.charCodeAt(0).toString(16).toUpperCase();
        }
        function literalEscape(s) {
            return s
                .replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/\0/g, "\\0")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/[\x00-\x0F]/g, function (ch) { return "\\x0" + hex(ch); })
                .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) { return "\\x" + hex(ch); });
        }
        function classEscape(s) {
            return s
                .replace(/\\/g, "\\\\")
                .replace(/\]/g, "\\]")
                .replace(/\^/g, "\\^")
                .replace(/-/g, "\\-")
                .replace(/\0/g, "\\0")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/[\x00-\x0F]/g, function (ch) { return "\\x0" + hex(ch); })
                .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) { return "\\x" + hex(ch); });
        }
        function describeExpectation(expectation) {
            if (!expectation) {
                return "end of input";
            }
            switch (expectation.type) {
                case "token":
                    return input.printToken(expectation.tokenId);
                case "any":
                    return "any character";
                case "end":
                    return "end of input";
                case "other":
                    return expectation.description;
            }
        }
        function describeExpected(expected1) {
            var descriptions = expected1.map(describeExpectation);
            var i;
            var j;
            descriptions.sort();
            if (descriptions.length > 0) {
                for (i = 1, j = 1; i < descriptions.length; i++) {
                    if (descriptions[i - 1] !== descriptions[i]) {
                        descriptions[j] = descriptions[i];
                        j++;
                    }
                }
                descriptions.length = j;
            }
            switch (descriptions.length) {
                case 1:
                    return descriptions[0];
                case 2:
                    return descriptions[0] + " or " + descriptions[1];
                default:
                    return descriptions.slice(0, -1).join(", ")
                        + ", or "
                        + descriptions[descriptions.length - 1];
            }
        }
        return "Expected " + describeExpected(expected) + " but " + describeExpectation(found) + " found.";
    };
    Object.defineProperty(PegjsParseErrorInfo.prototype, "message", {
        get: function () {
            if (!this.message1) {
                this.message1 = this.message0 + PegjsParseErrorInfo.buildMessage(this.input, this.expected, this.found);
            }
            return this.message1;
        },
        enumerable: false,
        configurable: true
    });
    return PegjsParseErrorInfo;
}());
exports.PegjsParseErrorInfo = PegjsParseErrorInfo;
var SyntaxError = /** @class */ (function (_super) {
    __extends(SyntaxError, _super);
    function SyntaxError(info) {
        var _this = _super.call(this) || this;
        _this.info = info;
        return _this;
    }
    Object.defineProperty(SyntaxError.prototype, "message", {
        get: function () {
            return this.info.message;
        },
        enumerable: false,
        configurable: true
    });
    return SyntaxError;
}(Error));
exports.SyntaxError = SyntaxError;
var DefaultTracer = /** @class */ (function () {
    function DefaultTracer(tracingOptions) {
        this.indentLevel = 0;
        this.tracingOptions = tracingOptions;
    }
    DefaultTracer.prototype.chktrace = function (rule) {
        var tr = !!this.started;
        var traceall = !this.tracingOptions ||
            !Object.keys(this.tracingOptions).length;
        if (traceall || this.tracingOptions[rule]) {
            tr = true;
        }
        if (!tr) {
            var rgxincl = this.tracingOptions["$includes"];
            if (rgxincl && rgxincl.exec(rule)) {
                tr = true;
            }
        }
        if (tr) {
            var rgxexcl = this.tracingOptions["$excludes"];
            if (rgxexcl && rgxexcl.exec(rule)) {
                tr = false;
            }
        }
        if (tr) {
            if (!this.started) {
                this.started = { atindent: this.indentLevel, running: true };
            }
            else {
                this.started.running = true;
            }
        }
        else {
            if (this.started) {
                this.started.running = false;
            }
        }
    };
    DefaultTracer.prototype.repeat = function (text, n) {
        var result = "", i;
        for (i = 0; i < n; i++) {
            result += text;
        }
        return result;
    };
    DefaultTracer.prototype.pad = function (text, length) {
        return text + this.repeat(" ", length - text.length);
    };
    DefaultTracer.prototype.log = function (evt, blocktxt) {
        if (typeof console === "object") { // IE 8-10
            var t1 = this.pad("" + evt.location.start.line + ":" + evt.location.start.column + "-"
                + evt.location.end.line + ":" + evt.location.end.column, 24);
            var t2 = this.pad(evt.type + "  " + (evt.cached ? "C" : ""), 17);
            console.log("/* " + t1 + t2 + this.repeat("  ", this.indentLevel) + evt.rule + blocktxt);
        }
    };
    DefaultTracer.prototype.trace = function (event) {
        var that = this;
        this.chktrace(event.rule);
        switch (event.type) {
            case "rule.enter":
                if (this.started && this.started.running) {
                    this.log(event, "*/   {");
                }
                this.indentLevel++;
                break;
            case "rule.match":
                this.indentLevel--;
                if (this.started && this.started.running) {
                    this.log(event, "*/   } //    +");
                }
                if (this.started && this.started.atindent === this.indentLevel) {
                    this.started = null;
                }
                break;
            case "rule.fail":
                this.indentLevel--;
                if (this.started && this.started.running) {
                    this.log(event, "*/   } //    -");
                }
                if (this.started && this.started.atindent === this.indentLevel) {
                    this.started = null;
                }
                break;
            default:
                throw new Error("Invalid event type: " + event.type + ".");
        }
    };
    return DefaultTracer;
}());
exports.DefaultTracer = DefaultTracer;
var PegjsParseStream = /** @class */ (function () {
    function PegjsParseStream(tokens, ruleNames) {
        this.tokens = tokens;
        this.ruleNames = ruleNames;
    }
    PegjsParseStream.prototype.tokenAt = function (pos) {
        return this.tokens[pos];
    };
    Object.defineProperty(PegjsParseStream.prototype, "length", {
        get: function () {
            return this.tokens.length;
        },
        enumerable: false,
        configurable: true
    });
    return PegjsParseStream;
}());
exports.PegjsParseStream = PegjsParseStream;
var SourceFilePosUtil = /** @class */ (function () {
    function SourceFilePosUtil() {
        this.posDetailsCache = [{ line: 1, column: 1 }];
    }
    SourceFilePosUtil.prototype.calculatePosition = function (buffer, pos) {
        var details = this.posDetailsCache[pos];
        if (details) {
            return details;
        }
        else if (pos >= 0) {
            var p = 0;
            if (pos >= this.posDetailsCache.length) {
                p = this.posDetailsCache.length - 1;
                details = this.posDetailsCache[p];
            }
            else {
                p = pos;
                while (!(details = this.posDetailsCache[--p]) && p > 0)
                    ;
            }
            details = {
                line: details.line,
                column: details.column
            };
            while (p < pos) {
                if (buffer.charCodeAt(p) === 10) {
                    details.line++;
                    details.column = 1;
                    this.posDetailsCache[++p] = {
                        line: details.line,
                        column: details.column
                    };
                }
                else {
                    details.column++;
                    ++p;
                }
            }
            this.posDetailsCache[pos] = details;
            return details;
        }
        else {
            return { line: 0, column: pos + 1 };
        }
    };
    return SourceFilePosUtil;
}());
exports.SourceFilePosUtil = SourceFilePosUtil;
// Fixed Octal Literal Before Number Char
//     .replace(/\0/g,   '\\0')    // null
// ->  .replace(/\0/g,   '\\x00')
// may be followed by "7" -> \07  
function JSstringEscape(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
     * literal except for the closing quote character, backslash, carriage
     * return, line separator, paragraph separator, and line feed. Any character
     * may appear in the form of an escape sequence.
     *
     * For portability, we also escape all control and non-ASCII characters.
     * Note that the "\v" escape sequence is not used because IE does not like
     * it.
     */
    return s
        .replace(/\\/g, '\\\\') // backslash
        .replace(/"/g, '\\"') // closing double quote
        .replace(/\0/g, '\\x00') // null
        .replace(/\x08/g, '\\b') // backspace
        .replace(/\t/g, '\\t') // horizontal tab
        .replace(/\n/g, '\\n') // line feed
        .replace(/\f/g, '\\f') // form feed
        .replace(/\r/g, '\\r') // carriage return
        .replace(/[\x00-\x0F]/g, function (ch) { return '\\x0' + hex(ch); })
        .replace(/[\x10-\x1F\x7F-\xFF]/g, function (ch) { return '\\x' + hex(ch); })
        .replace(/[\u0100-\u0FFF]/g, function (ch) { return '\\u0' + hex(ch); })
        .replace(/[\u1000-\uFFFF]/g, function (ch) { return '\\u' + hex(ch); });
}
exports.JSstringEscape = JSstringEscape;
function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
}
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
var PActionKind;
(function (PActionKind) {
    PActionKind["RULE"] = "RULE";
    PActionKind["PREDICATE"] = "PREDICATE";
})(PActionKind = exports.PActionKind || (exports.PActionKind = {}));
var PNode = /** @class */ (function () {
    function PNode(parent) {
        this.children = [];
        this.parent = parent;
        if (parent)
            parent.children.push(this);
    }
    PNode.prototype.toString = function () {
        return "" + this.kind;
    };
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
    function PRule() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = PNodeKind.RULE;
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
//# sourceMappingURL=index.js.map