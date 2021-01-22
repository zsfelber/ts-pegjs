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
export interface IClassParts extends Array<string | IClassParts> {
}
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
export declare type Expectation = ILiteralExpectation | IClassExpectation | IAnyExpectation | IEndExpectation | IOtherExpectation;
export declare class SyntaxError extends Error {
    private static buildMessage;
    input: IPegjsParseStream;
    message: string;
    expected: Expectation[];
    found: string | null;
    location: IFileRange;
    name: string;
    constructor(input: IPegjsParseStream, message: string, expected: Expectation[], found: string | null, location: IFileRange);
}
export interface ITraceEvent {
    type: string;
    rule: string;
    result?: any;
    location: IFileRange;
}
export declare class DefaultTracer {
    private indentLevel;
    constructor();
    trace(event: ITraceEvent): void;
}
export interface ICached {
    nextPos: number;
    result: any;
}
export interface IParseOptions {
    filename?: string;
    startRule?: string;
    tracer?: any;
    [key: string]: any;
}
export declare type PegjsParseFunction = (input: IPegjsParseStream, options?: IParseOptions) => any;
export declare type PegjsParser = {
    parse: PegjsParseFunction;
    RuleNames: string[];
};
export interface IPegjsParseStream {
    savedPos: number;
    currPos: number;
    isAvailableAt(position: number): boolean;
    charAt(position: number): string;
    charCodeAt(position: number): number;
    substring(from: number, to?: number): string;
    substr(from: number, len?: number): string;
    readForward(rule: number, len: number): string;
    expect(rule: number, expectedText: string): boolean;
    expectLowerCase(rule: number, expectedText: string): boolean;
    calculatePosition(position: number): IFilePosition;
    printTokens(tokenCodes: string): string;
}
export declare class PegjsParseStream implements IPegjsParseStream {
    readonly buffer: string;
    readonly ruleNames: string[];
    savedPos: number;
    currPos: number;
    readonly posDetailsCache: IFilePosition[];
    constructor(initialBuf?: string, ruleNames?: string[]);
    seek(position: number, rule?: number): void;
    isAvailableAt(position: number): boolean;
    charAt(position: number): string;
    charCodeAt(position: number): number;
    substring(from: number, to?: number, rule?: number): string;
    substr(from: number, len?: number, rule?: number): string;
    readForward(rule: number, len: number): string;
    expect(rule: number, expectedText: string): boolean;
    expectLowerCase(rule: number, expectedText: string): boolean;
    calculatePosition(pos: number): IFilePosition;
    printTokens(tokenCodes: string): string;
}
