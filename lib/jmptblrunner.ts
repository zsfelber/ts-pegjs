import { ParseTable, GrammarParsingLeafState, Analysis } from '.';
import { IToken } from '.';
import { SerDeser } from '../lib';
import { RTShift } from './analyzer';
import { PRuleRef } from './parsers';

export interface IJumpTable {

  inputPos: number;
  inputLength: number;
  
  readonly numRules: number;
  next(): IToken;
  rule(index: number): ParseTblJumper;
}

export abstract class JumpTableRunner {

  owner: IJumpTable;
  numRules: number;
  parseTable: ParseTable;
  result: ParseTblJumper[];
  
  constructor(owner: IJumpTable, parseTable: ParseTable) {
    this.owner = owner;
    this.parseTable = parseTable;
    this.numRules = owner.numRules;
  }
  
  run(): any {

    var jumper = new ParseTblJumper(this, this.parseTable);

    this.result = jumper.run();

  }
}




class ParseTblJumper {

  readonly runner: JumpTableRunner;
  readonly parseTable: ParseTable;

  shifts: RTShift[];
  currentStates: GrammarParsingLeafState[];

  constructor(runner: JumpTableRunner, parseTable: ParseTable, currentState?: GrammarParsingLeafState) {
    this.runner = runner;
    this.parseTable = parseTable;
    if (!currentState) {
      currentState = parseTable.startingState;
    }
    this.currentStates = [currentState];
  }

  reduceBefore() {
    this.currentState.reduceActions.forEach(node=>{
      
    });
  }

  // Not necessary to call, it's just a diagnostical feature
  reduceEmptyAfter(newState: GrammarParsingLeafState) {
    newState.epsilonReduceActions.forEach(node=>{
      // ...
    });
  }

  run(): boolean {
    while (this.process());
    // TODO better from reduce
    return this.runner.owner.inputPos === this.runner.owner.inputLength;
  }

  process(): boolean {
    var token = this.runner.owner.next();
    if (token) {
      var thisRound = this.currentStates;

      thisRound.forEach(state=>{
        var newShifts = state.transitions[token.tokenId];

        var reqstate = state.recursiveShiftState;
        if (!newShifts && reqstate) {
          var t = reqstate.toState;
          var rr =  t.startingPoint as PRuleRef;
          var nx = this.runner.owner.rule(rr.ruleIndex);
    
          // TODO deferred( with {} parser) / immedate ( with regular parser )
          if (nx.run()) {
            token = this.runner.owner.next();
            newShifts = t.transitions[token.tokenId];
          } else {
            // ok skip
          }
        }

        this.currentStates = newShifts ? newShifts.map(shift=>shift.toState) : null;

      });
    } else {
      this.currentStates = null;
    }
    return !!(this.currentStates && this.currentStates.length);
  }

}
