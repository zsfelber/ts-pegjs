import { GenerateParseTableStackMainGen, HyperGEnvType, NumMapLike, ParseTableGenerator, PLogicNode, PRef, PRule, PRuleRef, PValueNode, StateNodeCommon, StateNodeWithPrefix } from '.';
export declare class ParseTable {
    readonly rule: PRule;
    startingState: GrammarParsingLeafState;
    readonly allStates: GrammarParsingLeafState[];
    readonly myCommons: GrammarParsingLeafStateCommon[];
    readonly choiceTokenMap: PValueNode[][];
    openerTrans: GenerateParseTableStackMainGen;
    packed: boolean;
    packedIndex: number;
    constructor(rule: PRule, g?: ParseTableGenerator);
    resetOptimization(log?: boolean): void;
    fillStackOpenerTransitions(phase: number, log?: boolean): void;
    pack(allowReindexTransitions: boolean, log?: boolean, info?: string): boolean;
    static deserialize(rule: PRule, buf: number[]): ParseTable;
    leafStateCommon(index: number): GrammarParsingLeafStateCommon;
    leafState(index: number): GrammarParsingLeafState;
    ser(mode: HyperGEnvType): number[];
    deser(buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: ParseTable): boolean;
    toString(): string;
}
export declare class RTShift {
    shiftIndex: number;
    stepIntoRecursive: RTStackShiftItem;
    constructor(shiftIndex: number, stepIntoRecursive?: RTStackShiftItem);
    get toStateIndex(): number;
    diagnosticEqualityCheck(table: RTShift): boolean;
}
export declare class gRTShift extends RTShift {
    tokenId: number;
    constructor(shiftIndex: number, tokenId: number, stepIntoRecursive?: RTStackShiftItem);
}
export declare class RTStackShiftItem {
    enter: PRuleRef;
    index: number;
    childIndex: number;
    toStateIndex: number;
    _child: RTStackShiftItem;
    depth: number;
    constructor(enter: PRuleRef, toStateIndex: number, child?: RTStackShiftItem);
    get child(): RTStackShiftItem;
    lazy(parseTable?: ParseTable, enter?: PRuleRef): void;
    get tuple(): number[];
}
export declare class RTReduce {
    readonly shiftIndex: number;
    readonly node: PLogicNode;
    constructor(shiftIndex: number, node: PLogicNode);
    diagnosticEqualityCheck(table: RTReduce): boolean;
}
export declare class GrammarParsingLeafStateTransitions {
    index: number;
    map: NumMapLike<RTShift[]>;
    constructor(copy?: GrammarParsingLeafStateTransitions);
    clear(): void;
    slotsByNonUniqueShiftIndex(): NumMapLike<RTShift[]>;
    fixedClone(): GrammarParsingLeafStateTransitions;
    ser(buf: number[]): void;
    deser(index: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafStateTransitions): boolean;
}
export declare class gGrammarParsingLeafStateTransitions extends GrammarParsingLeafStateTransitions {
    map: NumMapLike<gRTShift[]>;
    add(shift: gRTShift): void;
    replace(shift: gRTShift): void;
    clone(fixIds?: boolean): gGrammarParsingLeafStateTransitions;
    fixedClone(): gGrammarParsingLeafStateTransitions;
}
export declare class GrammarParsingLeafStateReduces {
    index: number;
    readonly reducedNodes: RTReduce[][];
    alreadySerialized: number[];
    ser(buf: number[]): void;
    deser(index: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafStateReduces): boolean;
}
export declare class GrammarParsingLeafStateCommon {
    index: number;
    packedIndex: number;
    replacedIndex: number;
    startStateNode: StateNodeCommon;
    private _transitions;
    reduceActions: GrammarParsingLeafStateReduces;
    recursiveShifts: GrammarParsingLeafStateTransitions;
    serialStateMap: GrammarParsingLeafStateTransitions;
    serializedTuple: [number, number];
    constructor();
    get transitions(): GrammarParsingLeafStateTransitions;
    replace(newSerialStateMap: GrammarParsingLeafStateTransitions): void;
    ser(): [number, number];
    deser(packedIndex: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafStateCommon): boolean;
}
export declare class GrammarParsingLeafState {
    index: number;
    packedIndex: number;
    replacedIndex: number;
    startingPoint: PRef | PValueNode;
    startStateNode: StateNodeWithPrefix;
    commonIndex: number;
    common: GrammarParsingLeafStateCommon;
    reduceActions: GrammarParsingLeafStateReduces;
    serializedTuple: [number, number, number];
    constructor(startStateNode?: StateNodeWithPrefix, startingPoint?: PRef);
    lazyCommon(parseTable: ParseTable): void;
    lazy(parseTable: ParseTable): void;
    ser(): [number, number, number];
    deser(packedIndex: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafState): boolean;
}
