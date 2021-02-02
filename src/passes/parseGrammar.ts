import { PNodeKind, PActionKind, PNode, PFunction, PCallArg } from "../../lib";
import { visitor } from "pegjs/lib/compiler";
import { PRule, PGrammar, PTerminal, PActContainer } from '../../lib';
import { PLogicNode, PValueNode, PSemanticAnd, PSemanticNot, PTerminalRef, PRuleRef } from '../../lib/index';
import { type } from 'os';

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
    "semantic_not": PSemanticNot
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
    "semantic_not": PNodeKind.SEMANTIC_NOT
  }

  function gencode(code: string): string[] {
    var result = [];
    result = code.split("\n").map(line => line.trim());
    return result;
  }
  class Context {
    current: PNode;
    grammar: PGrammar;
    rule: PActContainer;

    pushNode<T extends PNode>(cons:new (parent:PNode) => T, kind?: PNodeKind): T {
      var child: T = new cons(this.current);
      if (kind !== undefined) child.kind = kind;
      this.current = child;
      return child;
    }
    popNode() {
      var generatedNode = this.current;
      this.current = this.current.parent;
      return generatedNode;
    }
    generateAction(target: PLogicNode, argumentsOwner: PNode, kind: PActionKind, node) {
      var action: PFunction = { name:"", kind, ownerRule:ctx.rule, target, code: gencode(node.code), index: this.rule.actions.length, args: [] };
      action.name = ctx.rule.symbol + "$" + action.index;

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
        } else {
          var r = ctx.pushNode(PRule);
          ctx.rule = r;
          r.rule = node.name;
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
        } else {
          var rr = ctx.pushNode(PRuleRef);
          rr.rule = node.name;
        }
        return ctx.popNode();

      case "literal":
        ctx.pushNode(PValueNode, PNodeKind.EMPTY);
        return ctx.popNode();
    }

    return child;
  }

  parseGrammarAst(null, ast);

  //console.log("parsed grammar : "+stringify(ctx.grammar, ""));

}

var i = 0;

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
