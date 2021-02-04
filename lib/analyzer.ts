import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';

interface StrMapLike<V> {
  [index: number]: V;
}
interface NumMapLike<V> {
  [index: string]: V;
}

export namespace Analysis {

  export var ERRORS = 0;

  export var ruleTable: PRule[];

}


namespace Factory {

  export var parseTables: StrMapLike<ParseTableGenerator> = {};

  export function createTraverser(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PValueNode) {
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

  rule: PRule;
  dependencyOf: ParseTableGenerator;
  startingStateGen: GrammarAnalysisStateGenerator;
  // Map  Leaf parser nodeIdx -> 
  allStateGens: GrammarAnalysisStateGenerator[] = [];
  maxTokenId: number = 0;

  allRuleReferences: RuleRefTraverser[] = [];
  allTerminalReferences: TerminalRefTraverser[] = [];
  mainEntryTraversion: Traversion;

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

    this.mainEntryTraversion = mainEntryPoint.traversion;

    // NOTE binding each to all in linear time :
    this.allTerminalReferences.forEach(previousStep => {
      previousStep.nextStepsFromTerminalAction(null, null);
    });

    var startingStateGen = new GrammarAnalysisStateGenerator(null, this.mainEntryTraversion);

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
  steps: Traversion;

  constructor(startingPointTraverser: TerminalRefTraverser, steps: Traversion) {
    this.startingPointTraverser = startingPointTraverser;
    this.steps = steps;
  }

  generateState() {
    var transitions = {};
    this.steps.forEach(nextTerm => {
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
  // Map  Leaf parser nodeIdx -> 
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
  RULE, RECURSIVE_RULE, TERMINAL, NEXT_SUBTREE
}
class TraversionItem {
  kind: TraversionItemKind;
  entry: EntryPointTraverser;
  terminal: TerminalRefTraverser;
  value: RuleElementTraverser;

  fromPosition: number;
  toPosition: number;

  get nodeIdx() {
    return this.value.node.nodeIdx;
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
      case TraversionItemKind.NEXT_SUBTREE:
        break;
      default:
        throw new Error();
    }
  }

  constructor(kind: TraversionItemKind, val: RuleElementTraverser, position: number) {
    this.kind = kind;
    this._value = val;
    this.fromPosition = this.toPosition = position;
  }
}

enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_PARENT
}

enum TraversionItemActionKind {
  OMIT_SUBTREE, CHANGE_PURPOSE,
  CONTINUE/*default*/
}

class Traversion {

  readonly all: { [index: number]: TraversionItem };

  readonly array: TraversionItem[];

  readonly purpose: TraversionPurpose;
  private position: number;
  private positionOk: boolean;

  get length() {
    return Object.keys(this).length;
  }

  constructor() {
    this.all = {};
  }

  push(item: TraversionItem) {
    this.all[item.nodeIdx] = item;
    this.array.push(item);
  }

  createLinearTraversion(item: RuleElementTraverser) {

    item.pushItemsToLinearTraversion(this);

    var first = 1;
    item.children.forEach(child => {
      var separator: TraversionItem;
      if (!first) {
        separator = new TraversionItem(TraversionItemKind.NEXT_SUBTREE, item, this.length);
        this.push(separator);
      }

      this.createLinearTraversion(child);

      if (separator) {
        separator.toPosition = this.length;
      }
    })
  }


  traverse(initialPurpose: TraversionPurpose, startPosition = 0) {
    (this as any).purpose = initialPurpose;

    for (this.position = 0; this.position < this.array.length;) {
      this.positionOk = false;
      var item = this.array[this.position];

      item.value.traversionActions(this, item);

      if (!this.positionOk) {
        this.position++;
      }
    }
  }

  execute(action: TraversionItemActionKind, step: TraversionItem, ...etc) {
    switch (action) {
      case TraversionItemActionKind.OMIT_SUBTREE:
        this.positionOk = true;
        this.position = step.toPosition;
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

  readonly constructionLevel: number;
  readonly parser: ParseTableGenerator;
  readonly parent: RuleElementTraverser;
  readonly node: PValueNode;
  readonly children: RuleElementTraverser[] = [];

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PValueNode) {
    this.parent = parent;
    this.parser = parser;
    this.node = node;
    this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
    this.parser.allNodes[this.node.nodeIdx] = this;

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

  pushItemsToLinearTraversion(inTraversion: Traversion) {
  }

  traversionActions(inTraversion: Traversion, step: TraversionItem) {
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {


  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_PARENT:
        if (step.kind === TraversionItemKind.NEXT_SUBTREE) {
          inTraversion.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
        }
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

  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        if (step.kind === TraversionItemKind.NEXT_SUBTREE) {
          inTraversion.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
        }
        break;
      case TraversionPurpose.BACKSTEP_TO_PARENT:
        break;
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleCollectionTraverser extends RuleElementTraverser {

  child: RuleElementTraverser;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PValueNode) {
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

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {


  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_PARENT:
        this.pushItemsToLinearTraversion([], nextStepsFromTerminal);
        break;
    }
  }


}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {


  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_PARENT:
        this.pushItemsToLinearTraversion([], nextStepsFromTerminal);
        break;
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends EmptyTraverser {

  node: PRuleRef;
  recursive: boolean;
  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;
  currentFirstStepsDup: TerminalRefTraverser[];


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    this.parser.allRuleReferences.push(this);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
    this.recursive = !!this.findRuleNodeParent(this.node.rule);
  }

  lazyCouldGenerateNew() {
    if (this.linkedRuleEntry) {
      return false;
    } else {
      this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
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

  pushItemsToLinearTraversion(inTraversion: Traversion) {
    var item: TraversionItem;
    if (inTraversion.all[this.targetRule.nodeIdx]) {
      //mark it is a backward jump
      item = new TraversionItem(TraversionItemKind.RECURSIVE_RULE, this.linkedRuleEntry, inTraversion.length);
    } else {
      item = new TraversionItem(TraversionItemKind.RULE, this.linkedRuleEntry, inTraversion.length);
    }
    inTraversion.push(item);

  }

  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {

      case TraversionPurpose.FIND_NEXT_TOKENS:
        if (step.kind === TraversionItemKind.RULE) {
          this.linkedRuleEntry.traversion.forEach(step => {
            var applied = step.stackedRefClone(this);
            firstSteps.push(applied);
          });
        } else {
          //backward jump : no new first step token possible
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
  nextStepsFromTerminal: Traversion = new Traversion();
  stateGen: GrammarAnalysisStateGenerator;

  stackedIn: RuleRefTraverser;
  original: TerminalRefTraverser;

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

  stateTransitionsFromHere(rootTraversion: Traversion) {
    rootTraversion.traverse(TraversionPurpose.BACKSTEP_TO_PARENT, this.positionInTraversion);
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  pushItemsToLinearTraversion(inTraversion: Traversion) {
    inTraversion.push(new TraversionItem(TraversionItemKind.TERMINAL, this, inTraversion.length));
  }

  traversionActions(inTraversion: Traversion, step: TraversionItem) {
    switch (inTraversion.purpose) {
      case TraversionPurpose.FIND_NEXT_TOKENS:
        break;
      case TraversionPurpose.BACKSTEP_TO_PARENT:
        break;
    }
  }
}


export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;
  _traversed = false;
  _traversion: Traversion = new Traversion();

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRule) {
    super(parser, parent, node);
    this.index = node.index;
  }

  get traversion(): Traversion {
    if (!this._traversed) {
      this._traversed = true;
      this._traversion.createLinearTraversion(this);
    }
    return this._traversion;
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

  pushItemsToLinearTraversion(inTraversion: Traversion) {
    inTraversion.push(new TraversionItem(TraversionItemKind.RULE, this, inTraversion.length));
  }

}


// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SemanticTraverser extends EmptyTraverser {
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
