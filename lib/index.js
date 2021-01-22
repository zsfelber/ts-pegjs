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
exports.__esModule = true;
exports.PegjsParseStream = exports.DefaultTracer = exports.SyntaxError = void 0;
var SyntaxError = /** @class */ (function (_super) {
    __extends(SyntaxError, _super);
    function SyntaxError(input, message, expected, found, location) {
        var _this = _super.call(this) || this;
        _this.input = input;
        _this.message = message;
        _this.expected = expected;
        _this.found = found;
        _this.location = location;
        _this.name = "SyntaxError";
        if (_this.location) {
            _this.message = "At " + location.start.line + ":" + location.start.column + " " + message;
        }
        return _this;
        //if (typeof (Error as any).captureStackTrace === "function") {
        //  (Error as any).captureStackTrace(this, SyntaxError);
        //}
    }
    SyntaxError.buildMessage = function (expected, found) {
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
            switch (expectation.type) {
                case "literal":
                    return "\"" + this.owner.printTokens(literalEscape(expectation.text)) + "\"";
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
        function describeFound(found1) {
            return found1 ? "\"" + this.owner.printTokens(literalEscape(found1)) + "\"" : "end of input";
        }
        return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
    };
    return SyntaxError;
}(Error));
exports.SyntaxError = SyntaxError;
var DefaultTracer = /** @class */ (function () {
    function DefaultTracer() {
        this.indentLevel = 0;
    }
    DefaultTracer.prototype.trace = function (event) {
        var that = this;
        function log(evt) {
            function repeat(text, n) {
                var result = "", i;
                for (i = 0; i < n; i++) {
                    result += text;
                }
                return result;
            }
            function pad(text, length) {
                return text + repeat(" ", length - text.length);
            }
            if (typeof console === "object") { // IE 8-10
                console.log(evt.location.start.line + ":" + evt.location.start.column + "-"
                    + evt.location.end.line + ":" + evt.location.end.column + " "
                    + pad(evt.type, 10) + " "
                    + repeat("  ", that.indentLevel) + evt.rule);
            }
        }
        switch (event.type) {
            case "rule.enter":
                log(event);
                this.indentLevel++;
                break;
            case "rule.match":
                this.indentLevel--;
                log(event);
                break;
            case "rule.fail":
                this.indentLevel--;
                log(event);
                break;
            default:
                throw new Error("Invalid event type: " + event.type + ".");
        }
    };
    return DefaultTracer;
}());
exports.DefaultTracer = DefaultTracer;
var PegjsParseStream = /** @class */ (function () {
    function PegjsParseStream(initialBuf, ruleNames) {
        this.ruleNames = [];
        /* give read-write access to pegjs, do not manipulate them */
        this.savedPos = 0;
        this.currPos = 0;
        this.posDetailsCache = [];
        this.buffer = initialBuf ? initialBuf : "";
        this.ruleNames = ruleNames ? ruleNames : [];
    }
    PegjsParseStream.prototype.seek = function (position, rule) {
        /*if (position >= this.buffer.length) {
            console.log("Attempt to overseek to " + position +
                " of len:" + this.buffer.length +
                (rule === undefined ? "" : "  in rule:" + this.ruleNames[rule]));
        }*/
    };
    /* these should read forward if requested position is in the future
    * meaning lookahead tokens */
    PegjsParseStream.prototype.isAvailableAt = function (position) {
        this.seek(position);
        return this.buffer.length > position;
    };
    PegjsParseStream.prototype.charAt = function (position) {
        this.seek(position);
        return this.buffer.charAt(position);
    };
    PegjsParseStream.prototype.charCodeAt = function (position) {
        this.seek(position);
        return this.buffer.charCodeAt(position);
    };
    PegjsParseStream.prototype.substring = function (from, to, rule) {
        if (to === undefined)
            to = this.buffer.length;
        this.seek(to - 1, rule);
        return this.buffer.substring(from, to);
    };
    PegjsParseStream.prototype.substr = function (from, len, rule) {
        return this.substring(from, len === undefined ? undefined : from + len, rule);
    };
    // should return this.substr(input.currPos, len)
    PegjsParseStream.prototype.readForward = function (rule, len) {
        return this.substr(this.currPos, len, rule);
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
        var details = this.posDetailsCache[pos];
        if (details) {
            return details;
        }
        else {
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
    };
    PegjsParseStream.prototype.printTokens = function (tokenCodes) {
        return tokenCodes;
    };
    return PegjsParseStream;
}());
exports.PegjsParseStream = PegjsParseStream;
