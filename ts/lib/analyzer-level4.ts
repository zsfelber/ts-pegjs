import { ParseTable } from '.';
import { GrammarParsingLeafStateCommon } from '.';
import { GrammarParsingLeafState } from '.';
import { RTShift } from '.';
import { PNodeKind } from '.';



export class GenerateParseLookaheadsMainGen {

  parent: GenerateParseLookaheadsCommon;
  parseTable: ParseTable;
  leafs: GenerateParseLookaheadsLeaf[] = [];
  commons: GenerateParseLookaheadsCommon[] = [];

  constructor(parent: GenerateParseLookaheadsCommon, parseTable: ParseTable) {

    parseTable.allStates.forEach(c=>{
      var child = new GenerateParseLookaheadsLeaf(this, parseTable, c);
      this.leafs.push(child);
    })
  }

  common(common: GrammarParsingLeafStateCommon) {
    var result = this.commons[common.index];
    if (!result) {
      this.commons[common.index] = result = new GenerateParseLookaheadsCommon(this, this.parseTable, common);
    }
    return result;
  }
}

export class GenerateParseLookaheadsLeaf {

  parent: GenerateParseLookaheadsMainGen;
  parseTable: ParseTable;
  leaf: GrammarParsingLeafState;
  common: GenerateParseLookaheadsCommon;

  constructor(parent: GenerateParseLookaheadsMainGen, parseTable: ParseTable, leaf: GrammarParsingLeafState) {

    this.common = parent.common(leaf.common);

  }

}

export class GenerateParseLookaheadsCommon {

  parent: GenerateParseLookaheadsMainGen;
  parseTable: ParseTable;
  common: GrammarParsingLeafStateCommon;

  children: GenerateParseLookaheadsMainGen[] = [];

  constructor(parent: GenerateParseLookaheadsMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon) {

    var recursiveShifts = common.recursiveShifts.map[0];

    if (recursiveShifts) {
      recursiveShifts.forEach(rshift => {
        this.insertImported(rshift);
      });
    }

  }

  insertImported(recursiveShift: RTShift) {
    if (!recursiveShift.toStateIndex) {
      throw new Error("recursiveShift.toStateIndex   " + recursiveShift.toStateIndex);
    }

    var state = this.parseTable.allStates[recursiveShift.toStateIndex];
    if (state.startingPoint.kind !== PNodeKind.RULE_REF) {
      throw new Error("state.startingPoint.kind !== PNodeKind.RULE_REF   " + state.startingPoint.kind + " !== " + PNodeKind.RULE_REF);
    }
    if (recursiveShift.toStateIndex !== state.index) {
      throw new Error("recursiveShift.toStateIndex !== state.index   " + recursiveShift.toStateIndex + " !== " + state.index);
    }

  }
}
