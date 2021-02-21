import { ParseTable } from '.';
import { GrammarParsingLeafStateCommon } from '.';
import { GrammarParsingLeafState } from '.';
import { RTShift } from '.';
export declare class GenerateParseLookaheadsMainGen {
    parent: GenerateParseLookaheadsCommon;
    parseTable: ParseTable;
    leafs: GenerateParseLookaheadsLeaf[];
    commons: GenerateParseLookaheadsCommon[];
    constructor(parent: GenerateParseLookaheadsCommon, parseTable: ParseTable);
    common(common: GrammarParsingLeafStateCommon): GenerateParseLookaheadsCommon;
}
export declare class GenerateParseLookaheadsLeaf {
    parent: GenerateParseLookaheadsMainGen;
    parseTable: ParseTable;
    leaf: GrammarParsingLeafState;
    common: GenerateParseLookaheadsCommon;
    constructor(parent: GenerateParseLookaheadsMainGen, parseTable: ParseTable, leaf: GrammarParsingLeafState);
}
export declare class GenerateParseLookaheadsCommon {
    parent: GenerateParseLookaheadsMainGen;
    parseTable: ParseTable;
    common: GrammarParsingLeafStateCommon;
    children: GenerateParseLookaheadsMainGen[];
    constructor(parent: GenerateParseLookaheadsMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon);
    insertImported(recursiveShift: RTShift): void;
}
