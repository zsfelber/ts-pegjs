import { IToken } from ".";

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

export namespace SerDeser {

  export var cnt = 0;

  export var functionTable: ((...etc)=>any)[];

  export var ruleTable: PRule[];

  export var nodeTable: PNode[];
}

export abstract class PNode {
  parent: PNode;
  kind: PNodeKind;
  children: PNode[] = [];
  nodeIdx: number;
  label?: string;

  static xkind = PNodeKind.GRAMMAR;

  constructor(parent: PNode) {
    this.parent = parent;
    if (parent) parent.children.push(this);
  }

  static deserialize(arr: number[]): PNode {
    SerDeser.cnt = 0;
    var res = [null];
    var pos = PNode.desone(arr, res, 0);
    if (pos !== arr.length) throw new Error("pos:"+pos+" !== "+arr.length);
    return res[0];
  }

  ser(): number[] {
    if (this.nodeIdx !== SerDeser.cnt) {
      console.warn("Invalid nodeIdx : "+this+"  this.nodeIdx:"+this.nodeIdx+" != "+SerDeser.cnt);
      this.nodeIdx = SerDeser.cnt;
    }
    SerDeser.cnt++;

    return [Codes[this.kind]].concat(this.serchildren());
  }
  deser(arr: number[], pos: number): number {
    this.nodeIdx = SerDeser.cnt++;
    pos = this.deschildren(arr, pos);
    SerDeser.nodeTable[this.nodeIdx] = this;
    return pos;
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

  ser(): number[] {
    return super.ser().concat([this.index]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.index = arr[pos++];
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

  ser(): number[] {
    var result = super.ser().concat([this.action?this.action.index+1:0]);
    if (this.action) {
      if (this.action.nodeIdx != SerDeser.cnt) {
        console.warn("Invalid nodeIdx : "+this+"  .action "+this.action+"  this.action.nodeIdx:"+this.action.nodeIdx+" != "+SerDeser.cnt);
        this.action.nodeIdx = SerDeser.cnt;
      }
      SerDeser.cnt++;
    }
    return result;
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    var actidx = arr[pos++] - 1;
    if (actidx !== -1) {
      var fun = SerDeser.functionTable[actidx];
      this.action = new PFunction();
      this.action.fun = fun;
      this.action.nodeIdx = SerDeser.cnt++;
    }
    return pos;
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
  rule?: string;
  ruleIndex?: number;

  get symbol() {
    return this.rule;
  }

  ser(): number[] {
    return super.ser().concat([this.ruleIndex]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.ruleIndex = arr[pos++];
    this.rule = SerDeser.ruleTable[this.ruleIndex].rule;
    return pos;
  }
}

export class PTerminalRef extends PRef {
  kind = PNodeKind.TERMINAL_REF;
  terminal?: string;

  value?: number;

  get symbol() {
    return this.terminal;
  }
  ser(): number[] {
    return super.ser().concat([this.value]);
  }
  deser(arr: number[], pos: number): number {
    pos = super.deser(arr, pos);
    this.value = arr[pos++];
    return pos;
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

