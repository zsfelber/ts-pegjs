import { PNodeKind, PNode, PFunction, PCallArg } from "../../lib";
import { visitor } from "pegjs/lib/compiler";

// Generates parser JavaScript code.
function generate(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  const terminals: string[] = [];
  const terminalConsts: Map<string,number> = new Map;
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
    grammar: PNode;
    rule: PNode;

    pushNode(kind: PNodeKind) {
      var child: PNode = { parent: this.current, kind, children: [] };
      if (this.current) this.current.children.push(child);
      this.current = child;
      return child;
    }
    popNode() {
      var generatedNode = this.current;
      this.current = this.current.parent;
      return generatedNode;
    }
    generateAction(target: PNode, argumentsOwner: PNode, node) {
      var ta: PFunction = {owner: target, code: gencode(node.code), index: this.rule.actions.length, args: new Map, argsarr: []};
      target.action = ta;
      this.grammar.actions.push(ta);
      this.rule.actions.push(ta);
      var i = 0;
      argumentsOwner.children.forEach(chch=>{
        if (chch.label) {
          var a = {label: chch.label, index: i, evaluate: chch};
          ta.args.set(chch.label, a);
          ta.argsarr.push(a);
        } else {
          //child.action.args.set(chch.label, {label: "$"+i, index: i, evaluate: chch});
        }
        i++;
      });
      return ta;
    }
  }

  var ctx = new Context();

  function parseGrammarAst(parent, node): PNode {

    var child: PNode;

    switch (node.type) {
      case "grammar":
        ctx.grammar = node.gramar = ctx.pushNode(PNodeKind.GRAMMAR);
        ctx.grammar.actions = [];
        node.rules.forEach(rule => {
          child = parseGrammarAst(node, rule);
        });
        return ctx.popNode();

      case "rule":
        // terminal/nonterminal 
        if (/^Ł/.exec(node.name)) {
          //node.name.substring(1)
        } else {
          ctx.rule = ctx.pushNode(PNodeKind.RULE);
          ctx.rule.actions = [];
          ctx.rule.name = node.name;
          child = parseGrammarAst(node, node.expression);
          
          return ctx.popNode();
        }
        break;

      case "action":

        child = parseGrammarAst(node, node.expression);
        ctx.generateAction(child, child, node);
        break;

      case "sequence":

        var sequence = ctx.pushNode(PNodeKind.SEQUENCE);

        node.elements.forEach(elem => {
          child = parseGrammarAst(node, elem);
        });

        return ctx.popNode();

      case "labeled":

        child = parseGrammarAst(node, node.expression);
        child.label = node.label;

        break;

      case "choice":

        var choice = ctx.pushNode(PNodeKind.CHOICE);

        node.alternatives.forEach(elem => {
          child = parseGrammarAst(node, elem);
        });

        return ctx.popNode();

      case "optional":
      case "zero_or_more":
      case "one_or_more":

        ctx.pushNode(KT[node.type]);
        child = parseGrammarAst(node, node.expression);
        return ctx.popNode();

      case "semantic_and":
      case "semantic_not":
        var current = ctx.current;
        child = ctx.pushNode(KT[node.type]);
        // this generates the function arguments from preceeding nodes, as expected 
        var action = ctx.generateAction(child, current, node);
        child.name = ctx.rule.name+"$"+action.index;
        return ctx.popNode();

      case "rule_ref":
        // terminal rule
        if (/^Ł/.exec(node.name)) {
          child = ctx.pushNode(PNodeKind.TERMINAL_REF);
          child.terminal = node.name.substring(1);
          child.value = terminalConsts[child.terminal];
        } else {
          child = ctx.pushNode(PNodeKind.RULE_REF);
          child.rule = node.name;
        }
        return ctx.popNode();
  
    }

  }

  parseGrammarAst(null, ast);

  //console.log("ast : "+JSON.stringify(ast, null, "  "));

}

module.exports = generate;
