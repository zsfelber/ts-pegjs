import { DeferredReduce, GrammarParsingLeafState, IParserProgram, IToken, Packrat, ParseTable } from '.';
export interface IJumpTableProgram extends IParserProgram {
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
