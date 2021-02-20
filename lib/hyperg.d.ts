import { Analysis, EntryPointInterpreter, ParseTable, PNode, PRule, PRuleRef, PValueNode, NumMapLike, MapLike } from '.';
export declare const MATCH_TOKEN = 40;
export declare const ACCEPT_TOKEN = 41;
export declare enum HyperGEnvType {
    NONE = 0,
    ANALYZING = 1,
    RUNTIME = 2,
    INTEGRITY_CHECK = 3,
    INTEGRITY_CHECK_VERBOSE = 4
}
export declare namespace HyperG {
    class Backup {
        Env: HyperGEnvType;
        anal: Analysis.Backup;
        serializerStartingIdx: number;
        serializerCnt: number;
        functionTable: ((...etc: any[]) => any)[];
        ruleTable: PRule[];
        ruleInterpreters: EntryPointInterpreter[];
        nodeTable: PNode[];
        ruleRefTable: PRuleRef[];
        indent: string;
        stack: Backup[];
        load(): void;
        save(): void;
    }
    var Env: HyperGEnvType;
    var serializerStartingIdx: number;
    var serializerCnt: number;
    var functionTable: ((...etc: any[]) => any)[];
    var ruleTable: PRule[];
    var ruleInterpreters: EntryPointInterpreter[];
    var nodeTable: PNode[];
    var ruleRefTable: PRuleRef[];
    var indent: string;
    var stack: Backup[];
    function backup(): Backup;
    function empty(): Backup;
    function totallyReinitializableTransaction(fun: Function): void;
    function countRuleRefs(): void;
}
export declare function findDiff(str1: any, str2: any): string;
export interface IFailure {
    maxFailPos: number;
    maxFailExpected: Expectation[];
    found?: Expectation;
}
export declare function mergeFailures(into: IFailure, other: IFailure): void;
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
export interface ITokenExpectation {
    type: "token";
    tokenId: number;
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
export declare type Expectation = ITokenExpectation | IAnyExpectation | IEndExpectation | IOtherExpectation;
export declare class HyperGParseErrorInfo<T extends IToken> {
    private static buildMessage;
    readonly input: HyperGParseStream<T>;
    readonly message0: string;
    private message1;
    readonly expected: Expectation[];
    readonly found: Expectation;
    readonly absolutePosition: number;
    readonly name: string;
    constructor(input: HyperGParseStream<T>, message: string, expected: Expectation[], found: Expectation, absolutePosition?: number);
    get message(): string;
}
export declare class SyntaxError<T extends IToken> extends Error {
    info: HyperGParseErrorInfo<T>;
    constructor(info: HyperGParseErrorInfo<T>);
    get message(): string;
}
export interface ITraceEvent {
    type: string;
    rule: string;
    result?: any;
    location: IFileRange;
    cached?: boolean;
}
export declare class DefaultTracer {
    private indentLevel;
    tracingOptions: {};
    started: {
        atindent: number;
        running: boolean;
    };
    constructor(tracingOptions: {});
    chktrace(rule: string): void;
    repeat(text: string, n: number): string;
    pad(text: string, length: number): string;
    log(evt: ITraceEvent, blocktxt: string): void;
    trace(event: ITraceEvent): void;
}
export interface ICached {
    nextPos?: number;
    result?: any;
    maxFailPos?: number;
}
export interface IToken {
    tokenId: number;
    text: string;
}
export interface IStringLike {
    charCodeAt(pos: number): number;
}
export declare abstract class HyperGParseStream<T extends IToken> {
    readonly ruleNames: string[];
    currPos: number;
    savedPos: number;
    readonly tokens: T[];
    constructor(tokens: T[], ruleNames: string[]);
    tokenAt(pos: number): T;
    get length(): number;
    abstract printToken(tokenId: number): string;
    abstract calculatePosition(pos: number): IFilePosition;
}
export declare class SourceFilePosUtil {
    readonly posDetailsCache: IFilePosition[];
    calculatePosition(buffer: IStringLike, pos: number): IFilePosition;
}
export declare function JSstringEscape(s: any): any;
export declare const DefaultComparator: (a: any, b: any) => any;
export declare var UNIQUE_OBJECT_ID: string;
export declare function minimum<T>(inparr0: NumMapLike<T>, cmp?: ((a: T, b: T) => number)): [number, T];
export declare function maximum<T>(inparr0: NumMapLike<T>, cmp?: ((a: T, b: T) => number)): [number, T];
export declare function distinct<T>(inparr0: MapLike<T>, cmp?: ((a: T, b: T) => number)): T[];
export declare function distinctIndexed<T>(inparr0: MapLike<T>, indexer: ((a: T) => number)): T[];
export declare function groupBy<T>(inparr0: MapLike<T>, cmp?: ((a: T, b: T) => number)): T[][];
export declare function groupByIndexed<T>(inparr0: MapLike<T>, indexer: ((a: T) => number)): T[][];
export declare function groupBy2Indexed<T>(inparr0: MapLike<MapLike<T>>, indexer: ((a: T) => number)): T[][];
export declare function CodeTblToHex(s: number[]): any[];
export declare function encodePrsTbl(parseTable: ParseTable): string;
export declare function encodeVsimPck(code: number[]): string;
export declare function verySimplePackMany0(raw: string): string;
export declare function peg$decode(s: string): number[];
export declare function checkRuleNodesIntegrity(items: [PRule, string][], mode?: HyperGEnvType): void;
export declare function checkParseTablesIntegrity(serializedConstTable: string, items: [ParseTable, string][], choiceTokens: PValueNode[], mode: HyperGEnvType): void;
export declare class IncVariator {
    K: number;
    n: number;
    Ex: number;
    Ex2: number;
    constructor(from?: IncVariator);
    add(x: number): void;
    get mean(): number;
    get variance(): number;
    get sqrtVariance(): number;
    toString(fractionDecimals?: number): string;
}
