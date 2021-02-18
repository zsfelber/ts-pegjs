import {
  HyperG,
  HyperGEnvType,
  IToken,
  Packrat,
  PFunction,
  PNode,
  PNodeKind,
  PRule,
  PRuleRef,
  PTerminalRef,
  PValueNode,
} from '.';

export const peg$FAILED: Readonly<any> = {};

export const peg$SUCCESS: Readonly<any> = {};

// NOTE The only exported Parser is EntryPointParser
namespace Factory {

  export function createParser(node: PNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceInterpreter(node as PValueNode);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceInterpreter(node as PValueNode);
      case PNodeKind.OPTIONAL:
        return new OptionalInterpreter(node as PValueNode);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndInterpreter(node as PValueNode);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotInterpreter(node as PValueNode);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreInterpreter(node as PValueNode);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreInterpreter(node as PValueNode);
      case PNodeKind.RULE_REF:
        return new RuleRefInterpreter(node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefInterpreter(node as PTerminalRef);
      case PNodeKind.RULE:
        return new EntryPointInterpreter(node as PRule);
  
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class RuleProcessStack {
  parser: InterpreterRunner;
  parent: RuleProcessStack;
  argsToLeft: DeferredReduce[];

  constructor(
    parser: InterpreterRunner,
    parent: RuleProcessStack,
    argsToLeft: DeferredReduce[]     ) {
      this.parser = parser;
      this.parent = parent;
      this.argsToLeft = argsToLeft;
  }
 
  push(stack: RuleProcessStack, newArgs: DeferredReduce[]): RuleProcessStack {
    var result = new RuleProcessStack(this.parser, this, newArgs);
    return result;
  }
}


// NOTE :
// We collect the reduced nodes but we don't actually reduce
// until the final state top node reached ! 
// We can omit calculation of the dead branches this way:

export class DeferredReduce {

  readonly action: PFunction;
  readonly fun: (...etc) => any;
  readonly argsToLeft: DeferredReduce[];
  readonly calculatedArgs: any[];
  readonly pos: number;

  constructor(action: PFunction, argsToLeft: any[], pos: number) {
    this.action = action;
    this.fun = action?action.fun:null;
    this.argsToLeft = argsToLeft;
    this.pos = pos;
  }

  calculateFromTop(parser: InterpreterRunner) {
    const p = parser.owner;
    var savedPos = p.inputPos;
    var result = this.calculate(parser);
    p.inputPos = savedPos;
    return result;
  }

  private calculate(parser: InterpreterRunner) {
    const p = parser.owner;
    this.calculateArgs(parser);
    if (this.fun) {
      p.inputPos = this.pos;
      return this.fun.apply(parser, this.calculateArgs);
    } else {
      return this.calculatedArgs;
    }
  }

  private calculateArgs(parser: InterpreterRunner) {
    this.argsToLeft.forEach(arg=>{
      var result: any;
      if (arg) {
        result = arg.calculate(parser);
      } else {
        result = arg;
      }
      this.calculatedArgs.push(result);
    });
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class RuleElementInterpreter {

  readonly parent: RuleElementInterpreter;
  readonly node: PNode;
  readonly children: RuleElementInterpreter[] = [];

  constructor(node: PNode) {
    this.node = node;
    this.node.children.forEach(n => {
      this.children.push(Factory.createParser(n));
    });
    if (this.checkConstructFailed()) {
      throw new Error("Ast construction failed.");
    }
  }

  checkConstructFailed(): any {
  }

  parse(stack: RuleProcessStack) {
    const p = stack.parser.owner;

    var pos = p.inputPos;

    var r0 = this.parseImpl(stack);

    if (r0 === peg$FAILED) {
      p.inputPos = pos;
      return r0;
    } else if (r0 === peg$SUCCESS) {
      var r = new DeferredReduce(this.node.action, stack.argsToLeft, p.inputPos);
      return r;
    } else {
      return r0;
    }
  }


  abstract parseImpl(stack: RuleProcessStack): any;
}


// NOTE Not exported.  The only exported one is EntryPointParser
class ChoiceInterpreter extends RuleElementInterpreter {

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

// NOTE Not exported.  The only exported one is EntryPointParser
class SequenceInterpreter extends RuleElementInterpreter {

  parseImpl(stack: RuleProcessStack) {

    var args: DeferredReduce[] = [];
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

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleCollectionInterpreter extends RuleElementInterpreter {
  
  child: RuleElementInterpreter;

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("parser.children.length !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleInterpreter extends SingleCollectionInterpreter {


}


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class EmptyInterpreter extends RuleElementInterpreter {
  
  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("parser.children.length !== 0  " + this.node);
      return 1;
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class OptionalInterpreter extends SingleInterpreter {

  parseImpl(stack: RuleProcessStack) {

    var args: DeferredReduce[] = [];
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

// NOTE Not exported.  The only exported one is EntryPointParser
class ZeroOrMoreInterpreter extends SingleCollectionInterpreter {

  parseImpl(stack: RuleProcessStack) {

    var items: DeferredReduce[] = [];
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

// NOTE Not exported.  The only exported one is EntryPointParser
class OneOrMoreInterpreter extends SingleCollectionInterpreter {

  parseImpl(stack: RuleProcessStack) {

    var items: DeferredReduce[] = [];
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

// NOTE Not exported.  The only exported one is EntryPointParser
class RuleRefInterpreter extends EmptyInterpreter {

  node: PRuleRef;
  _ruleEntryParser: EntryPointInterpreter;

  constructor(node: PRuleRef) {
    super(node);
  }
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.rule) {
      console.error("no this.node.rule  " + this.node);
      dirty = 1;
    }
    return dirty;
  }
  get ruleEntryParser() {
    if (!this._ruleEntryParser) {
      this._ruleEntryParser = HyperG.ruleInterpreters[this.node.ruleIndex];
      if (!this._ruleEntryParser) {
        console.error("no this.ruleEntryParser  " + this.node);
      }
    }
    return this._ruleEntryParser;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point
    return stack.parser.run(this.ruleEntryParser);
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class TerminalRefInterpreter extends EmptyInterpreter {

  node: PTerminalRef;

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (HyperG.Env === HyperGEnvType.ANALYZING) {
      if (!this.node.terminal) {
        console.error("no this.node.terminal  " + this.node);
        dirty = 1;
      }
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    const p = stack.parser.owner;
    var token = p.next();
    if (token && token.tokenId === this.node.value) {
      return token;
    } else {
      p.fail(token);
      return peg$FAILED;
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SemanticInterpreter extends SingleInterpreter {
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun");
      dirty = 1;
    }
    return dirty;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class SemanticAndInterpreter extends SemanticInterpreter {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return undefined;
    else
      return peg$FAILED;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class SemanticNotInterpreter extends SingleInterpreter {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return peg$FAILED;
    else
      return undefined;
  }
} 












//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the only exported Parser                 !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   A   R   S   E   R
//   !!
//
export class EntryPointInterpreter extends RuleElementInterpreter {

  node: PRule;
  index: number;
  child: RuleElementInterpreter;

  constructor(node: PRule) {
    super(node);
    this.index = node.index;
    this.child = this.children[0];
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point   not implemented
  }
}

export interface IBaseParserProgram {

  inputPos: number;
  currentRule: number;
  
  readonly numRules: number;

  fail(token: IToken): void;
  cacheKey(rule: PRule): number;
  next(): IToken;

}



export interface IParserProgram extends IBaseParserProgram {

}


export class InterpreterRunner {

  owner: IParserProgram;
  packrat: Packrat;
  numRules: number;
  
  constructor(owner: IParserProgram) {
    this.owner = owner;
    this.packrat = new Packrat(owner);
    this.numRules = owner.numRules;
  }

  run(rule: EntryPointInterpreter): any {
    const owner = this.owner;
    const cached = this.packrat.readCacheEntry(rule.node);

    if (cached.nextPos!==undefined) {
      owner.inputPos = cached.nextPos;
      return cached.result;
    }

    owner.currentRule = rule.node.index;
    var stack = new RuleProcessStack(this, null, []);

    // TODO
    var ruleMaxFailPos = 0;

    var result = rule.child.parse(stack);

    Object.assign(cached, { nextPos: owner.inputPos, maxFailPos: ruleMaxFailPos, 
      result });
  }
}
