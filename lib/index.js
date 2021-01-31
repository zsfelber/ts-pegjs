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
exports.JSstringEscape = exports.PegjsParseStreamBuffer = exports.PegjsParseStream = exports.DefaultTracer = exports.SyntaxError = exports.PegjsParseErrorInfo = exports.mergeLocalFailures = exports.mergeFailures = exports.ACCEPT_TOKEN = exports.MATCH_TOKEN = void 0;
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
                case "literal":
                    return "\"" + input.printLiteral(expectation.text) + "\"";
                case "token":
                    return input.printToken(expectation.tokenId);
                case "class":
                    var escapedParts = expectation.parts.map(function (part) {
                        return Array.isArray(part)
                            ? classEscape(part[0]) + "-" + classEscape(part[1])
                            : classEscape(part);
                    });
                    return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
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
    function PegjsParseStream(buffer, ruleNames) {
        this.buffer = buffer;
        this.ruleNames = ruleNames ? ruleNames : [];
    }
    Object.defineProperty(PegjsParseStream.prototype, "tokens", {
        get: function () {
            return this.buffer.tokens;
        },
        enumerable: false,
        configurable: true
    });
    PegjsParseStream.prototype.tokenAt = function (pos) {
        return this.buffer.tokenAt(pos);
    };
    Object.defineProperty(PegjsParseStream.prototype, "currPos", {
        get: function () {
            return this.buffer.currPos;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PegjsParseStream.prototype, "savedPos", {
        get: function () {
            return this.buffer.savedPos;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PegjsParseStream.prototype, "length", {
        get: function () {
            return this.buffer.length;
        },
        enumerable: false,
        configurable: true
    });
    PegjsParseStream.prototype.isAvailableAt = function (position) {
        return this.buffer.length > position;
    };
    PegjsParseStream.prototype.charAt = function (position) {
        return this.buffer.charAt(position);
    };
    PegjsParseStream.prototype.charCodeAt = function (position) {
        return this.buffer.charCodeAt(position);
    };
    PegjsParseStream.prototype.substring = function (from, to, rule) {
        return this.buffer.substring(from, to);
    };
    PegjsParseStream.prototype.substr = function (from, len, rule) {
        return this.buffer.substr(from, len);
    };
    // should return this.substr(input.currPos, len)
    PegjsParseStream.prototype.readForward = function (rule, len) {
        return this.buffer.readForward(rule, len);
    };
    //"input.readForward(rule, expectedText.length) === expectedText",
    //=
    //"input.expect(rule, expectedText)",
    PegjsParseStream.prototype.expect = function (rule, expectedText) {
        return this.readForward(rule, expectedText.length) === expectedText;
    };
    //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
    //=
    //"input.expectLowerCase(rule, expectedText)",
    PegjsParseStream.prototype.expectLowerCase = function (rule, expectedText) {
        return this.readForward(rule, expectedText.length).toLowerCase() === expectedText;
    };
    PegjsParseStream.prototype.calculatePosition = function (pos) {
        return this.buffer.calculatePosition(pos);
    };
    /* convert literal to human readable form */
    PegjsParseStream.prototype.printLiteral = function (literal) {
        return this.buffer.printLiteral(literal);
    };
    /* convert token to human readable form */
    PegjsParseStream.prototype.printToken = function (tokenId) {
        return this.buffer.printToken(tokenId);
    };
    PegjsParseStream.prototype.toAbsolutePosition = function (pos) {
        return this.buffer.toAbsolutePosition(pos);
    };
    return PegjsParseStream;
}());
exports.PegjsParseStream = PegjsParseStream;
var PegjsParseStreamBuffer = /** @class */ (function () {
    function PegjsParseStreamBuffer(src, tokens, initialPos) {
        if (initialPos === void 0) { initialPos = 0; }
        this.buffer = src;
        this.tokens = tokens;
        this.savedPos = initialPos;
        this.currPos = initialPos;
        this.posDetailsCache = [];
    }
    Object.defineProperty(PegjsParseStreamBuffer.prototype, "length", {
        get: function () {
            return this.buffer.length;
        },
        enumerable: false,
        configurable: true
    });
    PegjsParseStreamBuffer.prototype.seek = function (position) {
        /*
        if (position >= this.buffer.length) {
            console.log("Attempt to overseek to " + position +
                " of len:" + this.buffer.length +
                (rule === undefined ? "" : "  in rule:" + this.ruleNames[rule]));
        }*/
    };
    /* these should read forward if requested position is in the future
    * meaning lookahead tokens */
    PegjsParseStreamBuffer.prototype.charAt = function (position) {
        this.seek(position);
        return this.buffer.charAt(position);
    };
    PegjsParseStreamBuffer.prototype.charCodeAt = function (position) {
        this.seek(position);
        return this.buffer.charCodeAt(position);
    };
    PegjsParseStreamBuffer.prototype.substring = function (from, to) {
        this.seek(to);
        return this.buffer.substring(from, to);
    };
    PegjsParseStreamBuffer.prototype.substr = function (from, len) {
        this.seek(len < 0 ? this.buffer.length - 1 : from + len);
        return this.buffer.substr(from, len);
    };
    // should return this.substr(input.currPos, len)
    PegjsParseStreamBuffer.prototype.readForward = function (rule, len) {
        return this.substr(this.currPos, len);
    };
    PegjsParseStreamBuffer.prototype.tokenAt = function (pos) {
        if (!pos)
            pos = 0;
        else if (pos < 0)
            pos += this.currPos;
        return this.tokens[pos];
    };
    PegjsParseStreamBuffer.prototype.calculatePosition = function (pos) {
        var details = this.posDetailsCache[pos];
        if (details) {
            return details;
        }
        else if (pos >= 0) {
            var p = 0;
            if (this.posDetailsCache.length) {
                if (pos >= this.posDetailsCache.length) {
                    p = this.posDetailsCache.length - 1;
                    details = this.posDetailsCache[p];
                }
                else {
                    p = pos;
                    while (!(details = this.posDetailsCache[--p]) && p > 0)
                        ;
                    if (!details) {
                        details = { line: 1, column: 1 };
                    }
                }
                details = {
                    line: details.line,
                    column: details.column
                };
            }
            else {
                details = { line: 1, column: 1 };
            }
            while (p < pos) {
                if (this.charCodeAt(p) === 10) {
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
    PegjsParseStreamBuffer.prototype.toString = function () {
        return this.buffer;
    };
    PegjsParseStreamBuffer.prototype.toAbsolutePosition = function (pos) {
        return pos;
    };
    return PegjsParseStreamBuffer;
}());
exports.PegjsParseStreamBuffer = PegjsParseStreamBuffer;
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
//# sourceMappingURL=index.js.map