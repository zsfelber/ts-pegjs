import { PRule, PLogicNode, NumMapLike, PRef, ParseTableGenerator, StateNodeCommon } from '.';
import { StateNodeWithPrefix } from './analyzer';
import { PRuleRef, PValueNode } from './parsers';
export declare class ParseTable {
    readonly rule: PRule;
    startingState: GrammarParsingLeafState;
    readonly allStates: GrammarParsingLeafState[];
    readonly myCommons: GrammarParsingLeafStateCommon[];
    openerTrans: GenerateParseTableStackMainGen;
    packed: boolean;
    constructor(rule: PRule, g?: ParseTableGenerator);
    fillStackOpenerTransitions(phase: number, log?: boolean): void;
    pack(log?: boolean): boolean;
    packAgain(log?: boolean): void;
    static deserialize(rule: PRule, buf: number[]): ParseTable;
    leafState(index: number): GrammarParsingLeafState;
    ser(): number[];
    deser(buf: number[]): number;
    diagnosticEqualityCheck(table: ParseTable): boolean;
    toString(): string;
}
declare type UnresolvedTuple = [GenerateParseTableStackBox, GenerateParseTableStackMainGen, RTShift, PRuleRef];
declare type DependantTuple = [GenerateParseTableStackBox, RTShift, PRuleRef];
declare type ShiftTuple = [number, [number, RTShift][]];
declare class GenerateParseTableStackMainGen {
    readonly parent: GenerateParseTableStackBox;
    readonly top: GenerateParseTableStackMainGen;
    readonly indent: string;
    readonly stack: {
        [index: string]: GenerateParseTableStackMainGen;
    };
    readonly parseTable: ParseTable;
    readonly rr: PRuleRef;
    readonly rule: PRule | PRuleRef;
    shifts: GrammarParsingLeafStateTransitions;
    unresolvedRecursiveBoxes: UnresolvedTuple[];
    children: GenerateParseTableStackBox[];
    dependants: DependantTuple[];
    constructor(parent: GenerateParseTableStackBox, parseTable: ParseTable, rr?: PRuleRef);
    addAsUnresolved(stack: {
        [index: string]: GenerateParseTableStackMainGen;
    }): void;
    generate(phase: number): void;
}
declare class GenerateParseTableStackBox {
    top: GenerateParseTableStackMainGen;
    parent: GenerateParseTableStackMainGen;
    parseTable: ParseTable;
    common: GrammarParsingLeafStateCommon;
    stack: {
        [index: string]: GenerateParseTableStackMainGen;
    };
    shifts: GrammarParsingLeafStateTransitions;
    allShifts: {
        [index: string]: ShiftTuple;
    };
    children: [GenerateParseTableStackMainGen, RTShift, PRuleRef][];
    recursiveShifts: RTShift[];
    constructor(parent: GenerateParseTableStackMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon, stack: {
        [index: string]: GenerateParseTableStackMainGen;
    });
    generate(phase: number): void;
    generateShiftsAgain(phase: number): void;
    addAsUnresolved(stack: {
        [index: string]: GenerateParseTableStackMainGen;
    }): void;
    private newShift;
    private generateShifts;
    insertStackOpenShifts(phase: number, recursiveShift: RTShift): void;
    postfixInsertUnresolvedRule(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef): void;
    private appendChild;
}
export declare class RTShift {
    shiftIndex: number;
    readonly toStateIndex: number;
    readonly stepIntoRecursive: RTStackShiftItem[];
    constructor(shiftIndex: number, toStateIndex: number);
    serStackItms(buf: number[]): void;
    deserStackItms(buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: RTShift): boolean;
}
export declare class RTStackShiftItem {
    parent: RTStackShiftItem;
    enter: PRuleRef;
    toStateIndex: number;
    constructor(enter: PRuleRef, toStateIndex: number, parent?: RTStackShiftItem);
    lazyRule(parseTable?: ParseTable, shift0?: RTShift): void;
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
    alreadySerialized: number[];
    constructor(copy?: GrammarParsingLeafStateTransitions);
    clear(): void;
    ser(buf: number[]): void;
    deser(index: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafStateTransitions): boolean;
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
    startStateNode: StateNodeCommon;
    private _transitions;
    reduceActions: GrammarParsingLeafStateReduces;
    recursiveShifts: GrammarParsingLeafStateTransitions;
    serialStateMap: GrammarParsingLeafStateTransitions;
    serializedTuple: [number, number];
    filledWithRecursive: boolean;
    constructor(startStateNode?: StateNodeCommon);
    get transitions(): GrammarParsingLeafStateTransitions;
    replace(newSerialStateMap: GrammarParsingLeafStateTransitions): void;
    ser(buf: number[]): void;
    deser(index: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafStateCommon): boolean;
}
export declare class GrammarParsingLeafState {
    index: number;
    packedIndex: number;
    startingPoint: PRef | PValueNode;
    startStateNode: StateNodeWithPrefix;
    common: GrammarParsingLeafStateCommon;
    reduceActions: GrammarParsingLeafStateReduces;
    serializedTuple: [number, number, number];
    constructor(startStateNode?: StateNodeWithPrefix, startingPoint?: PRef);
    lazy(parseTable: ParseTable): void;
    ser(buf: number[]): void;
    deser(index: number, buf: number[], pos: number): number;
    diagnosticEqualityCheck(table: GrammarParsingLeafState): boolean;
}
export {};
