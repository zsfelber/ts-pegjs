import { gGrammarParsingLeafStateTransitions, GrammarParsingLeafState, GrammarParsingLeafStateCommon, GrammarParsingLeafStateReduces, GrammarParsingLeafStateTransitions, gRTShift, ParseTable, PRule, PRuleRef, RTShift, StrMapLike } from '.';
export declare class CompressParseTable {
    parseTable: ParseTable;
    allowReindexTransitions: boolean;
    log: boolean;
    info: string;
    t0: number;
    r0: number;
    sl0: number;
    sc0: number;
    transidx: number;
    redidx: number;
    lfidx: number;
    lfidx0: number;
    cmnidx: number;
    cmnidx0: number;
    serializedLeafStates: {
        [index: string]: GrammarParsingLeafState;
    };
    serializedStateCommons: {
        [index: string]: GrammarParsingLeafStateCommon;
    };
    constructor(parseTable: ParseTable, allowReindexTransitions: boolean, log?: boolean, info?: string);
    pack(): boolean;
    prstate(state: GrammarParsingLeafState): boolean;
    prscmn(state: GrammarParsingLeafStateCommon): boolean;
    tra(trans: GrammarParsingLeafStateTransitions, maplen: [number, number, number, number]): boolean;
    red(rr: GrammarParsingLeafStateReduces, maplen: [number]): boolean;
}
declare type UnresolvedTuple = [GenerateParseTableStackBox, GenerateParseTableStackMainGen, RTShift, PRuleRef];
declare type DependantTuple = [GenerateParseTableStackBox, RTShift, PRuleRef];
declare type BoxImportTuple = [GenerateParseTableStackMainGen, RTShift, PRuleRef];
export declare class GenerateParseTableStackMainGen {
    readonly parent: GenerateParseTableStackBox;
    readonly top: GenerateParseTableStackMainGen;
    readonly indent: string;
    readonly stack: StrMapLike<GenerateParseTableStackMainGen>;
    readonly parseTable: ParseTable;
    readonly rr: PRuleRef;
    readonly rule: PRule | PRuleRef;
    unresolvedRecursiveBoxes: UnresolvedTuple[];
    mainRuleBox: GenerateParseTableStackBox;
    children: GenerateParseTableStackBox[];
    dependants: DependantTuple[];
    constructor(parent: GenerateParseTableStackBox, parseTable: ParseTable, rr?: PRuleRef);
    addAsUnresolved(stack: StrMapLike<GenerateParseTableStackMainGen>): void;
    generate(phase: number): void;
}
export declare class GenerateParseTableStackBox {
    top: GenerateParseTableStackMainGen;
    parent: GenerateParseTableStackMainGen;
    parseTable: ParseTable;
    common: GrammarParsingLeafStateCommon;
    preGeneratedAndOrDefault: GrammarParsingLeafStateTransitions;
    stack: StrMapLike<GenerateParseTableStackMainGen>;
    allShifts: StrMapLike<gRTShift>;
    allShiftsByToken: gGrammarParsingLeafStateTransitions;
    children: BoxImportTuple[];
    recursiveShifts: RTShift[];
    constructor(parent: GenerateParseTableStackMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon, stack: StrMapLike<GenerateParseTableStackMainGen>);
    generate(phase: number): void;
    resetShitsToPreGenDef(): void;
    addAsUnresolved(stack: StrMapLike<GenerateParseTableStackMainGen>): void;
    private newShift;
    generateShifts(phase: number): void;
    insertStackOpenShifts(phase: number, recursiveShift: RTShift): void;
    appendChild(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef): void;
}
export {};
