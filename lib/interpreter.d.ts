import { IToken, PFunction, PRule } from '.';
export declare const peg$FAILED: Readonly<any>;
export declare const peg$SUCCESS: Readonly<any>;
export interface IParserProgram {
    inputPos: number;
    currentRule: number;
    readonly numRules: number;
    fail(token: IToken): void;
    cacheKey(rule: PRule): number;
    next(): IToken;
}
export declare class DeferredReduce {
    readonly action: PFunction;
    readonly fun: (...etc: any[]) => any;
    readonly argsToLeft: DeferredReduce[];
    readonly calculatedArgs: any[];
    readonly pos: number;
    constructor(action: PFunction, argsToLeft: any[], pos: number);
}
