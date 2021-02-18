import { ICached, IParserProgram, PRule } from '.';
export declare class Packrat {
    readonly peg$resultsCache: {
        [id: number]: ICached;
    };
    owner: IParserProgram;
    numRules: number;
    constructor(owner: IParserProgram);
    readCacheEntry(rule: PRule): ICached;
}
