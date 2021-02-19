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
exports.IncVariator = exports.checkParseTablesIntegrity = exports.checkRuleNodesIntegrity = exports.peg$decode = exports.verySimplePackMany0 = exports.encodeVsimPck = exports.encodePrsTbl = exports.CodeTblToHex = exports.distinct = exports.maximum = exports.minimum = exports.UNIQUE_OBJECT_ID = exports.DefaultComparator = exports.JSstringEscape = exports.SourceFilePosUtil = exports.HyperGParseStream = exports.DefaultTracer = exports.SyntaxError = exports.HyperGParseErrorInfo = exports.mergeFailures = exports.findDiff = exports.HyperG = exports.HyperGEnvType = exports.ACCEPT_TOKEN = exports.MATCH_TOKEN = void 0;
var _1 = require(".");
exports.MATCH_TOKEN = 40;
exports.ACCEPT_TOKEN = 41;
var HyperGEnvType;
(function (HyperGEnvType) {
    HyperGEnvType[HyperGEnvType["NONE"] = 0] = "NONE";
    HyperGEnvType[HyperGEnvType["ANALYZING"] = 1] = "ANALYZING";
    HyperGEnvType[HyperGEnvType["RUNTIME"] = 2] = "RUNTIME";
    HyperGEnvType[HyperGEnvType["INTEGRITY_CHECK"] = 3] = "INTEGRITY_CHECK";
    HyperGEnvType[HyperGEnvType["INTEGRITY_CHECK_VERBOSE"] = 4] = "INTEGRITY_CHECK_VERBOSE";
})(HyperGEnvType = exports.HyperGEnvType || (exports.HyperGEnvType = {}));
var HyperG;
(function (HyperG) {
    var Backup = /** @class */ (function () {
        function Backup() {
            this.Env = HyperGEnvType.ANALYZING;
            this.serializerStartingIdx = 0;
            this.serializerCnt = 0;
            this.nodeTable = [];
            this.ruleRefTable = [];
            this.indent = "";
            this.stack = [];
        }
        Backup.prototype.load = function () {
            this.Env = HyperG.Env;
            this.serializerStartingIdx = HyperG.serializerStartingIdx;
            this.serializerCnt = HyperG.serializerCnt;
            this.functionTable = [].concat(HyperG.functionTable);
            this.ruleTable = [].concat(HyperG.ruleTable);
            this.ruleInterpreters = [].concat(HyperG.ruleInterpreters);
            this.nodeTable = [].concat(HyperG.nodeTable);
            this.ruleRefTable = [].concat(HyperG.ruleRefTable);
            this.indent = HyperG.indent;
            this.stack = [].concat(HyperG.stack);
        };
        Backup.prototype.save = function () {
            HyperG.Env = this.Env;
            HyperG.serializerStartingIdx = this.serializerStartingIdx;
            HyperG.serializerCnt = this.serializerCnt;
            HyperG.functionTable = this.functionTable;
            HyperG.ruleTable = this.ruleTable;
            HyperG.ruleInterpreters = this.ruleInterpreters;
            HyperG.nodeTable = this.nodeTable;
            HyperG.ruleRefTable = this.ruleRefTable;
            HyperG.indent = this.indent;
            HyperG.stack = this.stack;
        };
        return Backup;
    }());
    HyperG.Env = HyperGEnvType.ANALYZING;
    HyperG.serializerStartingIdx = 0;
    HyperG.serializerCnt = 0;
    HyperG.nodeTable = [];
    HyperG.ruleRefTable = [];
    HyperG.indent = "";
    HyperG.stack = [];
    function backup() {
        var backup = new Backup();
        backup.load();
        return backup;
    }
    HyperG.backup = backup;
    function empty() {
        var emptyBackup = new Backup();
        return emptyBackup;
    }
    HyperG.empty = empty;
    function totallyReinitializableTransaction(fun) {
        var bak = _1.Analysis.backup();
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
    function countRuleRefs() {
        HyperG.ruleTable.forEach(function (r) {
            r.refs = 0;
        });
        HyperG.ruleRefTable.forEach(function (rr) {
            HyperG.ruleTable[rr.ruleIndex].refs++;
        });
    }
    HyperG.countRuleRefs = countRuleRefs;
})(HyperG = exports.HyperG || (exports.HyperG = {}));
function findDiff(str1, str2) {
    var diff = "";
    str2.split('').some(function (val, i) {
        if (val != str1.charAt(i)) {
            diff += "<" + i + ":";
            diff += "\n";
            diff += str1.substring(i);
            diff += "\n";
            diff += ">" + i + ":";
            diff += "\n";
            diff += str2.substring(i);
            return true;
        }
        return false;
    });
    return diff;
}
exports.findDiff = findDiff;
;
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
        this.currPos = 0;
        this.savedPos = 0;
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
var DefaultComparator = function (a, b) {
    if (a === b)
        return 0;
    var r1 = (a ? 1 : 0) - (b ? 1 : 0);
    if (r1)
        return r1;
    if (typeof (a) === "number" && typeof (b) === "number") {
        return a - b;
    }
    else if (typeof (a) === "string" && typeof (b) === "string") {
        return a.localeCompare(b);
    }
    else {
        return a[exports.UNIQUE_OBJECT_ID].toString().localeCompare(b[exports.UNIQUE_OBJECT_ID].toString());
    }
};
exports.DefaultComparator = DefaultComparator;
exports.UNIQUE_OBJECT_ID = "_uniqueObjId";
// static
var cnt_uniqueObjId = 1000;
if (!Object.prototype.hasOwnProperty(exports.UNIQUE_OBJECT_ID)) {
    Object.defineProperty(Object.prototype, exports.UNIQUE_OBJECT_ID, {
        // Using shorthand method names (ES2015 feature).
        // This is equivalent to:
        // get: function() { return bValue; },
        // set: function(newValue) { bValue = newValue; },
        get: function () {
            if (!this.__uniqueObjId) {
                this.__uniqueObjId = "_oid$¤" + (cnt_uniqueObjId++);
            }
            return this.__uniqueObjId;
        },
        enumerable: false,
        configurable: false
    });
}
Object.prototype.toString =
    function () {
        return (this.constructor ? this.constructor.name : "object") + "@" + this[exports.UNIQUE_OBJECT_ID];
    };
function minimum(inparr, cmp) {
    if (!inparr)
        return [-1, undefined];
    if (!inparr.length)
        return [-1, undefined];
    if (!cmp) {
        cmp = exports.DefaultComparator;
    }
    var mini = 0;
    var min = inparr[0];
    for (var i = 1; i < inparr.length; i++) {
        var d = inparr[i];
        if (cmp(d, min) < 0) {
            mini = i;
            min = d;
        }
    }
    return [mini, min];
}
exports.minimum = minimum;
function maximum(inparr, cmp) {
    if (!inparr)
        return [-1, undefined];
    if (!inparr.length)
        return [-1, undefined];
    if (!cmp) {
        cmp = exports.DefaultComparator;
    }
    var maxi = 0;
    var max = inparr[0];
    for (var i = 1; i < inparr.length; i++) {
        var d = inparr[i];
        if (cmp(d, max) > 0) {
            maxi = i;
            max = d;
        }
    }
    return [maxi, max];
}
exports.maximum = maximum;
function distinct(inparr, cmp) {
    if (!inparr)
        return inparr;
    if (!inparr.length)
        return [];
    if (!cmp) {
        cmp = exports.DefaultComparator;
    }
    inparr = [].concat(inparr);
    inparr.sort(cmp);
    var pd = inparr[0];
    var resarr = [pd];
    for (var i = 1; i < inparr.length; i++, pd = d) {
        var d = inparr[i];
        if (cmp(d, pd))
            resarr.push(d);
    }
    return resarr;
}
exports.distinct = distinct;
function CodeTblToHex(s) {
    var r = s.map(function (c) {
        if (!c) {
            return "00";
        }
        else {
            var res;
            if (c < 0) {
                c = -c;
                res = "-";
            }
            else {
                res = "";
            }
            if (c <= 0xf)
                res += '0' + c.toString(16).toUpperCase();
            else if (c <= 0xff)
                res += '' + c.toString(16).toUpperCase();
            else if (c <= 0xfff)
                res += 'x' + c.toString(16).toUpperCase();
            else if (c <= 0xffff)
                res += "X" + c.toString(16).toUpperCase();
            else
                res += "(" + c.toString(16).toUpperCase() + ")";
            return res;
        }
    });
    return r;
}
exports.CodeTblToHex = CodeTblToHex;
function encodePrsTbl(parseTable) {
    var code = parseTable.ser(HyperG.Env);
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
var HTOD = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
};
function peg$decode(s) {
    var code = [];
    for (var i = 0, sign = 1; i < s.length;) {
        var rrr = function (R) {
            var ra = R.exec(s);
            var num = 0;
            for (var j = 0; j < ra[1].length; j++) {
                num = (num << 4) + HTOD[ra[1][j]];
            }
            i = R.lastIndex;
            return num;
        };
        var char1 = s.charAt(i++);
        switch (char1) {
            case "{":
                var R = /\\{(.*?)\\}/;
                var len = rrr(R);
                for (var k = 0; k < len; k++)
                    code.push(0);
                sign = 1;
                break;
            case "(":
                var R = /\\((.*?)\\)/;
                var num = rrr(R);
                code.push(sign * num);
                sign = 1;
                break;
            case "X":
                code.push(sign * ((HTOD[s.charAt(i++)] << 12) + (HTOD[s.charAt(i++)] << 8) + (HTOD[s.charAt(i++)] << 4) + HTOD[s.charAt(i++)]));
                sign = 1;
                break;
            case "x":
                code.push(sign * ((HTOD[s.charAt(i++)] << 8) + (HTOD[s.charAt(i++)] << 4) + HTOD[s.charAt(i++)]));
                sign = 1;
                break;
            case "-":
                sign = -1;
                break;
            case "+":
                sign = 1;
                break;
            default:
                code.push(sign * ((HTOD[char1] << 4) + HTOD[s.charAt(i++)]));
                sign = 1;
                break;
        }
    }
    return code;
}
exports.peg$decode = peg$decode;
function checkRuleNodesIntegrity(items, mode) {
    HyperG.serializerCnt = HyperG.serializerStartingIdx;
    items.forEach(function (_a) {
        var ruleNode = _a[0], serializedForm = _a[1];
        checkRuleNodeIntegrity(ruleNode, serializedForm, mode);
    });
}
exports.checkRuleNodesIntegrity = checkRuleNodesIntegrity;
function checkRuleNodeIntegrity(ruleNode, serializedForm, mode) {
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
        HyperG.indent = "";
        HyperG.Env = mode ? mode : HyperGEnvType.INTEGRITY_CHECK;
        var node = _1.PNode.deserialize(code);
        var ruleNode2 = node;
        ruleNode2.rule = ruleNode.rule;
        if (!ruleNode.diagnosticEqualityCheck(ruleNode2)) {
            console.error("Rule node integrity error pass 2 : " + ruleNode2);
        }
        else {
            console.log("Rule node integrity check successful pass 2: " + ruleNode);
        }
    });
}
function checkParseTablesIntegrity(serializedConstTable, items, choiceTokens, mode) {
    HyperG.totallyReinitializableTransaction(function () {
        _1.Analysis.empty().save();
        _1.Analysis.choiceTokens = choiceTokens;
        HyperG.Env = mode ? mode : HyperGEnvType.INTEGRITY_CHECK;
        HyperG.serializerCnt = HyperG.serializerStartingIdx;
        items.forEach(function (_a) {
            var parseTable = _a[0], serializedForm = _a[1];
            checkParseTableIntegrity(parseTable, serializedForm, mode);
        });
        var ttbuf = [];
        _1.Analysis.generateTableSerializationData();
        _1.Analysis.writeAllSerializedTables(ttbuf);
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
function checkParseTableIntegrity(parseTable, serializedForm, mode) {
    var code = parseTable.ser(HyperG.Env);
    var hex = encodeVsimPck(code);
    if (hex !== serializedForm) {
        console.error("Parse table integrity error pass 1 : " + parseTable);
    }
    else {
        console.log("Parse table integrity check successful pass 1 : " + parseTable);
    }
    parseTable.allStates.forEach(function (c) {
        _1.Analysis.leafStates[c.packedIndex] = c;
    });
    parseTable.myCommons.forEach(function (c) {
        _1.Analysis.leafStateCommons[c.packedIndex] = c;
    });
    var parseTable2 = new _1.ParseTable(parseTable.rule);
    parseTable2.deser(code, 0);
    if (!parseTable.diagnosticEqualityCheck(parseTable2)) {
        console.error("Parse table integrity error pass 2 : " + parseTable2);
    }
    else {
        console.log("Parse table integrity check successful pass 2: " + parseTable);
    }
}
var IncVariator = /** @class */ (function () {
    function IncVariator(from) {
        this.K = 0;
        this.n = 0;
        this.Ex = 0;
        this.Ex2 = 0;
        if (from) {
            this.K = from.K;
            this.n = from.n;
            this.Ex = from.Ex;
            this.Ex2 = from.Ex2;
        }
    }
    IncVariator.prototype.add = function (x) {
        if (this.n === 0)
            this.K = x;
        this.n++;
        this.Ex += x - this.K;
        this.Ex2 += (x - this.K) * (x - this.K);
    };
    Object.defineProperty(IncVariator.prototype, "mean", {
        get: function () {
            return this.K + this.Ex / this.n;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "variance", {
        get: function () {
            return (this.Ex2 - (this.Ex * this.Ex) / this.n) / (this.n - 1);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "sqrtVariance", {
        get: function () {
            return Math.sqrt(this.variance);
        },
        enumerable: false,
        configurable: true
    });
    IncVariator.prototype.toString = function (fractionDecimals) {
        if (fractionDecimals === void 0) { fractionDecimals = 1; }
        return this.n + "*(avg:" + this.mean.toFixed(fractionDecimals) + "+-var:" + this.sqrtVariance.toFixed(fractionDecimals) + ")";
    };
    return IncVariator;
}());
exports.IncVariator = IncVariator;
//# sourceMappingURL=hyperg.js.map