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

export const FINISH_STATE = 255;

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
  startingStateGen: GrammarAnalysisStateGenerator;
  // Map  Leaf parser nodeTravId -> 
  allStateGens: GrammarAnalysisStateGenerator[] = [];
  maxTokenId: number = 0;

  allRuleReferences: RuleRefTraverser[] = [];
  allTerminalReferences: TerminalRefTraverser[] = [];
  mainEntryTraversion: LinearTraversion;
  firstStates: TerminalRefTraverser[] = [];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
  allNodes: NumMapLike<RuleElementTraverser> = {};

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
    this.mainEntryTraversion.traverse(TraversionPurpose.FIND_NEXT_TOKENS);
    this.firstStates = this.firstStates.concat(this.mainEntryTraversion.collectedTerminals);

    // ================================================================
    // NOTE   terminal reference <=>  persing state   
    //                       in 1 : 1  relationship
    // ================================================================

    // This simple loop generates all possible state transitions at once:
    this.allTerminalReferences.forEach(previousStep => {
      previousStep.stateTransitionsFromHere(this.mainEntryTraversion);
    });

    var startingStateGen = new GrammarAnalysisStateGenerator(null, this.firstStates);

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number

    this.startingStateGen = startingStateGen;
    this.allTerminalReferences.forEach(t => {
      this.allStateGens.push(t.stateGen);
      // 1 based index
      t.stateGen.index = this.allStateGens.length;
    });
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

}

export class GrammarAnalysisStateGenerator {

  index: number;
  startingPointTraverser: TerminalRefTraverser;
  firstStates: TerminalRefTraverser[];

  constructor(startingPointTraverser: TerminalRefTraverser, firstStates: TerminalRefTraverser[]) {
    this.startingPointTraverser = startingPointTraverser;
    this.firstStates = firstStates;
  }

  generateState() {
    var transitions = {};
    this.firstStates.forEach(nextTerm => {
      if (!transitions[nextTerm.node.value]) {
        transitions[nextTerm.node.value] = nextTerm.stateGen;
      }
    })
    var result = new GrammarAnalysisState(this.index, this.startingPointTraverser ? this.startingPointTraverser.node : null, transitions);
    return result;
  }
}



export class ParseTable {

  readonly rule: PRule;
  readonly maxTokenId: number;
  readonly startingState: GrammarAnalysisState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarAnalysisState[];

  constructor(rule: PRule, maxTokenId: number, startingState: GrammarAnalysisState, allStates: GrammarAnalysisState[]) {
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

export class GrammarAnalysisState {

  readonly index: number;

  readonly startingPoint: PTerminalRef;

  // tokenId -> traversion state
  readonly transitions: NumMapLike<GrammarAnalysisState>;

  constructor(index: number, startingPoint: PTerminalRef, transitions: NumMapLike<GrammarAnalysisState>) {
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
  RULE, RECURSIVE_RULE, REPEAT, OPTIONAL, TERMINAL, NEXT_SUBTREE
}
class TraversionControllerItem {
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
        case TraversionItemKind.NEXT_SUBTREE:

        break;
      default:
        throw new Error();
    }
  }

  constructor(parent: LinearTraversion, kind: TraversionItemKind, val: RuleElementTraverser, position: number) {
    this.parent = parent;
    this.kind = kind;
    this._value = val;
    this.fromPosition = this.toPosition = position;
  }
}

enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_SEQUENCE_THEN
}

enum TraversionItemActionKind {
  OMIT_SUBTREE, CHANGE_PURPOSE, SET_POSITION,
  CONTINUE/*default*/
}

class LinearTraversion {

  readonly rule: EntryPointTraverser;

  readonly array: TraversionControllerItem[];

  collectedTerminals: TerminalRefTraverser[];

  readonly purpose: TraversionPurpose;
  readonly purposeThen: TraversionPurpose;
  private position: number;
  private positionOk: boolean;

  get length() {
    return this.array.length;
  }

  constructor(rule: EntryPointTraverser) {
    this.rule = rule;
    this.array = [];

    this.createRecursively(rule, {});
  }

  private createRecursively(item: RuleElementTraverser, insertedItems: StrMapLike<RuleElementTraverser>) {

    item.pushPrefixControllerItem(this);

    var first = 1;
    var previousChild = null;
    item.children.forEach(child => {
      if (item.checkLoopIsFinite(this, child, insertedItems)) {
        var separator: TraversionControllerItem;
        if (!first) {
          separator = new TraversionControllerItem(this, TraversionItemKind.NEXT_SUBTREE, item, this.length);
          separator.child = child;
          separator.previousChild = previousChild;
          this.push(separator);
        }

        this.createRecursively(child, insertedItems);

        if (separator) {
          separator.toPosition = this.length;
        }
        previousChild = child;
      }

    });

    item.pushPostfixControllerItem(this);
  }

  push(item: TraversionControllerItem) {
    this.array.push(item);
  }

  traverse(initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose, startPosition = 0) {
    this.collectedTerminals = [];
    (this as any).purpose = initialPurpose;
    (this as any).purposeThen = purposeThen;
    for (this.position = 0; this.position < this.array.length;) {
      this.positionOk = false;
      var item = this.array[this.position];

      item.value.traversionActions(this, item);

      this.defaultActions(item);

    }
  }

  defaultActions(step: TraversionControllerItem) {
    switch (this.purpose) {
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        if (step.kind === TraversionItemKind.NEXT_SUBTREE) {
          this.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
        }
        break;
    }

    this.execute(TraversionItemActionKind.CONTINUE, null);
  }

  execute(action: TraversionItemActionKind, step: TraversionControllerItem, ...etc) {
    switch (action) {
      case TraversionItemActionKind.OMIT_SUBTREE:
        this.positionOk = true;
        this.position = step.toPosition;
        break;
      case TraversionItemActionKind.SET_POSITION:
        this.positionOk = true;
        this.position = step.fromPosition;
        break;
      case TraversionItemActionKind.CONTINUE:
        if (!this.positionOk) {
          this.positionOk = true;
          this.position++;
        }
        break;
      case TraversionItemActionKind.CHANGE_PURPOSE:
        (this as any).purpose = etc[0];
        break;
    }
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class RuleElementTraverser {

  readonly nodeTravId: number;
  readonly constructionLevel: number;
  readonly parser: ParseTableGenerator;
  readonly parent: RuleElementTraverser;
  readonly node: PNode;
  readonly children: RuleElementTraverser[] = [];

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
    //if (this.checkConstructFailed()) {
    //  throw new Error("Ast construction failed.");
    //}
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

  checkLoopIsFinite(inTraversion: LinearTraversion, childPending: RuleElementTraverser, insertedItems: StrMapLike<RuleElementTraverser>) {
    return true;
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
  }

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem) {
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {


  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        break;
    }
  }


}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SequenceTraverser extends RuleElementTraverser {

  checkConstructFailed() {
    if (!this.children.length) {
      console.error("!parser.children.length (empty sequence)  " + this.node);
      return 1;
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        if (step.kind === TraversionItemKind.NEXT_SUBTREE) {
          if (!step.previousChild.node.allowStepThrough) {
            inTraversion.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
          }
        }
        break;
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        inTraversion.execute(TraversionItemActionKind.CHANGE_PURPOSE, step, inTraversion.purposeThen);
        break;
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
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

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleTraverser extends SingleCollectionTraverser {


}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class EmptyTraverser extends RuleElementTraverser {

  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("this.children.length !== 0  " + this.node);
      return 1;
    }
  }

}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class OptionalTraverser extends SingleTraverser {

}

class OrMoreTraverser extends SingleCollectionTraverser {

  crrTrItem: TraversionControllerItem;

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem = new TraversionControllerItem(inTraversion, TraversionItemKind.REPEAT, this, inTraversion.length);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem.toPosition = inTraversion.length;
    inTraversion.push(this.crrTrItem);
    this.crrTrItem = null;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        inTraversion.execute(TraversionItemActionKind.SET_POSITION, step, step.fromPosition);
        inTraversion.execute(TraversionItemActionKind.CHANGE_PURPOSE, step, inTraversion.purposeThen);
        break;
    }
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends OrMoreTraverser {


}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends OrMoreTraverser {

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends SingleTraverser {

  node: PRuleRef;
  recursiveRuleRefOriginal: RuleRefTraverser;
  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;

  currentFirstStepsDup: TerminalRefTraverser[];

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    this.parser.allRuleReferences.push(this);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];

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
    this.recursive = !!this.findRuleNodeParent(this.node.rule);
    if (this.recursive) {
      console.warn("recursive : " + this.node);
    }
    return dirty;
  }

  checkLoopIsFinite(inTraversion: LinearTraversion, childPending: RuleElementTraverser, insertedItems: StrMapLike<RuleElementTraverser>) {
    // NOTE unique to rule ref nodes !
    this.recursiveRuleRefOriginal = insertedItems[this.node.nodeIdx] as RuleRefTraverser;
    if (this.recursiveRuleRefOriginal) {
      var tavItem = new TraversionControllerItem(inTraversion, TraversionItemKind.RECURSIVE_RULE, this.linkedRuleEntry, inTraversion.length);
      inTraversion.push(tavItem);

      return false;
    } else {
      var tavItem = new TraversionControllerItem(inTraversion, TraversionItemKind.RULE, this.linkedRuleEntry, inTraversion.length);
      inTraversion.push(tavItem);

      return true;
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem) {

    switch (inTraversion.purpose) {

      case TraversionPurpose.FIND_NEXT_TOKENS:
        switch (step.kind) {
          case TraversionItemKind.RECURSIVE_RULE:
            if (!this.recursiveRuleRefOriginal) throw new Error();

            // for transitions jumping to a recursive section,
            // generating a state which mapped to a sub - Starting- Rule- ParseTable :
            this.recursiveRuleRefOriginal.collectedTerminals.forEach(infiniteItem => {
              var newSubruleStarter = infiniteItem.stackedRefClone(this);
              inTraversion.collectedTerminals.push(newSubruleStarter);
            });
            // maybe this start rule has not existed, should be generated now :
            this.parser.startRuleDependencies[this.node.rule] = this.node;

            break;
          case TraversionItemKind.RULE:
            if (this.recursiveRuleRefOriginal) throw new Error();
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

// NOTE Not exported.  The only exported one is EntryPointTraverser
class TerminalRefTraverser extends EmptyTraverser {

  node: PTerminalRef;
  nextStepsFromTerminal: TerminalRefTraverser[];
  stateGen: GrammarAnalysisStateGenerator;

  stackedIn: RuleRefTraverser;
  original: TerminalRefTraverser;

  traverserStep: TraversionControllerItem;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminalReferences.push(this);
    if (this.node && this.node.value > parser.maxTokenId) parser.maxTokenId = this.node.value;
    this.stateGen = new GrammarAnalysisStateGenerator(this, this.nextStepsFromTerminal);
  }

  stackedRefClone(stackedIn: RuleRefTraverser) {
    var result = new TerminalRefTraverser(this.parser, this.parent, this.node);
    result.stackedIn = stackedIn;
    result.original = this;
    return result;
  }

  stateTransitionsFromHere(rootTraversion: LinearTraversion) {
    if (!this.traverserStep || this.traverserStep.parent !== rootTraversion) throw new Error();

    rootTraversion.traverse(TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, TraversionPurpose.FIND_NEXT_TOKENS, this.traverserStep.toPosition);
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
    this.traverserStep = new TraversionControllerItem(inTraversion, TraversionItemKind.TERMINAL, this, inTraversion.length);
    inTraversion.push(this.traverserStep);
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControllerItem, all: NumMapLike<TraversionControllerItem>) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        inTraversion.collectedTerminals.push(this);
        all["#"+this.node.nodeIdx] = step;
        break;
      case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
        break;
    }
  }
}


export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRule) {
    super(parser, parent, node);
    this.index = node.index;
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

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    inTraversion.push(new TraversionControllerItem(inTraversion, TraversionItemKind.RULE, this, inTraversion.length));
  }

}


// NOTE Not exported.  The only exported one is EntryPointTraverser
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
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SemanticAndTraverser extends SemanticTraverser {
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SemanticNotTraverser extends SingleTraverser {
} 
