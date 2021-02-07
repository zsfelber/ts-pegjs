import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser, PNode, PRef } from './parsers';

interface StrMapLike<V> {
  [index: number]: V;
}
interface NumMapLike<V> {
  [index: number]: V;
}

export namespace Analysis {

  export var ERRORS = 0;

  export var ruleTable: PRule[];

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
        return new EntryPointTraverser(parser, parent, node as PRule);

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

  readonly shiftesAndReduces: ShiftReduce[] = [];

  abstract generateTransitions(parser: ParseTableGenerator, previous: StateNode, rootTraversion: LinearTraversion);


  abstract generateState(): GrammarParsingLeafState;


  abstract get isRule(): boolean;

  abstract get traverser(): RuleElementTraverser;

  toString() {
    return "SH#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftesAndReduces.length+"s/r");
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

  generateTransitions(parser: ParseTableGenerator, previous: StateNode, rootTraversion: LinearTraversion) {
    if (parser.cntStates !== 1) throw new Error("?? staring state not the first : " + parser.cntStates);

    rootTraversion.traverse(this, previous, TraversionPurpose.FIND_NEXT_TOKENS);
    this.index = 1;
    parser.cntStates = 2;
  }

  generateState() {
    var result: GrammarParsingLeafState = new GrammarParsingLeafState(this, null);
    return result;
  }

  toString() {
    return "start#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftesAndReduces.length);
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

  generateTransitions(parser: ParseTableGenerator, previous: StateNode, rootTraversion: LinearTraversion) {

    var ts = this.ref.traverserStep;
    if (!ts || ts.parent !== rootTraversion) throw new Error("bad traversion params " + this+"  traverserStep:"+ts);

    rootTraversion.traverse(this, previous, TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN,
      [TraversionPurpose.FIND_NEXT_TOKENS], ts.toPosition);

    this.index = parser.cntStates;
    parser.cntStates++;
  }

  generateState() {
    var result: GrammarParsingLeafState = new GrammarParsingLeafState(this, this.ref.node);
    return result;
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

}

class JumpIntoSubroutineLeafStateNode extends LeafStateNode {

  ref: RuleRefTraverser;

  constructor(ref: RuleRefTraverser) {
    super(ref);
  }

  get isRule(): boolean {
    return true;
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

  startRuleDependencies: StrMapLike<PRuleRef> = [];
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

    this.rule = rule;
    var mainEntryPoint = new EntryPointTraverser(this, null, rule);
    this.entryPoints[rule.rule] = mainEntryPoint;

    // loads all :)
    while (this.allRuleReferences.some(ruleRef => ruleRef.lazyCouldGenerateNew()));

    this.startingStateNode = new RootStateNode(mainEntryPoint);

    this.theTraversion = new LinearTraversion(mainEntryPoint);

    this.startingStateNode.generateTransitions(this, null, this.theTraversion);


    // This simple loop generates all possible state transitions at once:

    // NOTE
    // each state handles the jumped-through REDUCE actions as well
    // so simply these always must be made sequentially

    this.allLeafStateNodes.forEach(state => {
      state.generateTransitions(this, state, this.theTraversion);
    });

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
    console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.entryPoints).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   state nodes:" + this.allLeafStateNodes.length + "  states:" + this.allLeafStateNodes.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);

  }

  getReferencedRule(node: PRule) {
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

  readonly maxTokenId: number;
  readonly rule: PRule;
  readonly startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];

  constructor(maxTokenId: number, rule: PRule, startingState: GrammarParsingLeafState, allStates: GrammarParsingLeafState[]) {
    this.maxTokenId = maxTokenId;
    this.rule = rule;
    this.startingState = startingState;
    this.allStates = allStates
  }

  static deserialize(code: number[]) {
    //SerDeser.ruleTable

  }

  ser(): number[] {
    var serStates: number[] = [];
    var maxIdx = 0;
    this.allStates.forEach(s => {
      var ind = s.ser(this.maxTokenId, serStates);
      if (ind > maxIdx) maxIdx = maxIdx;
    });
    if (this.allStates.length > maxIdx) maxIdx = this.allStates.length;

    var result = [this.allStates.length, this.maxTokenId, maxIdx].concat(serStates);
    return result;
  }

}

export class GrammarParsingLeafState {

  readonly isRule: boolean;
  readonly index: number;

  readonly startingPoint: PRef;
  private startState: StateNode;

  // tokenId -> traversion state
  private _transitions: NumMapLike<GrammarParsingLeafState>;
  readonly epsilonReduceActions: PNode[];
  readonly reduceActions: PNode[];

  constructor(startState: StateNode, startingPoint: PRef) {
    this.isRule = startState.isRule;
    this.index = startState.index;
    this.startState = startState;
    this.startingPoint = startingPoint;
    //result.jumpToRule = g.jumpToRule;
    //result.jumpToRuleTokenId = g.jumpToRuleTokenId;
    //result.actionNodeId = g.actionNodeId;
  }

  get transitions(): NumMapLike<GrammarParsingLeafState> {
    if (!this._transitions) {
      this._transitions = {};
      this.startState.shiftesAndReduces.forEach(nextTerm => {
        switch (nextTerm.kind) {
          case ShiftReduceKind.SHIFT:
          case ShiftReduceKind.SHIFT_RECURSIVE:
            var s = nextTerm as Shift;
            if (!this._transitions[s.item.node.value]) {
              //nextTerm.
              this._transitions[s.item.node.value] = s.item.stateNode.generateState();
            }
            break;
          case ShiftReduceKind.REDUCE:
          case ShiftReduceKind.REDUCE_RECURSIVE:
            var r = nextTerm as Reduce;
            if (r.isEpsilonReduce)
              this.epsilonReduceActions.push(r.item.node);
            else
              this.reduceActions.push(r.item.node);
            break;
        }
      });

    }
    return this._transitions;
  }

  ser(maxTknId: number, buf: number[]): number {
    var toTknIds: number[] = [];
    toTknIds[maxTknId] = 0;
    toTknIds.fill(0, 0, maxTknId);

    var es = Object.entries(this.transitions);
    es.forEach(([key, trans]: [string, GrammarParsingLeafState]) => {
      var tokenId = Number(key);
      toTknIds[tokenId] = trans.index;
    });

    var maxIdx = 0;
    var reduce: number[] = [];
    this.reduceActions.forEach(r => {
      reduce.push(r.nodeIdx);
      if (r.nodeIdx > maxIdx) maxIdx = r.nodeIdx;
    });
    var ereduce: number[] = [];
    this.epsilonReduceActions.forEach(r => {
      ereduce.push(r.nodeIdx);
      if (r.nodeIdx > maxIdx) maxIdx = r.nodeIdx;
    });

    buf.push(this.isRule ? 1 : 0);
    buf.push(this.startingPoint.nodeIdx);
    if (this.startingPoint.nodeIdx > maxIdx) maxIdx = this.startingPoint.nodeIdx;
    buf.push(reduce.length);
    buf.push(ereduce.length);
    buf.push.apply(buf, toTknIds);
    buf.push.apply(buf, reduce);
    buf.push.apply(buf, ereduce);

    return maxIdx;
  }

}

enum TraversionItemKind {
  RULE, RECURSIVE_RULE, REPEAT, OPTIONAL, TERMINAL, NODE_START, NODE_END, CHILD_SEPARATOR, NEGATE
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
      case TraversionItemKind.RECURSIVE_RULE:
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
  readonly previous: StateNode;

  constructor(intoState: StateNode, previous: StateNode) {
    this.intoState = intoState;
    this.previous = previous;
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

interface RecursiveRuleDef {
  itemGeneratedForStarterNode?: boolean;
  linkedRuleEntry: EntryPointTraverser;
  ownRuleEntry: EntryPointTraverser;
  collectedFromIndex: number;
  collectedToIndex?: number;
  shiftReducesBeforeRecursion: ShiftReduce[];
  toString:Function
};
interface TraversionMakerCache extends StrMapLike<RuleElementTraverser> {
  indent: string;
}

class LinearTraversion {

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

  constructor(rule: EntryPointTraverser) {
    this.rule = rule;
    this.traversionControls = [];

    var recursionCacheStack = { indent: ""};
    var rule0Def:RecursiveRuleDef = {
      itemGeneratedForStarterNode: true, linkedRuleEntry: rule,
      ownRuleEntry: rule, collectedFromIndex: 0,
      shiftReducesBeforeRecursion: [],
      toString:function() {return "entryruledef:"+rule;}
    };
    recursionCacheStack["rule_ref#" + rule.node.nodeIdx] = rule0Def;

    this.createRecursively(null, rule, recursionCacheStack);
  }

  private createRecursively(parent: RuleElementTraverser, item: RuleElementTraverser, recursionCacheStack: TraversionMakerCache) {

    var newRecursionStack = {indent:recursionCacheStack.indent+"  "};
    Object.setPrototypeOf(newRecursionStack, recursionCacheStack);

    if (item.traversionGeneratorEnter(this, newRecursionStack)) {

      this.pushDefaultPrefixControllerItems(item);
      item.pushPrefixControllerItem(this);

      var first = 1;
      var previousChild = null;
      item.children.forEach(child => {
        var separator: TraversionControl;
        if (first) {
          first = 0;
        } else {
          separator = new TraversionControl(this, TraversionItemKind.CHILD_SEPARATOR, item);
          separator.child = child;
          separator.previousChild = previousChild;
          this.pushControl(separator);
        }

        this.createRecursively(item, child, newRecursionStack);

        if (separator) {
          separator.toPosition = this.length;
        }
        previousChild = child;

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

  traverse(intoState: StateNode, previous: StateNode, initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition = 0): TraversionCache {
    var t = this as any;
    t.purpose = initialPurpose;
    t.purposeThen = purposeThen ? purposeThen : [];
    var cache = new TraversionCache(intoState, previous);

    if (startPosition >= this.traversionControls.length) {
      this.stopped = true;
    }
    for (this.position = startPosition; !this.stopped;) {
      this.positionBeforeStep = this.position;
      var item = this.traversionControls[this.position];

      if (item) {

        item.item.traversionActions(this, item, cache);

        this.defaultActions(item, cache, intoState, previous);
  
        if (this.position >= this.traversionControls.length) {
          this.stopped = true;
        }
      } else {
        throw new Error("Missing item at position : "+this);
      }
    }
    return cache;
  }

  defaultActions(step: TraversionControl, cache: TraversionCache, intoState: StateNode, previous: StateNode) {
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
            cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftesAndReduces.length;
            break;
        }
        break;

      case TraversionItemKind.NODE_END:
        switch (this.purpose) {
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            if (intoState.shiftesAndReduces.length) {
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
              previous.shiftesAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: false });
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
            if (cache.nodeLocal(step.item).shiftReducesAtStart === intoState.shiftesAndReduces.length) {
              intoState.shiftesAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: true });
              cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftesAndReduces.length;
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
    return "Traversing" + this.rule + "/" + TraversionPurpose[this.purpose] + "/" + this.position;
  }
}


abstract class RuleElementTraverser {

  readonly nodeTravId: number;
  readonly constructionLevel: number;
  readonly parser: ParseTableGenerator;
  readonly parent: RuleElementTraverser;
  readonly node: PNode;
  readonly children: RuleElementTraverser[] = [];
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    this.parent = parent;
    this.parser = parser;
    this.nodeTravId = parser.nodeTravIds++;
    this.node = node;
    this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
    this.parser.allNodes[this.nodeTravId] = this;

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


}

// node.optionalNode == false 

class OneOrMoreTraverser extends OrMoreTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.child.optionalBranch;
  }

}

class RefTraverser extends EmptyTraverser {

  child: RuleElementTraverser;

  node: PRef;

  traverserStep: TraversionControl;

  stateNode: LeafStateNode;

}

class RuleRefTraverser extends RefTraverser implements RecursiveRuleDef {

  node: PRuleRef;
  recursiveRuleOriginal: RecursiveRuleDef;
  collectedFromIndex: number;
  collectedToIndex: number;

  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;
  ownRuleEntry: EntryPointTraverser;

  shiftReducesBeforeRecursion: ShiftReduce[];
  stateNode: JumpIntoSubroutineLeafStateNode;

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
      this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
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

    this.recursiveRuleOriginal = recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];

    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    if (this.recursiveRuleOriginal) {
      console.log("peek rule_ref#" + this.targetRule.nodeIdx + recursionCacheStack.indent+" "+this.recursiveRuleOriginal);

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RECURSIVE_RULE, this);
      inTraversion.pushControl(this.traverserStep);

      return false;
    } else {

      recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;
      console.log("push rule_ref#" + this.targetRule.nodeIdx + recursionCacheStack.indent+" "+this);

      this.ownRuleEntry = new EntryPointTraverser(this.parser, this, this.targetRule);
      this.child = this.ownRuleEntry;
      this.children.push(this.ownRuleEntry);

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RULE, this);
      inTraversion.pushControl(this.traverserStep);

      return true;
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {

    const r = this.recursiveRuleOriginal;

    switch (inTraversion.purpose) {

      case TraversionPurpose.FIND_NEXT_TOKENS:
        switch (step.kind) {
          case TraversionItemKind.RECURSIVE_RULE:
            if (!r) throw new Error("no original one of RECURSIVE_RULE : " + this);

            if (r.shiftReducesBeforeRecursion) {
              // NOTE it means subsequent recursions' case theoretically
              // ...              
            } else {
              r.collectedToIndex = cache.intoState.shiftesAndReduces.length;
              r.shiftReducesBeforeRecursion =
                cache.intoState.shiftesAndReduces.slice(r.collectedFromIndex, r.collectedToIndex);
            }

            if (this.stateNode) {
              throw new Error("There's a stateNode already : " + this + " stateNode:" + this.stateNode);
            }
            this.stateNode = new JumpIntoSubroutineLeafStateNode(this);
            this.parser.allLeafStateNodes.push(this.stateNode);

            // for transitions jumping to a recursive section,
            // generating a state which mapped to a sub - Starting- Rule- ParseTable :
            r.shiftReducesBeforeRecursion.forEach(infiniteItem => {
              switch (infiniteItem.kind) {

                case ShiftReduceKind.SHIFT:
                  var normJump = infiniteItem as Shift;

                  cache.intoState.shiftesAndReduces.push({
                    kind: ShiftReduceKind.SHIFT_RECURSIVE,
                    item: normJump.item, intoRule: this.stateNode
                  });
                  break;

                case ShiftReduceKind.REDUCE:
                  var normReduce = infiniteItem as Reduce;

                  cache.intoState.shiftesAndReduces.push({
                    kind: ShiftReduceKind.REDUCE_RECURSIVE,
                    item: normReduce.item, isEpsilonReduce: normReduce.isEpsilonReduce
                  });
                  break;
                default:
                  // NOTE simply omit subsequent recursions, it could never produce
                  // next tokens here
                  break;
              }

            });
            // maybe this start rule has not existed, should be generated now :
            this.parser.startRuleDependencies[this.node.rule] = this.node;

            break;
          case TraversionItemKind.RULE:
            if (r) throw new Error("State error, it should be recursive or non-recursive :" + this + "  original???:" + r);

            this.collectedFromIndex = cache.intoState.shiftesAndReduces.length;

            break;
          case TraversionItemKind.NODE_START:
          case TraversionItemKind.NODE_END:
            break;

          default:
            throw new Error("Bad item : " + step);
        }

        break;
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
}


class TerminalRefTraverser extends RefTraverser {

  node: PTerminalRef;

  stateNode: TraversedLeafStateNode;


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminalReferences.push(this);
    this.stateNode = new TraversedLeafStateNode(this);
    parser.allLeafStateNodes.push(this.stateNode);
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
    this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
    inTraversion.pushControl(this.traverserStep);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    this.traverserStep = null;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.TERMINAL:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            cache.intoState.shiftesAndReduces.push({ kind: ShiftReduceKind.SHIFT, item: this });
            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            break;
        }
        break;
      default:
    }
  }
}


export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRule) {
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
      console.error("No parser.node.action or .action.fun   " + this.node);
      dirty = 1;
    }
    return dirty;
  }

}


class SemanticAndTraverser extends SemanticTraverser {

}


class SemanticNotTraverser extends SemanticTraverser {

} 
