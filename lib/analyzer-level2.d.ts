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
export declare class UniqueParseTableInGenStack {
    useCnt: number;
    dependants: DependantTuple[];
    isDeferred: boolean;
}
export declare class GenerateParseTableStackMainGen {
    readonly parent: GenerateParseTableStackBox;
    readonly top: GenerateParseTableStackMainGen;
    readonly indent: string;
    readonly stack: StrMapLike<GenerateParseTableStackMainGen>;
    readonly parseTable: ParseTable;
    readonly rr: PRuleRef;
    readonly rule: PRule | PRuleRef;
    mainRuleBox: GenerateParseTableStackBox;
    children: GenerateParseTableStackBox[];
    parseTableVars: UniqueParseTableInGenStack;
    unresolvedRecursiveBoxes: UnresolvedTuple[];
    parseTableVarsPool: UniqueParseTableInGenStack[];
    constructor(parent: GenerateParseTableStackBox, parseTable: ParseTable, rr?: PRuleRef);
    get dependants(): DependantTuple[];
    addAsUnresolved(): void;
    generate(phase: number): void;
    toString(): string;
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
    insertStackOpenShifts(phase: number, recursiveShift: RTShift): void;
    resetShitsToPreGenDef(): void;
    addAsUnresolved(): void;
    get dependants(): DependantTuple[];
    private newShift;
    generateShifts(phase: number): void;
    appendChildTransitions(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef): boolean;
    toString(): string;
}
export {};
