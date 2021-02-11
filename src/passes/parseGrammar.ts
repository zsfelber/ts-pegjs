import * as fs from "fs";
import { visitor } from "pegjs/lib/compiler";
import { Analysis, ParseTableGenerator } from '../../lib/analyzer';
import {
  PActContainer, PActionKind, PFunction,
  PGrammar, PLogicNode, PNode, PNodeKind, PRule,
  PRuleRef, PSemanticAnd, PSemanticNot, PTerminal,
  PTerminalRef, PValueNode, PConss, StrMapLike
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



  ctx = new Context();

  function parseGrammarAst(parent, node): PNode {

    var child: PNode;

    switch (node.type) {
      case PNodeKind.GRAMMAR:
        ctx.grammar = node.grammar = ctx.pushNode(PGrammar);
        ctx.grammar.actions = [];
        ctx.grammar.ruleActions = [];
        ctx.grammar.rules = [];
        node.rules.forEach(rule => {
          parseGrammarAst(node, rule);
        });
        return ctx.popNode();

      case PNodeKind.RULE:
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

      case PNodeKind.CHOICE:

        var choice = ctx.pushNode(PValueNode, PNodeKind.CHOICE);

        node.alternatives.forEach(elem => {
          parseGrammarAst(node, elem);
        });

        return ctx.popNode();

      case PNodeKind.SEQUENCE:

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

      case PNodeKind.OPTIONAL:
      case PNodeKind.ZERO_OR_MORE:
      case PNodeKind.ONE_OR_MORE:
      case PNodeKind.PREDICATE_AND:
      case PNodeKind.PREDICATE_NOT:

        ctx.pushNode(PConss[node.type], node.type);
        parseGrammarAst(node, node.expression);
        return ctx.popNode();

      case PNodeKind.SEMANTIC_AND:
      case PNodeKind.SEMANTIC_NOT:
        var current = ctx.current;
        child = ctx.pushNode(PConss[node.type], node.type);
        // this generates the function arguments from preceeding nodes, as expected 
        var action = ctx.generateAction(child, current, PActionKind.PREDICATE, node);
        return ctx.popNode();

      case PNodeKind.RULE_REF:
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

      case PNodeKind.LITERAL:
      case PNodeKind.TEXT:
        ctx.pushNode(PValueNode, PNodeKind.EMPTY);
        return ctx.popNode();
    }

    return child;
  }

  parseGrammarAst(null, ast);

  // must be circle-free :
  var T = (node: PNode)=>{
    if (node["$$"]) throw new Error("Circle:"+node);
    node["$$"] = 1;
    node.children.forEach(child => {
      T(child);
    });
    node["$$"] = 0;
  }
  T(ctx.grammar);

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

  var allstarts = [];
  var created: StrMapLike<number> = {};

  var ruleMap = {};
  var ri = 0;
  ast.rules.forEach(r => { ruleMap[r.name] = ri++; });

  var grammar: PGrammar = ctx.grammar;

  Analysis.ruleTable = grammar.rules;
  Analysis.deferredRules = options.deferredRules ? options.deferredRules : [];

  const doit = (r: string) => {
    if (!created[r]) {
      created[r] = 1;
      ri = ruleMap[r];
      var rule = grammar.children[ri] as PRule;

      var g = ParseTableGenerator.createForRule(rule);
      return true;
    }
  };

  if (options.allowedStartRules) {
    console.log("allowedStartRules:" + options.allowedStartRules.join(", "));
    options.allowedStartRules.forEach(r => {
      if (doit(r)) allstarts.push(r);
    });
  }

  var def0 = 0;
  if (options.deferredRules) {
    def0 = options.deferredRules.length;
    console.log("deferredRules:" + options.deferredRules.join(", "));
  }
  do {
    if (def0 < Analysis.deferredRules.length) {
      console.log("indirect deferredRules:" + Analysis.deferredRules.slice(def0).join(", "));
    }
    def0 = Analysis.deferredRules.length;
    Analysis.deferredRules.forEach(r => {
      if (doit(r)) allstarts.push(r);
    });
  } while (Analysis.deferredRules.length > def0);

  allstarts.sort();
  allstarts.splice(allstarts.indexOf(options.allowedStartRules[0]),1);
  allstarts.unshift(options.allowedStartRules[0]);
  ast.allstarts = allstarts;


  if (err) {
    throw new Error("Grammar parsing error(s).");
  }

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
  generateAction(_target: PNode, argumentsOwner: PNode, kind: PActionKind, node) {
    var target = _target as PValueNode;
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
        addlabels(chch as PValueNode);
      });
    } else {
      addlabels(argumentsOwner as PValueNode);
    }
    return action;
  }
}







module.exports = generate;






