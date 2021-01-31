
export const MATCH_TOKEN = 40;
export const ACCEPT_TOKEN = 41;


export interface IFailure {
  absoluteFailPos: number;
  maxFailExpected: Expectation[];
  found: Expectation;
}

export interface ILocalFailure {
  localFailPos: number;
  maxFailExpected: Expectation[];
}


export function mergeFailures(into: IFailure, other: IFailure) {
  if (other.absoluteFailPos < into.absoluteFailPos) { return; }

  if (other.absoluteFailPos > into.absoluteFailPos) {
    into.absoluteFailPos = other.absoluteFailPos;
    into.maxFailExpected = [];
    into.found = other.found;
  }

  into.maxFailExpected = into.maxFailExpected.concat(other.maxFailExpected);
}

export function mergeLocalFailures(into: ILocalFailure, other: ILocalFailure) {
  if (other.localFailPos < into.localFailPos) { return; }

  if (other.localFailPos > into.localFailPos) {
    into.localFailPos = other.localFailPos;
    into.maxFailExpected = [];
  }

  into.maxFailExpected = into.maxFailExpected.concat(other.maxFailExpected);
}

export interface IFilePosition {
  line: number;
  column: number;
  offset?: number;
  length?: number;
  text?: string;
}

export interface IFileRange {
  start: IFilePosition;
  end: IFilePosition;
}

export interface ILiteralExpectation {
  type: "literal";
  text: string;
  ignoreCase: boolean;
}

export interface ITokenExpectation {
  type: "token";
  tokenId: number;
}

export interface IClassParts extends Array<string | IClassParts> { }

export interface IClassExpectation {
  type: "class";
  parts: IClassParts;
  inverted: boolean;
  ignoreCase: boolean;
}

export interface IAnyExpectation {
  type: "any";
}

export interface IEndExpectation {
  type: "end";
}

export interface IOtherExpectation {
  type: "other";
  description: string;
}

export type Expectation = ILiteralExpectation | ITokenExpectation | IClassExpectation | IAnyExpectation | IEndExpectation | IOtherExpectation;

export class PegjsParseErrorInfo<T extends IToken> {

  private static buildMessage<T extends IToken>(input: IPegjsParseStream<T>, expected: Expectation[], found: Expectation) {

    function hex(ch: string): string {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }

    function literalEscape(s: string): string {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, (ch) => "\\x" + hex(ch));
    }

    function classEscape(s: string): string {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/-/g, "\\-")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, (ch) => "\\x" + hex(ch));
    }

    function describeExpectation(expectation: Expectation) {
      if (!expectation) {
        return "end of input";
      }
      switch (expectation.type) {
        case "literal":
          return "\"" + input.printLiteral(expectation.text) + "\"";
        case "token":
          return input.printToken(expectation.tokenId);
        case "class":
          const escapedParts = expectation.parts.map((part) => {
            return Array.isArray(part)
              ? classEscape(part[0] as string) + "-" + classEscape(part[1] as string)
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

    function describeExpected(expected1: Expectation[]) {
      const descriptions = expected1.map(describeExpectation);
      let i: number;
      let j: number;

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
  }

  readonly input: IPegjsParseStream<T>;
  readonly message0: string;
  private message1: string;
  readonly expected: Expectation[];
  readonly found: Expectation;
  readonly absolutePosition: number;
  readonly name: string;

  constructor(input: IPegjsParseStream<T>, message: string, expected: Expectation[], found: Expectation, absolutePosition?: number) {
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

  get message() {
    if (!this.message1) {
      this.message1 = this.message0 + PegjsParseErrorInfo.buildMessage(this.input, this.expected, this.found);
    }
    return this.message1;
  }


}

export class SyntaxError<T extends IToken> extends Error {
  info: PegjsParseErrorInfo<T>;

  constructor(info: PegjsParseErrorInfo<T>) {
    super();
    this.info = info;
  }

  get message() {
    return this.info.message;
  }
}


export interface ITraceEvent {
  type: string;
  rule: string;
  result?: any;
  location: IFileRange;
  cached?: boolean;
}

export class DefaultTracer {
  private indentLevel: number;

  tracingOptions: {};
  started: { atindent: number, running: boolean };

  constructor(tracingOptions: {}) {
    this.indentLevel = 0;
    this.tracingOptions = tracingOptions;
  }

  chktrace(rule: string) {
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
      } else {
        this.started.running = true;
      }
    } else {
      if (this.started) {
        this.started.running = false;
      }
    }
  }

  repeat(text: string, n: number): string {
    let result = "", i;

    for (i = 0; i < n; i++) {
      result += text;
    }

    return result;
  }

  pad(text: string, length: number): string {
    return text + this.repeat(" ", length - text.length);
  }

  log(evt: ITraceEvent, blocktxt: string) {

    if (typeof console === "object") { // IE 8-10
      var t1: string =
        this.pad("" + evt.location.start.line + ":" + evt.location.start.column + "-"
          + evt.location.end.line + ":" + evt.location.end.column, 24);

      var t2: string =
        this.pad(evt.type + "  " + (evt.cached ? "C" : ""), 17);

      console.log(
        "/* " + t1 + t2 + this.repeat("  ", this.indentLevel) + evt.rule + blocktxt
      );
    }
  }

  public trace(event: ITraceEvent) {
    const that = this;

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
  }
}

export interface ICached {
  nextPos: number;
  result: any;
  maxFailPos: number;
}

export interface IToken {
  tokenId: number;
  text: string;
}

// !!!! string is ok !!!!
export interface IBasicPegjsBuffer {

  readonly length: number;

  charAt(position: number): string;

  charCodeAt(position: number): number;

  substring(from: number, to?: number, rule?: number);

  substr(from: number, len?: number, rule?: number);

}

export interface IPegjsBuffer<T extends IToken> extends IBasicPegjsBuffer {
  currPos: number;
  savedPos: number;
  readonly tokens: T[];

  tokenAt(pos: number);

  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string;

  calculatePosition(pos: number): IFilePosition;

  /* convert literal to human readable form */
  printLiteral(literal: string): string;

  /* convert token to human readable form */
  printToken(tokenId: number): string;

  toAbsolutePosition(pos: number): number;

}

export interface IPegjsParseStream<T extends IToken> extends IPegjsBuffer<T> {

  readonly ruleNames: string[];

  readonly buffer: IPegjsBuffer<T>;

  /* these should read forward if requested position is in the future
  * meaning lookahead tokens */
  isAvailableAt(position: number): boolean;

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: number, expectedText: string): boolean;

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectLowerCase(rule: number, expectedText: string): boolean;

}


export class PegjsParseStream<T extends IToken> implements IPegjsParseStream<T> {

  readonly ruleNames: string[];

  readonly buffer: IPegjsBuffer<T>;

  constructor(buffer: IPegjsBuffer<T>, ruleNames?: string[]) {
    this.buffer = buffer;
    this.ruleNames = ruleNames ? ruleNames : [];
  }
  get tokens() {
    return this.buffer.tokens;
  }
  tokenAt(pos = -1) {
    return this.buffer.tokenAt(pos);
  }

  get currPos() {
    return this.buffer.currPos;
  }

  get savedPos() {
    return this.buffer.savedPos;
  }

  get length(): number {
    return this.buffer.length;
  }

  isAvailableAt(position: number): boolean {
    return this.buffer.length > position;
  }
  charAt(position: number): string {
    return this.buffer.charAt(position);
  }
  charCodeAt(position: number): number {
    return this.buffer.charCodeAt(position);
  }
  substring(from: number, to?: number, rule?: number): string {
    return this.buffer.substring(from, to);
  }
  substr(from: number, len?: number, rule?: number): string {
    return this.buffer.substr(from, len);
  }
  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string {
    return this.buffer.readForward(rule, len);
  }

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: number, expectedText: string): boolean {
    return this.readForward(rule, expectedText.length) === expectedText;
  }

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectLowerCase(rule: number, expectedText: string): boolean {
    return this.readForward(rule, expectedText.length).toLowerCase() === expectedText;
  }

  calculatePosition(pos: number): IFilePosition {
    return this.buffer.calculatePosition(pos);
  }

  /* convert literal to human readable form */
  printLiteral(literal: string): string {
    return this.buffer.printLiteral(literal);
  }

  /* convert token to human readable form */
  printToken(tokenId: number): string {
    return this.buffer.printToken(tokenId);
  }

  toAbsolutePosition(pos: number): number {
    return this.buffer.toAbsolutePosition(pos);
  }

}



export abstract class PegjsParseStreamBuffer<T extends IToken> implements IPegjsBuffer<T> {

  readonly buffer: string;
  /* give read-write access to pegjs, do not manipulate them */
  savedPos: number;
  currPos: number;
  readonly posDetailsCache: IFilePosition[];
  readonly tokens: T[];

  constructor(src: string, tokens: T[], initialPos = 0) {
    this.buffer = src;
    this.tokens = tokens;

    this.savedPos = initialPos;
    this.currPos = initialPos;
    this.posDetailsCache = [];
  }

  get length(): number {
    return this.buffer.length;
  }

  seek(position: number) {
    /*
    if (position >= this.buffer.length) {
        console.log("Attempt to overseek to " + position +
            " of len:" + this.buffer.length +
            (rule === undefined ? "" : "  in rule:" + this.ruleNames[rule]));
    }*/
  }

  /* these should read forward if requested position is in the future
  * meaning lookahead tokens */
  charAt(position: number): string {
    this.seek(position);
    return this.buffer.charAt(position);
  }
  charCodeAt(position: number): number {
    this.seek(position);
    return this.buffer.charCodeAt(position);
  }
  substring(from: number, to?: number): string {
    this.seek(to);
    return this.buffer.substring(from, to);
  }
  substr(from: number, len?: number): string {
    this.seek(len < 0 ? this.buffer.length - 1 : from + len);
    return this.buffer.substr(from, len);
  }
  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string {
    return this.substr(this.currPos, len);
  }

  tokenAt(pos = -1) {
    if (pos < 0) pos += this.currPos;
    return this.tokens[pos];
  }


  calculatePosition(pos: number): IFilePosition {
    let details = this.posDetailsCache[pos];

    if (details) {
      return details;
    } else if (pos >= 0) {
      let p = 0;
      if (this.posDetailsCache.length) {
        if (pos >= this.posDetailsCache.length) {
          p = this.posDetailsCache.length - 1;
          details = this.posDetailsCache[p];
        } else {
          p = pos;
          while (!(details = this.posDetailsCache[--p]) && p > 0);
          if (!details) {
            details = { line: 1, column: 1 };
          }
        }

        details = {
          line: details.line,
          column: details.column
        };

      } else {
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
        } else {
          details.column++;
          ++p;
        }
      }

      this.posDetailsCache[pos] = details;

      return details;
    } else {
      return { line: 0, column: pos + 1 };
    }
  }

  toString() {
    return this.buffer;
  }


  /* convert literal to human readable form  trivial impl: 
   * printLiteral(literal: string): string {
   *   return literal;
   * }
   **/
  abstract printLiteral(literal: string): string;

  /* convert token to human readable form  trivial impl:
   * printToken(tokenId: number): string {
   *   return ""+tokenId;
   * }
   **/
  abstract printToken(tokenId: number): string;

  toAbsolutePosition(pos: number): number {
    return pos;
  }

}




// Fixed Octal Literal Before Number Char
//     .replace(/\0/g,   '\\0')    // null
// ->  .replace(/\0/g,   '\\x00')
// may be followed by "7" -> \07  
export function JSstringEscape(s) {
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
    .replace(/\\/g,   '\\\\')   // backslash
    .replace(/"/g,    '\\"')    // closing double quote
    .replace(/\0/g,   '\\x00')    // null
    .replace(/\x08/g, '\\b')    // backspace
    .replace(/\t/g,   '\\t')    // horizontal tab
    .replace(/\n/g,   '\\n')    // line feed
    .replace(/\f/g,   '\\f')    // form feed
    .replace(/\r/g,   '\\r')    // carriage return
    .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
    .replace(/[\x10-\x1F\x7F-\xFF]/g, function(ch) { return '\\x'  + hex(ch); })
    .replace(/[\u0100-\u0FFF]/g,      function(ch) { return '\\u0' + hex(ch); })
    .replace(/[\u1000-\uFFFF]/g,      function(ch) { return '\\u'  + hex(ch); });
}

function hex(ch) {
  return ch.charCodeAt(0).toString(16).toUpperCase();
}


