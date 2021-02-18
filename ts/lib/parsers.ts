import { HyperG, HyperGEnvType } from '.';

const Codes = [], Strings = [];

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
  PREDICATE_AND = "simple_and",
  PREDICATE_NOT = "simple_not",
  RULE_REF = "rule_ref",
  TERMINAL_REF = "terminal_ref",
  TEXT = "text",
  LITERAL = "literal",
}

Codes[PNodeKind.GRAMMAR] = 0;
Codes[PNodeKind.RULE] = 1;
Codes[PNodeKind.TERMINAL] = 2;
Codes[PNodeKind.CHOICE] = 3;
Codes[PNodeKind.SEQUENCE] = 4;
Codes[PNodeKind.OPTIONAL] = 5;
Codes[PNodeKind.ONE_OR_MORE] = 6;
Codes[PNodeKind.ZERO_OR_MORE] = 7;
Codes[PNodeKind.EMPTY] = 8;
Codes[PNodeKind.SINGLE] = 9;
Codes[PNodeKind.SEMANTIC_AND] = 10;
Codes[PNodeKind.SEMANTIC_NOT] = 11;
Codes[PNodeKind.PREDICATE_AND] = 12;
Codes[PNodeKind.PREDICATE_NOT] = 13;
Codes[PNodeKind.RULE_REF] = 14;
Codes[PNodeKind.TERMINAL_REF] = 15;
Codes[PNodeKind.TEXT] = 16;
Codes[PNodeKind.LITERAL] = 17;

Strings[0] = PNodeKind.GRAMMAR;
Strings[1] = PNodeKind.RULE;
Strings[2] = PNodeKind.TERMINAL;
Strings[3] = PNodeKind.CHOICE;
Strings[4] = PNodeKind.SEQUENCE;
Strings[5] = PNodeKind.OPTIONAL;
Strings[6] = PNodeKind.ONE_OR_MORE;
Strings[7] = PNodeKind.ZERO_OR_MORE;
Strings[8] = PNodeKind.EMPTY;
Strings[9] = PNodeKind.SINGLE;
Strings[10] = PNodeKind.SEMANTIC_AND;
Strings[11] = PNodeKind.SEMANTIC_NOT;
Strings[12] = PNodeKind.PREDICATE_AND;
Strings[13] = PNodeKind.PREDICATE_NOT;
Strings[14] = PNodeKind.RULE_REF;
Strings[15] = PNodeKind.TERMINAL_REF;
Strings[16] = PNodeKind.LITERAL;
Strings[17] = PNodeKind.TEXT;


export enum PActionKind {
  RULE = "RULE",
  PREDICATE = "PREDICATE"
}

function slen(arr: any[]) {
  return arr ? arr.length : undefined;
}

function debuggerTrap<T>(value:T):T {
  return value;
}


export abstract class PNode {
  parent: PNode;
  kind: PNodeKind;
  children: PNode[] = [];
  nodeIdx: number;
  label?: string;
  _tokenId?: number;

  get action(): PFunction {
    return undefined;
  }
  get tokenId() {
    return this._tokenId;
  }

  static xkind = PNodeKind.GRAMMAR;

  constructor(parent: PNode) {
    this.parent = parent;
    if (parent) parent.children.push(this);
  }

  static deserialize(arr: number[]): PNode {
    var res = [null];
    var pos = PNode.desone(arr, res, 0);
    if (pos !== arr.length) throw new Error("pos:"+pos+" !== "+arr.length);
    return res[0];
  }

  ser(): number[] {
    if (this.nodeIdx !== HyperG.serializerCnt) {
      console.warn("Invalid nodeIdx : "+this+"  this.nodeIdx:"+this.nodeIdx+" != "+HyperG.serializerCnt);
      this.nodeIdx = HyperG.serializerCnt;
    }
    HyperG.serializerCnt++;

    return [Codes[this.kind]].concat(this.serchildren());
  }
  deser(arr: number[], pos: number): number {

    this.nodeIdx = HyperG.serializerCnt++;
    var h = HyperG.indent;
    if (HyperG.Env === HyperGEnvType.INTEGRITY_CHECK_VERBOSE) {
      console.log("deser "+h+this.kind+" "+this.nodeIdx);
    }

    HyperG.indent += "  ";
    pos = this.deschildren(arr, pos);
    HyperG.indent = h;

    HyperG.nodeTable[this.nodeIdx] = this;
    return pos;
  }
  diagnosticEqualityCheck(node: PNode) {
    if (this.kind !== node.kind) {
      return debuggerTrap(false);
    } else if (this.nodeIdx !== node.nodeIdx) {
      return debuggerTrap(false);
    } else if (this.children.length !== node.children.length) {
      return debuggerTrap(false);
    } else {
      for (var i = 0; i<this.children.length; i++) {
        var a = this.children[i];
        var b = node.children[i];
        var c = a.diagnosticEqualityCheck(b);
        if (!c) {
          return debuggerTrap(false);
        }
      }
    }
    return debuggerTrap(true);
  }

  serchildren(): number[] {
    var r = [this.children.length];
    this.children.forEach(itm=>{
      r = r.concat(itm.ser());
    });
    return r;
  }

  deschildren<T extends PNode>(arr: number[], pos): number {
    var length = arr[pos];
    pos++;
    var r: T[] = [];
    for (var i=0; i < length; i++) {
      var cs = [null];
      pos = PNode.desone(arr, cs, pos);
      this.children.push(cs[0]);
    }
    return pos;
  }

  private static desone(arr: number[], res: PNode[], pos) {
    var kind = arr[pos];
    var ekind = Strings[kind];
    var cons = PConss[ekind] as new (parent:PNode, ...etc)=>PNode;
    var node = new cons(null);
    node.kind = ekind;
    res[0] = node;
    pos = node.deser(arr, pos+1);
    return pos;
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
  
  get optionalNode() {
    return false;
  }

  toString() {
    return "" + this.kind;
  }
}

export class PActContainer extends PNode {
  actions?: PFunction[];
  ruleActions?: PFunction[];
  index: number;

  get symbol(): string {
    return null;
  }

  toString() {
    return this.kind + " " + this.symbol;
  }

  diagnosticEqualityCheck(node: PActContainer) {
    var dirty = super.diagnosticEqualityCheck(node);
    if (this.index !== node.index) {
      return debuggerTrap(false);
    } else if (slen(this.actions) !== slen(node.actions)) {
      return debuggerTrap(false);
    } else if (slen(this.ruleActions) !== slen(node.ruleActions)) {
      return debuggerTrap(false);
    } else if (this.actions) {
      for (var i = 0; i<this.actions.length; i++) {
        var a = this.actions[i];
        var b = node.actions[i];
        var c = a.diagnosticEqualityCheck(b);
        if (!c) {
          return debuggerTrap(false);
        }
      }
    } else if (this.ruleActions) {
      for (var i = 0; i<this.ruleActions.length; i++) {
        var a = this.ruleActions[i];
        var b = node.ruleActions[i];
        var c = a.diagnosticEqualityCheck(b);
        if (!c) {
          return debuggerTrap(false);
        }
      }
    }
    return debuggerTrap(dirty);
  }

  ser(): number[] {
    return super.ser().concat([this.index]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.index = arr[pos++];
    if (HyperG.Env === HyperGEnvType.INTEGRITY_CHECK_VERBOSE) {
      console.log("deser "+HyperG.indent+this.kind+" "+this.nodeIdx+" index:"+this.index);
    }
    return pos;
  }

}

export class PGrammar extends PActContainer {
  kind = PNodeKind.GRAMMAR;
  children: PActContainer[];
  rules: PRule[];
}

export class PRule extends PActContainer {
  kind = PNodeKind.RULE;
  rule?: string;
  refs = 0;

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
  private _action?: PFunction;
  private actidx?:number;
  private actid?:number;

  get action() {
    if (!this._action) {
      if (this.actidx !== -1 && this.actidx !== undefined) {
        var fun = HyperG.functionTable[this.actidx];
        this.action = new PFunction();
        this.action.fun = fun;
        this.action.nodeIdx = this.actid;
        this.action.index = this.actidx;
      }
    }
    return this._action;
  }
  set action(a: PFunction) {
    this._action = a;
  }
  ser(): number[] {
    var result = super.ser().concat([this.action?this.action.index+1:0]);
    if (this.action) {
      if (this.action.nodeIdx != HyperG.serializerCnt) {
        console.warn("Invalid nodeIdx : "+this+"  .action "+this.action+"  this.action.nodeIdx:"+this.action.nodeIdx+" != "+HyperG.serializerCnt);
        this.action.nodeIdx = HyperG.serializerCnt;
      }
      HyperG.serializerCnt++;
    }
    return result;
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.actidx = arr[pos++] - 1;
    if (this.actidx !== -1) {
      this.actid = HyperG.serializerCnt++;
      if (HyperG.Env === HyperGEnvType.INTEGRITY_CHECK_VERBOSE) {
        console.log("deser "+HyperG.indent+this.kind+" "+this.nodeIdx+" actidx:"+this.actidx);
      }
    }
    return pos;
  }

  diagnosticEqualityCheck(node: PLogicNode) {
    var dirty = super.diagnosticEqualityCheck(node);
    if (this.actidx !== node.actidx) {
      return debuggerTrap(false);
    }
    return debuggerTrap(dirty);
  }
}

export class PValueNode extends PLogicNode {
  get optionalNode() {
    return this.kind === PNodeKind.EMPTY || this.kind === PNodeKind.OPTIONAL ||
      this.kind === PNodeKind.ZERO_OR_MORE;
  }

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
  _rule?: string;
  ruleIndex?: number;

  get symbol() {
    return this.rule;
  }

  get rule() {
    if (!this._rule) this._rule = HyperG.ruleTable[this.ruleIndex].rule;
    return this._rule;
  }
  set rule(r: string) {
    this._rule = r;
  }

  diagnosticEqualityCheck(node: PRuleRef) {
    var dirty = super.diagnosticEqualityCheck(node);
    if (this.ruleIndex !== node.ruleIndex) {
      return debuggerTrap(false);
    }
    return debuggerTrap(dirty);
  }

  ser(): number[] {
    return super.ser().concat([this.ruleIndex]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.ruleIndex = arr[pos++];
    if (HyperG.Env === HyperGEnvType.INTEGRITY_CHECK_VERBOSE) {
      console.log("deser "+HyperG.indent+this.kind+" "+this.nodeIdx+" ruleIndex:"+this.ruleIndex);
    }
    HyperG.ruleRefTable[this.ruleIndex] = this;
    return pos;
  }
}

export class PTerminalRef extends PRef {
  kind = PNodeKind.TERMINAL_REF;
  terminal?: string;

  value?: number;

  get tokenId() {
    return this.value;
  }

  get symbol() {
    return this.terminal;
  }
  ser(): number[] {
    return super.ser().concat([this.value]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.value = arr[pos++];
    if (HyperG.Env === HyperGEnvType.INTEGRITY_CHECK_VERBOSE) {
      console.log("deser "+HyperG.indent+this.kind+" "+this.nodeIdx+" value:"+this.value);
    }
    return pos;
  }

  diagnosticEqualityCheck(node: PTerminalRef) {
    var dirty = super.diagnosticEqualityCheck(node);
    if (this.value !== node.value) {
      return debuggerTrap(false);
    }
    return debuggerTrap(dirty);
  }
}

export class PSemanticAnd extends PLogicNode {
  kind = PNodeKind.SEMANTIC_AND;

}

export class PSemanticNot extends PLogicNode {
  kind = PNodeKind.SEMANTIC_NOT;

}


export class PFunction {
  nodeIdx: number;

  ownerRule: PActContainer;
  target: PLogicNode;
  index: number;

  args: PCallArg[];

  generatedMemberName?: string;
  code?: string[];
  kind: PActionKind;

  fun: (...etc) => any;

  diagnosticEqualityCheck(node: PFunction) {
    if (this.index !== node.index) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}

export class PCallArg {
  label?: string;
  type?: string;
  index: number;
  evaluate: PValueNode;
}


export const PConss = {
  "grammar": PGrammar,
  "rule": PRule,
  "choice": PValueNode,
  "sequence": PValueNode,
  "optional": PValueNode,
  "one_or_more": PValueNode,
  "zero_or_more": PValueNode,
  "semantic_and": PSemanticAnd,
  "semantic_not": PSemanticNot,
  "simple_and": PValueNode,
  "simple_not": PValueNode,
  "text": PValueNode,
  "literal": PValueNode,

   "terminal":PTerminal,
   "empty":PValueNode,
   "single":PValueNode,
   "rule_ref":PRuleRef,
   "terminal_ref":PTerminalRef

}

