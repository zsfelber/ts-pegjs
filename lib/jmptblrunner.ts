import { ParseTable, GrammarParsingLeafState, Analysis } from '.';
import { IToken } from '.';
import { SerDeser } from '../lib';
import { RTShift } from './analyzer';
import { IBaseParserProgram } from './interpreter';
import { PRuleRef } from './parsers';

export interface IJumpTableProgram extends IBaseParserProgram {

  inputPos: number;
  inputLength: number;

  ruleAutomaton(index: number): ParseTblJumper;
}

export class JumpTableRunner {

  owner: IJumpTableProgram;
  numRules: number;
  result: ParseTblJumper[];

  constructor(owner: IJumpTableProgram) {
    this.owner = owner;
    this.numRules = owner.numRules;
  }

  run(parseTable: ParseTable): any {

    var jumper = new ParseTblJumper(this, parseTable);

    jumper.run();
    var result = jumper.result;
    return result;
  }
}




class ParseTblJumper {

  readonly runner: JumpTableRunner;
  readonly parseTable: ParseTable;

  constructor(runner: JumpTableRunner, parseTable: ParseTable) {
    this.runner = runner;
    this.parseTable = parseTable;
  }

  reduceBefore() {
    this.currentState.reduceActions.forEach(node => {

    });
  }

  // Not necessary to call, it's just a diagnostical feature
  reduceEmptyAfter(newState: GrammarParsingLeafState) {
    newState.epsilonReduceActions.forEach(node => {
      // ...
    });
  }

  run(withToken?: IToken): boolean {

    var token: IToken;
    if (withToken) token = withToken
    else token = this.runner.owner.next();

    var currentStates: GrammarParsingLeafState[] = [this.parseTable.startingState];
    var stack: [GrammarParsingLeafState[], IToken, number, number][] = [];
    var i = 0;

    // NOTE to avoid recursion for each stepping forward one single step  
    maincyc:while (token) {

      for (; i < currentStates.length; i++) {
        var currentState = currentStates[i];

        var newShifts = currentState.transitions[token.tokenId];
        var rsh: RTShift;
  
        if (newShifts) {

          stack.push([currentStates, token, i + 1, this.runner.owner.inputPos]);
          currentStates = newShifts.map(shift=>shift.toState);
          token = this.runner.owner.next();
          i = 0;
          continue maincyc;

        } else if (rsh = currentState.recursiveShift) {
          var reqstate = rsh.toState;
          var rr = reqstate.startingPoint as PRuleRef;
  
          var ruleRefAutom = this.runner.owner.ruleAutomaton(rr.ruleIndex);
  
          // TODO deferred( with {} parser) / immedate ( with regular parser )
          if (ruleRefAutom.run()) {

            stack.push([currentStates, token, i + 1, this.runner.owner.inputPos]);
            currentStates = [reqstate];
            token = this.runner.owner.next();
            i = 0;
            continue maincyc;

          } else {
            // ok skip
            // FIXME ?? rewind to pos0 here or in ruleRefAutom.run() ??
          }
        }
      }

      if (stack.length) {
        var inputPos: number;
        [currentStates, token, i, inputPos] = stack.pop();
        this.runner.owner.inputPos = inputPos;
      } else {
        break;
      }
    }

    // TODO better from reduce
    return !token;

  }


}
