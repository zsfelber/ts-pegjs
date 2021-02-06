import * as fs from "fs";
import { visitor } from "pegjs/lib/compiler";
import {
  PActContainer, PActionKind, PFunction,
  PGrammar,  PLogicNode, PNode, PNodeKind, PRule,
  PRuleRef, PSemanticAnd, PSemanticNot, PTerminal,
  PTerminalRef, PValueNode
} from '../../lib';

// Generates parser JavaScript code.
function generate(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  const terminals: string[] = [];
  const terminalConsts: Map<string, number> = new Map;
  ast.terminals = terminals;
  ast.terminalConsts = terminalConsts;


  var findTerminals = visitor.build({
    rule: function (node, context) {
      // terminal rule
      if (/^Ł/.exec(node.name)) {
        findTerminals(node.expression, {
          terminal: node.name.substring(1)
        });
      }
    },

    literal: function (node, context) {
      if (context.terminal) {
        var tokenId = node.value.charCodeAt(0);
        terminalConsts.set(context.terminal, tokenId);
        terminals.push("    " + context.terminal + " = " + tokenId);
      }
    }
  });
  findTerminals(ast);


  var KT = {
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
  }
  var KK = {
    "grammar": PNodeKind.GRAMMAR,
    "rule": PNodeKind.RULE,
    "choice": PNodeKind.CHOICE,
    "sequence": PNodeKind.SEQUENCE,
    "optional": PNodeKind.OPTIONAL,
    "one_or_more": PNodeKind.ONE_OR_MORE,
    "zero_or_more": PNodeKind.ZERO_OR_MORE,
    "semantic_and": PNodeKind.SEMANTIC_AND,
    "semantic_not": PNodeKind.SEMANTIC_NOT,
    "simple_and": PNodeKind.PREDICATE_AND,
    "simple_not": PNodeKind.PREDICATE_NOT,
  }

  function gencode(code: string): string[] {
    var result = [];
    result = code.split("\n").map(line => line.trim());
    return result;
  }
  class Context {
    nodeIdxs = 0;
    ruleIndices = 0;
    functionIndices = 0;

    current: PNode;
    grammar: PGrammar;
    rule: PActContainer;
    ruleRefs: PRuleRef[] = [];
    terminalRefs: PTerminalRef[] = [];
    rules: Map<string,PRule> = new Map;
    terminals: Map<string,PTerminal> = new Map;

    pushIdxNode<T extends PNode>(cons:new (parent:PNode, index:number) => T, index: number, kind?: PNodeKind): T {
      var child: T = new cons(this.current, index);
      if (kind !== undefined) child.kind = kind;
      this.current = child;
      child.nodeIdx = this.nodeIdxs++;
      return child;
    }
    pushNode<T extends PNode>(cons:new (parent:PNode) => T, kind?: PNodeKind): T {
      var child: T = new cons(this.current);
      if (kind !== undefined) child.kind = kind;
      this.current = child;
      child.nodeIdx = this.nodeIdxs++;
      return child;
    }

    popNode() {
      var generatedNode = this.current;
      this.current = this.current.parent;
      return generatedNode;
    }
    generateAction(target: PLogicNode, argumentsOwner: PNode, kind: PActionKind, node) {
      var action: PFunction = { kind, ownerRule:ctx.rule, target, 
          nodeIdx: this.nodeIdxs++, index: ctx.functionIndices++,
          code: gencode(node.code), args: [], fun: null };

      target.action = action;
      this.grammar.actions.push(action);
      this.rule.actions.push(action);
      if (kind === PActionKind.RULE) {
        this.grammar.ruleActions.push(action);
        this.rule.ruleActions.push(action);
      }
      var i = 0;
      const addlabels = (chch: PValueNode) => {
        if (chch.label) {
          var a = { label: chch.label, index: i, evaluate: chch };
          action.args.push(a);
        } else {
          //child.action.args.set(chch.label, {label: "$"+i, index: i, evaluate: chch});
        }
        i++;
      }

      if (argumentsOwner.kind === PNodeKind.SEQUENCE || argumentsOwner.kind === PNodeKind.CHOICE) {
        argumentsOwner.children.forEach(chch => {
          addlabels(chch);
        });
      } else {
        addlabels(argumentsOwner);
      }
      return action;
    }
  }

  var ctx = new Context();

  function parseGrammarAst(parent, node): PNode {

    var child: PNode;

    switch (node.type) {
      case "grammar":
        ctx.grammar = node.grammar = ctx.pushNode(PGrammar);
        ctx.grammar.actions = [];
        ctx.grammar.ruleActions = [];
        ctx.grammar.rules = [];
        node.rules.forEach(rule => {
          parseGrammarAst(node, rule);
        });
        return ctx.popNode();

      case "rule":
        // terminal/nonterminal 
        if (/^Ł/.exec(node.name)) {
          var t = ctx.pushNode(PTerminal);
          t.terminal = node.name.substring(1);
          ctx.rule = t;
          ctx.terminals.set(t.terminal, t);
        } else {
          var r = ctx.pushIdxNode(PRule, ctx.ruleIndices++);
          r.rule = node.name;
          ctx.rule = r;
          ctx.rules.set(r.rule, r);
          ctx.grammar.rules.push(r);
        }
        ctx.rule.actions = [];
        ctx.rule.ruleActions = [];
        parseGrammarAst(node, node.expression);
        return ctx.popNode();

      case "action":

        child = parseGrammarAst(node, node.expression);
        ctx.generateAction(child, child, PActionKind.RULE, node);
        break;

      case "choice":

        var choice = ctx.pushNode(PValueNode, PNodeKind.CHOICE);

        node.alternatives.forEach(elem => {
          parseGrammarAst(node, elem);
        });

        return ctx.popNode();
  
      case "sequence":

        var sequence = ctx.pushNode(PValueNode, PNodeKind.SEQUENCE);

        node.elements.forEach(elem => {
          parseGrammarAst(node, elem);
        });
        if (sequence.children.length === 0) {
          sequence.kind = PNodeKind.EMPTY;
        } else if (sequence.children.length === 0) {
          sequence.kind = PNodeKind.SINGLE;
        }

        return ctx.popNode();

      case "labeled":

        var v = parseGrammarAst(node, node.expression) as PValueNode;
        v.label = node.label;
        child = v;

        break;

      case "optional":
      case "zero_or_more":
      case "one_or_more":
      case "simple_and":
      case "simple_not":
    
        ctx.pushNode(KT[node.type], KK[node.type]);
        parseGrammarAst(node, node.expression);
        return ctx.popNode();

      case "semantic_and":
      case "semantic_not":
        var current = ctx.current;
        child = ctx.pushNode(KT[node.type], KK[node.type]);
        // this generates the function arguments from preceeding nodes, as expected 
        var action = ctx.generateAction(child, current, PActionKind.PREDICATE, node);
        return ctx.popNode();
  
      case "rule_ref":
        // terminal rule
        if (/^Ł/.exec(node.name)) {
          var tr = ctx.pushNode(PTerminalRef);
          tr.terminal = node.name.substring(1);
          tr.value = terminalConsts.get(tr.terminal);
          ctx.terminalRefs.push(tr);
        } else {
          var rr = ctx.pushNode(PRuleRef);
          rr.rule = node.name;
          ctx.ruleRefs.push(rr);
        }
        return ctx.popNode();

      case "literal":
        ctx.pushNode(PValueNode, PNodeKind.EMPTY);
        return ctx.popNode();
    }

    return child;
  }

  parseGrammarAst(null, ast);

  var err = 0;
  ctx.ruleRefs.forEach(rr=>{
    var target = ctx.rules.get(rr.rule);
    if (target) {
      rr.ruleIndex = target.index;
    } else {
      console.error("No rule for rule ref : "+rr.rule);
      err = 1;
    }
  });
  ctx.terminalRefs.forEach(tr=>{
    var target = ctx.terminals.get(tr.terminal);
    if (target) {
      //tr.terminalIndex = target.index;
    } else {
      console.error("No terminal for terminal ref : "+tr.terminal);
      err = 1;
    }
  });

  if (err) {
    throw new Error("Grammar parsing error(s).");
  }

  //console.log("parsed grammar : "+stringify(ctx.grammar, ""));
  var gs = new GraphStat();
  var json = {nodes:[], edges:[]};
  countGraph(ctx.grammar, gs);
  generateGraph(ctx.grammar, gs, json);

  const fnm = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm, JSON.stringify(json, null, "  "));

}

var i = 0;
class GraphStat {
  maxN = 0;
  totalN = 0;
  now = 0;

  _perLevel: GraphStat[] = [];

  perLevel(level:number) {
    var lgs = this._perLevel[level];
    if (!lgs) {
      this._perLevel[level] = lgs = new GraphStat();
    }
    return lgs;
  }
};
function countGraph(node: PNode, graphStat: GraphStat, l:number=0) {
  var n = 0;
  node.children.forEach(child=>{
    n += countGraph(child, graphStat, l+1);
  });
  if (!node.children.length) n = 1;

  var lev = graphStat.perLevel(l);
  if (n > lev.maxN) lev.maxN = n;
  lev.totalN += n;

  return n;
}

function generateGraph(node: PNode, graphStat: GraphStat, json: {nodes:any[],edges:any[]}, l:number=0) {
  var n = 0;
  var l0graphStat = graphStat.perLevel(0);
  var lgraphStat = graphStat.perLevel(l);

  node.children.forEach(child=>{
    n += generateGraph(child, graphStat, json, l+1);
    var edge =     {
      "id": "e"+node.nodeIdx+":"+child.nodeIdx,
      "source": "n"+node.nodeIdx,
      "target": "n"+child.nodeIdx,
      "label": (child as any).label
    };
    json.edges.push(edge);
  });
  if (!node.children.length) n = 1;

  var levheight = l0graphStat.totalN * 300;
  var radius = levheight * l;
  var angle0 = - 0.5;
  var angleFromAngle0 = 2 * lgraphStat.now / lgraphStat.totalN;
  var angle = angle0 + angleFromAngle0;
  var x = radius * Math.cos(angle * Math.PI);
  var y = radius * Math.sin(angle * Math.PI);

  lgraphStat.now += n;

  var gnode=
  {
    "id": "n"+node.nodeIdx,
    "label": node.toString(),
    "x": x,
    "y": y,
    "size": n
  };
  json.nodes.push(gnode);

  return n;
}


function stringify(obj, indent) {
  if (!indent) indent = "";
  if (typeof obj !== 'object' || obj === null || obj instanceof Array) {
    return value(obj, indent);
  }
  if (obj["$pr"]) {
    return obj["$pr"];
  }
  obj["$pr"] = "$" + i;

  var result = " " + i + "." + indent + ' {\n' + Object.keys(obj).map(k => {
    return (typeof obj[k] === 'function') ? null : indent + "  " + k + " : " + value(obj[k], indent + "  ");
  }).join(",\n") + "/" + i + "." + indent + '}\n';

  return result;
}

function value(val, indent) {
  switch (typeof val) {
    case 'string':
      return '"' + val.replace(/\\/g, '\\\\').replace('"', '\\"') + '"';
    case 'number':
    case 'boolean':
      return '' + val;
    case 'function':
      return 'null';
    case 'object':
      if (val instanceof Date) return '"' + val.toISOString() + '"';
      if (val instanceof Array) return " " + i + "." + indent + '[\n' + val.map(v => value(v, indent + "  ")).join(',\n') + + "/" + i + "." + indent + ']\n';
      if (val === null) return 'null';
      return stringify(val, indent);
  }
}

module.exports = generate;
