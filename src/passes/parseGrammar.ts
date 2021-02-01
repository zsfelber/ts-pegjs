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
  class Context {
    current: PNode;

    pushNode(kind: PNodeKind) {
      var child: PNode = { parent: this.current, kind, children: [] };
      this.current.children.push(child);
      this.current = child;
      return child;
    }
    popNode() {
      var generatedNode = this.current;
      this.current = this.current.parent;
      return generatedNode;
    }
    generateAction(target: PNode, argumentsOwner: PNode, name: string) {
      var ta = {name, args: new Map, argsarr: []};
      target.action = ta;
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
    }
  }

  var stack = new Context();

  function parseGrammarAst(parent, node): PNode {

    var argIndex = stack.current.children.length;

    switch (node.type) {
      case "grammar":
        node.gramar = stack.pushNode(PNodeKind.GRAMMAR);
        node.rules.forEach(rule => {
          var child = parseGrammarAst(node, rule);
        });
        return stack.popNode();

      case "rule":
        // terminal/nonterminal 
        if (/^Ł/.exec(node.name)) {
          //node.name.substring(1)
        } else {
          var rule = stack.pushNode(PNodeKind.RULE);
          rule.name = node.name;
          var child = parseGrammarAst(node, node.expression);
          
          return stack.popNode();
        }
        break;

      case "action":

        var child = parseGrammarAst(node, node.expression);
        stack.generateAction(child, child, node.templateFunction);
        break;

      case "sequence":

        var sequence = stack.pushNode(PNodeKind.SEQUENCE);

        node.elements.forEach(elem => {
          var child = parseGrammarAst(node, elem);
        });

        return stack.popNode();

      case "labeled":

        var child = parseGrammarAst(node, node.expression);
        child.label = node.label;

        break;

      case "choice":

        var choice = stack.pushNode(PNodeKind.CHOICE);

        node.alternatives.forEach(elem => {
          var child = parseGrammarAst(node, elem);
        });

        return stack.popNode();

      case "optional":
      case "zero_or_more":
      case "one_or_more":

        stack.pushNode(KT[node.type]);
        var child = parseGrammarAst(node, node.expression);
        return stack.popNode();

      case "semantic_and":
      case "semantic_not":
        var current = stack.current;
        var child = stack.pushNode(KT[node.type]);
        // this generates the function arguments from preceeding nodes, as expected 
        stack.generateAction(child, current, node.templateFunction);
        return stack.popNode();

      case "rule_ref":
        // terminal rule
        if (/^Ł/.exec(node.name)) {
          var child = stack.pushNode(PNodeKind.TERMINAL_REF);
          child.terminal = node.name.substring(1);
          child.value = terminalConsts[child.terminal];
        } else {
          var child = stack.pushNode(PNodeKind.RULE_REF);
          child.rule = node.name;
        }
  
    }

  }



  //console.log("ast : "+JSON.stringify(ast, null, "  "));

}

module.exports = generate;
