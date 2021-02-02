import { IParseRunner, PNodeKind } from '.';
import { PRule, PRuleRef, PTerminalRef, PValueNode, SerDeser } from './parsers';
import { IToken } from './index';


const peg$FAILED: Readonly<any> = {};

const peg$SUCCESS: Readonly<any> = {};


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

var stateIndices: number = 0;

class TraversionState {

  stateId: number;

  parent: TraversionState;

  children: TraversionState[] = [];

  traverser: RuleElementTraverser;

  positionInCurrent: number;

  constructor(parent: TraversionState, traverser: RuleElementTraverser) {
    this.stateId = stateIndices++;
    this.parent = parent;
    this.traverser = traverser;
    this.positionInCurrent = 0;
  }

  ensureChildAt(childTraverser: RuleElementTraverser, pos: number) {
    if (pos >= this.children.length) {
      var newChild = new TraversionState(this, childTraverser);
      this.children.push(newChild);
      if (pos >= this.children.length) {
        throw new Error();
      }
      return newChild;
    }
    return this.children[pos];
  }

  push(traverser: RuleElementTraverser) {
    var result = new TraversionState(this, traverser);
    return result;
  }
}

class TraversionStateDelta {

  childDelta: TraversionStateDelta;

  traverser: RuleElementTraverser;

  newPosition: number;

  acceptedToken: number;

  constructor(childDelta: TraversionStateDelta, traverser: RuleElementTraverser, newPosition: number, acceptedToken: number) {
    this.childDelta = childDelta;
    this.traverser = traverser;
    this.newPosition = newPosition;
    this.acceptedToken = acceptedToken;
  }
}

const peg$BRANCH_FINISHED: TraversionStateDelta = {from:undefined, positionChange:false, acceptedToken:-1};

class RuleProcessStack {
  parser: IParseRunner;
  parent: RuleProcessStack;
  argsToLeft: any[];

  currentTraversionState: TraversionState;

  constructor(
    parser: IParseRunner,
    parent: RuleProcessStack,
    argsToLeft: any[]     ) {
      this.parser = parser;
      this.parent = parent;
      this.argsToLeft = argsToLeft;
  }
 
  push(stack: RuleProcessStack, newArgs: any[]): RuleProcessStack {
    var result = new RuleProcessStack(this.parser, this, newArgs);
    return result;
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

  acceptNextToken(topState: TraversionState, thisLevelState: TraversionState): TraversionStateDelta {

    //var thisLevelState = new TraversionState(parentState, this);
    if (thisLevelState.traverser !== this) throw new Error();

    var position = thisLevelState.positionInCurrent;
    do {
      var currentChild = this.children[position];
      var currentChildState = thisLevelState.ensureChildAt(currentChild, position);

      var r = currentChild.acceptNextToken(topState, currentChildState);

      if (r === peg$BRANCH_FINISHED) {
        position++;
      } else {
        var thisLevelDelta = new TraversionStateDelta(r, this, position, r.acceptedToken);
      }
    } while (position < this.children.length);

    return peg$BRANCH_FINISHED;
  }

  parse(stack: RuleProcessStack) {

    var pos = stack.parser.pos;

    var r0 = this.parseImpl(stack);

    if (r0 === peg$FAILED) {
      stack.parser.pos = pos;
      return r0;
    } else if (r0 === peg$SUCCESS) {
      var r;
      if (this.node.action) {
        r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
      } else {
        r = stack.argsToLeft;
      }
      return r;
    } else {
      return r0;
    }
  }


  abstract parseImpl(stack: RuleProcessStack): any;
}


// NOTE Not exported.  The only exported one is EntryPointTraverser
class ChoiceTraverser extends RuleElementTraverser {

  parseImpl(stack: RuleProcessStack) {
    this.children.forEach(n => {
      var r = n.parse(stack);
      if (r !== peg$FAILED) {
        return r;
      }
    });
    return peg$FAILED;
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SequenceTraverser extends RuleElementTraverser {

  parseImpl(stack: RuleProcessStack) {

    var args = [];
    stack = stack.push(stack, args);

    this.children.forEach(n => {
      var r = n.parse(stack);
      if (r === peg$FAILED) {
        return peg$FAILED;
      } else if (n.node.label) {
        args.push(r);
      }
    });
    return peg$SUCCESS;
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
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
abstract class SingleTraverser extends SingleCollectionTraverser {

  
  parse(stack: RuleProcessStack) {

    var pos = stack.parser.pos;

    var r0 = this.parseImpl(stack);

    if (r0 === peg$FAILED) {
      stack.parser.pos = pos;
      return r0;
    } else if (r0 === peg$SUCCESS) {
      var r;
      if (this.node.action) {
        r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
      } else {
        r = stack.argsToLeft[0];
      }
      return r;
    } else {
      return r0;
    }
  }

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

  parseImpl(stack: RuleProcessStack) {

    var args = [];
    stack = stack.push(stack, args);

    var r = this.child.parse(stack);
    if (r === peg$FAILED) {
      return null;
    } else {
      args.push(r);
    }

    return peg$SUCCESS;
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class ZeroOrMoreTraverser extends SingleCollectionTraverser {

  parseImpl(stack: RuleProcessStack) {

    var items = [];
    stack = stack.push(stack, items);

    while (true) {
      var r = this.child.parse(stack);
      if (r === peg$FAILED) {
        break;
      } else {
        items.push(r);
      }
    }

    return peg$SUCCESS;
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class OneOrMoreTraverser extends SingleCollectionTraverser {

  parseImpl(stack: RuleProcessStack) {

    var items = [];
    stack = stack.push(stack, items);

    var r = this.child.parse(stack);
    if (r === peg$FAILED) {
      return peg$FAILED;
    }
    items.push(r);
    while (true) {
      r = this.child.parse(stack);
      if (r === peg$FAILED) {
        break;
      } else {
        items.push(r);
      }
    }

    return peg$SUCCESS;
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class RuleRefTraverser extends EmptyTraverser {

  node: PRuleRef;
  ruleEntryTraverser: EntryPointTraverser;

  constructor(node: PRuleRef) {
    super(node);
    this.ruleEntryTraverser = SerDeser.ruleTable[node.ruleIndex];
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.ruleEntryTraverser) {
      console.error("no this.ruleEntryTraverser  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point
    return stack.parser.run(this.ruleEntryTraverser);
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

  acceptNextToken(topState: TraversionState, thisLevelState: TraversionState): TraversionStateDelta {
    var delta = new TraversionStateDelta(null, this, 1, this.node.value);
    return delta;
  }

  parseImpl(stack: RuleProcessStack) {
    var token = stack.parser.next();
    if (token && token.tokenId === this.node.value) {
      return token;
    } else {
      return peg$FAILED;
    }
  }
}

//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the only exported Traverser                 !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   A   R   S   E   R
//   !!
//
export class EntryPointTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  constructor(node: PRule) {
    super(node);
    this.index = node.index;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point   not implemented
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
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return undefined;
    else
      return peg$FAILED;
  }
}

// NOTE Not exported.  The only exported one is EntryPointTraverser
class SemanticNotTraverser extends SingleTraverser {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return peg$FAILED;
    else
      return undefined;
  }
} 
