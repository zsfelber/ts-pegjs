export declare enum PNodeKind {
    GRAMMAR = "grammar",
    RULE = "rule",
    TERMINAL = "terminal",
    CHOICE = "choice",
    SEQUENCE = "sequence",
    OPTIONAL = "optional",
    ONE_OR_MORE = "one_or_more",
    ZERO_OR_MORE = "zero_or_more",
    EMPTY = "empty",
    SINGLE = "single",
    SEMANTIC_AND = "semantic_and",
    SEMANTIC_NOT = "semantic_not",
    PREDICATE_AND = "simple_and",
    PREDICATE_NOT = "simple_not",
    RULE_REF = "rule_ref",
    TERMINAL_REF = "terminal_ref",
    TEXT = "text",
    LITERAL = "literal"
}
export declare enum PActionKind {
    RULE = "RULE",
    PREDICATE = "PREDICATE"
}
export declare abstract class PNode {
    parent: PNode;
    kind: PNodeKind;
    children: PNode[];
    nodeIdx: number;
    label?: string;
    _tokenId?: number;
    get action(): PFunction;
    get tokenId(): number;
    static xkind: PNodeKind;
    constructor(parent: PNode);
    static deserialize(arr: number[]): PNode;
    ser(): number[];
    deser(arr: number[], pos: number): number;
    diagnosticEqualityCheck(node: PNode): boolean;
    serchildren(): number[];
    deschildren<T extends PNode>(arr: number[], pos: any): number;
    private static desone;
    as<P extends PNode>(cons: new (parent: PNode, ...etc: any[]) => P): P;
    ass<P extends PNode>(cons: new (parent: PNode, ...etc: any[]) => P): P;
    get optionalNode(): boolean;
    toString(): string;
}
export declare class PActContainer extends PNode {
    actions?: PFunction[];
    ruleActions?: PFunction[];
    index: number;
    get symbol(): string;
    toString(): string;
    diagnosticEqualityCheck(node: PActContainer): boolean;
    ser(): number[];
    deser(arr: number[], pos: number): number;
}
export declare class PGrammar extends PActContainer {
    kind: PNodeKind;
    children: PActContainer[];
    rules: PRule[];
}
export declare class PRule extends PActContainer {
    kind: PNodeKind;
    rule?: string;
    refs: number;
    constructor(parent: PNode, index: number);
    get symbol(): string;
}
export declare class PTerminal extends PActContainer {
    kind: PNodeKind;
    terminal?: string;
    get symbol(): string;
}
export declare class PLogicNode extends PNode {
    private _action?;
    private actidx?;
    private actid?;
    get action(): PFunction;
    set action(a: PFunction);
    ser(): number[];
    deser(arr: number[], pos: number): number;
    diagnosticEqualityCheck(node: PLogicNode): boolean;
}
export declare class PValueNode extends PLogicNode {
    get optionalNode(): boolean;
    toString(): string;
}
export declare class PRef extends PValueNode {
    get symbol(): any;
    toString(): string;
}
export declare class PRuleRef extends PRef {
    kind: PNodeKind;
    _rule?: string;
    ruleIndex?: number;
    get symbol(): string;
    get rule(): string;
    set rule(r: string);
    diagnosticEqualityCheck(node: PRuleRef): boolean;
    ser(): number[];
    deser(arr: number[], pos: number): number;
}
export declare class PTerminalRef extends PRef {
    kind: PNodeKind;
    terminal?: string;
    value?: number;
    get tokenId(): number;
    get symbol(): string;
    ser(): number[];
    deser(arr: number[], pos: number): number;
    diagnosticEqualityCheck(node: PTerminalRef): boolean;
}
export declare class PSemanticAnd extends PLogicNode {
    kind: PNodeKind;
}
export declare class PSemanticNot extends PLogicNode {
    kind: PNodeKind;
}
export declare class PFunction {
    nodeIdx: number;
    ownerRule: PActContainer;
    target: PLogicNode;
    index: number;
    args: PCallArg[];
    generatedMemberName?: string;
    code?: string[];
    kind: PActionKind;
    fun: (...etc: any[]) => any;
    diagnosticEqualityCheck(node: PFunction): boolean;
}
export declare class PCallArg {
    label?: string;
    type?: string;
    index: number;
    evaluate: PValueNode;
}
export declare const PConss: {
    grammar: typeof PGrammar;
    rule: typeof PRule;
    choice: typeof PValueNode;
    sequence: typeof PValueNode;
    optional: typeof PValueNode;
    one_or_more: typeof PValueNode;
    zero_or_more: typeof PValueNode;
    semantic_and: typeof PSemanticAnd;
    semantic_not: typeof PSemanticNot;
    simple_and: typeof PValueNode;
    simple_not: typeof PValueNode;
    text: typeof PValueNode;
    literal: typeof PValueNode;
    terminal: typeof PTerminal;
    empty: typeof PValueNode;
    single: typeof PValueNode;
    rule_ref: typeof PRuleRef;
    terminal_ref: typeof PTerminalRef;
};
