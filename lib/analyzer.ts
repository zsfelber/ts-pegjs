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
    this.firstStates = cache.collectedTerminals;

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

  constructor(index: number, startingPointTraverser: TerminalRefTraverser, firstStates: TerminalRefTraverser[]) {
    this.index = index;
    this.startingPointTraverser = startingPointTraverser;
    this.firstStates = firstStates;
  }

  generateState() {
    var transitions = {};
    this.firstStates.forEach(nextTerm => {
      if (!transitions[nextTerm.node.value]) {
        transitions[nextTerm.node.value] = nextTerm.stateGen.generateState();
      }
    })
    var result = new GrammarParsingLeafState(
      this.index,
      this.startingPointTraverser ? this.startingPointTraverser.node : null,
      transitions);
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

  constructor(index: number, startingPoint: PTerminalRef, transitions: NumMapLike<GrammarParsingLeafState>) {
    this.index = index;
    this.startingPoint = startingPoint;
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
  RULE, RECURSIVE_RULE, REPEAT, OPTIONAL, TERMINAL, SEPARATE_NEXT_SUBTREE, ACTION
}
class TraversionControl {
  readonly parent: LinearTraversion;

  kind: TraversionItemKind;
  entry: EntryPointTraverser;
  terminal: TerminalRefTraverser;
  value: RuleElementTraverser;
  child: RuleElementTraverser;
  previousChild: RuleElementTraverser;

  fromPosition: number;
  toPosition: number;

  get nodeTravId() {
    return this.value.nodeTravId;
  }
  private set _value(v: RuleElementTraverser) {
    this.value = v;
    switch (this.kind) {
      case TraversionItemKind.RULE:
      case TraversionItemKind.RECURSIVE_RULE:
        this.entry = v as any;
        break;
      case TraversionItemKind.TERMINAL:
        this.terminal = v as any;
        break;
      case TraversionItemKind.REPEAT:
      case TraversionItemKind.OPTIONAL:
      case TraversionItemKind.SEPARATE_NEXT_SUBTREE:
      case TraversionItemKind.ACTION:

        break;
      default:
        throw new Error();
    }
  }

  constructor(parent: LinearTraversion, kind: TraversionItemKind, val: RuleElementTraverser) {
    this.parent = parent;
    this.kind = kind;
    this._value = val;
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

class TraversionCache {
  collectedTerminals: TerminalRefTraverser[] = [];

  private nodeLocals: any[] = [];

  nodeLocal(node: RuleElementTraverser) {
    var r = this.nodeLocals[node.nodeTravId];
    if (!r) {
      this.nodeLocals[node.nodeTravId] = r = [];
    }
    return r;
  }
}

class LinearTraversion {

  readonly rule: EntryPointTraverser;

  readonly array: TraversionControl[];

  readonly purpose: TraversionPurpose;
  readonly purposeThen: TraversionPurpose[];
  private position: number;
  private positionOk: boolean;
  private stopped: boolean;

  get length() {
    return this.array.length;
  }

  constructor(rule: EntryPointTraverser) {
    this.rule = rule;
    this.array = [];

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

    item.pushPrefixControllerItem(this);

    var first = 1;
    var previousChild = null;
    item.children.forEach(child => {
      if (item.checkLoopIsFinitePrefix(this, child, newRecursionStack)) {
        var separator: TraversionControl;
        if (first) {
          first = 0;
        } else {
          separator = new TraversionControl(this, TraversionItemKind.SEPARATE_NEXT_SUBTREE, item);
          separator.child = child;
          separator.previousChild = previousChild;
          this.push(separator);
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

  pushDefaultPostfixControllerItems(item: RuleElementTraverser) {

  }

  push(item: TraversionControl) {
    this.array.push(item);
  }

  traverse(initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition = 0): TraversionCache {
    (this as any).purpose = initialPurpose;
    (this as any).purposeThen = purposeThen ? purposeThen : [];
    var cache = new TraversionCache();

    if (this.position >= this.array.length) {
      this.stopped = true;
    }
    for (this.position = startPosition; !this.stopped;) {
      this.positionOk = false;
      var item = this.array[this.position];

      item.value.traversionActions(this, item, cache);

      this.defaultActions(item);

      if (this.position >= this.array.length) {
        this.stopped = true;
      }
    }
    return cache;
  }

  defaultActions(step: TraversionControl) {
    switch (this.purpose) {
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        if (step.kind === TraversionItemKind.SEPARATE_NEXT_SUBTREE) {
          this.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
        }
        break;
    }

    this.execute(TraversionItemActionKind.CONTINUE, null);
  }

  execute(action: TraversionItemActionKind, step: TraversionControl) {
    switch (action) {
      case TraversionItemActionKind.OMIT_SUBTREE:
        if (step.kind !== TraversionItemKind.SEPARATE_NEXT_SUBTREE) {
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

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    if (this.parent && this.parent.node.kind !== PNodeKind.RULE) {
      var action = new TraversionControl(inTraversion, TraversionItemKind.ACTION, this);
      inTraversion.push(action);
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.SEPARATE_NEXT_SUBTREE:
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

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    if (this.parent && this.parent.node.kind !== PNodeKind.RULE) {
      var action = new TraversionControl(inTraversion, TraversionItemKind.ACTION, this);
      inTraversion.push(action);
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {

    var traverseLocals = cache.nodeLocal(this);

    switch (step.kind) {
      case TraversionItemKind.SEPARATE_NEXT_SUBTREE:
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

}



class OptionalTraverser extends SingleTraverser {

}

class OrMoreTraverser extends SingleCollectionTraverser {

  crrTrItem: TraversionControl;

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem = new TraversionControl(inTraversion, TraversionItemKind.REPEAT, this);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem.toPosition = inTraversion.length;
    inTraversion.push(this.crrTrItem);
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
      inTraversion.push(tavItem);

      return false;
    } else {

      recursionCacheStack[this.targetRule.nodeIdx] = this.linkedRuleEntry;

      var tavItem = new TraversionControl(inTraversion, TraversionItemKind.RULE, this.linkedRuleEntry);
      inTraversion.push(tavItem);

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
              r.collectedToIndex = cache.collectedTerminals.length;
              r.collectedTerminalsFromHereToRecursiveRepetition =
                cache.collectedTerminals.slice(r.collectedFromIndex, r.collectedToIndex);
            }

            // for transitions jumping to a recursive section,
            // generating a state which mapped to a sub - Starting- Rule- ParseTable :
            r.collectedTerminalsFromHereToRecursiveRepetition.forEach(infiniteItem => {
              var newSubruleStarter = infiniteItem.stackedRefClone(this);
              cache.collectedTerminals.push(newSubruleStarter);
            });
            // maybe this start rule has not existed, should be generated now :
            this.parser.startRuleDependencies[this.node.rule] = this.node;

            break;
          case TraversionItemKind.RULE:
            if (r) throw new Error();

            this.collectedFromIndex = cache.collectedTerminals.length;

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
    if (cache.collectedTerminals.length) {
      this.stateGen = new GrammarParsingLeafStateGenerator(index, this, cache.collectedTerminals);
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
    inTraversion.push(this.traverserStep);
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.TERMINAL:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:
            cache.collectedTerminals.push(this);
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
}


abstract class SemanticTraverser extends EmptyTraverser {
  node: PValueNode;

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun   " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    if (this.parent && this.parent.node.kind !== PNodeKind.RULE) {
      var action = new TraversionControl(inTraversion, TraversionItemKind.ACTION, this);
      inTraversion.push(action);
    }
  }
}


class SemanticAndTraverser extends SemanticTraverser {
  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = 
  }

}


class SemanticNotTraverser extends SemanticTraverser {
  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = 
  }
} 
