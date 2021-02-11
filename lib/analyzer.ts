import { EntryPointTraverser, Factory, PNodeKind, RefTraverser, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser, PNode, PRef } from './parsers';
import { CodeTblToHex } from './index';

export const FAIL_STATE = 0;

export const START_STATE = 1;

export const CNT_HUB_LEVELS = 5;

export const LEV_CNT_LN_RULE = 500;

export const LEV_CNT_BRANCH_NODES = 500;


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

  export var localDeferredRules = [];

  export var leafStates: GrammarParsingLeafState[] = [];

  export var leafStateTransitionTables: GrammarParsingLeafStateTransitions[] = [];

  export var leafStateReduceTables: GrammarParsingLeafStateReduces[] = [];

  export var maxTokenId: number;

  export const uniformMaxStateId = 0xe000;

  export var serializedTransitions: {[index: string]:GrammarParsingLeafStateTransitions} = {};

  export var serializedReduces: {[index: string]:GrammarParsingLeafStateReduces} = {};

  export function leafState(index: number) {
    var ls = leafStates[index];
    if (!ls) {
      leafStates[index] = ls = new GrammarParsingLeafState();
      ls.index = index;
    }
    return ls;
  }

  export function writeAllSerializedTables(buf: number[]) {
    var strans = Object.values(serializedTransitions);
    var sreds = Object.values(serializedReduces);

    buf.push(strans.length);
    buf.push(sreds.length);
    strans.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
    })
    sreds.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
    })
  }

  export function readAllSerializedTables(buf: number[], pos: number): number {

    var [stransln,sredsln] = buf;
    for (var i=0; i<stransln; i++) {
      var trans = new GrammarParsingLeafStateTransitions();
      trans.index = i;
      pos = trans.deser(buf, pos);
      leafStateTransitionTables.push(trans);
    }
    for (var i=0; i<sredsln; i++) {
      var red = new GrammarParsingLeafStateReduces();
      red.index = i;
      pos = red.deser(buf, pos);
      leafStateReduceTables.push(red);
    }
    return pos;
  }
}


interface TraversionMakerCache extends StrMapLike<RuleElementTraverser> {
  depth: number;
  indent: string;
  upwardBranchCnt: number;
  parent?: TraversionMakerCache;
  top?: TraversionMakerCache;
  item?: RuleElementTraverser;
}

export namespace Traversing {

  export var active: boolean;

  export var inTraversion: LinearTraversion;

  export var recursionCacheStack: TraversionMakerCache;
  
  export var item: RuleElementTraverser;

  var maxdepth = 0;

  export function start(_inTraversion: LinearTraversion, _item: RuleElementTraverser) {
    inTraversion = _inTraversion;
    recursionCacheStack = { depth:0, indent: "", upwardBranchCnt:1, item:_item };
    recursionCacheStack.top = recursionCacheStack;
    item = recursionCacheStack.item;
    maxdepth = 0;
    active = true;
  }
  export function finish() {
    active = false;
  }

  export function push(child: RuleElementTraverser) {
    var oldRecursionCacheStack = recursionCacheStack;
    recursionCacheStack = { depth:oldRecursionCacheStack.depth+1, indent: oldRecursionCacheStack.indent + "  ", upwardBranchCnt: oldRecursionCacheStack.upwardBranchCnt, parent:oldRecursionCacheStack, top:oldRecursionCacheStack.top, item:child };
    if (recursionCacheStack.depth > maxdepth) {
      maxdepth = recursionCacheStack.depth;
      /*if (!(maxdepth%10)) {
        console.log("Traversal depth:"+recursionCacheStack.depth);
      }*/
    }
    item = recursionCacheStack.item;
    Object.setPrototypeOf(recursionCacheStack, oldRecursionCacheStack);
  }
  export function pop() {
    recursionCacheStack = recursionCacheStack.parent;
    item = recursionCacheStack.item;
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

export abstract class LeafStateNode extends StateNode {

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

export class TraversedLeafStateNode extends LeafStateNode {

  ref: TerminalRefTraverser;

  constructor(ref: TerminalRefTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return false;
  }

  generateState() {
    var state = Analysis.leafState(this.index);
    if (!state.startStateNode) {
      state.startStateNode = this;
      state.startingPoint = this.ref.node;
      state.isRule = this.isRule;
      state.index = this.index;
    }
    return state;
  }

}

export class JumpIntoSubroutineLeafStateNode extends LeafStateNode {

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


export class ShiftReduce {
  kind: ShiftReduceKind;

  item: RuleElementTraverser;

  isEpsilonReduce?: boolean;
  intoRule?: JumpIntoSubroutineLeafStateNode;
}

export class Shift extends ShiftReduce {

  kind = ShiftReduceKind.SHIFT;

  item: TerminalRefTraverser;
}

export class ShiftRecursive extends ShiftReduce {

  kind = ShiftReduceKind.SHIFT_RECURSIVE;

  item: RuleRefTraverser;
}

export class Reduce extends ShiftReduce {

  kind = ShiftReduceKind.REDUCE;

  isEpsilonReduce: boolean;
}

export enum ShiftReduceKind {
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

  newRuleReferences: RuleRefTraverser[] = [];

  // the state nodes 
  allLeafStateNodes: StateNode[] = [];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
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

    // !
    Analysis.leafStates = [];

    this.rule = rule;
    var mainEntryPoint = new EntryPointTraverser(this, null, rule);
    this.entryPoints[rule.rule] = mainEntryPoint;

    // loads all
    var cntrules = 0;
    while (this.newRuleReferences.length) {
      cntrules += this.newRuleReferences.length;
      var newRefs = this.newRuleReferences;
      this.newRuleReferences = [];
      newRefs.forEach(ruleRef => ruleRef.lazyLinkRule());
    }
    //console.log("Loaded "+cntrules+" rules.");

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
    console.log("Parse table for   starting rule:" + rule.rule + "  entry points(nonterminals):" + Object.keys(this.entryPoints).length + "  all nodes:" + mainEntryPoint.allNodes.length +"  all rule refs:"+cntrules+ "  L1 rule refs:" + mainEntryPoint.allRuleReferences.length + "  L1 terminal refs:" + mainEntryPoint.allTerminalReferences.length + "  tokens:" + Analysis.maxTokenId + "   states:" + this.allLeafStateNodes.length);

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
    var result = new ParseTable(this.rule, start, all);
    return result;
  }

}



export class ParseTable {

  readonly rule: PRule;
  startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];


  constructor(rule: PRule, startingState: GrammarParsingLeafState, allStates: GrammarParsingLeafState[]) {
    this.rule = rule;
    this.startingState = startingState;
    this.allStates = allStates;

    this.pack();
  }

  pack() {
    Analysis.serializedTransitions = {};
    Analysis.serializedReduces = {};

    if (this.allStates.length > Analysis.uniformMaxStateId) {
      throw new Error("State id overflow. Grammar too big. uniformMaxStateId:"+Analysis.uniformMaxStateId+"  Too many states:"+this.allStates.length);
    }

    var redidx = 0;
    this.allStates.forEach(state=>{
      var trans = state.transitions;
      trans.index = state.index;

      trans.alreadySerialized = [];
      trans.ser(trans.alreadySerialized);

      var encoded = CodeTblToHex(trans.alreadySerialized).join("");

      var trans0 = Analysis.serializedTransitions[encoded];
      if (trans0) {
        console.log("Merged state transitions into : "+trans0.index+" <-<- "+trans.index);
        trans.index = trans0.index;
      }

      function red(rr: GrammarParsingLeafStateReduces) {
        rr.index = redidx++;
        rr.alreadySerialized = [];
        rr.ser(rr.alreadySerialized);
        var encred = CodeTblToHex(rr.alreadySerialized).join("");
  
        var rr0 = Analysis.serializedReduces[encred];
        if (rr0) {
          console.log("Merged reduces into : "+rr0.index+" <-<- "+rr.index);
          rr.index = rr0.index;
        }
      }

      red(state.reduceActions);
      red(state.epsilonReduceActions);

    });

  }

  static deserialize(rule: PRule, buf: number[]) {
    var result = new ParseTable(rule, null, []);
    var pos = result.deser(buf);
    if (pos !== buf.length) throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
    return result;
  }

  ser(): number[] {
    var serStates: number[] = [];

    var ind = this.startingState.ser(serStates);

    this.allStates.forEach(s => {
      var ind = s.ser(serStates);
    });

    var result = [this.rule.nodeIdx, this.allStates.length].concat(serStates);
    return result;
  }

  deser(buf: number[]): number {
    var maxIdx = 0;
    var [ridx, stlen] = buf;
    if (ridx !== this.rule.nodeIdx) {
      throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
    }

    var pos = 4;
    var st0 = Analysis.leafState(1);
    pos = st0.deser(1, buf, pos);
    this.startingState = st0;

    stlen++;
    for (var i = 2; i <= stlen; i++) {
      var st = Analysis.leafState(i);
      pos = st.deser(i, buf, pos);
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

export class GrammarParsingLeafStateTransitions implements NumMapLike<RTShift[]> {

  index: number;

  startingStateMinus1: number;

  [index: number]: RTShift[];

  alreadySerialized: number[];

  delta(stateId: number): number {
    return stateId - this.startingStateMinus1;
  }

  ser(buf: number[]): void {
    if (this.alreadySerialized) {
      this.alreadySerialized.forEach(itm=>buf.push(itm));
      return;
    }

    var toTknIds: number[] = [];
    toTknIds.fill(0, 0, 2 * (Analysis.maxTokenId + 1));

    var additionalStates = 0;
    var es = Object.entries(this);
    var posA = (Analysis.maxTokenId + 1) * 2;

    es.forEach(([key, shifts]: [string, RTShift[]]) => {
      var tokenId = Number(key);
      var pos = tokenId * 2;
      if (shifts.length !== 1) {
        toTknIds[pos++] = Analysis.uniformMaxStateId + (++additionalStates);
        toTknIds[pos++] = shifts.length;

        shifts.forEach(shift => {
          toTknIds[posA++] = this.delta(shift.toState.index);
          toTknIds[posA++] = shift.shiftIndex;
        });
      } else {
        var shift = shifts[0];
        toTknIds[pos++] = this.delta(shift.toState.index);
        toTknIds[pos++] = shift.shiftIndex;
      }
    });

    buf.push.apply(buf, toTknIds);
  }

  deser(buf: number[], pos: number): number {
    var postkn0 = pos;
    var posA = postkn0 + (Analysis.maxTokenId + 1) * 2;
 
    for (var i = 0; i <= Analysis.maxTokenId; i++, pos += 2) {
      var si = buf[pos];
      if (si > Analysis.uniformMaxStateId) {
        var ass: RTShift[] = [];
        this[i] = ass;
        var len = buf[pos + 1];
        for (var j = 0; j < len; j++, posA += 2) {
          var sia = buf[posA]
          var statea = Analysis.leafState(sia);
          ass.push(new RTShift(buf[posA + 1], statea));
        }
      } else if (si) {
        var state = Analysis.leafState(si);
        this[i] = [new RTShift(buf[pos + 1], state)];
      }
    }
    // posA !
    return posA;
  }
}

export class GrammarParsingLeafStateReduces {

  index: number;

  readonly reducedNodes: PNode[] = [];

  alreadySerialized: number[];

  ser(buf: number[]): void {
    if (this.alreadySerialized) {
      this.alreadySerialized.forEach(itm=>buf.push(itm));
      return;
    }

    buf.push(reduce.length);
    var reduce: number[] = [];
    this.reducedNodes.forEach(r => {
      reduce.push(r.nodeIdx);
    });
  }

  deser(buf: number[], pos: number): number {
    var [rlen] = buf;
    for (var i = 0; i < rlen; i++, pos++) {
      var node = SerDeser.nodeTable[buf[pos]];
      this.reducedNodes.push(node);
    }
    return pos;
  }
}

export class GrammarParsingLeafState {

  isRule: boolean;
  index: number;

  startingPoint: PRef;
  startStateNode: StateNode;

  // tokenId -> traversion state
  private _transitions: GrammarParsingLeafStateTransitions;
  reduceActions: GrammarParsingLeafStateReduces;
  epsilonReduceActions: GrammarParsingLeafStateReduces;
  recursiveShift: RTShift;

  constructor(startStateNode?: StateNode, startingPoint?: PRef) {
    if (startStateNode) {
      this.isRule = startStateNode.isRule;
      this.index = startStateNode.index;
    }
    this.startStateNode = startStateNode;
    this.startingPoint = startingPoint;
    this.epsilonReduceActions = new GrammarParsingLeafStateReduces();
    this.reduceActions = new GrammarParsingLeafStateReduces();
  }

  get transitions(): GrammarParsingLeafStateTransitions {
    if (!this._transitions) {
      this._transitions = new GrammarParsingLeafStateTransitions();
      this._transitions.startingStateMinus1 = this.index - 1;

      this.startStateNode.regularReduces.forEach(nextTerm => {
        switch (nextTerm.kind) {
          case ShiftReduceKind.REDUCE:
          case ShiftReduceKind.REDUCE_RECURSIVE:
            var r = nextTerm as Reduce;
            if (r.isEpsilonReduce)
              throw new Error();
            else
              this.reduceActions.reducedNodes.push(r.item.node);
            break;
          default:
            throw new Error("111  " + nextTerm);
        }

      });

      var shiftIndex = 0;
      this.startStateNode.shiftsAndReduces.forEach(nextTerm => {

        if (this.recursiveShift) {
          throw new Error("Recursive shift already found, error : "+this.recursiveShift+"  while generating state:"+this.startStateNode+" shiftIndex:"+shiftIndex+" unexpected:"+nextTerm.item);
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
              this.epsilonReduceActions.reducedNodes.push(r.item.node);
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

  ser(buf: number[]): void {

    buf.push(this.isRule ? 1 : 0);
    if (this.startingPoint) {
      buf.push(this.startingPoint.nodeIdx);
    } else {
      buf.push(0);
    }

    buf.push(this.transitions.index);
    buf.push(this.reduceActions.index);
    buf.push(this.epsilonReduceActions.index);

    if (this.recursiveShift) {
      buf.push(this.recursiveShift.toState.index);
      buf.push(this.recursiveShift.shiftIndex);
    } else {
      buf.push(0);
      buf.push(0);
    }
  }


  deser(index: number, buf: number[], pos: number): number {

    var [isrl, sndx, trind, rdind, emprdind, rsi, shi] = buf;
    pos = 7;

    this.isRule = isrl === 1;
    this.index = index;
    this.startingPoint = sndx ? SerDeser.nodeTable[sndx] as PRef : null;

    this._transitions = Analysis.leafStateTransitionTables[trind];
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    this.epsilonReduceActions = Analysis.leafStateReduceTables[emprdind];

    if (rsi) {
      var state = Analysis.leafState(rsi);
      this.recursiveShift = new RTShift(shi, state);
    }

    return pos;
  }

}

export enum TraversionItemKind {
  RULE, DEFERRED_RULE, REPEAT, OPTIONAL, TERMINAL, NODE_START, NODE_END, CHILD_SEPARATOR, NEGATE
}
export class TraversionControl {
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

export enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_SEQUENCE_THEN
}

export enum TraversionItemActionKind {
  OMIT_SUBTREE, STEP_PURPOSE, RESET_POSITION,
  STOP, CONTINUE/*default*/
}

export class TraversionCache {

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


export class LinearTraversion {

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


    Traversing.start(this, rule);
    this.createRecursively();
    Traversing.finish();
  }

  private createRecursively() {

    const item = Traversing.item;

    // each one located beneath start rule and its copied CopiedRuleTraverser s,
    // is traversable,
    // the rest which created for linked rules, and/or in parser.getReferencedRule, 
    // is not traversable
    if (!item.top.parent && item.top !== this.parser.startingStateNode.rule) {
      throw new Error("This how : " + item + "  in:" + this);
    }


    if (item.traversionGeneratorEnter(this)) {

      //if (recursionCacheStack.indent.length<30) {
      //   console.log("createRecursively"+newRecursionStack.indent+item);
      //}
      this.pushDefaultPrefixControllerItems(item);
      item.pushPrefixControllerItem(this);

      var i = 0;
      var previousChild = null;

      Traversing.recursionCacheStack.upwardBranchCnt *= item.children.length;

      item.children.forEach(child => {
        //console.log("iterate "+i+"."+newRecursionStack.indent+child);

        var separator: TraversionControl;
        if (i > 0) {
          separator = new TraversionControl(this, TraversionItemKind.CHILD_SEPARATOR, item);
          separator.child = child;
          separator.previousChild = previousChild;
          this.pushControl(separator);
        }

        Traversing.push(child);
        this.createRecursively();
        Traversing.pop();

        if (separator) {
          separator.toPosition = this.length;
        }
        previousChild = child;
        i++;
      });

      item.pushPostfixControllerItem(this);
      this.pushDefaultPostfixControllerItems(item);

      item.traversionGeneratorExited(this);
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

