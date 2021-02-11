import { ParseTable, GrammarParsingLeafState, Analysis } from '.';
import { IToken } from '.';
import { SerDeser } from '../lib';
import { RTShift } from './analyzer';
import { IBaseParserProgram, DeferredReduce } from './interpreter';
import { PRuleRef, PValueNode } from './parsers';
import { Packrat } from './packrat';

export namespace JumpTables {

  export var parseTables: {[index:number]:ParseTable};

}

export interface IJumpTableProgram extends IBaseParserProgram {

  inputPos: number;
  inputLength: number;

}

export class JumpTableRunner {

  owner: IJumpTableProgram;
  parseTable: ParseTable;
  packrat: Packrat;
  numRules: number;
  reduce: {[index: number]:DeferredReduce};

  constructor(owner: IJumpTableProgram, parseTable: ParseTable, packrat?: Packrat) {
    this.owner = owner;
    this.parseTable = parseTable;
    this.packrat = packrat ? packrat : new Packrat(owner);
    this.numRules = owner.numRules;
    this.reduce = [];
  }

  get result(): DeferredReduce {
    // maybe rolling up
    //return this.reduce[this.parseTable.rule.nodeIdx];
    return this.reduce[this.parseTable.rule.children[0].nodeIdx];
  }

  reduceBefore(currentState: GrammarParsingLeafState) {
    currentState.reduceActions.reducedNodes.forEach(node => {
      var r = node as PValueNode;
      var args: DeferredReduce[] = 
        r.action.args.map(arg=>this.reduce[arg.evaluate.nodeIdx]);
      var reduce = new DeferredReduce(r.action, args, this.owner.inputPos);
      this.reduce[r.nodeIdx] = reduce;
    });
  }

  // Not necessary to call, it's just a diagnostical feature
  reduceEmptyAfter(newState: GrammarParsingLeafState) {
    newState.epsilonReduceActions.reducedNodes.forEach(node => {
      // ...
    });
  }

  run(withToken?: IToken): boolean {

    const owner = this.owner;
    const parseTable = this.parseTable;

    var token: IToken;
    if (withToken) token = withToken
    else token = owner.next();

    owner.currentRule = parseTable.rule.index;

    // TODO
    var ruleMaxFailPos = 0;

    var currentStates: GrammarParsingLeafState[] = [parseTable.startingState];
    var stack: [GrammarParsingLeafState[], IToken, number, number][] = [];
    var i = 0;

    // NOTE to avoid recursion for each stepping forward one single step  
    maincyc:while (token) {

      for (; i < currentStates.length; i++) {
        var currentState = currentStates[i];

        // !! :)  !!
        this.reduceBefore(currentState);

        var newShifts = currentState.transitions[token.tokenId];
        var rsh: RTShift;
  
        if (newShifts) {

          stack.push([currentStates, token, i + 1, owner.inputPos]);
          currentStates = newShifts.map(shift=>shift.toState);
          token = owner.next();
          i = 0;
          continue maincyc;

        } else if (rsh = currentState.recursiveShift) {
          var reqstate = rsh.toState;
          var rr = reqstate.startingPoint as PRuleRef;
  
          const cached = this.packrat.readCacheEntry(SerDeser.ruleTable[rr.ruleIndex]);

          if (cached.nextPos!==undefined) {
            stack.push([currentStates, token, i + 1, owner.inputPos]);
            currentStates = [reqstate];
            token = owner.next();
            i = 0;
            // TODO
            // REDUCE cached.result;
            continue maincyc;
          } else {
            var ruleRefTbl = JumpTables.parseTables[rr.ruleIndex];
            var childRunner = new JumpTableRunner(owner, ruleRefTbl, this.packrat);
  
            // TODO deferred( with {} parser) / immedate ( with regular parser )
            if (childRunner.run(token)) {
  
              stack.push([currentStates, token, i + 1, owner.inputPos]);
              currentStates = [reqstate];
              token = owner.next();
              i = 0;

              // TODO result
              Object.assign(cached, { nextPos: owner.inputPos, 
                maxFailPos: ruleMaxFailPos, result:childRunner.result });
          
              continue maincyc;
  
            } else {
              // ok skip
              // FIXME ?? rewind to pos0 here or in ruleRefAutom.run() ??
            }
          }
        }
      }

      if (stack.length) {
        var inputPos: number;
        [currentStates, token, i, inputPos] = stack.pop();
        owner.inputPos = inputPos;
      } else {
        break;
      }
    }

    // TODO better from reduce
    return !token;

  }


}
