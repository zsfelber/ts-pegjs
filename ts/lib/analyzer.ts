import { EntryPointTraverser, Factory, PNodeKind, RefTraverser, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, PNode, PRef, PLogicNode } from './parsers';
import { CodeTblToHex, HyperG, IncVariator, distinct } from './index';
import { GrammarParsingLeafState, GrammarParsingLeafStateTransitions, GrammarParsingLeafStateReduces, ParseTable, GrammarParsingLeafStateCommon } from './analyzer-rt';
import { LinearTraversion, TraversionPurpose } from './analyzer-tra';
import { ChoiceTraverser } from './analyzer-nodes';


export const FAIL_STATE = 0;

export const START_STATE = 1;

//export const CNT_HUB_LEVELS = 5;
//export const LEV_CNT_LN_RULE = 500;
//export const LEV_CNT_BRANCH_NODES = 500;

// NOTE case cut off currently
export const CNT_HUB_LEVELS = 1;
export const LEV_CNT_LN_RULE = 50000;
export const LEV_CNT_BRANCH_NODES = 50000;


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
    leafStateCommons: GrammarParsingLeafStateCommon[] = [];
    leafStateTransitionTables: GrammarParsingLeafStateTransitions[] = [];
    leafStateReduceTables: GrammarParsingLeafStateReduces[] = [];
    choiceTokens: PValueNode[] = [];
    maxTokenId: number;
    totalStates = 0;
    cntChoiceTknIds = -1;
    serializedLeafStates: {[index: string]:GrammarParsingLeafState} = {};
    serializedStateCommons: {[index: string]:GrammarParsingLeafStateCommon} = {};
    serializedTransitions: {[index: string]:GrammarParsingLeafStateTransitions} = {};
    serializedReduces: {[index: string]:GrammarParsingLeafStateReduces} = {};
    stack: Backup[] = [];
    serializedStateCommonsCnt = 1;
    parseTableGens: StrMapLike<ParseTableGenerator> = {};
    parseTables: StrMapLike<ParseTable> = {};
    varShs = new IncVariator();
    varShReqs = new IncVariator();
    varTkns = new IncVariator();
    varRds = new IncVariator();
  

    load() {
      this.ERRORS = ERRORS;
      this.deferredRules = [].concat(deferredRules);
      this.localDeferredRules = [].concat(localDeferredRules);
      this.leafStateCommons = [].concat(leafStateCommons);
      this.leafStateTransitionTables = [].concat(leafStateTransitionTables);
      this.leafStateReduceTables = [].concat(leafStateReduceTables);
      this.choiceTokens = [].concat(choiceTokens);
      this.maxTokenId = maxTokenId;
      this.totalStates = totalStates;
      this.cntChoiceTknIds = cntChoiceTknIds;
      this.serializedLeafStates = Object.assign({}, serializedLeafStates);
      this.serializedStateCommons = Object.assign({}, serializedStateCommons);
      this.serializedTransitions = Object.assign({}, serializedTransitions);
      this.serializedReduces = Object.assign({}, serializedReduces);
      this.stack = [].concat(stack);
      this.serializedStateCommonsCnt = serializedStateCommonsCnt;
      this.parseTableGens = Object.assign({}, parseTableGens);
      this.parseTables = Object.assign({}, parseTables);
      this.varShs = new IncVariator(varShs);
      this.varShReqs = new IncVariator(varShReqs);
      this.varTkns = new IncVariator(varTkns);
      this.varRds = new IncVariator(varRds);
    
    }
    save() {
      ERRORS = this.ERRORS;
      deferredRules = this.deferredRules;
      localDeferredRules = this.localDeferredRules;
      leafStateCommons = this.leafStateCommons;
      leafStateTransitionTables = this.leafStateTransitionTables;
      leafStateReduceTables = this.leafStateReduceTables;
      choiceTokens = this.choiceTokens;
      maxTokenId = this.maxTokenId;
      totalStates = this.totalStates;
      cntChoiceTknIds = this.cntChoiceTknIds;
      serializedLeafStates = this.serializedLeafStates;
      serializedStateCommons = this.serializedStateCommons;
      serializedTransitions = this.serializedTransitions;
      serializedReduces = this.serializedReduces;
      stack = this.stack;
      serializedStateCommonsCnt = this.serializedStateCommonsCnt;
      parseTableGens = this.parseTableGens;
      parseTables = this.parseTables;
      varShs = this.varShs;
      varShReqs = this.varShReqs;
      varTkns = this.varTkns;
      varRds = this.varRds;
    }
  }
  


  export var ERRORS = 0;

  export var deferredRules = [];

  export var localDeferredRules = [];

  export var leafStates: GrammarParsingLeafState[] = [];

  export var leafStateCommons: GrammarParsingLeafStateCommon[] = [];

  export var leafStateTransitionTables: GrammarParsingLeafStateTransitions[] = [];

  export var leafStateReduceTables: GrammarParsingLeafStateReduces[] = [];

  export var choiceTokens: PValueNode[] = [];

  export var maxTokenId: number;

  export var totalStates = 0;
  
  export var cntChoiceTknIds = -1;

  export const uniformMaxStateId = 0xe000;

  export var serializedLeafStates: {[index: string]:GrammarParsingLeafState} = {};

  export var serializedStateCommons: {[index: string]:GrammarParsingLeafStateCommon} = {};

  export var serializedTransitions: {[index: string]:GrammarParsingLeafStateTransitions} = {};

  export var serializedReduces: {[index: string]:GrammarParsingLeafStateReduces} = {};

  export var stack: Backup[] = [];

  export var serializedStateCommonsCnt = 1;

  export var parseTableGens: StrMapLike<ParseTableGenerator> = {};
  export var parseTables: StrMapLike<ParseTable> = {};

  export var varShs = new IncVariator();
  export var varShReqs = new IncVariator();
  export var varTkns = new IncVariator();
  export var varRds = new IncVariator();
  
  export function backup() {
    var backup = new Backup();
    backup.load();
    return backup;
  }

  export function empty() {
    var emptyBackup = new Backup();
    return emptyBackup;
  }

  export function parseTable(rule: PRule, g?: ParseTableGenerator) {
    var parseTable: ParseTable = parseTables[rule.rule];
    if (!parseTable) {
      parseTable = new ParseTable(rule, g);
      parseTables[rule.rule] = parseTable;
    }
    return parseTable;
  }

  export function leafState(parseTable: ParseTable, index: number, packedIdx: number) {
    if (!index) return null;
    var ls = leafStates[packedIdx];
    if (ls) {
      if (ls.packedIndex !== packedIdx) {
        throw new Error("ls.packedIndex !== index   "+ls.packedIndex+" !== "+packedIdx);
      }
    } else {
      leafStates[packedIdx] = ls = new GrammarParsingLeafState();
      ls.packedIndex = packedIdx;
      ls.index = index;
    }
    parseTable.allStates[index] = ls;
    return ls;
  }

  export function leafStateCommon(parseTable: ParseTable, index: number) {
    if (!index) return null;
    var ls = leafStateCommons[index];
    if (ls) {
      if (ls.index !== index) {
        throw new Error("ls.index !== index   "+ls.index+" !== "+index);
      }
    } else {
      leafStateCommons[index] = ls = new GrammarParsingLeafStateCommon();
      ls.index = index;
    }
    parseTable.myCommons[index] = ls;
    return ls;
  }

  export function writeAllSerializedTables(buf: number[]) {
    var strans0 = Object.values(serializedTransitions);
    var sreds0 = Object.values(serializedReduces);
    var scmn0 = Object.values(serializedStateCommons);
    var slf0 = Object.values(serializedLeafStates);
    var strans = distinct(strans0, (a,b)=>{
      return a.index-b.index;
    });
    var sreds = distinct(sreds0, (a,b)=>{
      return a.index-b.index;
    });
    var scmn = distinct(scmn0, (a,b)=>{
      return a.packedIndex-b.packedIndex;
    });
    var slf = distinct(slf0, (a,b)=>{
      return a.packedIndex-b.packedIndex;
    });
    if (strans.length !== strans0.length) {

    }

    buf.push(strans.length);
    buf.push(sreds.length);
    buf.push(scmn.length);
    buf.push(slf.length);
    buf.push(choiceTokens.length);

    var i = 1;
    strans.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
      if (s.index !== i) {
        throw new Error("s.index !== i   "+s.index+" !== "+i);
      }
      i++;
    });
    var i = 1;
    sreds.forEach(s=>{
      s.alreadySerialized.forEach(num=>buf.push(num));
      if (s.index !== i) {
        throw new Error("s.index !== i   "+s.index+" !== "+i);
      }
      i++;
    });
    var i = 1;
    scmn.forEach(s=>{
      s.serializedTuple.forEach(num=>buf.push(num));
      if (s.packedIndex !== i) {
        throw new Error("s.index !== i   "+s.packedIndex+" !== "+i);
      }
      i++;
    });
    var i = 1;
    slf.forEach(s=>{
      s.serializedTuple.forEach(num=>buf.push(num));
      if (s.packedIndex !== i) {
        throw new Error("s.index !== i   "+s.index+" !== "+i);
      }
      i++;
    });
    for (var i = 1; i < choiceTokens.length; i++) {
      buf.push(choiceTokens[i].nodeIdx);
    }
  }

  export function readAllSerializedTables(buf: number[]): number {

    var pos = 0;
    var [stransln,sredsln,scmnln,slfln,ctks] = [buf[pos++], buf[pos++], buf[pos++], buf[pos++], buf[pos++]];

    leafStateTransitionTables.push(null);
    leafStateReduceTables.push(null);
    leafStateCommons.push(null);
    leafStates.push(null);
    choiceTokens.push(null);
    for (var i=1; i<=stransln; i++) {
      var trans = new GrammarParsingLeafStateTransitions();
      pos = trans.deser(i, buf, pos);
      leafStateTransitionTables.push(trans);
    }
    for (var i=1; i<=sredsln; i++) {
      var red = new GrammarParsingLeafStateReduces();
      pos = red.deser(i, buf, pos);
      leafStateReduceTables.push(red);
    }
    for (var i=1; i<=scmnln; i++) {
      var cmn = new GrammarParsingLeafStateCommon();
      pos = cmn.deser(i, buf, pos);
      leafStateCommons.push(cmn);
    }
    for (var i=1; i<=slfln; i++) {
      var lf = new GrammarParsingLeafState();
      pos = lf.deser(i, buf, pos);
      leafStates.push(lf);
    }
    for (var i=1; i<=ctks; i++) {
      var ndx = buf[pos++];
      var ctk = HyperG.nodeTable[ndx];
      choiceTokens[i] = ctk;
    }
    if (pos !== buf.length) {
      throw new Error("pos !== buf.length  "+pos+" !== "+buf.length);
    }
    return pos;
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

export abstract class StateNodeCommon {

  parseTable: ParseTableGenerator;
  index: number;

  // of state transitions starting from here
  // includes
  // Regular SHIFTs
  // SHIFT_RECURSIVEs
  // Regular REDUCEs 
  // Epsilon REDUCEs
  readonly shiftsAndReduces: ShiftReduce[] = [];

  constructor(parseTable: ParseTableGenerator) {
    this.parseTable = parseTable;
    this.index = Analysis.serializedStateCommonsCnt++;
    parseTable.allLeafStateCommons[this.index] = this;
  }

  generateState(parseTable: ParseTable) {
    var state = Analysis.leafStateCommon(parseTable, this.index);
    if (!state.startStateNode) {
      state.startStateNode = this;
      state.index = this.index;
    }
    return state;
  }

  toString() {
    return "C#" + this.index + "->" + ("->" + this.shiftsAndReduces.length + "s/r");
  }
}


class RootStateNodeCommon extends StateNodeCommon {

  toString() {
    return "start C#" + this.index + ("->" + this.shiftsAndReduces.length);
  }
}

export class LeafStateNodeCommon extends StateNodeCommon {

}

export abstract class StateNodeWithPrefix {

  common: StateNodeCommon;

  index: number;

  ref?: RefTraverser|ChoiceTraverser;

  constructor() {
  }

  readonly reduces: Reduce[] = [];

  abstract get traverser(): RuleElementTraverser;

 
  generateState(parseTable: ParseTable) {
    var state = parseTable.leafState(this.index);
    if (!state.startStateNode) {
      state.startStateNode = this;
      state.startingPoint = this.ref ? this.ref.node : null;
      state.lazyCommon(parseTable);
    }
    return state;
  }

}



class RootStateNodeWithPrefix extends StateNodeWithPrefix {

  rule: EntryPointTraverser;

  common: RootStateNodeCommon;

  constructor(rule: EntryPointTraverser) {
    super();
    this.rule = rule;
    this.common = new RootStateNodeCommon(rule.parser);
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

  toString() {
    return "start C#" + this.index + "->" + this.traverser + ("->C#" + this.common.index);
  }
}


export abstract class LeafStateNodeWithPrefix extends StateNodeWithPrefix {

  common: LeafStateNodeCommon;

  ref: RefTraverser|ChoiceTraverser;

  constructor(ref: RefTraverser|ChoiceTraverser) {
    super();
    this.ref = ref;
  }

  get traverser(): RuleElementTraverser {
    return this.ref;
  }

  
  generateTransitions(parser: ParseTableGenerator, rootTraversion: LinearTraversion) {

    rootTraversion.traverse(this, TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN,
      [TraversionPurpose.FIND_NEXT_TOKENS], this.ref.traverserPosition);

    this.index = parser.cntStates;
    parser.cntStates++;
  }

  abstract get isRule(): boolean;

  toString() {
    return "LeafSN#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->C#" + this.common.index);
  }

}

export class TraversedLeafStateNode extends LeafStateNodeWithPrefix {

  ref: TerminalRefTraverser|ChoiceTraverser;

  constructor(ref: TerminalRefTraverser|ChoiceTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return false;
  }


}


export class TerminalChoiceLeafStateNode extends LeafStateNodeWithPrefix {

  ref: ChoiceTraverser;

  constructor(ref: ChoiceTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return false;
  }


}

export class JumpIntoSubroutineLeafStateNode extends LeafStateNodeWithPrefix {

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
  item: (RefTraverser|ChoiceTraverser);
}

export class Shift extends Shifts {

  kind = ShiftReduceKind.SHIFT;

  item: (TerminalRefTraverser|ChoiceTraverser);
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

  startingStateNode: RootStateNodeWithPrefix;

  newRuleReferences: RuleRefTraverser[] = [];

  // the state nodes 
  allLeafStateNodes: LeafStateNodeWithPrefix[] = [];
  allLeafStateCommons: LeafStateNodeCommon[] = [];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
  jumperStates: NumMapLike<number> = [];

  // 1 based index
  cntStates = 1;
  
  static createForRule(rule: PRule) {
    var parseTable: ParseTableGenerator = Analysis.parseTableGens[rule.rule];
    if (!parseTable) {
      parseTable = new ParseTableGenerator(rule);
      Analysis.parseTableGens[rule.rule] = parseTable;
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
      newRefs.forEach(ruleRef => ruleRef.lazyBuildMonoRefTree());
    }
    //console.log("Loaded "+cntrules+" rules.");

    this.startingStateNode = new RootStateNodeWithPrefix(mainEntryPoint);

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

}





