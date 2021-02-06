import * as fs from "fs";
import { visitor } from "pegjs/lib/compiler";
import {
  PActContainer, PActionKind, PFunction,
  PGrammar, PLogicNode, PNode, PNodeKind, PRule,
  PRuleRef, PSemanticAnd, PSemanticNot, PTerminal,
  PTerminalRef, PValueNode
} from '../../lib';
var stringifySafe = require('json-stringify-safe');

var options;
const terminals: string[] = [];
const terminalConsts: Map<string, number> = new Map;
var ctx: Context;


// Generates parser JavaScript code.
function generate(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  options = args[args.length - 1];

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


  ctx = new Context();

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
  ctx.ruleRefs.forEach(rr => {
    var target = ctx.rules.get(rr.rule);
    if (target) {
      rr.ruleIndex = target.index;
    } else {
      console.error("No rule for rule ref : " + rr.rule);
      err = 1;
    }
  });
  ctx.terminalRefs.forEach(tr => {
    var target = ctx.terminals.get(tr.terminal);
    if (target) {
      //tr.terminalIndex = target.index;
    } else {
      console.error("No terminal for terminal ref : " + tr.terminal);
      err = 1;
    }
  });

  if (err) {
    throw new Error("Grammar parsing error(s).");
  }

  //console.log("parsed grammar : "+stringify(ctx.grammar, ""));
  var vtree = nodeToGraph(ctx.grammar, { n: 0, alreadyProc: {} });

  var j = tojson(vtree, { n: 0, alreadyProc: {} });

  const fnm = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm, j);

}

class RetekBufferMár {
  n: number = 0;
  alreadyProc: any
}

function tojson(obj: any, processing: RetekBufferMár, ind = "") {
  if (processing.alreadyProc[obj.nodeIdx]) return undefined;
  processing.alreadyProc[obj.nodeIdx] = 1;

  var chbuf = [];
  obj.children.forEach(itm => {
    var ij = tojson(itm, processing, ind + "  ");
    if (ij) chbuf.push(ij);
  });

  var buffer = [];
  buffer.push(ind + '{ "name":"' + obj.name + '", "n":' + (obj.n ? obj.n : 0) + ', "children":[');
  buffer.push(chbuf.join(",\n"));
  buffer.push(ind + "]  }");

  return buffer.join("\n");
}

function gencode(code: string): string[] {
  var result = [];
  result = code.split("\n").map(line => line.trim());
  return result;
}

class Thingy {
  clauseN = 0;
}

function nodesToGraph(src: PNode[], processing: RetekBufferMár, target: any[]) {

  src.forEach(srcitm => {
    var targetitm = nodeToGraph(srcitm, processing);
    if (!targetitm) return;//continue;
    target.push(targetitm);
  });
}

function nodeToGraph(node: PNode, processing: RetekBufferMár) {

  if (node["generated_"]) {
    var s = node["generated_"];

    return {
      name: s.name, label: s.label, children: s.children,
      nodeIdx: s.nodeIdx, n: s.n
    };
  }

  var branchTotal0 = processing.n;

  var result = {
    name: "? " + node.toString(), label: node.label, children: [],
    nodeIdx: node.nodeIdx, n: 1
  };
  node["generated_"] = result;

  switch (node.kind) {
    case PNodeKind.GRAMMAR:
      var buf = [];
      nodesToGraph(node.children, processing, buf);
      result = { name: "O", label: "", children: buf, nodeIdx: node.nodeIdx, n: 1 };
      processing.n++;
      result.n = processing.n - branchTotal0;
      break;
    case PNodeKind.RULE:
      var rule = (node as PRule).rule;
      if (rule) {
        var n2 = nodeToGraph(node.children[0], processing);
        result = { name: rule, label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
        processing.n++;
      } else {
        result = null;
      }
      break;
    case PNodeKind.TERMINAL_REF:
      result = { name: "Ł" + (node as PTerminalRef).terminal, label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
      processing.n++;
      break;
    case PNodeKind.RULE_REF:
      var rule = (node as PRuleRef).rule;
      if (options.allowedStartRules[rule] || processing.alreadyProc[rule]) {
        result = { name: rule + "->", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
        processing.n++;
      } else {
        processing.alreadyProc[rule] = 1;
        var rule0: PRule = ctx.rules.get(rule);
        var n2 = nodeToGraph(rule0, processing);
        result = { name: n2.name + "->", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
        processing.n++;
        processing.alreadyProc[rule] = 0;
      }
      break;
    case PNodeKind.ZERO_OR_MORE:
      var n2 = nodeToGraph(node.children[0], processing);
      result = { name: n2.name + "*", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
      processing.n++;
      break;
    case PNodeKind.ONE_OR_MORE:
      var n2 = nodeToGraph(node.children[0], processing);
      result = { name: n2.name + "+", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
      processing.n++;
      break;
    case PNodeKind.OPTIONAL:
      var n2 = nodeToGraph(node.children[0], processing);
      result = { name: n2.name + "?", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
      processing.n++;
      break;
    case PNodeKind.SEMANTIC_AND:
      result = { name: "&{...}", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
      processing.n++;
      break;
    case PNodeKind.PREDICATE_AND:
      var n2 = nodeToGraph(node.children[0], processing);
      result = { name: "&" + n2.name, label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
      processing.n++;
      break;
    case PNodeKind.SEMANTIC_NOT:
      result = { name: "!{...}", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
      processing.n++;
      break;
    case PNodeKind.PREDICATE_NOT:
      var n2 = nodeToGraph(node.children[0], processing);
      result = { name: "!" + n2.name, label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
      processing.n++;
      break;

    case PNodeKind.CHOICE:
      result = { name: "", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
      var f = 1;
      node.children.forEach(ch => {
        var c = nodeToGraph(ch, processing);

        if (!c) return;//continue;
        if (!f) {
          c.name = " / " + c.name;
          result.children.push({ name: " / " + c.name, children: c.children, label: c.label, n: c.n });
        } else {
          result.children.push(c);
        }
        f = 0;
      });
      processing.n++;
      result.n = processing.n - branchTotal0;
      break;
    case PNodeKind.SEQUENCE:
      result = { name: "", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
      node.children.forEach(ch => {
        var c = nodeToGraph(ch, processing);

        if (!c) return;//continue;
        result.children.push(c);
      });
      processing.n++;
      result.n = processing.n - branchTotal0;
      break;
    case PNodeKind.TERMINAL:
      result = null;
      break;
  }

  if (result) {
    result.nodeIdx = node.nodeIdx;

    if (result.label) {
      result.name = result.label + ":" + result.name;
    }
    node["generated_"] = result;
  }

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
  rules: Map<string, PRule> = new Map;
  terminals: Map<string, PTerminal> = new Map;

  pushIdxNode<T extends PNode>(cons: new (parent: PNode, index: number) => T, index: number, kind?: PNodeKind): T {
    var child: T = new cons(this.current, index);
    if (kind !== undefined) child.kind = kind;
    this.current = child;
    child.nodeIdx = this.nodeIdxs++;
    return child;
  }
  pushNode<T extends PNode>(cons: new (parent: PNode) => T, kind?: PNodeKind): T {
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
    var action: PFunction = {
      kind, ownerRule: ctx.rule, target,
      nodeIdx: this.nodeIdxs++, index: ctx.functionIndices++,
      code: gencode(node.code), args: [], fun: null
    };

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







module.exports = generate;






