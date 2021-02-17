import { EntryPointTraverser, RefTraverser, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser } from '.';
import { PRule, PValueNode } from './parsers';
import { IncVariator } from './index';
import { GrammarParsingLeafState, GrammarParsingLeafStateTransitions, GrammarParsingLeafStateReduces, ParseTable, GrammarParsingLeafStateCommon } from './analyzer-rt';
import { LinearTraversion } from './analyzer-tra';
import { ChoiceTraverser } from './analyzer-nodes';
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
        load(): void;
        save(): void;
    }
    export class SerOutputWithIndex {
        index: number;
        output: number[];
    }
    export var ERRORS: number;
    export var deferredRules: any[];
    export var localDeferredRules: any[];
    export var leafStates: GrammarParsingLeafState[];
    export var leafStateCommons: GrammarParsingLeafStateCommon[];
    export var leafStateTransitionTables: GrammarParsingLeafStateTransitions[];
    export var leafStateReduceTables: GrammarParsingLeafStateReduces[];
    export var choiceTokens: PValueNode[];
    export var maxTokenId: number;
    export var totalStates: number;
    export var cntChoiceTknIds: number;
    export const uniformMaxStateId = 57344;
    export var serializedLeafStates: {
        [index: string]: SerOutputWithIndex;
    };
    export var serializedStateCommons: {
        [index: string]: SerOutputWithIndex;
    };
    export var serializedTransitions: {
        [index: string]: SerOutputWithIndex;
    };
    export var serializedReduces: {
        [index: string]: SerOutputWithIndex;
    };
    export var serializedParseTables: SerOutputWithIndex[];
    export var stack: Backup[];
    export var serializedParseTablesCnt: number;
    export var parseTableGens: StrMapLike<ParseTableGenerator>;
    export var parseTables: StrMapLike<ParseTable>;
    export var varShs: IncVariator;
    export var varShReqs: IncVariator;
    export var varTkns: IncVariator;
    export var varRds: IncVariator;
    export function backup(): Backup;
    export function empty(): Backup;
    export function parseTable(rule: PRule, g?: ParseTableGenerator): ParseTable;
    export function leafState(parseTable: ParseTable, index: number, packedIdx: number): GrammarParsingLeafState;
    export function leafStateCommon(parseTable: ParseTable, index: number, packedIdx: number): GrammarParsingLeafStateCommon;
    export function writeAllSerializedTables(buf: number[]): void;
    export function readAllSerializedTables(buf: number[]): number;
    export {};
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
    static createForRule(rule: PRule): ParseTableGenerator;
    private constructor();
    getEntryPoint(node: PRule): EntryPointTraverser;
}
export {};
