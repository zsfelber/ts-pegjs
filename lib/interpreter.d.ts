import { IToken, Packrat, PFunction, PNode, PRule } from '.';
export declare const peg$FAILED: Readonly<any>;
export declare const peg$SUCCESS: Readonly<any>;
declare class RuleProcessStack {
    parser: InterpreterRunner;
    parent: RuleProcessStack;
    argsToLeft: DeferredReduce[];
    constructor(parser: InterpreterRunner, parent: RuleProcessStack, argsToLeft: DeferredReduce[]);
    push(stack: RuleProcessStack, newArgs: DeferredReduce[]): RuleProcessStack;
}
export declare class DeferredReduce {
    readonly action: PFunction;
    readonly fun: (...etc: any[]) => any;
    readonly argsToLeft: DeferredReduce[];
    readonly calculatedArgs: any[];
    readonly pos: number;
    constructor(action: PFunction, argsToLeft: any[], pos: number);
    calculateFromTop(parser: InterpreterRunner): any;
    private calculate;
    private calculateArgs;
}
declare abstract class RuleElementInterpreter {
    readonly parent: RuleElementInterpreter;
    readonly node: PNode;
    readonly children: RuleElementInterpreter[];
    constructor(node: PNode);
    checkConstructFailed(): any;
    parse(stack: RuleProcessStack): any;
    abstract parseImpl(stack: RuleProcessStack): any;
}
export declare class EntryPointInterpreter extends RuleElementInterpreter {
    node: PRule;
    index: number;
    child: RuleElementInterpreter;
    constructor(node: PRule);
    parseImpl(stack: RuleProcessStack): void;
}
export interface IBaseParserProgram {
    inputPos: number;
    currentRule: number;
    readonly numRules: number;
    fail(token: IToken): void;
    cacheKey(rule: PRule): number;
    next(): IToken;
}
export interface IParserProgram extends IBaseParserProgram {
}
export declare class InterpreterRunner {
    owner: IParserProgram;
    packrat: Packrat;
    constructor(owner: IParserProgram);
    run(rule: EntryPointInterpreter): any;
}
export {};
