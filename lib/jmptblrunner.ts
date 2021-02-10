import { ParseTable, GrammarParsingLeafState, Analysis } from '.';
import { IToken } from '.';
import { SerDeser } from '../lib';
import { RTShift } from './analyzer';
import { PRuleRef } from './parsers';

export interface IJumpTable {

  pos: number;
  
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

    var jumper = ParseTblJumper.create(this, this.parseTable);

    this.result = jumper.run();

  }
}




class ParseTblJumper {

  readonly runner: JumpTableRunner;
  readonly parseTable: ParseTable;

  shifts: RTShift[];
  currentStates: GrammarParsingLeafState[];

  static create(runner: JumpTableRunner, parseTable: ParseTable, currentState?: GrammarParsingLeafState) {
    if (!currentState) {
      currentState = parseTable.startingState;
    }
    if (currentState.recursiveShiftStates.length) {

    } else {
      return new SimpleParseTblJumper(runner, parseTable, currentState);
    }
  }

  constructor(runner: JumpTableRunner, parseTable: ParseTable, currentState: GrammarParsingLeafState) {
    this.runner = runner;
    this.parseTable = parseTable;
    this.currentStates = currentState ? [currentState] : [];
  }

  run(): boolean {
    return false;
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
}

class SimpleParseTblJumper extends ParseTblJumper {


  constructor(runner: JumpTableRunner, parseTable: ParseTable, currentState: GrammarParsingLeafState) {
    super(runner, parseTable, currentState);
  }

  run() {
    while (this.process());
  }

  process() {
    var token = this.runner.owner.next();
    if (token) {
      var thisRound = this.currentStates;
      this.currentStates = [];
      thisRound.forEach(state=>{
        var newShifts = state.transitions[token.tokenId];

        if (newShifts) {
          newShifts.forEach(shift=>{

            var min = Math.min(state.recursiveShiftStates.length, shift.shiftIndex)
            for (var i = 0; i < min; i++) {
              var reqstate = state.recursiveShiftStates[i];
              if (reqstate) {
                var rr =  reqstate.startingPoint as PRuleRef;
                var nx = this.runner.owner.rule(rr.ruleIndex);

                // TODO deferred( with {} parser) / immedate ( with regular parser )
                if (nx.run()) {
                  // TODO ?
                  //this.currentStates 
                } else {
                  // ok skip
                }
              }
            }

        });
        }
  
      })
    } else {
      this.currentState = null;
    }
    return this.currentState;
  }

}

class MaybeRecursiveParseTblJumper extends ParseTblJumper {

  toStates: ParseTblJumper[];

  constructor(runner: JumpTableRunner, parseTable: ParseTable, currentState: GrammarParsingLeafState) {
    super(runner, parseTable, currentState);
  }

  process() {
    var token = this.runner.owner.next();
    if (token) {
      this.shifts = this.currentState.transitions[token.tokenId];
      if (this.shifts) {
        this.toStates = [];
        this.shifts.forEach(shift=>{
          var shist = ParseTblJumper.create(this.runner, shift)
        })
      }
    } else {
      this.currentState = null;
    }
    return this.currentState;
  }
}
