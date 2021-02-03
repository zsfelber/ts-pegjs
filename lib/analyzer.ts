import { PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';


namespace Factory {

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

var traversionSteps: TraversionStep[] = [];

var savedStates: Map<string, LevelTraversionState> = new Map;

class LevelTraversionState {

  parent: LevelTraversionState;

  child: LevelTraversionState;

  level: number;

  traverser: RuleElementTraverser;

  positionInCurrent: number;

  starterState: LevelTraversionState;

  uniqueStateKey: string;

  transitions: Map<number, LevelTraversionState>;

  repetitions: Map<number, LevelTraversionState>;

  constructor(parent: LevelTraversionState, child: LevelTraversionState, traverser: RuleElementTraverser) {
    //this.stateId = stateIndices++;
    this.parent = parent;
    this.child = child;
    this.level = parent ? parent.level + 1 : 0;
    this.traverser = traverser;
    this.positionInCurrent = 0;
  }

  setChildTo(childTraverser: RuleElementTraverser) {
    if (!this.child || this.child.traverser !== childTraverser) {
      var newChild = new LevelTraversionState(this, null, childTraverser);
      this.child = newChild;
    }
    return newChild;
  }

  saveState(step: TraversionStep) {
    var uid = this.genUniqueStateKey();
    var saved = this.clone();
    saved.transitions = step.transitions;
    step.transitions = null;
    saved.uniqueStateKey = uid;
    savedStates.set(uid, saved);
    return saved;
  }
  
  private genUniqueStateKey() {
    var id = hex3(this.traverser.node.nodeIdx) + hex2(this.positionInCurrent);
    for (var node: LevelTraversionState = this.parent; !!node; node = node.parent) {
      id = node.uniqueStateKey + id;
    }
    return id;
  }

  clone(): LevelTraversionState {
    var clonedState = new LevelTraversionState(this.parent, this.child.clone(), this.traverser);
    clonedState.positionInCurrent = this.positionInCurrent;
    return clonedState;
  }

}


class TraversionStep {

  stateId: number;

  token: number;

  // tokenId -> traversion state
  transitions: Map<number, LevelTraversionState> = new Map;

  constructor() {
    this.stateId = traversionSteps.length;
    traversionSteps.push(this);
  }
}

enum TraversionResult {
  FORWARD, ACCEPT, REJECT
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

  
  collectPossibleFirstSteps(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {

    //if (!steppedState.starterState) {
    //  steppedState.starterState = steppedState.saveState();
    //}

    //var newState = new TraversionState(parentState, this);
    if (steppedState.traverser !== this) throw new Error();

    var currentChild = this.children[steppedState.positionInCurrent];
    var steppedChildState = steppedState.setChildTo(currentChild);

    w:while (true) {

      var resultInChild = currentChild.collectPossibleFirstSteps(currentStep, steppedChildState);

      switch (resultInChild) {
        case TraversionResult.ACCEPT:

          currentStep.transitions.set(currentStep.token, steppedState.clone());

          if (this.children.length > ++steppedState.positionInCurrent) {
            currentChild = this.children[steppedState.positionInCurrent];
            steppedChildState = steppedState.setChildTo(currentChild);
          } else {
            var savedState = steppedState.saveState(currentStep);

            var result = this.onChildrenAccept(currentStep, savedState);
            if (result !== undefined) {
              return result;
            }

            break w;
          }
          break;
        case TraversionResult.FORWARD:
          if (this.children.length > ++steppedState.positionInCurrent) {
            currentChild = this.children[steppedState.positionInCurrent];
            steppedChildState = steppedState.setChildTo(currentChild);
          } else {

            var result = this.onChildrenForward(currentStep, steppedState);
            if (result !== undefined) {
              return result;
            }

          }
          break;

        case TraversionResult.REJECT:
          var result = this.onChildReject(currentStep, steppedState);
          if (result !== undefined) {
            return result;
          }
          if (this.children.length <= steppedState.positionInCurrent) {
            break w;
          }
          break;
      }
    }


    var result = this.onEndReached(currentStep, steppedState);

    return result;
  }

  onChildrenAccept(currentStep: TraversionStep, savedState: LevelTraversionState): TraversionResult {
    return TraversionResult.FORWARD;
  }
  onChildrenForward(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {
    return TraversionResult.FORWARD;
  }

  onChildReject(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {
    return TraversionResult.REJECT;
  }

  onEndReached(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {
    return TraversionResult.ACCEPT;
  }


}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {

  onChildReject(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {
    steppedState.positionInCurrent++;
    return undefined;
  }
    

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SequenceTraverser extends RuleElementTraverser {



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


}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleTraverser extends SingleCollectionTraverser {


}


// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class EmptyTraverser extends RuleElementTraverser {
  
  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("parser.children.length !== 0  " + this.node);
      return 1;
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class OptionalTraverser extends SingleTraverser {

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {

  onChildrenAccept(currentStep: TraversionStep, savedState: LevelTraversionState): TraversionResult {

    // Repeat all transitions in all finishing states of this node
    savedState.repetitions = savedState.transitions;

    return TraversionResult.FORWARD;
  }

}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {

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

}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class TerminalRefTraverser extends EmptyTraverser {

  node: PTerminalRef;

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  collectPossibleFirstSteps(currentStep: TraversionStep, steppedState: LevelTraversionState): TraversionResult {
    if (steppedState.positionInCurrent === 0) {

      steppedState.positionInCurrent++;

      var myToken = this.node.value;
      currentStep.token = myToken;
      if (currentStep.transitions.get(myToken)) {
        return TraversionResult.REJECT;
      } else {
        return TraversionResult.ACCEPT;
      }
    } else {
      return TraversionResult.REJECT;
    }
  }

}

export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  constructor(node: PRule) {
    super(node);
    this.index = node.index;
  }

  generateParseTreeTraversionTable() {
    while (true) {
      var startingTopState = new LevelTraversionState(null, null, this);

    
    }
  }

  traverseFromState(currentState: LevelTraversionState) {
    var currentStep = new TraversionStep();

    this.collectPossibleFirstSteps(currentStep, currentState);

    currentStep.transitions.forEach(resultingState=>{
      this.traverseFromState(resultingState);
    });
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
