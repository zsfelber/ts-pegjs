import { ChoiceTraverser, EntryPointTraverser, GrammarParsingLeafState, GrammarParsingLeafStateCommon, GrammarParsingLeafStateReduces, GrammarParsingLeafStateTransitions, IncVariator, LinearTraversion, ParseTable, PRule, PValueNode, RefTraverser, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser } from '.';
export declare const FAIL_STATE = 0;
export declare const START_STATE = 1;
export declare const CNT_HUB_LEVELS = 1;
export declare const LEV_CNT_LN_RULE = 50000;
export declare const LEV_CNT_BRANCH_NODES = 50000;
export interface StrMapLike<V> {
    [index: number]: V;
}
export interface NumMapLike<V> {
    [index: number]: V;
}
export declare type MapLike<V> = StrMapLike<V> | NumMapLike<V>;
export declare namespace Analysis {
    class Backup {
        ERRORS: number;
        deferredRules: any[];
        localDeferredRules: any[];
        leafStates: GrammarParsingLeafState[];
        leafStateCommons: GrammarParsingLeafStateCommon[];
        leafStateTransitionTables: GrammarParsingLeafStateTransitions[];
        leafStateReduceTables: GrammarParsingLeafStateReduces[];
        choiceTokens: PValueNode[];
        choiceTokenMap: PValueNode[][];
        maxTokenId: number;
        totalStates: number;
        cntChoiceTknIds: number;
        serializedLeafStates: {
            [index: string]: SerOutputWithIndex;
        };
        serializedStateCommons: {
            [index: string]: SerOutputWithIndex;
        };
        serializedTransitions: {
            [index: string]: SerOutputWithIndex;
        };
        serializedReduces: {
            [index: string]: SerOutputWithIndex;
        };
        serializedParseTables: SerOutputWithIndex[];
        stack: Backup[];
        serializedParseTablesCnt: number;
        parseTableGens: StrMapLike<ParseTableGenerator>;
        parseTables: StrMapLike<ParseTable>;
        varShs: IncVariator;
        varShReqs: IncVariator;
        varTkns: IncVariator;
        varRds: IncVariator;
        varDeep: IncVariator;
        varEntryPts: IncVariator;
        varAllNds: IncVariator;
        varAllRuleRefs: IncVariator;
        varRuleRefs: IncVariator;
        varTerminalRefs: IncVariator;
        varLfStates: IncVariator;
        load(): void;
        save(): void;
    }
    class SerOutputWithIndex {
        index: number;
        output: number[];
    }
    var ERRORS: number;
    var deferredRules: any[];
    var localDeferredRules: any[];
    var leafStates: GrammarParsingLeafState[];
    var leafStateCommons: GrammarParsingLeafStateCommon[];
    var leafStateTransitionTables: GrammarParsingLeafStateTransitions[];
    var leafStateReduceTables: GrammarParsingLeafStateReduces[];
    var choiceTokens: PValueNode[];
    var choiceTokenMap: PValueNode[][];
    var maxTokenId: number;
    var totalStates: number;
    var cntChoiceTknIds: number;
    const uniformMaxStateId = 57344;
    var serializedLeafStates: {
        [index: string]: SerOutputWithIndex;
    };
    var serializedStateCommons: {
        [index: string]: SerOutputWithIndex;
    };
    var serializedTransitions: {
        [index: string]: SerOutputWithIndex;
    };
    var serializedReduces: {
        [index: string]: SerOutputWithIndex;
    };
    var serializedParseTables: SerOutputWithIndex[];
    var stack: Backup[];
    var serializedParseTablesCnt: number;
    var parseTableGens: StrMapLike<ParseTableGenerator>;
    var parseTables: StrMapLike<ParseTable>;
    var varShs: IncVariator;
    var varShReqs: IncVariator;
    var varTkns: IncVariator;
    var varRds: IncVariator;
    var varDeep: IncVariator;
    var varEntryPts: IncVariator;
    var varAllNds: IncVariator;
    var varAllRuleRefs: IncVariator;
    var varRuleRefs: IncVariator;
    var varTerminalRefs: IncVariator;
    var varLfStates: IncVariator;
    function backup(): Backup;
    function empty(): Backup;
    function parseTable(rule: PRule, g?: ParseTableGenerator): ParseTable;
    function leafState(parseTable: ParseTable, index: number, packedIdx: number): GrammarParsingLeafState;
    function leafStateCommon(parseTable: ParseTable, index: number, packedIdx: number): GrammarParsingLeafStateCommon;
    function writeAllSerializedTables(buf: number[]): void;
    function readAllSerializedTables(buf: number[]): number;
    function generateTableSerializationData(): void;
    function initChoiceTokens(): void;
}
export declare abstract class StateNodeCommon {
    parseTable: ParseTableGenerator;
    index: number;
    readonly shiftsAndReduces: ShiftReduce[];
    constructor(parseTable: ParseTableGenerator);
    generateState(parseTable: ParseTable): GrammarParsingLeafStateCommon;
    toString(): string;
}
declare class RootStateNodeCommon extends StateNodeCommon {
    toString(): string;
}
export declare class LeafStateNodeCommon extends StateNodeCommon {
}
export declare abstract class StateNodeWithPrefix {
    common: StateNodeCommon;
    index: number;
    ref?: RefTraverser | ChoiceTraverser;
    constructor();
    readonly reduces: Reduce[];
    abstract get traverser(): RuleElementTraverser;
    generateState(parseTable: ParseTable): GrammarParsingLeafState;
}
declare class RootStateNodeWithPrefix extends StateNodeWithPrefix {
    rule: EntryPointTraverser;
    common: RootStateNodeCommon;
    constructor(rule: EntryPointTraverser);
    get traverser(): RuleElementTraverser;
    generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion): void;
    toString(): string;
}
export declare abstract class LeafStateNodeWithPrefix extends StateNodeWithPrefix {
    common: LeafStateNodeCommon;
    ref: RefTraverser | ChoiceTraverser;
    constructor(ref: RefTraverser | ChoiceTraverser);
    get traverser(): RuleElementTraverser;
    generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion): void;
    abstract get isRule(): boolean;
    toString(): string;
}
export declare class TraversedLeafStateNode extends LeafStateNodeWithPrefix {
    ref: TerminalRefTraverser | ChoiceTraverser;
    constructor(ref: TerminalRefTraverser | ChoiceTraverser);
    get isRule(): boolean;
}
export declare class TerminalChoiceLeafStateNode extends LeafStateNodeWithPrefix {
    ref: ChoiceTraverser;
    constructor(ref: ChoiceTraverser);
    get isRule(): boolean;
}
export declare class JumpIntoSubroutineLeafStateNode extends LeafStateNodeWithPrefix {
    ref: RuleRefTraverser;
    constructor(ref: RuleRefTraverser);
    get isRule(): boolean;
}
export declare class ShiftReduce {
    kind: ShiftReduceKind;
    item: RuleElementTraverser;
    intoRule?: JumpIntoSubroutineLeafStateNode;
}
export declare class Shifts extends ShiftReduce {
    item: (RefTraverser | ChoiceTraverser);
}
export declare class Shift extends Shifts {
    kind: ShiftReduceKind;
    item: (TerminalRefTraverser | ChoiceTraverser);
}
export declare class ShiftRecursive extends Shifts {
    kind: ShiftReduceKind;
    item: RuleRefTraverser;
}
export declare class Reduce extends ShiftReduce {
    kind: ShiftReduceKind;
}
export declare enum ShiftReduceKind {
    SHIFT = 0,
    REDUCE = 1,
    SHIFT_RECURSIVE = 2,
    REDUCE_RECURSIVE = 3
}
export declare class ParseTableGenerator {
    nodeTravIds: number;
    rule: PRule;
    theTraversion: LinearTraversion;
    startingStateNode: RootStateNodeWithPrefix;
    newRuleReferences: RuleRefTraverser[];
    allLeafStateNodes: LeafStateNodeWithPrefix[];
    allLeafStateCommons: LeafStateNodeCommon[];
    entryPoints: StrMapLike<EntryPointTraverser>;
    jumperStates: NumMapLike<number>;
    cntStates: number;
    cntCommons: number;
    static createForRule(rule: PRule, log?: boolean, info?: string): ParseTableGenerator;
    private constructor();
    getEntryPoint(node: PRule): EntryPointTraverser;
}
export {};
