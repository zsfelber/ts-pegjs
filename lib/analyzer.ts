import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser, PNode } from './parsers';

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

export class ParseTableGenerator {

  nodeTravIds: number = 0;

  rule: PRule;
  startRuleDependencies: StrMapLike<PRuleRef> = [];
  startingStateGen: GrammarParsingLeafStateGenerator;
  // Map  Leaf parser nodeTravId -> 
  allStateGens: GrammarParsingLeafStateGenerator[] = [];
  maxTokenId: number = 0;

  allRuleReferences: RuleRefTraverser[] = [];
  allTerminalReferences: TerminalRefTraverser[] = [];
  mainEntryTraversion: LinearTraversion;
  firstStates: TerminalRefTraverser[];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
  allNodes: NumMapLike<RuleElementTraverser> = {};
  jumperStates: NumMapLike<number> = [];

  // 1 based index
  cntStates = 2;
  cntJumperStates = 254;

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

    this.mainEntryTraversion = new LinearTraversion(mainEntryPoint);
    var cache = this.mainEntryTraversion.traverse(TraversionPurpose.FIND_NEXT_TOKENS);
    this.firstStates = cache.collectedStateJumpingTokens;

    // ================================================================
    // NOTE   terminal reference (node) <=>  persing state   
    //                              in 1 : 1  relationship
    // ================================================================

    // So this simple loop generates all possible state transitions at once:

    this.allStateGens = this.allTerminalReferences.map(previousStep => {

      // when normal states and jumper states together reach max
      if (this.cntStates > this.cntJumperStates) throw new Error("Too many states : " + this.cntStates);

      var trans = previousStep.stateTransitionsFromHere(this.cntStates, this.mainEntryTraversion);

      // So non final and non jumper state :
      if (trans.index <= this.cntJumperStates) {
        this.cntStates++;
      }
      return trans;
    });

    // this should be the latter one because  of
    // allTerminalReferences->stateTransitionsFromHere  which generates  *.stateGen
    this.startingStateGen = new GrammarParsingLeafStateGenerator(1, null, this.firstStates);

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
    console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.entryPoints).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   terminal nodes:" + this.allTerminalReferences.length + "  states:" + this.allStateGens.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);

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
    var start = this.startingStateGen.generateState();
    var all = this.allStateGens.map(s => s.generateState());
    var result = new ParseTable(this.rule, this.maxTokenId, start, all);
    return result;
  }

  jumpToTableState(rule: PRule, tokenId: number): GrammarParsingLeafStateGenerator {
    var stateId = this.jumperStates[rule.nodeIdx];
    if (!stateId) {
      // when normal states and jumper states together reach max
      if (this.cntStates > this.cntJumperStates) throw new Error("Too many states : " + this.cntStates);

      this.jumperStates[rule.nodeIdx] = stateId = this.cntJumperStates;
      this.cntJumperStates--;
    }

    var js = new GrammarParsingLeafStateGenerator(stateId, null, null);
    js.jumpToRule = rule;
    js.jumpToRuleTokenId = tokenId;

    return js;
  }

}

export class GrammarParsingLeafStateGenerator {

  static FINAL_STATE_GEN: GrammarParsingLeafStateGenerator =
    new GrammarParsingLeafStateGenerator(FINAL_STATE, null, null);

  readonly index: number;
  readonly startingPointTraverser: TerminalRefTraverser;
  readonly firstStates: TerminalRefTraverser[];
  jumpToRule: PRule;
  jumpToRuleTokenId: number;
  actionNodeId: number;

  constructor(index: number, startingPointTraverser: TerminalRefTraverser, firstStates: TerminalRefTraverser[]) {
    this.index = index;
    this.startingPointTraverser = startingPointTraverser;
    this.firstStates = firstStates;
  }

  generateState() {
    var result = new GrammarParsingLeafState(this);
    return result;
  }
}



export class ParseTable {

  readonly rule: PRule;
  readonly maxTokenId: number;
  readonly startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];

  constructor(rule: PRule, maxTokenId: number, startingState: GrammarParsingLeafState, allStates: GrammarParsingLeafState[]) {
    this.rule = rule;
    this.maxTokenId = maxTokenId;
    this.startingState = startingState;
    this.allStates = allStates
  }

  static deserialize(code: number[]) {
    //SerDeser.ruleTable

  }

  ser(): number[] {
    var serStates: number[] = [];
    this.allStates.forEach(s => {
      serStates = serStates.concat(s.ser(this.maxTokenId));
    });
    var result = [this.allStates.length, this.maxTokenId].concat(serStates);
    return result;
  }

}

export class GrammarParsingLeafState {

  readonly index: number;

  readonly startingPoint: PTerminalRef;

  // tokenId -> traversion state
  readonly transitions: NumMapLike<GrammarParsingLeafState>;

  readonly jumpToRule: PRule;
  readonly jumpToRuleTokenId: number;
  readonly actionNodeId: number;

  constructor(g: GrammarParsingLeafStateGenerator) {
    this.index = g.index;
    this.startingPoint = g.startingPointTraverser ? g.startingPointTraverser.node : null;
    this.jumpToRule = g.jumpToRule;
    this.jumpToRuleTokenId = g.jumpToRuleTokenId;
    this.actionNodeId = g.actionNodeId;

    var transitions = {};
    g.firstStates.forEach(nextTerm => {
      if (!transitions[nextTerm.node.value]) {
        transitions[nextTerm.node.value] = nextTerm.stateGen.generateState();
      }
    })
    this.transitions = transitions;
  }

  ser(maxTknId: number): number[] {
    var toTknIds: number[] = [];
    toTknIds[maxTknId] = 0;
    toTknIds.fill(0, 0, maxTknId);
    var es = Object.entries(this.transitions);
    var len = es.length;
    es.forEach(([key, trans]) => {
      var tokenId = Number(key);
      toTknIds[tokenId] = trans.index;
    });
    return [len].concat(toTknIds);
  }

}

enum TraversionItemKind {
  RULE, RECURSIVE_RULE, REPEAT, OPTIONAL, TERMINAL, NODE_START, NODE_END, CHILD_SEPARATOR, NEGATE
}
class TraversionControl {
  readonly parent: LinearTraversion;

  kind: TraversionItemKind;
  item: RuleElementTraverser;

  entry: EntryPointTraverser;
  terminal: TerminalRefTraverser;
  child: RuleElementTraverser;
  previousChild: RuleElementTraverser;

  fromPosition: number;
  toPosition: number;

  get nodeTravId() {
    return this.item.nodeTravId;
  }
  private _set_itm(itm: RuleElementTraverser) {
    this.item = itm;
    switch (this.kind) {
      case TraversionItemKind.RULE:
      case TraversionItemKind.RECURSIVE_RULE:
        this.entry = itm as any;
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
        throw new Error(TraversionItemKind[this.kind]);
    }
  }

  constructor(parent: LinearTraversion, kind: TraversionItemKind, itm: RuleElementTraverser) {
    this.parent = parent;
    this.kind = kind;
    this._set_itm(itm);
    this.fromPosition = this.toPosition = parent.length;
  }
}

enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_SEQUENCE_THEN
}

enum TraversionItemActionKind {
  OMIT_SUBTREE, STEP_PURPOSE, RESET_POSITION,
  STOP, CONTINUE/*default*/
}

enum RuntimeItemActionKind {
  NODE_ACCEPTED_DEFAULT, NODE_ACCEPTED_USER,
  PREDICATE_DEFAULT, PREDICATE_USER,
  PREDICATE_NOT_DEFAULT, PREDICATE_NOT_USER
}

class TraversionCache {

  readonly isNegative = false;

  readonly collectedStateJumpingTokens: TerminalRefTraverser[] = [];

  readonly runtimeControls: RuntimeControl[];

  readonly reducedNodesAtBegin: RuleElementTraverser[] = [];


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

class LinearTraversion {

  readonly rule: EntryPointTraverser;

  readonly traversionControls: TraversionControl[];

  readonly purpose: TraversionPurpose;
  readonly purposeThen: TraversionPurpose[];
  private position: number;
  private positionOk: boolean;
  private stopped: boolean;

  get length() {
    return this.traversionControls.length;
  }

  constructor(rule: EntryPointTraverser) {
    this.rule = rule;
    this.traversionControls = [];

    var recursionCacheStack = {};
    recursionCacheStack[rule.node.nodeIdx] = {
      itemGeneratedForStarterNode: "", linkedRuleEntry: rule,
      collectedFromIndex: 0
    };

    this.createRecursively(rule, recursionCacheStack);
  }

  private createRecursively(item: RuleElementTraverser, recursionCacheStack: StrMapLike<RuleElementTraverser>) {

    var newRecursionStack = {};
    Object.setPrototypeOf(newRecursionStack, recursionCacheStack);

    this.pushDefaultPrefixControllerItems(item);
    item.pushPrefixControllerItem(this);

    var first = 1;
    var previousChild = null;
    item.children.forEach(child => {
      if (item.checkLoopIsFinitePrefix(this, child, newRecursionStack)) {
        var separator: TraversionControl;
        if (first) {
          first = 0;
        } else {
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

        item.checkLoopIsFinitePostfix(this, child, newRecursionStack);
      }

    });

    item.pushPostfixControllerItem(this);
    this.pushDefaultPostfixControllerItems(item);
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

  traverse(initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition = 0): TraversionCache {
    var t = this as any;
    t.purpose = initialPurpose;
    t.purposeThen = purposeThen ? purposeThen : [];
    var cache = new TraversionCache();

    if (this.position >= this.traversionControls.length) {
      this.stopped = true;
    }
    for (this.position = startPosition; !this.stopped;) {
      this.positionOk = false;
      var item = this.traversionControls[this.position];

      item.item.traversionActions(this, item, cache);

      this.defaultActions(item, cache);

      if (this.position >= this.traversionControls.length) {
        this.stopped = true;
      }
    }
    return cache;
  }

  defaultActions(step: TraversionControl, cache: TraversionCache) {
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
            cache.nodeLocal(step.item).terminalsAtStart = cache.collectedStateJumpingTokens.length;
            break;
        }
        break;

      case TraversionItemKind.NODE_END:
        switch (this.purpose) {
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            if (cache.collectedStateJumpingTokens.length) {
              throw new Error();
            }
            // REDUCE action (default or user function)
            // node succeeded, previous terminal is a sub-/main-end state
            // :
            // triggers to the user-defined action if any exists  
            // or default runtime action otherwise  generated here
            // 
            // conditions:
            // - at beginning of starting state traversion
            // excluded:
            // - reduction checking omitted after first terminal 
            //   ( this is the expected behavior since we are
            //     analyzing one from-token to-tokens state transition
            //     table which is holding all reduction cases in the front
            //     of that  and  contains all token jumps after that )
            if (step.item.isReducable) {
              cache.reducedNodesAtBegin.push(step.item);
            }

            break;
          case TraversionPurpose.FIND_NEXT_TOKENS:
            // Epsilon REDUCE action (default or user function)
            // A whole branch was empty and it is accepted as a 
            // a valid empty node success, which should be of an
            // optionalBranch==true node ...
            // 
            // This case demands a behavior  which is exactly like
            // that of BACKSTEP_TO_SEQUENCE_THEN ...
            // conditions:
            // - at beginning of starting state traversion
            // - or at traversion beginning after token jump state
            //     a) before anything
            //     b) between / after regular reductions
            // excluded:
            // - reduction checking omitted after first terminal 
            //   ( this is the expected behavior since we are
            //     analyzing one from-token to-tokens state transition
            //     table which is holding all reduction cases in the front
            //     of that  and  contains all token jumps after that )
            if (cache.nodeLocal(step.item).terminalsAtStart === cache.collectedStateJumpingTokens.length) {
                // TODO
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
          throw new Error();
        }
        this.positionOk = true;
        this.position = step.toPosition;
        break;
      case TraversionItemActionKind.RESET_POSITION:
        this.positionOk = true;
        this.position = step.fromPosition;
        break;
      case TraversionItemActionKind.STEP_PURPOSE:
        (this as any).purpose = this.purposeThen.shift();
        break;
      case TraversionItemActionKind.CONTINUE:
        if (!this.positionOk) {
          this.positionOk = true;
          this.position++;
        }
        break;
      case TraversionItemActionKind.STOP:
        this.stopped = true;
        break;
    }
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

  checkLoopIsFinitePrefix(inTraversion: LinearTraversion, childPending: RuleElementTraverser, recursionCacheStack: StrMapLike<RuleElementTraverser>) {
    return true;
  }
  checkLoopIsFinitePostfix(inTraversion: LinearTraversion, childPending: RuleElementTraverser, recursionCacheStack: StrMapLike<RuleElementTraverser>) {
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
  }

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
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


class RuleRefTraverser extends SingleTraverser {

  node: PRuleRef;
  recursiveRuleOriginal: RuleRefTraverser;
  collectedFromIndex: number;
  collectedToIndex: number;

  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;

  collectedTerminalsFromHereToRecursiveRepetition: TerminalRefTraverser[];

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    this.parser.allRuleReferences.push(this);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];

    this.optionalBranch = this.linkedRuleEntry.optionalBranch;
  }

  get isReducable() {
    return true;
  }

  lazyCouldGenerateNew() {
    if (this.linkedRuleEntry) {
      return false;
    } else {
      this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
      this.child = this.linkedRuleEntry;
      this.children.push(this.linkedRuleEntry);
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

  checkLoopIsFinitePrefix(inTraversion: LinearTraversion, childPending: RuleElementTraverser, recursionCacheStack: StrMapLike<RuleElementTraverser>) {

    this.recursiveRuleOriginal = recursionCacheStack[this.targetRule.nodeIdx] as RuleRefTraverser;

    if (this.recursiveRuleOriginal) {
      var tavItem = new TraversionControl(inTraversion, TraversionItemKind.RECURSIVE_RULE, this.linkedRuleEntry);
      inTraversion.pushControl(tavItem);

      return false;
    } else {

      recursionCacheStack[this.targetRule.nodeIdx] = this.linkedRuleEntry;

      var tavItem = new TraversionControl(inTraversion, TraversionItemKind.RULE, this.linkedRuleEntry);
      inTraversion.pushControl(tavItem);

      return true;
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {

    const r = this.recursiveRuleOriginal;

    switch (inTraversion.purpose) {

      case TraversionPurpose.FIND_NEXT_TOKENS:
        switch (step.kind) {
          case TraversionItemKind.RECURSIVE_RULE:
            if (!r) throw new Error();

            if (!r.collectedTerminalsFromHereToRecursiveRepetition) {
              r.collectedToIndex = cache.collectedStateJumpingTokens.length;
              r.collectedTerminalsFromHereToRecursiveRepetition =
                cache.collectedStateJumpingTokens.slice(r.collectedFromIndex, r.collectedToIndex);
            }

            // for transitions jumping to a recursive section,
            // generating a state which mapped to a sub - Starting- Rule- ParseTable :
            r.collectedTerminalsFromHereToRecursiveRepetition.forEach(infiniteItem => {
              var newSubruleStarter = infiniteItem.stackedRefClone(this);
              cache.collectedStateJumpingTokens.push(newSubruleStarter);
            });
            // maybe this start rule has not existed, should be generated now :
            this.parser.startRuleDependencies[this.node.rule] = this.node;

            break;
          case TraversionItemKind.RULE:
            if (r) throw new Error();

            this.collectedFromIndex = cache.collectedStateJumpingTokens.length;

            break;
          default:
            throw new Error();
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


class TerminalRefTraverser extends EmptyTraverser {

  node: PTerminalRef;

  stackedIn: RuleRefTraverser;
  original: TerminalRefTraverser;

  traverserStep: TraversionControl;

  stateGen: GrammarParsingLeafStateGenerator;


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminalReferences.push(this);
    if (this.node && this.node.value > parser.maxTokenId) parser.maxTokenId = this.node.value;
  }

  get isReducable() {
    return true;
  }

  stackedRefClone(stackedIn: RuleRefTraverser) {
    var result = new TerminalRefTraverser(this.parser, this.parent, this.node);
    result.stackedIn = stackedIn;
    result.original = this;
    return result;
  }

  stateTransitionsFromHere(index: number, rootTraversion: LinearTraversion) {
    // opens another parser of sub-start rule :
    if (this.stackedIn) {
      return this.parser.jumpToTableState(this.stackedIn.linkedRuleEntry.node, this.node.value);
    }

    if (!this.traverserStep || this.traverserStep.parent !== rootTraversion) throw new Error();

    var cache = rootTraversion.traverse(TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [TraversionPurpose.FIND_NEXT_TOKENS], this.traverserStep.toPosition);
    if (cache.collectedStateJumpingTokens.length) {
      this.stateGen = new GrammarParsingLeafStateGenerator(index, this, cache.collectedStateJumpingTokens);
    } else {
      this.stateGen = GrammarParsingLeafStateGenerator.FINAL_STATE_GEN;
    }
    return this.stateGen;
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
    if (this.traverserStep) throw new Error();
    this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
    inTraversion.pushControl(this.traverserStep);
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.TERMINAL:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            cache.collectedStateJumpingTokens.push(this);
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
