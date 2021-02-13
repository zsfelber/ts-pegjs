import { EntryPointTraverser, Factory, PNodeKind, RefTraverser, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, PNode, PRef, PLogicNode } from './parsers';
import { CodeTblToHex, HyperG } from './index';
import { GrammarParsingLeafState, GrammarParsingLeafStateTransitions, GrammarParsingLeafStateReduces, LinearTraversion, TraversionPurpose, ParseTable } from './analyzer-rt';


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

  class Backup {

    ERRORS = 0;
    deferredRules = [];
    localDeferredRules = [];
    leafStates: GrammarParsingLeafState[] = [];
    leafStateTransitionTables: GrammarParsingLeafStateTransitions[] = [];
    leafStateReduceTables: GrammarParsingLeafStateReduces[] = [];
    maxTokenId: number;
    totalStates = 0;
    serializedTransitions: {[index: string]:GrammarParsingLeafStateTransitions} = {};
    serializedReduces: {[index: string]:GrammarParsingLeafStateReduces} = {};
    serializedTuples: {[index: string]:[number,number,number]} = {};
  
    load() {
      this.ERRORS = ERRORS;
      this.deferredRules = deferredRules;
      this.localDeferredRules = localDeferredRules;
      this.leafStates = leafStates;
      this.leafStateTransitionTables = leafStateTransitionTables;
      this.leafStateReduceTables = leafStateReduceTables;
      this.maxTokenId = maxTokenId;
      this.totalStates = totalStates;
      this.serializedTransitions = serializedTransitions;
      this.serializedReduces = serializedReduces;
      this.serializedTuples = serializedTuples;
  
    }
    save() {
      ERRORS = this.ERRORS;
      deferredRules = this.deferredRules;
      localDeferredRules = this.localDeferredRules;
      leafStates = this.leafStates;
      leafStateTransitionTables = this.leafStateTransitionTables;
      leafStateReduceTables = this.leafStateReduceTables;
      maxTokenId = this.maxTokenId;
      totalStates = this.totalStates;
      serializedTransitions = this.serializedTransitions;
      serializedReduces = this.serializedReduces;
      serializedTuples = this.serializedTuples;
  
    }
  }
  


  export var ERRORS = 0;

  export var deferredRules = [];

  export var localDeferredRules = [];

  export var leafStates: GrammarParsingLeafState[] = [];

  export var leafStateTransitionTables: GrammarParsingLeafStateTransitions[] = [];

  export var leafStateReduceTables: GrammarParsingLeafStateReduces[] = [];

  export var maxTokenId: number;

  export var totalStates = 0;

  export const uniformMaxStateId = 0xe000;

  export var serializedTransitions: {[index: string]:GrammarParsingLeafStateTransitions} = {};

  export var serializedReduces: {[index: string]:GrammarParsingLeafStateReduces} = {};

  export var serializedTuples: {[index: string]:[number,number,number]} = {};

  export function backup() {
    var backup = new Backup();
    backup.load();
    return backup;
  }

  export function init() {
    var emptyBackup = new Backup();
    emptyBackup.save();
    return emptyBackup;
  }

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
    strans.sort((a,b)=>{
      return a.index-b.index;
    });
    sreds.sort((a,b)=>{
      return a.index-b.index;
    });

    buf.push(strans.length);
    buf.push(sreds.length);

    strans.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
    });
    sreds.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
    });
  }

  export function readAllSerializedTables(buf: number[]): number {

    var pos = 0;
    var [stransln,sredsln] = [buf[pos++], buf[pos++]];

    for (var i=0; i<stransln; i++) {
      var trans = new GrammarParsingLeafStateTransitions();
      trans.index = i;
      // TODO Not working now just testing Gener~.pack()
      pos = trans.deser(0, buf, pos);
      leafStateTransitionTables.push(trans);
    }
    for (var i=0; i<sredsln; i++) {
      var red = new GrammarParsingLeafStateReduces();
      red.index = i;
      pos = red.deser(buf, pos);
      leafStateReduceTables.push(red);
    }
    if (pos !== buf.length) {
      throw new Error("pos !== buf.length  "+pos+" !== "+buf.length);
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

/*class StateNode {

}*/

export abstract class StateNode {

  index: number;

  // of state transitions starting from here
  // includes
  // Regular SHIFTs
  // SHIFT_RECURSIVEs
  // Regular REDUCEs 
  // Epsilon REDUCEs
  readonly shiftsAndReduces: ShiftReduce[] = [];

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

  generateState() {
    var state = Analysis.leafState(this.index);
    if (!state.startStateNode) {
      state.startStateNode = this;
      state.startingPoint = this.ref.node;
      state.index = this.index;
    }
    return state;
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


}

export class JumpIntoSubroutineLeafStateNode extends LeafStateNode {

  ref: RuleRefTraverser;

  constructor(ref: RuleRefTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return true;
  }

}


export class ShiftReduce {
  kind: ShiftReduceKind;

  item: RuleElementTraverser;

  intoRule?: JumpIntoSubroutineLeafStateNode;
}

export class Shifts extends ShiftReduce {
  item: RefTraverser;
}

export class Shift extends Shifts {

  kind = ShiftReduceKind.SHIFT;

  item: TerminalRefTraverser;
}

export class ShiftRecursive extends Shifts {

  kind = ShiftReduceKind.SHIFT_RECURSIVE;

  item: RuleRefTraverser;
}

export class Reduce extends ShiftReduce {

  kind = ShiftReduceKind.REDUCE;

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
    console.log("Parse table for   starting rule:" + rule.rule + "  entry points(nonterminals):" + Object.keys(this.entryPoints).length + "  all nodes:" + mainEntryPoint.allNodes.length +"  all rule refs:"+cntrules+ "  L1 rule refs:" + mainEntryPoint.allRuleReferences.length + "  L1 terminal refs:" + mainEntryPoint.allTerminalReferences.length + "  tokens:" + Analysis.maxTokenId + "   states:" + (1+this.allLeafStateNodes.length));

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
