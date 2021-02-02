import { ICached, IToken } from './index';

const peg$FAILED: Readonly<any> = {};


export enum PNodeKind {
  GRAMMAR = "grammar",
  RULE = "rule",
  TERMINAL = "terminal",
  CHOICE = "choice",
  SEQUENCE = "sequence",
  OPTIONAL = "optional",
  ONE_OR_MORE = "one_or_more",
  ZERO_OR_MORE = "zero_or_more",
  EMPTY = "empty",
  SINGLE = "single",
  SEMANTIC_AND = "semantic_and",
  SEMANTIC_NOT = "semantic_not",
  RULE_REF = "rule_ref",
  TERMINAL_REF = "terminal_ref"
}
export enum PActionKind {
  RULE = "RULE",
  PREDICATE = "PREDICATE"
}

const ExpextedPNodeTypes = [];
const ExpextedPNodeKinds = [];


export class PNode {
  parent: PNode;
  kind: PNodeKind;
  children: PNode[] = [];
  index: number;
  nodeIdx: number;

  static xkind = PNodeKind.GRAMMAR;

  constructor(parent: PNode) {
    
    if (parent) parent.children.push(this);
  }

  as<P extends PNode>(cons:new (parent:PNode, ...etc)=>P) : P {
    if (this["__proto"] === cons) {
      return this as any;
    } else {
      return null;
    }
  }

  ass<P extends PNode>(cons:new (parent:PNode, ...etc)=>P) : P {
    if (this["__proto"] === cons) {
      return this as any;
    } else {
      throw new Error("Invalid class cast from : "+this);
    }
  }

  toString() {
    return "" + this.kind;
  }
}

export class PActContainer extends PNode {
  actions?: PFunction[];
  ruleActions?: PFunction[];

  get symbol(): string {
    return null;
  }

  toString() {
    return this.kind + " " + this.symbol;
  }
}

export class PGrammar extends PActContainer {
  kind = PNodeKind.GRAMMAR;
  children: PActContainer[];
}

export class PRule extends PActContainer {
  kind = PNodeKind.RULE;
  rule?: string;
  index: number;

  constructor(parent: PNode, index: number) {
    super(parent);
    this.index = index;
  }

  get symbol() {
    return this.rule;
  }
}

export class PTerminal extends PActContainer {
  kind = PNodeKind.TERMINAL;
  terminal?: string;

  get symbol() {
    return this.terminal;
  }
}

export class PLogicNode extends PNode {
  action?: PFunction;

}

export class PValueNode extends PLogicNode {
  label?: string;

  toString() {
    return this.kind + (this.label ? " " + this.label : "");
  }
}

export class PRef extends PValueNode {
  get symbol() {
    return null;
  }

  toString() {
    return this.kind + (this.label ? " " + this.label : "") + " " + this.symbol;
  }
}

export class PRuleRef extends PRef {
  kind = PNodeKind.RULE_REF;
  rule?: string;
  ruleIndex?: number;

  get symbol() {
    return this.rule;
  }
}

export class PTerminalRef extends PRef {
  kind = PNodeKind.TERMINAL_REF;
  terminal?: string;

  value?: number;

  get symbol() {
    return this.terminal;
  }
}

export class PSemanticAnd extends PLogicNode {
  kind = PNodeKind.SEMANTIC_AND;

}

export class PSemanticNot extends PLogicNode {
  kind = PNodeKind.SEMANTIC_NOT;

}


ExpextedPNodeTypes[PNodeKind.GRAMMAR] = PGrammar;
ExpextedPNodeTypes[PNodeKind.RULE] = PRule;
ExpextedPNodeTypes[PNodeKind.CHOICE] = PValueNode;
ExpextedPNodeTypes[PNodeKind.SEQUENCE] = PValueNode;
ExpextedPNodeTypes[PNodeKind.OPTIONAL] = PValueNode;
ExpextedPNodeTypes[PNodeKind.ONE_OR_MORE] = PValueNode;
ExpextedPNodeTypes[PNodeKind.ZERO_OR_MORE] = PValueNode;
ExpextedPNodeTypes[PNodeKind.SEMANTIC_AND] = PSemanticAnd;
ExpextedPNodeTypes[PNodeKind.SEMANTIC_NOT] = PSemanticNot;

export class PFunction {
  name: string;
  ownerRule: PActContainer;
  target: PLogicNode;

  index: number;
  args: PCallArg[];

  generatedMemberName?: string;
  code?: string[];
  kind: PActionKind;

  fun: (...etc) => any;
}

export class PCallArg {
  label?: string;
  type?: string;
  index: number;
  evaluate: PValueNode;
}

// NOTE The only exported Parser is EntryPointParser
namespace Factory {

  export function createParser(parser: IParseRunner, node: PValueNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceParser(parser, node);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceParser(parser, node);
      case PNodeKind.OPTIONAL:
        return new OptionalParser(parser, node);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndParser(parser, node);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotParser(parser, node);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreParser(parser, node);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreParser(parser, node);
      case PNodeKind.RULE_REF:
        return new RuleRefParser(parser, node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefParser(parser, node as PTerminalRef);
      case PNodeKind.RULE:
        return new EntryPointParser(parser, node as PRule);
  
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class RuleProcessStack {
  parser: IParseRunner;
  parent: RuleProcessStack;
  argsToLeft: any[];

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


//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the main entry point                     !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   r  o  c  e  s  s  o  r     object
//   !!
//
export interface IParseRunner {

  readonly pos: number; 
  readonly numRules: number;

  next(): IToken;


  rule(index: number): PRule;

  run(rule: RuleParser): any;

}

export abstract class PackratRunner implements IParseRunner {
  readonly peg$resultsCache: {[id: number]: ICached} = {};

  abstract get pos(): number;
  abstract set pos(topos: number);
  
  abstract get numRules(): number;
  abstract next(): IToken;
  abstract rule(index: number): PRule;
  
  run(rule: EntryPointParser): any {
    const key = this.pos * this.numRules + rule.index;
    const cached: ICached = this.peg$resultsCache[key];
    if (cached) {
      this.pos = cached.nextPos;
    }
    if (cached) {
      return cached.result;
    }

    var stack = new RuleProcessStack(this, null, []);

    // TODO
    var ruleMaxFailPos = 0;

    var result = rule.child.parseImpl(stack);

    this.peg$resultsCache[key] = { nextPos: this.pos, maxFailPos: ruleMaxFailPos, 
      result };
  }
}

//
// TODO for graph traverser parse tree generator
// As I was thinking it is possible / even trivial 
// !!!
//export abstract class CollectJumpStatesRunner implements IParseRunner {
//}
//


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class RuleParser {

  readonly parser: IParseRunner;
  readonly parent: RuleParser;
  readonly node: PValueNode;
  readonly children: RuleParser[] = [];

  constructor(parser: IParseRunner, node: PValueNode) {
    this.parser = parser;
    this.node = node;
    this.node.children.forEach(n => {
      this.children.push(Factory.createParser(parser, n));
    });
    if (this.checkConstructFailed(parser)) {
      throw new Error("Ast construction failed.");
    }
  }

  checkConstructFailed(parser): any {
  }

  getResult(stack: RuleProcessStack) {
    var r;
    if (this.node.action) {
      r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
    } else {
      r = stack.argsToLeft;
    }
    return r;
  }

  abstract parseImpl(stack: RuleProcessStack): any;
}


// NOTE Not exported.  The only exported one is EntryPointParser
class ChoiceParser extends RuleParser {

  parseImpl(stack: RuleProcessStack) {

    this.children.forEach(n => {
      var r = n.parseImpl(stack);
      if (r !== peg$FAILED) {
        return r;
      }
    });
    return peg$FAILED;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class SequenceParser extends RuleParser {

  parseImpl(stack: RuleProcessStack) {

    var args = [];
    stack = stack.push(stack, args);

    this.children.forEach(n => {
      var r = n.parseImpl(stack);
      if (r === peg$FAILED) {
        return peg$FAILED;
      } else if (n.node.label) {
        args.push(r);
      }
    });
    var r = this.getResult(stack);
    return r;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleCollectionParser extends RuleParser {
  
  child: RuleParser;

  checkConstructFailed(parser: IParseRunner) {
    if (this.children.length !== 1) {
      console.error("parser.children.length !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleParser extends SingleCollectionParser {

  getResult(stack: RuleProcessStack) {
    var r;
    if (this.node.action) {
      r = this.node.action.fun.apply(stack.parser, stack.argsToLeft);
    } else {
      r = stack.argsToLeft[0];
    }
    return r;
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class EmptyParser extends RuleParser {
  
  checkConstructFailed(parser: IParseRunner) {
    if (this.children.length !== 0) {
      console.error("parser.children.length !== 0  " + this.node);
      return 1;
    }
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class OptionalParser extends SingleParser {

  parseImpl(stack: RuleProcessStack) {

    var args = [];
    stack = stack.push(stack, args);

    var r = this.child.parseImpl(stack);
    if (r === peg$FAILED) {
      return null;
    } else {
      args.push(r);
    }

    var r = this.getResult(stack);
    return r;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class ZeroOrMoreParser extends SingleCollectionParser {

  parseImpl(stack: RuleProcessStack) {

    var items = [];
    stack = stack.push(stack, items);

    while (true) {
      var r = this.child.parseImpl(stack);
      if (r === peg$FAILED) {
        break;
      } else {
        items.push(r);
      }
    }

    var r = this.getResult(stack);
    return r;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class OneOrMoreParser extends SingleCollectionParser {

  parseImpl(stack: RuleProcessStack) {

    var items = [];
    stack = stack.push(stack, items);

    var r = this.child.parseImpl(stack);
    if (r === peg$FAILED) {
      return peg$FAILED;
    }
    items.push(r);
    while (true) {
      r = this.child.parseImpl(stack);
      if (r === peg$FAILED) {
        break;
      } else {
        items.push(r);
      }
    }

    var r = this.getResult(stack);
    return r;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class RuleRefParser extends EmptyParser {

  node: PRuleRef;
  rule0: PRule;
  ruleEntryParser: EntryPointParser;

  constructor(parser: IParseRunner, node: PRuleRef) {
    super(parser, node);
    this.rule0 = parser.rule(node.ruleIndex);
  }

  checkConstructFailed(parser: IParseRunner) {
    var dirty = super.checkConstructFailed(parser);
    if (this.rule0) {
      this.ruleEntryParser = Factory.createParser(parser, this.rule0) as EntryPointParser;
    } else {
      console.error("no this.rule  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point
    return this.parser.run(this.ruleEntryParser);
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class TerminalRefParser extends EmptyParser {

  node: PTerminalRef;

  checkConstructFailed(parser: IParseRunner) {
    var dirty = super.checkConstructFailed(parser);
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    var token = stack.parser.next();
    if (token.tokenId === this.node.value) {
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
//   !!     NOTE     HERE is the only exported Parser                 !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   A   R   S   E   R
//   !!
//
export class EntryPointParser extends SingleParser {

  node: PRuleRef;
  index: number;

  constructor(parser: IParseRunner, node: PRule) {
    super(parser, node);
    this.index = node.index;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point   not implemented
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SemanticParser extends SingleParser {
  checkConstructFailed(parser: IParseRunner) {
    var dirty = super.checkConstructFailed(parser);
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun");
      dirty = 1;
    }
    return dirty;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class SemanticAndParser extends SemanticParser {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return undefined;
    else
      return peg$FAILED;
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
class SemanticNotParser extends SingleParser {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return peg$FAILED;
    else
      return undefined;
  }
} 
