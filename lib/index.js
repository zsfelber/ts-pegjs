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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkParseTablesIntegrity = exports.checkRuleNodesIntegrity = exports.verySimplePackMany0 = exports.encodeVsimPck = exports.encodePrsTbl = exports.CodeTblToHex = exports.JSstringEscape = exports.SourceFilePosUtil = exports.HyperGParseStream = exports.DefaultTracer = exports.SyntaxError = exports.HyperGParseErrorInfo = exports.mergeFailures = exports.HyperG = exports.HyperGEnvType = exports.ACCEPT_TOKEN = exports.MATCH_TOKEN = void 0;
var analyzer_1 = require("./analyzer");
var parsers_1 = require("./parsers");
var lib_1 = require("../lib");
exports.MATCH_TOKEN = 40;
exports.ACCEPT_TOKEN = 41;
var HyperGEnvType;
(function (HyperGEnvType) {
    HyperGEnvType[HyperGEnvType["ANALYZING"] = 0] = "ANALYZING";
    HyperGEnvType[HyperGEnvType["RUNTIME"] = 1] = "RUNTIME";
    HyperGEnvType[HyperGEnvType["INTEGRITY_CHECK"] = 2] = "INTEGRITY_CHECK";
})(HyperGEnvType = exports.HyperGEnvType || (exports.HyperGEnvType = {}));
var HyperG;
(function (HyperG) {
    var Backup = /** @class */ (function () {
        function Backup() {
            this.Env = HyperGEnvType.ANALYZING;
            this.serializerStartingIdx = 0;
            this.serializerCnt = 0;
            this.nodeTable = [];
        }
        Backup.prototype.load = function () {
            this.Env = HyperG.Env;
            this.serializerStartingIdx = HyperG.serializerStartingIdx;
            this.serializerCnt = HyperG.serializerCnt;
            this.functionTable = HyperG.functionTable;
            this.ruleTable = HyperG.ruleTable;
            this.ruleInterpreters = HyperG.ruleInterpreters;
            this.nodeTable = HyperG.nodeTable;
            this.parseTables = HyperG.parseTables;
        };
        Backup.prototype.save = function () {
            HyperG.Env = this.Env;
            HyperG.serializerStartingIdx = this.serializerStartingIdx;
            HyperG.serializerCnt = this.serializerCnt;
            HyperG.functionTable = this.functionTable;
            HyperG.ruleTable = this.ruleTable;
            HyperG.ruleInterpreters = this.ruleInterpreters;
            HyperG.nodeTable = this.nodeTable;
            HyperG.parseTables = this.parseTables;
        };
        return Backup;
    }());
    HyperG.Env = HyperGEnvType.ANALYZING;
    HyperG.serializerStartingIdx = 0;
    HyperG.serializerCnt = 0;
    HyperG.nodeTable = [];
    function backup() {
        var backup = new Backup();
        backup.load();
        return backup;
    }
    HyperG.backup = backup;
    function init() {
        var emptyBackup = new Backup();
        emptyBackup.save();
        return emptyBackup;
    }
    HyperG.init = init;
    function totallyReinitializableTransaction(fun) {
        var bak = lib_1.Analysis.backup();
        var e = backup();
        try {
            fun();
        }
        finally {
            bak.save();
            e.save();
        }
    }
    HyperG.totallyReinitializableTransaction = totallyReinitializableTransaction;
})(HyperG = exports.HyperG || (exports.HyperG = {}));
function mergeFailures(into, other) {
    if (other.maxFailPos < into.maxFailPos) {
        return;
    }
    if (other.maxFailPos > into.maxFailPos) {
        into.maxFailPos = other.maxFailPos;
        into.maxFailExpected = [];
        into.found = other.found;
    }
    into.maxFailExpected = into.maxFailExpected.concat(other.maxFailExpected);
}
exports.mergeFailures = mergeFailures;
var HyperGParseErrorInfo = /** @class */ (function () {
    function HyperGParseErrorInfo(input, message, expected, found, absolutePosition) {
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
    HyperGParseErrorInfo.buildMessage = function (input, expected, found) {
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
    Object.defineProperty(HyperGParseErrorInfo.prototype, "message", {
        get: function () {
            if (!this.message1) {
                this.message1 = this.message0 + HyperGParseErrorInfo.buildMessage(this.input, this.expected, this.found);
            }
            return this.message1;
        },
        enumerable: false,
        configurable: true
    });
    return HyperGParseErrorInfo;
}());
exports.HyperGParseErrorInfo = HyperGParseErrorInfo;
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
var HyperGParseStream = /** @class */ (function () {
    function HyperGParseStream(tokens, ruleNames) {
        this.tokens = tokens;
        this.ruleNames = ruleNames;
    }
    HyperGParseStream.prototype.tokenAt = function (pos) {
        return this.tokens[pos];
    };
    Object.defineProperty(HyperGParseStream.prototype, "length", {
        get: function () {
            return this.tokens.length;
        },
        enumerable: false,
        configurable: true
    });
    return HyperGParseStream;
}());
exports.HyperGParseStream = HyperGParseStream;
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
function CodeTblToHex(s) {
    var r = s.map(function (c) {
        if (!c)
            return "00";
        else if (c <= 0xf)
            return '0' + c.toString(16).toUpperCase();
        else if (c <= 0xff)
            return '' + c.toString(16).toUpperCase();
        else if (c <= 0xfff)
            return 'x' + c.toString(16).toUpperCase();
        else if (c <= 0xffff)
            return "X" + c.toString(16).toUpperCase();
        else
            return "(" + c.toString(16).toUpperCase() + ")";
    });
    return r;
}
exports.CodeTblToHex = CodeTblToHex;
function encodePrsTbl(parseTable) {
    var code = parseTable.ser();
    var enc = encodeVsimPck(code);
    return enc;
}
exports.encodePrsTbl = encodePrsTbl;
function encodeVsimPck(code) {
    var hex = CodeTblToHex(code).join('');
    var enc = verySimplePackMany0(hex);
    return enc;
}
exports.encodeVsimPck = encodeVsimPck;
function verySimplePackMany0(raw) {
    var result = "";
    var R = /(x...|X....)?(0{10,})/g;
    var li = 0;
    for (var ra; ra = R.exec(raw);) {
        result += raw.substring(li, ra.index);
        result += (ra[1] ? ra[1] : "") + "{" + ra[2].length.toString(16).toUpperCase() + "}";
        li = R.lastIndex;
    }
    result += raw.substring(li);
    return result;
}
exports.verySimplePackMany0 = verySimplePackMany0;
function checkRuleNodesIntegrity(items) {
    HyperG.serializerCnt = HyperG.serializerStartingIdx;
    items.forEach(function (_a) {
        var ruleNode = _a[0], serializedForm = _a[1];
        checkRuleNodeIntegrity(ruleNode, serializedForm);
    });
}
exports.checkRuleNodesIntegrity = checkRuleNodesIntegrity;
function checkRuleNodeIntegrity(ruleNode, serializedForm) {
    var code = ruleNode.ser();
    var hex = CodeTblToHex(code).join('');
    if (hex !== serializedForm) {
        console.error("Rule node integrity error pass 1 : " + ruleNode);
    }
    else {
        console.log("Rule node integrity check successful pass 1 : " + ruleNode);
    }
    HyperG.totallyReinitializableTransaction(function () {
        HyperG.serializerCnt = ruleNode.nodeIdx;
        var ruleNode2 = new parsers_1.PRule(null, ruleNode.index);
        ruleNode2.rule = ruleNode.rule;
        ruleNode2.deser(code, 0);
        if (!ruleNode.diagnosticEqualityCheck(ruleNode2)) {
            console.error("Rule node integrity error pass 2 : " + ruleNode2);
        }
        else {
            console.log("Rule node integrity check successful pass 2: " + ruleNode);
        }
    });
}
function checkParseTablesIntegrity(serializedConstTable, items) {
    HyperG.totallyReinitializableTransaction(function () {
        lib_1.Analysis.init();
        HyperG.Env = HyperGEnvType.INTEGRITY_CHECK;
        HyperG.serializerCnt = HyperG.serializerStartingIdx;
        items.forEach(function (_a) {
            var parseTable = _a[0], serializedForm = _a[1];
            checkParseTableIntegrity(parseTable, serializedForm);
        });
        var ttbuf = [];
        lib_1.Analysis.writeAllSerializedTables(ttbuf);
        var hex = encodeVsimPck(ttbuf);
        if (hex !== serializedConstTable) {
            console.error("Const table integrity error.");
        }
        else {
            console.log("Const table integrity check successful.");
        }
    });
}
exports.checkParseTablesIntegrity = checkParseTablesIntegrity;
function checkParseTableIntegrity(parseTable, serializedForm) {
    var code = parseTable.ser();
    var hex = encodeVsimPck(code);
    if (hex !== serializedForm) {
        console.error("Parse table integrity error : " + parseTable);
    }
    else {
        console.log("Parse table integrity check successful : " + parseTable);
    }
    var parseTable2 = new analyzer_1.ParseTable(parseTable.rule, null, []);
    parseTable2.deser(code);
    if (!parseTable.diagnosticEqualityCheck(parseTable2)) {
        console.error("Parse table integrity error pass 2 : " + parseTable2);
    }
    else {
        console.log("Parse table integrity check successful pass 2: " + parseTable);
    }
}
__exportStar(require("./parsers"), exports);
__exportStar(require("./analyzer"), exports);
__exportStar(require("./analyzer-nodes"), exports);
__exportStar(require("./interpreter"), exports);
__exportStar(require("./packrat"), exports);
__exportStar(require("./jmptblrunner"), exports);
//# sourceMappingURL=index.js.map