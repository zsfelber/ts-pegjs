import { JumpIntoSubroutineLeafStateNode, LeafStateNodeCommon, ParseTableGenerator, PNode, PRef, PRule, PRuleRef, PTerminalRef, PValueNode, TraversedLeafStateNode } from '.';
import { LeafStateNodeWithPrefix } from './analyzer';
import { TraversionControl, TraversionCache, LinearTraversion } from './analyzer-tra';
export declare namespace Factory {
    function createTraverser(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode): TerminalRefTraverser | ChoiceTraverser | RuleRefTraverser | SequenceTraverser | OptionalTraverser | SemanticAndTraverser | SemanticNotTraverser | ZeroOrMoreTraverser | OneOrMoreTraverser;
}
export declare abstract class RuleElementTraverser {
    readonly allNodes: RuleElementTraverser[];
    readonly allRuleReferences: RuleRefTraverser[];
    readonly allTerminalReferences: TerminalRefTraverser[];
    readonly nodeTravId: number;
    readonly constructionLevel: number;
    readonly parser: ParseTableGenerator;
    readonly parent: RuleElementTraverser;
    readonly node: PNode;
    readonly children: RuleElementTraverser[];
    readonly optionalBranch: boolean;
    common: LeafStateNodeCommon;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    get isReducable(): boolean;
    get isTerminalRefOrChoice(): boolean;
    get top(): EntryPointTraverser;
    get importPoint(): CopiedRuleTraverser;
    get topRule(): RuleTraverser;
    checkConstructFailed(): any;
    findParent(node: PValueNode, incl?: boolean): any;
    findRuleNodeParent(rule: string, incl?: boolean): any;
    traversionGeneratorEnter(inTraversion: LinearTraversion): boolean;
    traversionGeneratorExited(inTraversion: LinearTraversion): void;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
    toString(): string;
    get shortLabel(): string;
}
export declare class ChoiceTraverser extends RuleElementTraverser {
    readonly optionalBranch: boolean;
    readonly terminalChoice: boolean;
    stateNode: TraversedLeafStateNode;
    traverserPosition: number;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    get isReducable(): boolean;
    get isTerminalRefOrChoice(): boolean;
    traversionGeneratorEnter(inTraversion: LinearTraversion): boolean;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
    get shortLabel(): string;
}
export declare class SequenceTraverser extends RuleElementTraverser {
    readonly optionalBranch: boolean;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    checkConstructFailed(): number;
    get isReducable(): boolean;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
}
export declare abstract class SingleCollectionTraverser extends RuleElementTraverser {
    child: RuleElementTraverser;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    checkConstructFailed(): number;
}
export declare abstract class SingleTraverser extends SingleCollectionTraverser {
}
export declare class EmptyTraverser extends RuleElementTraverser {
    checkConstructFailed(): number;
    get isReducable(): boolean;
}
export declare class OptionalTraverser extends SingleTraverser {
    get isReducable(): boolean;
    get shortLabel(): string;
}
export declare class OrMoreTraverser extends SingleCollectionTraverser {
    get isReducable(): boolean;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
}
export declare class ZeroOrMoreTraverser extends OrMoreTraverser {
    get shortLabel(): string;
}
export declare class OneOrMoreTraverser extends OrMoreTraverser {
    readonly optionalBranch: boolean;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    get shortLabel(): string;
}
export declare class RefTraverser extends EmptyTraverser {
    child: RuleElementTraverser;
    node: PRef;
    stateNode: LeafStateNodeWithPrefix;
    traverserPosition: number;
}
export declare class RuleRefTraverser extends RefTraverser {
    node: PRuleRef;
    isDeferred: boolean;
    targetRule: PRule;
    linkedRuleEntry: EntryPointTraverser;
    ownRuleEntry: CopiedRuleTraverser;
    stateNode: JumpIntoSubroutineLeafStateNode;
    readonly ruleRef = true;
    readonly optionalBranch: boolean;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef);
    get isReducable(): boolean;
    lazyBuildMonoRefTree(): void;
    lazyLinkRule(): boolean;
    checkConstructFailed(): number;
    traversionGeneratorEnter(inTraversion: LinearTraversion): boolean;
    traversionGeneratorExited(inTraversion: LinearTraversion): void;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
    findRuleNodeParent(rule: string, incl?: boolean): any;
    get shortLabel(): string;
}
export declare class TerminalRefTraverser extends RefTraverser {
    node: PTerminalRef;
    stateNode: TraversedLeafStateNode;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef);
    get isReducable(): boolean;
    get isTerminalRefOrChoice(): boolean;
    checkConstructFailed(): number;
    traversionGeneratorEnter(inTraversion: LinearTraversion): boolean;
    traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache): void;
    get shortLabel(): string;
}
export declare class RuleTraverser extends SingleTraverser {
    node: PRule;
    index: number;
    readonly optionalBranch: boolean;
    readonly parent: RuleRefTraverser;
    constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule);
    get isReducable(): boolean;
    findRuleNodeParent(rule: string, incl?: boolean): any;
}
export declare class CopiedRuleTraverser extends RuleTraverser {
    _ReferencedRuleTraverser: any;
    constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule);
    get topRule(): RuleTraverser;
    get importPoint(): CopiedRuleTraverser;
}
export declare class EntryPointTraverser extends RuleTraverser {
    constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule);
    get top(): EntryPointTraverser;
    get topRule(): RuleTraverser;
    get importPoint(): CopiedRuleTraverser;
    hubSize(maxLev: number): number;
    traversionGeneratorEnter(inTraversion: LinearTraversion): boolean;
    get shortLabel(): string;
}
declare abstract class SemanticTraverser extends EmptyTraverser {
    node: PValueNode;
    readonly optionalBranch: boolean;
    constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode);
    get isReducable(): boolean;
    checkConstructFailed(): number;
}
export declare class SemanticAndTraverser extends SemanticTraverser {
}
export declare class SemanticNotTraverser extends SemanticTraverser {
}
export {};
