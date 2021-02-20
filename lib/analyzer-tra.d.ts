import { EntryPointTraverser, ParseTableGenerator, RuleElementTraverser, StateNodeWithPrefix } from '.';
export declare enum TraversionItemKind {
    NODE_START = 0,
    NODE_END = 1,
    CHILD_SEPARATOR = 2,
    NEGATE = 3
}
interface TraversionMakerCache {
    depth: number;
    indent: string;
    upwardBranchCnt: number;
    parent?: TraversionMakerCache;
    top?: TraversionMakerCache;
    item?: RuleElementTraverser;
}
export declare namespace Traversing {
    var active: boolean;
    var inTraversion: LinearTraversion;
    var recursionCacheStack: TraversionMakerCache;
    var item: RuleElementTraverser;
    function start(_inTraversion: LinearTraversion, _item: RuleElementTraverser): void;
    function finish(): void;
    function push(child: RuleElementTraverser): void;
    function pop(): void;
}
export declare class TraversionControl {
    readonly parent: LinearTraversion;
    kind: TraversionItemKind;
    item: RuleElementTraverser;
    child: RuleElementTraverser;
    previousChild: RuleElementTraverser;
    start: TraversionControl;
    end: TraversionControl;
    fromPosition: number;
    toPosition: number;
    constructor(parent: LinearTraversion, kind: TraversionItemKind, itm: RuleElementTraverser);
    toString(): string;
}
export declare enum TraversionPurpose {
    FIND_NEXT_TOKENS = 0,
    BACKSTEP_TO_SEQUENCE_THEN = 1
}
export declare enum TraversionItemActionKind {
    OMIT_SUBTREE = 0,
    STEP_PURPOSE = 1,
    CHANGE_PURPOSE = 2,
    RESET_POSITION = 3,
    STOP = 4,
    CONTINUE = 5
}
export declare class TraversionCache {
    readonly isNegative = false;
    readonly intoState: StateNodeWithPrefix;
    constructor(intoState: StateNodeWithPrefix);
    private nodeLocals;
    nodeLocal(node: RuleElementTraverser): any;
    negate(): void;
}
export declare class LinearTraversion {
    readonly parser: ParseTableGenerator;
    readonly rule: EntryPointTraverser;
    readonly traversionControls: TraversionControl[];
    readonly purpose: TraversionPurpose;
    readonly purposeThen: TraversionPurpose[];
    private position;
    private positionBeforeStep;
    private stopped;
    private steparranged;
    get length(): number;
    constructor(parser: ParseTableGenerator, rule: EntryPointTraverser);
    private createRecursively;
    pushControl(item: TraversionControl): void;
    traverse(intoState: StateNodeWithPrefix, initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition?: number): TraversionCache;
    defaultActions(step: TraversionControl, cache: TraversionCache, intoState: StateNodeWithPrefix): void;
    execute(action: TraversionItemActionKind, step: TraversionControl, ...etc: any[]): void;
    toString(): string;
}
export {};
