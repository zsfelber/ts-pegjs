import { start } from 'repl';
import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';


namespace Factory {

  export var allTerminals: TerminalRefTraverser[] = [];

  export function createTraverser(node: PValueNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceTraverser(node);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceTraverser(node);
      case PNodeKind.OPTIONAL:
        return new OptionalTraverser(node);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndTraverser(node);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotTraverser(node);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreTraverser(node);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreTraverser(node);
      case PNodeKind.RULE_REF:
        return new RuleRefTraverser(node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefTraverser(node as PTerminalRef);
      case PNodeKind.RULE:
        return new EntryPointTraverser(node as PRule);
  
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

  startingState : GrammarAnalysisState;
  // Map  Leaf parser nodeIdx -> 
  allStates: Map<number, GrammarAnalysisState> = new Map;

  constructor(startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[]) {
    this.startingState = startingState;
    allTerminals.forEach(t=>{
      this.allStates.set(t.node.nodeIdx, t.state);
    });
  }

  ser() {
    
  }
}

export class GrammarAnalysisState {

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

}



// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class RuleElementTraverser {

  readonly parent: RuleElementTraverser;
  readonly node: PValueNode;
  readonly children: RuleElementTraverser[] = [];

  constructor(node: PValueNode) {
    this.node = node;
    this.node.children.forEach(n => {
      this.children.push(Factory.createTraverser(n));
    });
    if (this.checkConstructFailed()) {
      throw new Error("Ast construction failed.");
    }
  }

  checkConstructFailed(): any {
  }

  abstract possibleFirstSteps(firstSteps: TerminalRefTraverser[]);


  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.parent.possibleNextSteps(stepsFromTerminal, this);
  }


}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {

 
  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {

    this.children.forEach(ch=>{
      ch.possibleFirstSteps(firstSteps);
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


  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {
    this.children[0].possibleFirstSteps(firstSteps);
  }
  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    var ind = this.children.indexOf(fromChild) + 1;
    if (ind < this.children.length) {
      this.children[ind].possibleFirstSteps(stepsFromTerminal);
    } else {
      this.parent.possibleNextSteps(stepsFromTerminal, this);
    }
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleCollectionTraverser extends RuleElementTraverser {
  
  child: RuleElementTraverser;

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("parser.children.length !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
  }


  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {
    this.child.possibleFirstSteps(firstSteps);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleTraverser extends SingleCollectionTraverser {


}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class EmptyTraverser extends RuleElementTraverser {
  
  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("parser.children.length !== 0  " + this.node);
      return 1;
    }
  }

  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {
  }
}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class OptionalTraverser extends SingleTraverser {

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps(stepsFromTerminal);
    this.parent.possibleNextSteps(stepsFromTerminal, this);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {

  possibleNextSteps(stepsFromTerminal: TerminalRefTraverser[], fromChild: RuleElementTraverser) {
    this.possibleFirstSteps(stepsFromTerminal);
    this.parent.possibleNextSteps(stepsFromTerminal, this);
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends EmptyTraverser {

  node: PRuleRef;
  ruleEntryTraverser: EntryPointTraverser;

  constructor(node: PRuleRef) {
    super(node);
    //this.ruleEntryTraverser = SerDeser.ruleTable[node.ruleIndex];
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.ruleEntryTraverser) {
      console.error("no this.ruleEntryTraverser  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {
    this.ruleEntryTraverser.possibleFirstSteps(firstSteps);
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class TerminalRefTraverser extends EmptyTraverser {

  node: PTerminalRef;
  stepsFromTerminal: TerminalRefTraverser[] = [];
  state: GrammarAnalysisState;
  
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    Factory.allTerminals.push(this);
    return dirty;
  }

  possibleFirstSteps(firstSteps: TerminalRefTraverser[]) {
    firstSteps.push(this);
  }

  possibleNextSteps(stepsFromTerminal: null, fromChild: null) {
    this.parent.possibleNextSteps(this.stepsFromTerminal, this);
    this.state = new GrammarAnalysisState(this, this.stepsFromTerminal);
  }

}

export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  constructor(node: PRule) {
    super(node);
    this.index = node.index;
  }

  generateParseTreeTraversionTable(): ParseTable {
    Factory.allTerminals = [];

    var firstSteps: TerminalRefTraverser[] = [];
    this.possibleFirstSteps(firstSteps);

    firstSteps.forEach(terminal=>{
      terminal.possibleNextSteps(null, null);
    });

    var step0 = new GrammarAnalysisState(null, firstSteps);
    var result = new ParseTable(step0, Factory.allTerminals);

    return result;
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
