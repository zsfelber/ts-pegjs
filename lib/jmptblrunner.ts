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
  ruleAutomaton(index: number): ParseTblJumper;
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

  run(withToken?: IToken): boolean {
    var token;
    if (withToken) token = withToken
    else token = this.runner.owner.next();

    do {
      if (token) {
        if (this.process(token)) {
          token = this.runner.owner.next();
        }
      } else {
        this.currentStates = null;
        token = null;
      }
    } while (token);

    // TODO better from reduce
    return this.runner.owner.inputPos === this.runner.owner.inputLength;
  }

  process(token: IToken): boolean {
    var thisRound = this.currentStates;

    this.currentStates = [];

    thisRound.forEach(state=>{
      var newShifts = state.transitions[tokenAfterRq.tokenId];

      var rsh = state.recursiveShift;
      if (!newShifts && rsh) {
        var reqstate = rsh.toState;
        var rr =  reqstate.startingPoint as PRuleRef;

        var ruleRefAutom = this.runner.owner.ruleAutomaton(rr.ruleIndex);
  
        var pos0 = this.runner.owner.inputPos;
        // TODO deferred( with {} parser) / immedate ( with regular parser )
        if (ruleRefAutom.run()) {
          var tokenAfterRq = this.runner.owner.next();
          if (tokenAfterRq) {
            newShifts = reqstate.transitions[tokenAfterRq.tokenId];
          }
        } else {
          // ok skip
        }
        this.runner.owner.inputPos = pos0;
      }

      if (newShifts) {
        this.currentStates = this.currentStates.concat(newShifts.map(shift=>shift.toState));
      }

    });
    return !!(this.currentStates && this.currentStates.length);
  }

}
