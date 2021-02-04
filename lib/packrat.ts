import { PValueNode, PNodeKind, PRuleRef, PTerminalRef, PRule, IToken, ICached, SerDeser, IParseRunner } from ".";

const peg$FAILED: Readonly<any> = {};

const peg$SUCCESS: Readonly<any> = {};


// NOTE The only exported Parser is EntryPointParser
namespace Factory {

  export function createParser(node: PValueNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceParser(node);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceParser(node);
      case PNodeKind.OPTIONAL:
        return new OptionalParser(node);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndParser(node);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotParser(node);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreParser(node);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreParser(node);
      case PNodeKind.RULE_REF:
        return new RuleRefParser(node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefParser(node as PTerminalRef);
      case PNodeKind.RULE:
        return new EntryPointParser(node as PRule);
  
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
// TODO for graph traverser parse tree generator
// As I was thinking it is possible / even trivial 
// !!!
//export abstract class CollectJumpStatesRunner implements IParseRunner {
//}
//


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class RuleElementParser {

  readonly parent: RuleElementParser;
  readonly node: PValueNode;
  readonly children: RuleElementParser[] = [];

  constructor(node: PValueNode) {
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


// NOTE Not exported.  The only exported one is EntryPointParser
class ChoiceParser extends RuleElementParser {

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
class SequenceParser extends RuleElementParser {

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

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleCollectionParser extends RuleElementParser {
  
  child: RuleElementParser;

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("parser.children.length !== 1  " + this.node);
      return 1;
    }
    this.child = this.children[0];
  }
}

// NOTE Not exported.  The only exported one is EntryPointParser
abstract class SingleParser extends SingleCollectionParser {

  
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


// NOTE Not exported.  The only exported one is EntryPointParser
abstract class EmptyParser extends RuleElementParser {
  
  checkConstructFailed() {
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
class ZeroOrMoreParser extends SingleCollectionParser {

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

// NOTE Not exported.  The only exported one is EntryPointParser
class OneOrMoreParser extends SingleCollectionParser {

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

// NOTE Not exported.  The only exported one is EntryPointParser
class RuleRefParser extends EmptyParser {

  node: PRuleRef;
  ruleEntryParser: EntryPointParser;

  constructor(node: PRuleRef) {
    super(node);
    this.ruleEntryParser = SerDeser.ruleTable[node.ruleIndex];
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.ruleEntryParser) {
      console.error("no this.ruleEntryParser  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  parseImpl(stack: RuleProcessStack) {
    // NOTE new entry point
    return stack.parser.run(this.ruleEntryParser);
  }
}


// NOTE Not exported.  The only exported one is EntryPointParser
class TerminalRefParser extends EmptyParser {

  node: PTerminalRef;

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
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


// NOTE Not exported.  The only exported one is EntryPointParser
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

export abstract class PackratRunner implements IParseRunner {

  _numRules: number;
  
  constructor() {
  }
  init() {
    this._numRules = this.numRules;
  }

  readonly peg$resultsCache: {[id: number]: ICached} = {};

  abstract get pos(): number;
  abstract set pos(topos: number);
  
  abstract get numRules(): number;
  abstract cacheKey(rule: EntryPointParser): number;
  abstract next(): IToken;
  abstract rule(index: number): EntryPointParser;
  
  run(rule: EntryPointParser): any {
    const key = this.cacheKey(rule);
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

    var result = rule.child.parse(stack);

    this.peg$resultsCache[key] = { nextPos: this.pos, maxFailPos: ruleMaxFailPos, 
      result };
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
