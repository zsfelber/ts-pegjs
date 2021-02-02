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

export class PNode {
  parent: PNode;
  kind: PNodeKind;
  children: PNode[] = [];

  constructor(parent: PNode) {
    
    if (parent) parent.children.push(this);
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

export namespace Factory {

  export function createParser(parser: IParser, node: PValueNode) {
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

    }
  }
}


class RuleProcessStack {
  parser: IParser;
  parent: RuleProcessStack;
  argsToLeft: any[];

  constructor(
    parser: IParser,
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

interface IParser {

  next(): IToken;

  rule(id: string): PValueNode;

  applyCachedResult(rule: RuleParser): ICached;

  trackRuleFinished(rule: RuleParser, result: any);

}

export abstract class RuleParser {

  readonly parent: RuleParser;
  readonly node: PValueNode;
  readonly children: RuleParser[] = [];

  constructor(parser: IParser, node: PValueNode) {
    
    this.node = node;
    this.node.children.forEach(n => {
      this.children.push(Factory.createParser(parser, n));
    });
    if (this.checkConstructFailed()) {
      throw new Error("Ast construction failed.");
    }
  }

  checkConstructFailed(): any {
  }

  parse(parser: IParser): any {
    const cached = parser.applyCachedResult(this);
    if (cached) {
      return cached.result;
    }

    var stack = new RuleProcessStack(parser, null, []);
    var result = this.parseImpl(stack);

    parser.trackRuleFinished(this, result);
  }

  abstract parseImpl(stack: RuleProcessStack): any;
}

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
    var r: any;
    if (this.node.action) {
      r = this.node.action.fun.apply(stack.parser, args);
    } else {
      r = args;
    }
    return r;
  }
}

abstract class SingleParser extends RuleParser {
  
  child: RuleParser;

  constructor(parser: IParser, node: PValueNode) {
    super(parser, node);
  }

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("parser.children.length !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
  }
}


abstract class EmptyParser extends RuleParser {
  

  constructor(parser: IParser, node: PValueNode) {
    super(parser, node);
  }

  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("parser.children.length !== 0  " + this.node);
      return 1;
    }
  }
}


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

    if (this.node.action) {
      var r = this.node.action.fun.apply(stack.parser, args);
      return r;
    } else {
      return args[0];
    }
  }
}

class ZeroOrMoreParser extends SingleParser {

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

    if (this.node.action) {
      var r = this.node.action.fun.apply(stack.parser, [items]);
      return r;
    } else {
      return items;
    }
  }
}

class OneOrMoreParser extends SingleParser {

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

    if (this.node.action) {
      var r = this.node.action.fun.apply(stack.parser, [items]);
      return r;
    } else {
      return items;
    }
  }
}

class RuleRefParser extends EmptyParser {

  node: PRuleRef;
  rule: RuleParser;

  constructor(parser: IParser, node: PRuleRef) {
    super(parser, node);
    var r0 = parser.rule(node.rule);
    this.rule = Factory.createParser(parser, r0);
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (this.rule) {
      console.error("no this.rule  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point  parseImpl is not enough 
    return this.rule.parse(stack.parser);
  }
}


class TerminalRefParser extends EmptyParser {

  node: PTerminalRef;

  constructor(parser: IParser, node: PTerminalRef) {
    super(parser, node);
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (this.node.terminal) {
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

abstract class SemanticParser extends SingleParser {
  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      console.error("No parser.node.action or .action.fun");
      dirty = 1;
    }
    return dirty;
  }
}

class SemanticAndParser extends SemanticParser {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return undefined;
    else
      return peg$FAILED;
  }
}

class SemanticNotParser extends SingleParser {
  parseImpl(stack: RuleProcessStack) {
    var boolres = this.node.action.fun.apply(stack.parser, stack);
    if (boolres)
      return peg$FAILED;
    else
      return undefined;
  }
} 
