import { Analysis, IToken, HyperG } from '.';
import { IBaseParserProgram, DeferredReduce } from './interpreter';
import { PRuleRef, PValueNode } from './parsers';
import { Packrat } from './packrat';
import { peg$FAILED } from '.';
import { GrammarParsingLeafState, ParseTable, RTShift, GrammarParsingLeafStateTransitions } from './analyzer-rt';

export interface IJumpTableProgram extends IBaseParserProgram {

  inputPos: number;
  inputLength: number;

}

interface StackAction {
  fun: Function;

  args: any[];
}

type StackTuple = [GrammarParsingLeafState[], IToken, number, number, StackAction];

export class JumpTableRunner {

  owner: IJumpTableProgram;
  parseTables: { [index: number]: ParseTable };
  parseTable: ParseTable;
  packrat: Packrat;
  numRules: number;
  reduce: { [index: number]: DeferredReduce };

  constructor(owner: IJumpTableProgram, parseTables: { [index: number]: ParseTable }, parseTable: ParseTable, packrat?: Packrat) {
    this.owner = owner;
    this.parseTables = parseTables;
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
    currentState.reduceActions.reducedNodes.forEach(reds => {

      /*  TODO outdated because muliple reducedNodes are now possible in every shiftIndex
        (beginning and between shifts too, regular and recursive too)

        var r = node as PValueNode;
      var args: DeferredReduce[] =
        r.action.args.map(arg => this.reduce[arg.evaluate.nodeIdx]);
      var reduce = new DeferredReduce(r.action, args, this.owner.inputPos);
      this.reduce[r.nodeIdx] = reduce;
      */
    });
  }

  reduceAfter(newState: GrammarParsingLeafState) {
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
    var stack: StackTuple[] = [];
    var i = 0;

    // NOTE to avoid recursion for each stepping forward one single step  
    maincyc: while (token) {

      const pushShift = (newShifts: RTShift[], stack: StackTuple[], action?: StackAction) => {
        stack.push([currentStates, token, i + 1, owner.inputPos, action]);
        // 1 - based
        currentStates = newShifts.map(shift => (this.parseTable.allStates[shift.toStateIndex - 1]));
        token = owner.next();
        i = 0;
      }

      const hasRecursionSucceeded = (rsh: RTShift): boolean => {
        // 1 - based
        var reqstate = (this.parseTable.allStates[rsh.toStateIndex - 1]);
        var rr = reqstate.startingPoint as PRuleRef;

        const cached = This.packrat.readCacheEntry(HyperG.ruleTable[rr.ruleIndex]);

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
          var ruleRefTbl = this.parseTables[rr.ruleIndex];
          var childRunner = new JumpTableRunner(owner, this.parseTables, ruleRefTbl, This.packrat);

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

      const conditionalRecursion = (rsh: RTShift, stack: StackTuple[]) => {
        if (hasRecursionSucceeded(rsh)) {
          pushShift([rsh], stack);
          return true;
        } else {
          return false;
        }
      }

      for (; i < currentStates.length; i++) {
        var currentState = currentStates[i];

        // !! :)  !!
        this.reduceBefore(currentState);

        var newShifts = currentState.common.transitions.map[token.tokenId];
        // TODO now multiple
        // TODO add these to before/after sequence split to 
        var rshs0 = currentState.reduceActions;
        var rshs1 = currentState.common.reduceActions;
        var rshs = currentState.common.recursiveShifts;

        if (newShifts) {
          if (!rshs) rshs = new GrammarParsingLeafStateTransitions();

          var reverseSubStack: StackTuple[] = [];
          var statesAfterReq: RTShift[];
          statesAfterReq = [];

          var nscur = 0;
          const Lj = rshs[0].length - 1;
          for (var j = 0; j <= Lj; j++) {
            var rsh = rshs[0][j];

            var statesBeforeReq: RTShift[];
            // if recursiveShift split to 2 parts:
            // before and after recursiveShift :
            statesBeforeReq = [];
            for (; nscur < newShifts.length; nscur++) {
              var shift = newShifts[nscur];
              if (shift.shiftIndex < rsh.shiftIndex) {
                statesBeforeReq.push(shift);
              } else if (j === Lj) {
                statesAfterReq.push(shift);
              } else {
                break;
              }
            }

            // Then:
            // First   statesBeforeReq
            // Second  recursive state
            // Third   shift to recursive if succeeded / statesAfterReq if recursion failed

            pushShift(statesBeforeReq, reverseSubStack);
            pushShift([], reverseSubStack, { fun: conditionalRecursion, args: [rsh, stack] });
            if (j === Lj) {
              pushShift(statesAfterReq, reverseSubStack);
            }
          }

          reverseSubStack.reverse();
          stack = stack.concat(reverseSubStack);

          // pop

        } else if (rshs) {

          if (!conditionalRecursion(rsh, stack)) {

            // fail
            continue maincyc;

          } // else pop
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
