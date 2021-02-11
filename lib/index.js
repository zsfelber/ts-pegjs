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
exports.CodeTblToHex = exports.JSstringEscape = exports.SourceFilePosUtil = exports.PegCannonParseStream = exports.DefaultTracer = exports.SyntaxError = exports.PegCannonParseErrorInfo = exports.mergeFailures = exports.ACCEPT_TOKEN = exports.MATCH_TOKEN = void 0;
exports.MATCH_TOKEN = 40;
exports.ACCEPT_TOKEN = 41;
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
var PegCannonParseErrorInfo = /** @class */ (function () {
    function PegCannonParseErrorInfo(input, message, expected, found, absolutePosition) {
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
    PegCannonParseErrorInfo.buildMessage = function (input, expected, found) {
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
    Object.defineProperty(PegCannonParseErrorInfo.prototype, "message", {
        get: function () {
            if (!this.message1) {
                this.message1 = this.message0 + PegCannonParseErrorInfo.buildMessage(this.input, this.expected, this.found);
            }
            return this.message1;
        },
        enumerable: false,
        configurable: true
    });
    return PegCannonParseErrorInfo;
}());
exports.PegCannonParseErrorInfo = PegCannonParseErrorInfo;
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
var PegCannonParseStream = /** @class */ (function () {
    function PegCannonParseStream(tokens, ruleNames) {
        this.tokens = tokens;
        this.ruleNames = ruleNames;
    }
    PegCannonParseStream.prototype.tokenAt = function (pos) {
        return this.tokens[pos];
    };
    Object.defineProperty(PegCannonParseStream.prototype, "length", {
        get: function () {
            return this.tokens.length;
        },
        enumerable: false,
        configurable: true
    });
    return PegCannonParseStream;
}());
exports.PegCannonParseStream = PegCannonParseStream;
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
function CodeTblToHex(s) {
    var r = s.map(function (c) {
        if (c === undefined) {
            return "00";
        }
        else if (c <= 0xf)
            return '0' + c.toString(16).toUpperCase();
        else if (c <= 0xff)
            return '' + c.toString(16).toUpperCase();
        else if (c <= 0xfff)
            return 'x' + c.toString(16).toUpperCase();
        else
            return "X" + c.toString(16).toUpperCase();
    });
    return r;
}
exports.CodeTblToHex = CodeTblToHex;
function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
}
__exportStar(require("./parsers"), exports);
__exportStar(require("./analyzer"), exports);
__exportStar(require("./analyzer-nodes"), exports);
__exportStar(require("./interpreter"), exports);
__exportStar(require("./packrat"), exports);
__exportStar(require("./jmptblrunner"), exports);
//# sourceMappingURL=index.js.map