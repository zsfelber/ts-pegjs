import { start } from 'repl';
import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';

interface StrMapLike<V> {
  [index: number]:V;
}
interface NumMapLike<V> {
  [index: string]:V;
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
  startingState : GrammarAnalysisStateGenerator;
  // Map  Leaf parser nodeIdx -> 
  allStateGens: GrammarAnalysisStateGenerator[] = [];
  maxTokenId: number = 0;

  allRuleReferences: RuleRefTraverser[] = [];
  allTerminalReferences: TerminalRefTraverser[] = [];
  firstSteps: TerminalRefTraverser[];

  entryPoints: StrMapLike<EntryPointTraverser> = {};
  allNodes: NumMapLike<RuleElementTraverser> = {};

  static createForRule(rule: PRule) {
    var parseTable: ParseTableGenerator = Factory.parseTables[rule.rule];
    if (!parseTable) {
      parseTable = new ParseTableGenerator(rule);
      Factory.parseTables[rule.rule]=parseTable;
    }
    return parseTable;
  }

  private constructor(rule: PRule) {
    this.rule = rule;
    var traverser = new EntryPointTraverser(this, null, rule);
    this.entryPoints[rule.rule] = traverser;

    // loads all :)
    while (this.allRuleReferences.some(ruleRef=>ruleRef.lazy()));

    this.firstSteps = [];
    traverser.possibleFirstSteps([], this.firstSteps);

    this.allTerminalReferences.forEach(previousStep=>{
      previousStep.possibleNextSteps(null, null);
    });

    var startingState = new GrammarAnalysisStateGenerator(null, this.firstSteps);

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number

    this.startingState = startingState;
    this.allTerminalReferences.forEach(t=>{
      this.allStateGens.push(t.stateGen);
      // 1 based index
      t.stateGen.index = this.allStateGens.length;
    });
    console.log("Parse table for   starting rule:"+rule.rule+"  nonterminals:"+Object.getOwnPropertyNames(this.entryPoints).length+"  tokens:"+this.maxTokenId+"   nonterminal nodes:"+this.allRuleReferences.length+"   terminal nodes:"+this.allTerminalReferences.length+"  states:"+this.allStateGens.length+"  all nodes:"+Object.getOwnPropertyNames(this.allNodes).length);
  }

  getReferencedRule(node: PRule) {
    var rule: EntryPointTraverser;
    rule = this.entryPoints[node.rule];
    if (!rule) {
      rule = new EntryPointTraverser(this, null, node);
      this.entryPoints[node.rule]=rule;
    } 
    return rule;
  }

  generateParseTable() {
    var start = this.startingState.generateState();
    var all = this.allStateGens.map(s=>s.generateState());
    var result = new ParseTable(this.rule, this.maxTokenId, start, all);
    return result;
  }

}

export class GrammarAnalysisStateGenerator {

  index: number;
  startingPointTraverser: TerminalRefTraverser;
  steps: TerminalRefTraverser[];

  constructor(startingPointTraverser: TerminalRefTraverser, steps: TerminalRefTraverser[]) {
    this.startingPointTraverser = startingPointTraverser;
    this.steps = steps;
  }

  generateState() {
    var transitions = {};
    this.steps.forEach(nextTerm=>{
      if (!transitions[nextTerm.node.value]) {
        transitions[nextTerm.node.value]=nextTerm.stateGen;
      }
    })
    var result = new GrammarAnalysisState(this.index, this.startingPointTraverser?this.startingPointTraverser.node:null, transitions);
    return result;
  }
}



export class ParseTable {
  
  readonly rule: PRule;
  readonly maxTokenId: number;
  readonly startingState : GrammarAnalysisState;
  // Map  Leaf parser nodeIdx -> 
  readonly allStates: GrammarAnalysisState[];

  constructor(rule:PRule, maxTokenId: number, startingState: GrammarAnalysisState, allStates:GrammarAnalysisState[]) {
    this.rule = rule;
    this.maxTokenId = maxTokenId;
    this.startingState = startingState;
    this.allStates = allStates
  }

  static deserialize(code: number[]) {
    //SerDeser.ruleTable
  }

  ser(): number[] {
    var serStates:number[] = [];
    this.allStates.forEach(s=>{
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
    var toTknIds:number[] = [];
    toTknIds[maxTknId] = 0;
    toTknIds.fill(0, 0, maxTknId);
    var es = Object.entries(this.transitions);
    var len = es.length;
    es.forEach(([key,trans])=>{
      var tokenId = Number(key);
      toTknIds[tokenId] = trans.index;
    });
    return [len].concat(toTknIds);
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
    this.constructionLevel = parent ? parent.constructionLevel+1 : 0;
    this.parser.allNodes[this.node.nodeIdx]=this;

    this.node.children.forEach(n => {
      this.children.push(Factory.createTraverser(parser, this, n));
    });
    //if (this.checkConstructFailed()) {
    //  throw new Error("Ast construction failed.");
    //}
  }

  checkConstructFailed(): any {
  }

  abstract possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]);


  possibleNextSteps(nextStepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    if (this.parent) this.parent.possibleNextSteps(nextStepsFromTerminal, this);
  }

  findParent(node: PValueNode, incl=false) {
    if (node === this.node && incl) {
      return this;
    } else if (this.parent) {
      return this.parent.findParent(node, true);
    } else {
      return null;
    }
  }

  findRuleNodeParent(rule: string, incl=false) {
    if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {

 
  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    this.children.forEach(ch=>{
      ch.possibleFirstSteps(traversionPath, firstSteps);
    });
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

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    this.children[0].possibleFirstSteps(traversionPath, firstSteps);
  }
  possibleNextSteps(nextStepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    var ind = this.children.indexOf(fromChild) + 1;
    if (ind < this.children.length) {
      this.children[ind].possibleFirstSteps([], nextStepsFromTerminal);
    } else if (this.parent) {
      this.parent.possibleNextSteps(nextStepsFromTerminal, this);
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
      console.error("this.children.length:"+this.children.length+" !== 1  " + this.node);
      return 1;
    }
  }


  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    this.child.possibleFirstSteps(traversionPath, firstSteps);
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

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
  }
}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class OptionalTraverser extends SingleTraverser {

  
  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    this.child.possibleFirstSteps(traversionPath, firstSteps);
    if (this.parent) this.parent.possibleNextSteps(firstSteps, this);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(nextStepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps([], nextStepsFromTerminal);
    if (this.parent) this.parent.possibleNextSteps(nextStepsFromTerminal, this);
  }

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    this.child.possibleFirstSteps(traversionPath, firstSteps);
    if (this.parent) this.parent.possibleNextSteps(firstSteps, this);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(nextStepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps([], nextStepsFromTerminal);
    if (this.parent) this.parent.possibleNextSteps(nextStepsFromTerminal, this);
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends EmptyTraverser {

  node: PRuleRef;
  recursive: boolean;
  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    this.parser.allRuleReferences.push(this);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
    this.recursive = !!this.findRuleNodeParent(this.node.rule);
  }

  lazy() {
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

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    // we don't create cycle
    // also, it is semantically correct...
    if (traversionPath[this.targetRule.nodeIdx]) {
      //console.warn("backward jump : " + this.node+"->"+this.parser.allNodes.get(this.targetRule.nodeIdx).node);
    } else {
      this.linkedRuleEntry.possibleFirstSteps(traversionPath, firstSteps);
    }
  }


  findRuleNodeParent(rule: string, incl=false) {
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
  nextStepsFromTerminal: TerminalRefTraverser[] = [];
  stateGen: GrammarAnalysisStateGenerator;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminalReferences.push(this);
    if (this.node && this.node.value > parser.maxTokenId) parser.maxTokenId = this.node.value;
    this.stateGen = new GrammarAnalysisStateGenerator(this, this.nextStepsFromTerminal);
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    firstSteps.push(this);
  }

  possibleNextSteps(nextStepsFromTerminal: null, fromChild: null) {
    if (this.parent) this.parent.possibleNextSteps(this.nextStepsFromTerminal, this);
  }

}

export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRule) {
    super(parser, parent, node);
    this.index = node.index;
  }

  
  findRuleNodeParent(rule: string, incl=false) {
    if (incl && rule === this.node.rule) {
      return this;
    } else if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

  
  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    traversionPath[this.node.nodeIdx] = this;
    this.child.possibleFirstSteps(traversionPath, firstSteps);
  }

}


// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SemanticTraverser extends EmptyTraverser {
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun   "+this.node);
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
