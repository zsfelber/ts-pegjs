import { ParseTable, Analysis } from '.';
import { PTerminalRef } from './parsers';



export class GenerateParseDeferrerMainGen {

  parseTable: ParseTable;
  ambiogousTokens = {};
  internalAmbiguity = 0;
  externalAmbiguity = 0;

  constructor(ast: any, parseTable: ParseTable) {
    this.parseTable = parseTable;

    var common = parseTable.startingState.common;
    var tokenSet:number[] = Object.keys(common.transitions.map) as any;

    const terminalDeconsts = ast.terminalDeconsts;

    const tknToStr = (token: number) => {
      if (token >= 0) {
        return terminalDeconsts[token]
      } else {
        return Analysis.choiceTokens[-token].children.map(termRef=>(termRef as PTerminalRef).terminal).join("|");
      }
    };
    tokenSet.forEach(token=>{
      var shifts = common.transitions.map[token];
      if (shifts.length > 1) {
        this.ambiogousTokens[tknToStr(token)] = 1;
        shifts.forEach(shift=>{
          if (shift.stepIntoRecursive && shift.stepIntoRecursive.child) {
            this.externalAmbiguity += shift.stepIntoRecursive.depth;
          } else {
            this.internalAmbiguity ++;
          }
        });
      }
    });
    if (this.internalAmbiguity + this.externalAmbiguity >= 100) {
      console.warn("WARNING  Amibigous shifts for the start rule of '"+parseTable.rule.rule+"'  Ambiguity internal:"+this.internalAmbiguity+" external:"+this.externalAmbiguity+" of tokens "+Object.keys(this.ambiogousTokens).join(",")+"  Advised to define some rules as deferred and trying to compile the grammar again.");
    }
  }

}
