import { start } from 'repl';
import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';


export namespace Analysis {

  export var ERRORS = 0;

  export var ruleTable: PRule[];

}


namespace Factory {

  export var parseTables = new Map<string, ParseTable>();

  export function createTraverser(parser: ParseTable, parent: RuleElementTraverser, node: PValueNode) {
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

export class ParseTable {

  rule: PRule;
  dependencyOf: ParseTable;
  startingState : GrammarAnalysisState;
  // Map  Leaf parser nodeIdx -> 
  allStates: GrammarAnalysisState[] = [];
  maxTokenId: number;
  dependencies: ParseTable[] = [];
  allTerminals: TerminalRefTraverser[] = [];
  firstSteps: TerminalRefTraverser[];

  childRules: Map<string, EntryPointTraverser> = new Map;

  static createForRule(rule: PRule, dependencyOf?: ParseTable) {
    var parseTable = Factory.parseTables.get(rule.rule);
    if (!parseTable) {
      parseTable = new ParseTable(rule, dependencyOf);
      Factory.parseTables.set(rule.rule, parseTable);
    }
    return parseTable;
  }

  private constructor(rule: PRule, dependencyOf?: ParseTable) {
    this.rule = rule;
    this.dependencyOf = dependencyOf;
    if (dependencyOf) {
      dependencyOf.dependencies.push(this);
    }

    var traverser = new EntryPointTraverser(this, null, rule);

    this.firstSteps = [];
    traverser.possibleFirstSteps([], this.firstSteps);

    var totalStates = new Map<number, boolean>();
    this.allTerminals.forEach(t=>{
      totalStates.set(t.node.nodeIdx, true);
    })

    var previousSteps = this.firstSteps;
    var newTerminals: TerminalRefTraverser[];
    do {
      newTerminals = [];

      previousSteps.forEach(previousStep=>{
        previousStep.possibleNextSteps(null, null);

        previousStep.stepsFromTerminal.forEach(t=>{
          if (!totalStates.get(t.node.nodeIdx)) {
            totalStates.set(t.node.nodeIdx, true);
            newTerminals.push(t);
            console.log("New terminal available from transition : "+t.node.terminal)
          }
        })
      });

      previousSteps = newTerminals;

    } while (newTerminals.length);

    var startingState = new GrammarAnalysisState(null, this.firstSteps);

    //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
    //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number

    this.startingState = startingState;
    this.allTerminals.forEach(t=>{
      t.state.index = this.allStates.length;
      this.allStates.push(t.state);
    });
  }

  getReferencedRule(node: PRule) {
    var rule: EntryPointTraverser;
    rule = this.childRules.get(node.rule);
    if (!rule) {
      rule = new EntryPointTraverser(this, null, node);
      this.childRules.set(node.rule, rule);
    } 
    return rule;
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

  index: number;

  startingPoint: PTerminalRef;

  steps: TerminalRefTraverser[];

  // tokenId -> traversion state
  _transitions: Map<number, GrammarAnalysisState>;

  constructor(startingPointTraverser: TerminalRefTraverser, steps: TerminalRefTraverser[]) {
    this.startingPoint = startingPointTraverser ? startingPointTraverser.node : null;
    this.steps = steps;
  }

  get transitions() {
    if (this._transitions) {
      return this._transitions;
    } else {
      this._transitions = new Map;
      this.steps.forEach(nextTerm=>{
        if (!this.transitions.get(nextTerm.node.value)) {
          this.transitions.set(nextTerm.node.value, nextTerm.state);
        }
      })
    }
  }

  ser(maxTknId: number): number[] {
    var toTknIds:number[] = [];
    toTknIds[maxTknId] = 0;
    this.transitions.forEach((trans, tokenId)=>{
      toTknIds[tokenId] = trans.index;
    });
    return toTknIds;
  }

}



// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class RuleElementTraverser {

  readonly constructionLevel: number;
  readonly parser: ParseTable;
  readonly parent: RuleElementTraverser;
  readonly node: PValueNode;
  readonly children: RuleElementTraverser[] = [];

  constructor(parser: ParseTable, parent: RuleElementTraverser, node: PValueNode) {
    this.parent = parent;
    this.parser = parser;
    this.node = node;
    this.constructionLevel = parent ? parent.constructionLevel+1 : 0;

    this.node.children.forEach(n => {
      this.children.push(Factory.createTraverser(parser, this, n));
    });
    if (this.checkConstructFailed()) {
    //  throw new Error("Ast construction failed.");
    }
  }

  checkConstructFailed(): any {
  }

  abstract possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]);


  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    if (this.parent) this.parent.possibleNextSteps(stepsFromTerminal, this);
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
  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    var ind = this.children.indexOf(fromChild) + 1;
    if (ind < this.children.length) {
      this.children[ind].possibleFirstSteps([], stepsFromTerminal);
    } else if (this.parent) {
      this.parent.possibleNextSteps(stepsFromTerminal, this);
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleCollectionTraverser extends RuleElementTraverser {
  
  child: RuleElementTraverser;

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("this.children.length:"+this.children.length+" !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
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

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps([], stepsFromTerminal);
    if (this.parent) this.parent.possibleNextSteps(stepsFromTerminal, this);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps([], stepsFromTerminal);
    if (this.parent) this.parent.possibleNextSteps(stepsFromTerminal, this);
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends EmptyTraverser {

  node: PRuleRef;
  recursive: boolean;
  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;

  constructor(parser: ParseTable, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);

  }

  checkConstructFailed() {
    this.recursive = !!this.findRuleNodeParent(this.node.rule);
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];

    var dirty = super.checkConstructFailed();
    if (!this.targetRule) {
      console.error("no this.targetRule  " + this.node);
      dirty = 1;
    }
    if (this.recursive) {
      console.warn("recursive : " + this.node);
    }
    return dirty;
  }

  possibleFirstSteps(traversionPath: {[index: number]:EntryPointTraverser}, firstSteps: TerminalRefTraverser[]) {
    if (!this.linkedRuleEntry) {
      this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
    }
    // we don't create cycle
    // also, it is semantically correct...
    if (!traversionPath[this.targetRule.nodeIdx]) {
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
  stepsFromTerminal: TerminalRefTraverser[] = [];
  state: GrammarAnalysisState;

  constructor(parser: ParseTable, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    parser.allTerminals.push(this);
    if (this.node && this.node.value > parser.maxTokenId) parser.maxTokenId = this.node.value;
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

  possibleNextSteps(stepsFromTerminal: null, fromChild: null) {
    if (this.parent) this.parent.possibleNextSteps(this.stepsFromTerminal, this);
    this.state = new GrammarAnalysisState(this, this.stepsFromTerminal);
  }

}

export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  constructor(parser: ParseTable, parent: RuleElementTraverser, node: PRule) {
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
abstract class SemanticTraverser extends SingleTraverser {
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun");
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
