

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

export type Expectation = ILiteralExpectation | IClassExpectation | IAnyExpectation | IEndExpectation | IOtherExpectation;

export class SyntaxError extends Error {

  private static buildMessage(input: IPegjsParseStream, expected: Expectation[], found: string | null) {

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
      switch (expectation.type) {
        case "literal":
          return "\"" + input.printTokens(expectation.text) + "\"";
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

    function describeFound(found1: string | null) {
      return found1 ? "\"" + input.printTokens(found1) + "\"" : "end of input";
    }

    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  }

  public input: IPegjsParseStream;
  public message: string;
  public expected: Expectation[];
  public found: string | null;
  public offset: number;
  public name: string;

  constructor(input: IPegjsParseStream, message: string, expected: Expectation[], found: string | null, offset?: number) {
    super();
    this.input = input;
    this.message = message + SyntaxError.buildMessage(input, expected, found);
    this.expected = expected;
    this.found = found;
    this.offset = offset;
    this.name = "SyntaxError";

    //if (typeof (Error as any).captureStackTrace === "function") {
    //  (Error as any).captureStackTrace(this, SyntaxError);
    //}
  }
}


export interface ITraceEvent {
  type: string;
  rule: string;
  result?: any;
  location: IFileRange;
}

export class DefaultTracer {
  private indentLevel: number;

  constructor() {
    this.indentLevel = 0;
  }

  public trace(event: ITraceEvent) {
    const that = this;

    function log(evt: ITraceEvent) {
      function repeat(text: string, n: number) {
        let result = "", i;

        for (i = 0; i < n; i++) {
          result += text;
        }

        return result;
      }

      function pad(text: string, length: number) {
        return text + repeat(" ", length - text.length);
      }

      if (typeof console === "object") { // IE 8-10
        console.log(
          evt.location.start.line + ":" + evt.location.start.column + "-"
          + evt.location.end.line + ":" + evt.location.end.column + " "
          + pad(evt.type, 10) + " "
          + repeat("  ", that.indentLevel) + evt.rule
        );
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
  }
}

export interface ICached {
  nextPos: number;
  result: any;
}

// !!!! string is ok !!!!
export interface IPegjsParseStreamBuffer {

  readonly length: number;

  charAt(position: number): string;

  charCodeAt(position: number): number;

  substring(from: number, to?: number, rule?: number);

  substr(from: number, len?: number, rule?: number);

}

export interface IPegjsParseStreamBuffer2 extends IPegjsParseStreamBuffer {
  currPos: number;
  savedPos: number;

  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string;

}

export interface IPegjsParseStream extends IPegjsParseStreamBuffer {

  readonly ruleNames: string[];

  readonly buffer: IPegjsParseStreamBuffer2;

  /* these should read forward if requested position is in the future
  * meaning lookahead tokens */
  isAvailableAt(position: number): boolean;
  charAt(position: number): string;
  charCodeAt(position: number): number;
  substring(from: number, to?: number): string;
  substr(from: number, len?: number): string;

  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string;

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: number, expectedText: string): boolean;

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectLowerCase(rule: number, expectedText: string): boolean;

  calculatePosition(position: number): IFilePosition;

  /* convert tokens to human readable form */
  printTokens(tokenCodes: string): string;

}


export class PegjsParseStream implements IPegjsParseStream {

  readonly ruleNames: string[];

  readonly buffer: IPegjsParseStreamBuffer2;
  readonly posDetailsCache: IFilePosition[];

  constructor(buffer: IPegjsParseStreamBuffer, ruleNames?: string[]) {
    if (Object.hasOwnProperty("currPos")) {
      this.buffer = buffer as IPegjsParseStreamBuffer2;
    } else {
      this.buffer = new PegjsParseStreamBuffer(buffer);
    }
    this.ruleNames = ruleNames ? ruleNames : [];
    this.posDetailsCache = [];
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

  printTokens(tokenCodes: string): string {
    return tokenCodes;
  }


  

  calculatePosition(pos: number): IFilePosition {
    let details = this.posDetailsCache[pos];

    if (details) {
      return details;
    } else {
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
    }
  }
}



export class PegjsParseStreamBuffer implements IPegjsParseStreamBuffer2 {

  readonly buffer: string;
  /* give read-write access to pegjs, do not manipulate them */
  savedPos: number;
  currPos: number;

  constructor(src: IPegjsParseStreamBuffer, initialPos = 0) {
    this.buffer = src ? src.toString() : "";
    this.savedPos = initialPos;
    this.currPos = initialPos;
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
    this.seek(len<0?this.buffer.length-1:from+len);
    return this.buffer.substr(from, len);
  }
  // should return this.substr(input.currPos, len)
  readForward(rule: number, len: number): string {
    return this.substr(this.currPos, len);
  }


  toString() {
    return this.buffer;
  }
  printTokens(tokenCodes: string): string {
    return tokenCodes;
  }

}



/**
 * T token class
 */
export abstract class PegjsTknParseStreamBuffer<T> extends PegjsParseStreamBuffer {

  readonly tokens: T[];

  constructor(src: IPegjsParseStreamBuffer, initialPos?: number, initialTokens?: T[]) {
      super(src, initialPos)
      this.tokens = src && src["tokens"] ? src["tokens"] : initialTokens;
    }

  replace(from: number, to: number, newConvertedTokens: T[]) {
      var rem = this.tokens.slice(to);
      this.tokens.length = from;
      this.tokens.push.apply(newConvertedTokens);
      this.tokens.push.apply(rem);
      (this as any).buffer = this.buffer.substring(0, from) + this.generateTokenCodes(newConvertedTokens) + this.buffer.substring(to);
  }

  token(pos = -1) {
      if (pos < 0) pos += this.currPos;
      return this.tokens[pos];
  }

  abstract generateTokenCodes(tokens: T[]): string;

  
}
