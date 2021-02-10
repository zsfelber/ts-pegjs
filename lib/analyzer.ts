import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser, PNode, PRef } from './parsers';

export interface StrMapLike<V> {
  [index: number]: V;
}
export interface NumMapLike<V> {
  [index: number]: V;
}

export namespace Analysis {

  export var ERRORS = 0;

  export var ruleTable: PRule[];

  export var deferredRules = [];

  export var leafStates: GrammarParsingLeafState[] = [];

  export function leafState(index: number) {
    var ls = leafStates[index];
    if (!ls) {
      leafStates[index] = ls = new GrammarParsingLeafState();
      ls.index = index;
    }
    return ls;
  }
}

export const FAIL_STATE = 0;

export const START_STATE = 1;

export const FINAL_STATE = 255;

namespace Factory {

  export var parseTables: StrMapLike<ParseTableGenerator> = {};

  export function createTraverser(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceTraverser(parser, parent, node);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceTraverser(parser, parent, node);
      case PNodeKind.OPTIONAL:
        return new OptionalTraverser(parser, parent, node);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndTraverser(parser, parent, node);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotTraverser(parser, parent, node);
      case PNodeKind.PREDICATE_AND:
        return new SemanticAndTraverser(parser, parent, node);
      case PNodeKind.PREDICATE_NOT:
        return new SemanticNotTraverser(parser, parent, node);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreTraverser(parser, parent, node);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreTraverser(parser, parent, node);
      case PNodeKind.RULE_REF:
        return new RuleRefTraverser(parser, parent, node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefTraverser(parser, parent, node as PTerminalRef);
      case PNodeKind.RULE:
        if (!parent) {
          return new EntryPointTraverser(parser, null, node as PRule);
        } else if (parent instanceof RuleRefTraverser) {
          throw new Error("Not expecting it here please fix it");
          //return new CopiedRuleTraverser(parser, parent, node as PRule);
        } else {
          throw new Error("bad parent:" + parent);
        }

    }
  }
}


function hex3(c) {
  if (c < 16) return '00' + c.toString(16).toUpperCase();
  else if (c < 256) return '0' + c.toString(16).toUpperCase();
  else if (c < 4096) return '' + c.toString(16).toUpperCase();
  else return "???"
}

function hex2(c) {
  if (c < 16) return '0' + c.toString(16).toUpperCase();
  else if (c < 256) return '' + c.toString(16).toUpperCase();
  else return "??"
}

abstract class StateNode {

  index: number;

  // of state transitions starting from here
  // includes Regular SHIFTs
  // includes Epsilon REDUCEs
  // includes SHIFT_RECURSIVEs
  readonly shiftsAndReduces: ShiftReduce[] = [];

  // Regular REDUCEs 
  // of state transitions arriving to here
  readonly regularReduces: Reduce[] = [];

  abstract generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion);


  abstract generateState(): GrammarParsingLeafState;


  abstract get isRule(): boolean;

  abstract get traverser(): RuleElementTraverser;

  toString() {
    return "SH#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftsAndReduces.length + "s/r");
  }
}


class RootStateNode extends StateNode {

  rule: EntryPointTraverser;

  constructor(rule: EntryPointTraverser) {
    super();
    this.rule = rule;
  }

  get isRule(): boolean {
    return false;
  }

  get traverser(): RuleElementTraverser {
    return this.rule;
  }

  generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion) {
    if (parser.cntStates !== 1) throw new Error("?? staring state not the first : " + parser.cntStates);

    rootTraversion.traverse(this, TraversionPurpose.FIND_NEXT_TOKENS);
    this.index = 1;
    parser.cntStates = 2;
  }

  generateState() {
    var result: GrammarParsingLeafState = new GrammarParsingLeafState(this, null);
    return result;
  }

  toString() {
    return "start#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftsAndReduces.length);
  }
}

abstract class LeafStateNode extends StateNode {

  ref: RefTraverser;

  constructor(ref: RefTraverser) {
    super();
    this.ref = ref;
  }

  get traverser(): RuleElementTraverser {
    return this.ref;
  }

  generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion) {

    var ts = this.ref.traverserStep;
    if (!ts || ts.parent !== rootTraversion) throw new Error("bad traversion params " + this + "  traverserStep:" + ts);

    rootTraversion.traverse(this, TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN,
      [TraversionPurpose.FIND_NEXT_TOKENS], ts.toPosition);

    this.index = parser.cntStates;
    parser.cntStates++;
  }

}

class TraversedLeafStateNode extends LeafStateNode {

  ref: TerminalRefTraverser;

  constructor(ref: TerminalRefTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return false;
  }

  generateState() {
    var result: GrammarParsingLeafState = new GrammarParsingLeafState(this, this.ref.node);
    return result;
  }

}

class JumpIntoSubroutineLeafStateNode extends LeafStateNode {

  ref: RuleRefTraverser;

  constructor(ref: RuleRefTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return true;
  }

  generateState() {
    var result: GrammarParsingLeafState = new GrammarParsingLeafState(this, this.ref.node);
    return result;
  }

}


class ShiftReduce {
  kind: ShiftReduceKind;

  item: RuleElementTraverser;

  isEpsilonReduce?: boolean;
  intoRule?: JumpIntoSubroutineLeafStateNode;
}

class Shift extends ShiftReduce {

  kind = ShiftReduceKind.SHIFT;

  item: TerminalRefTraverser;
}

class ShiftRecursive extends ShiftReduce {

  kind = ShiftReduceKind.SHIFT_RECURSIVE;

  item: RuleRefTraverser;
}

class Reduce extends ShiftReduce {

  kind = ShiftReduceKind.REDUCE;

  isEpsilonReduce: boolean;
}

enum ShiftReduceKind {
  SHIFT, REDUCE, SHIFT_RECURSIVE, REDUCE_RECURSIVE
}


//
//   TODO   
// I was thinking
// There are parallel cases  (multiple shifts, maybe  choice2, choice3 will be the winner)
//  GLL  needed
//  MAybe Using Breadth-first traversal
//
//



// 
// ======================================================================================
//
// The Parse Table generator. 
// The logic basically consist of SHIFT and REDUCE actions. The flow
// of the 2 kind of actions are driven by incoming token stream,  
// possibly 1 SHIFT step and N REDUCE steps for each incoming token. 
//
// There are three steps of producing it:
// 1. Generating a parse graph first. 
// 2. Then, creating a linear traversion stream. 
// 3. Then traversing operations in 2 different modes (purposes). 
// 4. Finally we can produce the jumping tables itself with all necessary 
// information. 
//
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
//
//
// 1. About parsing graph:
// It should be a finite graph which may be circular. Logically, its
// leaf nodes are the terminal refs, intermediate nodes are the rule nodes
// and nonterminal refs.
// Its circle points are 2 kind of, 1st the LOOP nodes, pointing to itself,
// and 2nd the recursive JUMP nodes. We can handle both kinds of circularity  
// in a straight way.
// The leaf nodes are the parse states and belong to SHIFT actions. To  
// infinitely included sub sections, the graph also contains special recursive
// jumping states in points  of the grammar ( as a special kind of SHIFT action ).
// The root node means the starting and the final state.
//
// For the leaf (state) nodes, these are true:
//    - these and the starting/finishing action are the linear parsing states as each 
//      one leaf state is the starting point of and as well the result of a SHIFT action,
//    - each SHIFT produces a leaf state, so
//        1+1 starting+finishing state
//        + leaf nodes      <=>    parsing state      in 1 : 1  relationship
// For the intermediate (logic) nodes, these are true:
//    - maybe a rule entry, choice, sequence, optional, zero or more cycle, 
//      one or more cycle
//    - produces REDUCE actions, during bacwards direction of traversion
//
// 2. The traversion handler makes a simple linear stream of TraversionControl (may be
//    called Action) items which generated  by  the Reference or Logic Nodes (which are 
//    the graph nodes), subsequentially, by an initial recursive process. The object
//    executes the travesing over and over again, in a simple linear cycle in possibly
//    different modes (called  Purposes). The TraversionControls are responsible to 
//    take actions in traversed nodes (differently for different Purposes), so 
//    traversion handler is purpose-, action-  (of course topology-of-tree-nodes) 
//    driven and in a somewhat very straight manner, linear.
//
// 3. SHIFTs and REDUCEs are produced by traversion. 2 modes (purposes) the traversion
//    is called
//    - FIND_NEXT_TOKENS : collects the controlling (so the possible Next) tokens. 
//      Simply, these are the SHIFT actions. 
//      This process may be 1)the Starting state jumps generation or 2)in the generation of 
//      intermediate states, it starts after the initial reduction detections
//      (following the starting point token). It also detects implicit (empty branch) 
//      REDUCE actions.
//    - BACKSTEP_TO_SEQUENCE_THEN..FIND_NEXT_TOKENS
//      The initial reduction detections, followed by regular collecting of next shift,
//      just mentioned . 
//      This way of call the traversion  detects the regular(explicit) REDUCE actions.  
//      There are implicit (empty branch) REDUCE actions as well which detected during 
//      the FIND_NEXT_TOKENS phase.
//      When it reaches the Sequence upwards, turns downwards and continues in regular
//      FIND_NEXT_TOKENS mode.
//
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
//
//
// For the REDUCE actions, these are true:
//
//    - REDUCE actions coming in upward direction of the traversion
//    - The regular ones collected in the beginning of each SHIFT but belongs to 
//      the previous      Leaf State (so at runtime it is called immediately 
//      when the Leaf State reached, not during the next SHIFT)
//    - The implicit empty branch REDUCE actions collected before the SHIFT that
//      belongs to, these are called  at beginning the next SHIFT
//    - when a TOP node REDUCE action presents, it is the final state
// 
// ======================================================================================
// 
export class ParseTableGenerator {

  nodeTravIds: number = 0;

  rule: PRule;
  theTraversion: LinearTraversion;

  startingStateNode: RootStateNode;
  maxTokenId: number = 0;

  allRuleReferences: RuleRefTraverser[] = [];
  allTerminalReferences: TerminalRefTraverser[] = [];

  // the state nodes 
  allLeafStateNodes: StateNode[] = [];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
  allNodes: NumMapLike<RuleElementTraverser> = {};
  jumperStates: NumMapLike<number> = [];

  // 1 based index
  cntStates = 1;

  static createForRule(rule: PRule) {
    var parseTable: ParseTableGenerator = Factory.parseTables[rule.rule];
    if (!parseTable) {
      parseTable = new ParseTableGenerator(rule);
      Factory.parseTables[rule.rule] = parseTable;
    }
    return parseTable;
  }

  private constructor(rule: PRule) {

    //console.log("Read rules tree...")

    this.rule = rule;
    var mainEntryPoint = new EntryPointTraverser(this, null, rule);
    this.entryPoints[rule.rule] = mainEntryPoint;

    // loads all :)
    while (this.allRuleReferences.some(ruleRef => ruleRef.lazyCouldGenerateNew()));

    this.startingStateNode = new RootStateNode(mainEntryPoint);

    //console.log("Generating traversion...")

    this.theTraversion = new LinearTraversion(this, mainEntryPoint);

    //console.log("Generating starting transitions...")

    this.startingStateNode.generateTransitions(this, this.theTraversion);


    // This simple loop generates all possible state transitions at once:

    // NOTE
    // each state handles the jumped-through REDUCE actions as well
    // so simply these always must be made sequentially

    //console.log("Generating states...")


    this.allLeafStateNodes.forEach(state => {
      state.generateTransitions(this, this.theTraversion);
    });

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
    console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.entryPoints).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   states:" + this.allLeafStateNodes.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);

  }

  getEntryPoint(node: PRule) {
    var rule: EntryPointTraverser;
    rule = this.entryPoints[node.rule];
    if (!rule) {
      rule = new EntryPointTraverser(this, null, node);
      this.entryPoints[node.rule] = rule;
    }
    return rule;
  }

  generateParseTable() {
    var start = this.startingStateNode.generateState();
    var all = this.allLeafStateNodes.map(s => s.generateState());
    var result = new ParseTable(this.maxTokenId, this.rule, start, all);
    return result;
  }

}



export class ParseTable {

  maxTokenId: number;
  readonly rule: PRule;
  startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];

  constructor(maxTokenId: number, rule: PRule, startingState: GrammarParsingLeafState, allStates: GrammarParsingLeafState[]) {
    this.maxTokenId = maxTokenId;
    this.rule = rule;
    this.startingState = startingState;
    this.allStates = allStates
  }

  static deserialize(rule: PRule, buf: number[]) {
    var result = new ParseTable(0, rule, null, []);
    var pos = result.deser(buf);
    if (pos !== buf.length) throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
    return result;
  }

  ser(): number[] {
    var serStates: number[] = [];

    var maxStateId = this.allStates.length;
    var ind = this.startingState.ser(maxStateId, this.maxTokenId, serStates);

    this.allStates.forEach(s => {
      var ind = s.ser(maxStateId, this.maxTokenId, serStates);
    });

    var result = [this.rule.nodeIdx, this.allStates.length, this.maxTokenId].concat(serStates);
    return result;
  }

  deser(buf: number[]): number {
    var maxIdx = 0;
    var [ridx, stlen, mxtki] = buf;
    if (ridx !== this.rule.nodeIdx) {
      throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
    }

    this.maxTokenId = mxtki;
    var pos = 4;
    var st0 = Analysis.leafState(1);
    pos = st0.deser(stlen, mxtki, 1, buf, pos);
    this.startingState = st0;

    stlen++;
    for (var i = 2; i <= stlen; i++) {
      var st = Analysis.leafState(i);
      pos = st.deser(stlen, mxtki, i, buf, pos);
      this.allStates.push(st);
    }

    return pos;
  }

}

export class RTShift {

  readonly shiftIndex: number;

  readonly toState: GrammarParsingLeafState;

  constructor(shiftIndex: number, toState: GrammarParsingLeafState) {
    this.shiftIndex = shiftIndex;
    this.toState = toState;
  }
}

export class GrammarParsingLeafState {

  isRule: boolean;
  index: number;

  startingPoint: PRef;
  private startState: StateNode;

  // tokenId -> traversion state
  private _transitions: NumMapLike<RTShift[]>;
  readonly reduceActions: PNode[];
  readonly epsilonReduceActions: PNode[];
  recursiveShift: RTShift;

  constructor(startState?: StateNode, startingPoint?: PRef) {
    if (startState) {
      this.isRule = startState.isRule;
      this.index = startState.index;
    }
    this.startState = startState;
    this.startingPoint = startingPoint;
    this.epsilonReduceActions = [];
    this.reduceActions = [];
  }

  get transitions(): NumMapLike<RTShift[]> {
    if (!this._transitions) {
      this._transitions = {};
      this.startState.regularReduces.forEach(nextTerm => {
        switch (nextTerm.kind) {
          case ShiftReduceKind.REDUCE:
          case ShiftReduceKind.REDUCE_RECURSIVE:
            var r = nextTerm as Reduce;
            if (r.isEpsilonReduce)
              throw new Error();
            else
              this.reduceActions.push(r.item.node);
            break;
          default:
            throw new Error("111  " + nextTerm);
        }

      });

      var shiftIndex = 0;
      this.startState.shiftsAndReduces.forEach(nextTerm => {

        if (this.recursiveShift) {
          throw new Error("Recursive shift already found, error : "+this.recursiveShift+"  while generating state:"+this.startState+" shiftIndex:"+shiftIndex+" unexpected:"+nextTerm.item);
        }

        switch (nextTerm.kind) {
          case ShiftReduceKind.SHIFT:
            var s = nextTerm as Shift;
            var ts = this._transitions[s.item.node.value];
            if (!ts) {
              this._transitions[s.item.node.value] = ts = [];
            }
            var tshift = new RTShift(shiftIndex, s.item.stateNode.generateState());
            ts.push(tshift)

            shiftIndex++;
            break;

          // these are the rule-ref recursive states
          // these have unknown jumping-in tokens, so 
          // we should check at runtime whether it is over-traversed, if so,
          // stop processing and opening its sub-rule automaton
          case ShiftReduceKind.SHIFT_RECURSIVE:

            var sr = nextTerm as ShiftRecursive;
            this.recursiveShift = new RTShift(shiftIndex, sr.item.stateNode.generateState());

            shiftIndex++;
            break;

          case ShiftReduceKind.REDUCE:
          case ShiftReduceKind.REDUCE_RECURSIVE:
            var r = nextTerm as Reduce;
            if (r.isEpsilonReduce)
              this.epsilonReduceActions.push(r.item.node);
            else
              throw new Error("222  " + nextTerm);
            break;
          default:
            throw new Error("222b  " + nextTerm);
        }
      });

    }
    return this._transitions;
  }

  ser(maxStateId: number, maxTknId: number, buf: number[]): void {
    var toTknIds: number[] = [];
    toTknIds.fill(0, 0, 2 * (maxTknId + 1));

    var additionalStates = 0;
    var es = Object.entries(this.transitions);
    es.forEach(([key, shifts]: [string, RTShift[]]) => {
      var tokenId = Number(key);
      var pos = tokenId * 2;
      if (shifts.length !== 1) {
        toTknIds[pos++] = maxStateId + (++additionalStates);
        toTknIds[pos++] = shifts.length;
      } else {
        var shift = shifts[0];
        toTknIds[pos++] = shift.toState.index;
        toTknIds[pos++] = shift.shiftIndex;
      }
      var pos = (maxTknId + 1) * 2 + additionalStates * 2;
      shifts.forEach(shift => {
        toTknIds[pos++] = shift.toState.index;
        toTknIds[pos++] = shift.shiftIndex;
      });
    });

    var recshift: number[];
    if (this.recursiveShift) {
      recshift = [];
      recshift.push(this.recursiveShift.toState.index);
      recshift.push(this.recursiveShift.shiftIndex);
    } else {
      recshift = [0,0];
    }
    var reduce: number[] = [];
    this.reduceActions.forEach(r => {
      reduce.push(r.nodeIdx);
    });
    var ereduce: number[] = [];
    this.epsilonReduceActions.forEach(r => {
      ereduce.push(r.nodeIdx);
    });

    buf.push(this.isRule ? 1 : 0);
    if (this.startingPoint) {
      buf.push(this.startingPoint.nodeIdx);
    } else {
      buf.push(0);
    }
    buf.push(additionalStates);
    buf.push(reduce.length);
    buf.push(ereduce.length);

    buf.push.apply(buf, toTknIds);
    buf.push.apply(buf, recshift);
    buf.push.apply(buf, reduce);
    buf.push.apply(buf, ereduce);
  }


  deser(maxStateId: number, maxTknId: number, index: number, buf: number[], pos: number): number {
    var [isrl, sndx, addsts, rlen, erlen] = buf;
    this.isRule = isrl === 1;
    this.index = index;
    this.startingPoint = sndx ? SerDeser.nodeTable[sndx] as PRef : null;

    var postkn0 = pos;
    var addst = 0;
    for (var i = 0; i <= maxTknId; i++, pos += 2) {
      var si = buf[pos];
      if (si > maxStateId) {
        var ass: RTShift[] = [];
        this.transitions[i] = ass;
        var len = buf[pos + 1];
        var posa = postkn0 + (maxStateId + 1) * 2;
        for (var j = 0; j < len; j++, posa += 2) {
          var sia = buf[posa]
          var statea = Analysis.leafState(sia);
          ass.push(new RTShift(buf[posa + 1], statea));
        }
      } else if (si) {
        var state = Analysis.leafState(si);
        this.transitions[i] = [new RTShift(buf[pos + 1], state)];
      }
    }
    var rsi = buf[pos++];
    var shi = buf[pos++];
    if (rsi) {
      var state = Analysis.leafState(rsi);
      this.recursiveShift = new RTShift(shi, state);
    }
    for (var i = 0; i < rlen; i++, pos++) {
      var node = SerDeser.nodeTable[buf[pos]];
      this.reduceActions.push(node);
    }
    for (var i = 0; i < erlen; i++, pos++) {
      var node = SerDeser.nodeTable[buf[pos]];
      this.epsilonReduceActions.push(node);
    }
    return pos;
  }

}

enum TraversionItemKind {
  RULE, DEFERRED_RULE, REPEAT, OPTIONAL, TERMINAL, NODE_START, NODE_END, CHILD_SEPARATOR, NEGATE
}
class TraversionControl {
  readonly parent: LinearTraversion;

  kind: TraversionItemKind;
  item: RuleElementTraverser;

  rule: RuleRefTraverser;
  terminal: TerminalRefTraverser;
  child: RuleElementTraverser;
  previousChild: RuleElementTraverser;

  fromPosition: number;
  toPosition: number;

  private _set_itm(itm: RuleElementTraverser) {
    this.item = itm;
    switch (this.kind) {
      case TraversionItemKind.RULE:
      case TraversionItemKind.DEFERRED_RULE:
        this.rule = itm as any;
        break;
      case TraversionItemKind.TERMINAL:
        this.terminal = itm as any;
        break;
      case TraversionItemKind.REPEAT:
      case TraversionItemKind.OPTIONAL:
      case TraversionItemKind.NODE_START:
      case TraversionItemKind.NODE_END:
      case TraversionItemKind.CHILD_SEPARATOR:
      case TraversionItemKind.NEGATE:

        break;
      default:
        throw new Error("Bad kind:" + this + ":" + TraversionItemKind[this.kind]);
    }
  }

  constructor(parent: LinearTraversion, kind: TraversionItemKind, itm: RuleElementTraverser) {
    this.parent = parent;
    this.kind = kind;
    this._set_itm(itm);
    this.fromPosition = this.toPosition = parent.length;
  }

  toString() {
    return "TrvCtrl." + TraversionItemKind[this.kind] + "/" + this.fromPosition + (this.fromPosition !== this.toPosition ? ".." + this.toPosition : "") + "/" + this.item;
  }
}

enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_SEQUENCE_THEN
}

enum TraversionItemActionKind {
  OMIT_SUBTREE, STEP_PURPOSE, RESET_POSITION,
  STOP, CONTINUE/*default*/
}

class TraversionCache {

  readonly isNegative = false;

  readonly intoState: StateNode;

  constructor(intoState: StateNode) {
    this.intoState = intoState;
  }

  private nodeLocals: any[] = [];

  nodeLocal(node: RuleElementTraverser) {
    var r = this.nodeLocals[node.nodeTravId];
    if (!r) {
      this.nodeLocals[node.nodeTravId] = r = [];
    }
    return r;
  }

  negate() {
    var t = this as any;
    t.isNegative = !this.isNegative;
  }
}


interface TraversionMakerCache extends StrMapLike<RuleElementTraverser> {
  indent: string;
}

class LinearTraversion {

  readonly parser: ParseTableGenerator;
  readonly rule: EntryPointTraverser;

  readonly traversionControls: TraversionControl[];

  readonly purpose: TraversionPurpose;
  readonly purposeThen: TraversionPurpose[];
  private position: number;
  private positionBeforeStep: number;
  private stopped: boolean;

  get length() {
    return this.traversionControls.length;
  }

  constructor(parser: ParseTableGenerator, rule: EntryPointTraverser) {
    this.parser = parser;
    this.rule = rule;
    this.traversionControls = [];

    var recursionCacheStack = { indent: "" };

    this.createRecursively(rule, recursionCacheStack);
  }

  private createRecursively(item: RuleElementTraverser, recursionCacheStack: TraversionMakerCache) {

    var newRecursionStack = { indent: recursionCacheStack.indent + "  " };
    Object.setPrototypeOf(newRecursionStack, recursionCacheStack);

    // only which located beneath start rule and copied EntryPointTraversers ,
    // are traversable,
    // the rest which created for linked rules, and/or in parser.getReferencedRule, is not
    if (!item.top.parent && item.top !== this.parser.startingStateNode.rule) {
      throw new Error("This how : " + item + "  in:" + this);
    }


    if (item.traversionGeneratorEnter(this, newRecursionStack)) {

      //if (recursionCacheStack.indent.length<30) {
      //   console.log("createRecursively"+newRecursionStack.indent+item);
      //}
      this.pushDefaultPrefixControllerItems(item);
      item.pushPrefixControllerItem(this);

      var i = 0;
      var previousChild = null;
      item.children.forEach(child => {
        //console.log("iterate "+i+"."+newRecursionStack.indent+child);

        var separator: TraversionControl;
        if (i > 0) {
          separator = new TraversionControl(this, TraversionItemKind.CHILD_SEPARATOR, item);
          separator.child = child;
          separator.previousChild = previousChild;
          this.pushControl(separator);
        }

        this.createRecursively(child, newRecursionStack);

        if (separator) {
          separator.toPosition = this.length;
        }
        previousChild = child;
        i++;
      });

      item.pushPostfixControllerItem(this);
      this.pushDefaultPostfixControllerItems(item);

      item.traversionGeneratorExited(this, newRecursionStack);
    }
  }

  pushDefaultPrefixControllerItems(item: RuleElementTraverser) {
    var startnode = new TraversionControl(this, TraversionItemKind.NODE_START, item);
    this.pushControl(startnode);
  }

  pushDefaultPostfixControllerItems(item: RuleElementTraverser) {
    var endnode = new TraversionControl(this, TraversionItemKind.NODE_END, item);
    this.pushControl(endnode);
  }

  pushControl(item: TraversionControl) {
    this.traversionControls.push(item);
  }

  traverse(intoState: StateNode, initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition = 0): TraversionCache {
    var t = this as any;
    t.purpose = initialPurpose;
    t.purposeThen = purposeThen ? purposeThen : [];
    var cache = new TraversionCache(intoState);

    if (startPosition >= this.traversionControls.length) {
      this.stopped = true;
    }
    for (this.position = startPosition; !this.stopped;) {
      this.positionBeforeStep = this.position;
      var item = this.traversionControls[this.position];

      if (item) {

        item.item.traversionActions(this, item, cache);

        this.defaultActions(item, cache, intoState);

        if (this.position >= this.traversionControls.length) {
          this.stopped = true;
        }
      } else {
        throw new Error("Missing item at position : " + this);
      }
    }
    return cache;
  }

  defaultActions(step: TraversionControl, cache: TraversionCache, intoState: StateNode) {
    switch (step.kind) {
      case TraversionItemKind.CHILD_SEPARATOR:
        switch (this.purpose) {
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            this.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
            break;
        }
        break;
      case TraversionItemKind.NEGATE:
        cache.negate();
        break;
      case TraversionItemKind.NODE_START:
        switch (this.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftsAndReduces.length;
            break;
        }
        break;

      case TraversionItemKind.NODE_END:
        switch (this.purpose) {
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            if (intoState.shiftsAndReduces.length) {
              throw new Error("Already in next state/" + this + ":" + step);
            }
            // REDUCE action (default or user function)
            // node succeeded, previous terminal was in a sub-/main-end state
            // :
            // triggers to the user-defined action if any exists  
            // or default runtime action otherwise  generated here
            // 
            // conditions:
            // - at beginning of any state traversion
            // excluded:
            // - reduction checking omitted after first terminal 
            //   ( this is the expected behavior since we are
            //     analyzing one from-token to-tokens state transition
            //     table which is holding all reduction cases in the front
            //     of that  and  contains all token jumps after that )
            // 
            // NOTE still generating this one for the previous state !
            //
            if (step.item.isReducable) {
              intoState.regularReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: false });
            }

            break;
          case TraversionPurpose.FIND_NEXT_TOKENS:
            // Epsilon REDUCE action (default or user function)
            // A whole branch was empty and it is accepted as a 
            // a valid empty node success (which should be of an
            // optionalBranch==true node) ...
            // 
            // This case demands a behavior  which is exactly like
            // that of BACKSTEP_TO_SEQUENCE_THEN ...
            //
            if (cache.nodeLocal(step.item).shiftReducesAtStart === intoState.shiftsAndReduces.length) {
              intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: true });
              cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftsAndReduces.length;
            }
            break;
        }

        break;
    }
    this.execute(TraversionItemActionKind.CONTINUE, null);
  }

  execute(action: TraversionItemActionKind, step: TraversionControl) {
    switch (action) {
      case TraversionItemActionKind.OMIT_SUBTREE:
        if (step.kind !== TraversionItemKind.CHILD_SEPARATOR) {
          throw new Error("Unknown here:" + step + " in " + this);
        }
        this.position = step.toPosition;
        break;
      case TraversionItemActionKind.RESET_POSITION:
        this.position = step.fromPosition;
        break;
      case TraversionItemActionKind.STEP_PURPOSE:
        (this as any).purpose = this.purposeThen.shift();
        break;
      case TraversionItemActionKind.CONTINUE:
        this.position = this.positionBeforeStep + 1;
        break;
      case TraversionItemActionKind.STOP:
        this.stopped = true;
        break;
    }
  }
  toString() {
    return "Traversing " + this.rule + "/" + (this.position === undefined ? "gen.time/" + this.traversionControls.length : TraversionPurpose[this.purpose] + "/" + this.position);
  }
}


export abstract class RuleElementTraverser {

  readonly nodeTravId: number;
  readonly constructionLevel: number;
  readonly parser: ParseTableGenerator;

  readonly parent: RuleElementTraverser;
  readonly node: PNode;
  readonly children: RuleElementTraverser[] = [];
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    this.parser = parser;
    this.parent = parent;
    this.nodeTravId = parser.nodeTravIds++;
    this.node = node;
    this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
    if (this.importPoint) {
      if (this.importPoint.allNodes) this.importPoint.allNodes[this.nodeTravId] = this;
    } else {
      this.parser.allNodes[this.nodeTravId] = this;
    }

    this.node.children.forEach(n => {
      this.children.push(Factory.createTraverser(parser, this, n));
    });
    if (this.checkConstructFailed()) {
      //  throw new Error("Ast construction failed.");
    }
    this.optionalBranch = this.node.optionalNode;
  }

  get isReducable() {
    return false;
  }
  get top(): EntryPointTraverser {
    return this.parent.top;
  }
  get importPoint(): CopiedRuleTraverser {
    return this.parent.importPoint;
  }

  checkConstructFailed(): any {
  }

  findParent(node: PValueNode, incl = false) {
    if (node === this.node && incl) {
      return this;
    } else if (this.parent) {
      return this.parent.findParent(node, true);
    } else {
      return null;
    }
  }

  findRuleNodeParent(rule: string, incl = false) {
    if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

  traversionGeneratorEnter(inTraversion: LinearTraversion, recursionCacheStack: TraversionMakerCache) {
    return true;
  }
  traversionGeneratorExited(inTraversion: LinearTraversion, recursionCacheStack: TraversionMakerCache) {
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
  }

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
  }

  toString() {
    return "T~" + this.node + (this.optionalBranch ? "<opt>" : "");
  }

  get shortLabel() {
    return "";
  }

}


class ChoiceTraverser extends RuleElementTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.children.some(itm => itm.optionalBranch);
  }

  get isReducable() {
    return true;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.CHILD_SEPARATOR:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            break;
        }
        break;
      default:
    }
  }

}


class SequenceTraverser extends RuleElementTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = !this.children.some(itm => !itm.optionalBranch);
  }

  checkConstructFailed() {
    if (!this.children.length) {
      console.error("!parser.children.length (empty sequence)  " + this.node);
      return 1;
    }
  }

  get isReducable() {
    return true;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {

    var traverseLocals = cache.nodeLocal(this);

    switch (step.kind) {
      case TraversionItemKind.CHILD_SEPARATOR:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:

            if (traverseLocals.steppingFromInsideThisSequence) {
              // Rule = A B C? D
              // looking for the next possible tokens inside a sequence, started from
              // A B or C  which, in previous rounds, 
              // raised BACKSTEP_TO_SEQUENCE_THEN > FIND_NEXT_TOKENS,  
              // which triggered traversion to next branch B C or D 
              // and we are after that

              // now, if the mandatory item of the sequence WAS n't coming,
              // makes the whole parse Invalid   if prev was optional, continuing 
              // regurarly and traversing the next (C or D) or moving upwards

              if (!step.previousChild.optionalBranch) {
                inTraversion.execute(TraversionItemActionKind.STOP, step);
              }

            } else {
              // it is the 2..n th branch of sequence, their first items  may not be
              // the following  unless the 1..(n-1)th (previous) branch was optional
              //
              // if so then traversing the next branch / moving upwards  regurarly
              //
              if (!step.previousChild.optionalBranch) {
                inTraversion.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
              }
            }

            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:

            traverseLocals.steppingFromInsideThisSequence = true;

            inTraversion.execute(TraversionItemActionKind.STEP_PURPOSE, step);
            break;
        }
        break;
      default:
    }
  }

}


abstract class SingleCollectionTraverser extends RuleElementTraverser {

  child: RuleElementTraverser;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.child = this.children[0];
  }

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("this.children.length:" + this.children.length + " !== 1  " + this.node);
      return 1;
    }
  }



}


abstract class SingleTraverser extends SingleCollectionTraverser {


}



class EmptyTraverser extends RuleElementTraverser {

  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("this.children.length !== 0  " + this.node);
      return 1;
    }
  }

  get isReducable() {
    return true;
  }

}



class OptionalTraverser extends SingleTraverser {

  get isReducable() {
    return true;
  }

  get shortLabel() {
    return "?";
  }
}

class OrMoreTraverser extends SingleCollectionTraverser {

  get isReducable() {
    return true;
  }

  crrTrItem: TraversionControl;

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem = new TraversionControl(inTraversion, TraversionItemKind.REPEAT, this);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem.toPosition = inTraversion.length;
    inTraversion.pushControl(this.crrTrItem);
    this.crrTrItem = null;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.REPEAT:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            inTraversion.execute(TraversionItemActionKind.RESET_POSITION, step);
            inTraversion.execute(TraversionItemActionKind.STEP_PURPOSE, step);
            break;
        }
        break;
      default:
    }
  }
}


// node.optionalNode == true 

class ZeroOrMoreTraverser extends OrMoreTraverser {


  get shortLabel() {
    return "*";
  }

}

// node.optionalNode == false 

class OneOrMoreTraverser extends OrMoreTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.child.optionalBranch;
  }

  get shortLabel() {
    return "+";
  }

}

class RefTraverser extends EmptyTraverser {

  child: RuleElementTraverser;

  node: PRef;

  traverserStep: TraversionControl;

  stateNode: LeafStateNode;

}

class RuleRefTraverser extends RefTraverser {

  node: PRuleRef;

  isDeferred: boolean;

  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;
  ownRuleEntry: CopiedRuleTraverser;

  stateNode: JumpIntoSubroutineLeafStateNode;

  readonly ruleRef = true;

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    this.parser.allRuleReferences.push(this);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];

  }

  get isReducable() {
    return true;
  }

  lazyCouldGenerateNew() {
    if (this.linkedRuleEntry) {
      return false;
    } else {
      this.linkedRuleEntry = this.parser.getEntryPoint(this.targetRule);
      (this as any).optionalBranch = this.linkedRuleEntry.optionalBranch;

      return true;
    }
  }

  checkConstructFailed() {

    var dirty = super.checkConstructFailed();
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
    if (!this.targetRule) {
      console.error("no this.targetRule  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  traversionGeneratorEnter(inTraversion: LinearTraversion, recursionCacheStack: TraversionMakerCache) {

    var recursiveRule = recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];

    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    var deferred = Analysis.deferredRules.indexOf(this.targetRule.rule) !== -1;

    if (deferred) {
      //console.log("Deferred node : "+this+" in "+inTraversion);
      //
      // NOTE  manually declared defer mode 
      //
      this.isDeferred = true;
    } else if (recursiveRule) {

      console.log("Auto defer recursive rule : " + this + " in " + inTraversion);
      //
      // NOTE  auto-defer mode here
      //       when a rule is infinitely included !!!
      //
      // It is simple right now, though an important condition have
      // to pass later: a deferred automaton should adjust parsing position
      this.isDeferred = true;

    }

    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    var ruledup: CopiedRuleTraverser;

    if (!this.isDeferred) {

      recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;
      //console.log("rule#" + this.targetRule.nodeIdx +"->"+ recursionCacheStack.indent+" "+this);

      //
      // NOTE  auto-defer mode also
      //       when a rule is too large
      //
      //       Though, recommended defining these manually in ellegant hotspots
      //       which not autodetectable but this safeguard is definitely required:

      ruledup = new CopiedRuleTraverser(this.parser, this, this.targetRule);
      var cntNodes = Object.keys(ruledup.allNodes).length;
      if (cntNodes >= 2000) {
        console.warn("Auto defer, rule is too big : " + this + " in " + inTraversion + "  number of its nodes:" + cntNodes);
        console.warn(
        "  Consider configuring deferred rules manually for your code esthetics.\n"+
        "  This rule reference is made deferred automatically due to its large extent.\n"+
        "  Analyzer could not simply generate everything to beneath one root, because\n"+
        "  it may add an unexpected rapid growth effect to analyzing time and parsing\n"+
        "  table output size at some point due to its exponential nature.\n");

        this.isDeferred = true;
      }
    }

    if (this.isDeferred) {

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.DEFERRED_RULE, this);
      inTraversion.pushControl(this.traverserStep);

      this.stateNode = new JumpIntoSubroutineLeafStateNode(this);
      this.parser.allLeafStateNodes.push(this.stateNode);

      return false;

    } else {
      Object.assign(this.parser.allNodes, ruledup.allNodes);

      this.ownRuleEntry = ruledup;
      this.child = this.ownRuleEntry;
      this.children.push(this.ownRuleEntry);

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RULE, this);
      inTraversion.pushControl(this.traverserStep);

      return true;
    }


  }


  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.DEFERRED_RULE:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:

            cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT_RECURSIVE, item: this });
            inTraversion.execute(TraversionItemActionKind.STOP, step);

            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            break;
        }
        break;
      default:
    }
  }


  findRuleNodeParent(rule: string, incl = false) {
    if (incl && rule === this.node.rule) {
      return this;
    } else if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

  get shortLabel() {
    return this.node.rule + (this.stateNode ? "#" + this.stateNode.index : "");
  }

}


class TerminalRefTraverser extends RefTraverser {

  node: PTerminalRef;

  stateNode: TraversedLeafStateNode;


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminalReferences.push(this);

    if (this.node && this.node.value > parser.maxTokenId) parser.maxTokenId = this.node.value;
  }

  get isReducable() {
    return true;
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    this.stateNode = new TraversedLeafStateNode(this);
    this.parser.allLeafStateNodes.push(this.stateNode);

    this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
    inTraversion.pushControl(this.traverserStep);
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.TERMINAL:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT, item: this });
            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            break;
        }
        break;
      default:
    }
  }

  get shortLabel() {
    return this.node.terminal + "#" + this.stateNode.index;
  }

}


export class RuleTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  readonly optionalBranch: boolean;

  readonly parent: RuleRefTraverser;


  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);

    this.index = node.index;
    this.optionalBranch = this.child.optionalBranch;
  }

  get isReducable() {
    return true;
  }

  findRuleNodeParent(rule: string, incl = false) {
    if (incl && rule === this.node.rule) {
      return this;
    } else if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }


}

export class CopiedRuleTraverser extends RuleTraverser {

  _ReferencedRuleTraverser;
  allNodes: NumMapLike<RuleElementTraverser>;

  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);
    if (!parent) throw new Error();
    this.allNodes = {};
    this.allNodes[this.nodeTravId] = this;
  }

  get importPoint(): CopiedRuleTraverser {
    return this;
  }
}


export class EntryPointTraverser extends RuleTraverser {


  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);
    if (parent) throw new Error();
  }

  get top(): EntryPointTraverser {
    return this;
  }
  get importPoint(): CopiedRuleTraverser {
    return this.parent ? this.parent.importPoint : null;
  }

  traversionGeneratorEnter(inTraversion: LinearTraversion, recursionCacheStack: TraversionMakerCache) {
    var ruleOriginal = recursionCacheStack["rule_ref#" + this.node.nodeIdx];

    if (!ruleOriginal) {

      recursionCacheStack["rule_ref#" + this.node.nodeIdx] = this.node;

    }
    return true;
  }


  get shortLabel() {
    return this.node.rule + "#1";
  }

}

abstract class PredicateTraverser extends SingleTraverser {

  get isReducable() {
    return true;
  }

}


class PredicateAndTraverser extends PredicateTraverser {
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.child.optionalBranch;
  }
}


class PredicateNotTraverser extends PredicateTraverser {
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    // NOTE it is good , somewhat thoughtfully tricky
    this.optionalBranch = !this.child.optionalBranch;
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
    inTraversion.pushControl(action);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
    inTraversion.pushControl(action);
  }

}


abstract class SemanticTraverser extends EmptyTraverser {
  node: PValueNode;
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = false;
  }

  get isReducable() {
    return true;
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      // TODO frequently..
      //console.error("No parser.node.action or .action.fun   " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  // TODO impl like this:
  // this too should stop the traversion :
  // cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT_RECURSIVE, item: this });
  // inTraversion.execute(TraversionItemActionKind.STOP, step);


}


class SemanticAndTraverser extends SemanticTraverser {

}


class SemanticNotTraverser extends SemanticTraverser {

} 
