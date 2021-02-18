import { DeferredReduce, GrammarParsingLeafState, IBaseParserProgram, IToken, Packrat, ParseTable } from '.';
export interface IJumpTableProgram extends IBaseParserProgram {
    inputPos: number;
    inputLength: number;
}
export declare class JumpTableRunner {
    owner: IJumpTableProgram;
    parseTables: {
        [index: number]: ParseTable;
    };
    parseTable: ParseTable;
    packrat: Packrat;
    numRules: number;
    reduce: {
        [index: number]: DeferredReduce;
    };
    constructor(owner: IJumpTableProgram, parseTables: {
        [index: number]: ParseTable;
    }, parseTable: ParseTable, packrat?: Packrat);
    get result(): DeferredReduce;
    reduceBefore(currentState: GrammarParsingLeafState): void;
    reduceAfter(newState: GrammarParsingLeafState): void;
    run(withToken?: IToken): boolean;
}
