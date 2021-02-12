import { ParseTable, GrammarParsingLeafState, Analysis } from '.';
import { IToken } from '.';
import { SerDeser } from '../lib';
import { RTShift } from './analyzer';
import { IBaseParserProgram, DeferredReduce } from './interpreter';
import { PRuleRef, PValueNode } from './parsers';
import { Packrat } from './packrat';
import { peg$FAILED } from '../lib';

export namespace JumpTables {

  export var parseTables: { [index: number]: ParseTable };

}

export interface IJumpTableProgram extends IBaseParserProgram {

  inputPos: number;
  inputLength: number;

}

interface StackAction {
  fun: Function;

  args: any[];
}

export class JumpTableRunner {

  owner: IJumpTableProgram;
  parseTable: ParseTable;
  packrat: Packrat;
  numRules: number;
  reduce: { [index: number]: DeferredReduce };

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
        r.action.args.map(arg => this.reduce[arg.evaluate.nodeIdx]);
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
    var This = this;

    const owner = this.owner;
    const parseTable = this.parseTable;

    var token: IToken;
    if (withToken) token = withToken
    else token = owner.next();

    owner.currentRule = parseTable.rule.index;

    // TODO
    var ruleMaxFailPos = 0;

    var currentStates: GrammarParsingLeafState[] = [parseTable.startingState];
    var stack: [GrammarParsingLeafState[], IToken, number, number, StackAction][] = [];
    var i = 0;

    // NOTE to avoid recursion for each stepping forward one single step  
    maincyc: while (token) {

      const pushShift = (newShifts: RTShift[], action?: StackAction) => {
        stack.push([currentStates, token, i + 1, owner.inputPos, action]);
        currentStates = newShifts.map(shift => shift.toState);
        token = owner.next();
        i = 0;
      }

      const hasRecursionSucceeded = (rsh: RTShift): boolean => {
        var reqstate = rsh.toState;
        var rr = reqstate.startingPoint as PRuleRef;

        const cached = This.packrat.readCacheEntry(SerDeser.ruleTable[rr.ruleIndex]);

        if (cached.nextPos !== undefined) {
          if (cached.result === peg$FAILED) {
            // TODO failures
            return false;
          } else {

            // TODO
            // REDUCE cached.result;
            return true;
          }
        } else {
          var ruleRefTbl = JumpTables.parseTables[rr.ruleIndex];
          var childRunner = new JumpTableRunner(owner, ruleRefTbl, This.packrat);

          // TODO deferred( with {} parser) / immedate ( with regular parser )
          if (childRunner.run(token)) {

            // TODO result
            Object.assign(cached, {
              nextPos: owner.inputPos,
              maxFailPos: ruleMaxFailPos, result: childRunner.result
            });

            return true;

          } else {
            // ok skip
            // FIXME ?? rewind to pos0 here or in ruleRefAutom.run() ??
          }
        }
        return false;
      }

      const conditionalRecursion = (rsh: RTShift, statesAfterReq: RTShift[]) => {
        if (hasRecursionSucceeded(rsh)) {
          pushShift([rsh]);
        } else {
          pushShift(statesAfterReq);
        }
        return true;
      }

      const pushConditionalRecursion = (rsh: RTShift, statesBeforeReq: RTShift[], statesAfterReq: RTShift[]) => {
        if (rsh) {
          if (statesBeforeReq.length) {
            pushShift([], { fun: conditionalRecursion, args: [rsh, statesAfterReq] });
            pushShift(statesBeforeReq);
          } else {
            if (!statesAfterReq.length) {
              throw new Error();
            }
            conditionalRecursion(rsh, statesAfterReq);
          }
        } else {
          if (!statesBeforeReq.length || statesAfterReq.length) {
            throw new Error();
          }
          pushShift(statesBeforeReq);
        }
      }

      for (; i < currentStates.length; i++) {
        var currentState = currentStates[i];

        // !! :)  !!
        this.reduceBefore(currentState);

        var newShifts = currentState.transitions.map[token.tokenId];
        var rsh = currentState.recursiveShift;

        if (newShifts) {
          var statesBeforeReq: RTShift[];
          var statesAfterReq: RTShift[];
          // if recursiveShift split to 2 parts:
          // before and after recursiveShift :
          if (rsh) {
            statesBeforeReq = [];
            statesAfterReq = [];
            newShifts.forEach(shift => {
              if (shift.shiftIndex < rsh.shiftIndex) {
                statesBeforeReq.push(shift);
              } else {
                statesAfterReq.push(shift);
              }
            });
          } else {
            statesBeforeReq = newShifts;
          }

          // Then:
          // First   statesBeforeReq
          // Second  recursive state
          // Third   shift to recursive if succeeded / statesAfterReq if recursion failed

          pushConditionalRecursion(rsh, statesBeforeReq, statesAfterReq);

          continue maincyc;

        } else if (rsh = currentState.recursiveShift) {

          if (hasRecursionSucceeded(rsh)) {

            pushShift([rsh]);

            continue maincyc;
          } // else ???   ok to fall down ?
        }
      }

      if (stack.length) {
        var inputPos: number;
        var action: StackAction;
        [currentStates, token, i, inputPos, action] = stack.pop();
        owner.inputPos = inputPos;
        if (action) {
          action.fun.call(this, action.args);
        }
      } else {
        break;
      }
    }

    // TODO better from reduce
    return !token;

  }


}
