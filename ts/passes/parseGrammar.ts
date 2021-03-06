import * as fs from "fs";
import { visitor } from "pegjs/lib/compiler";
import { Analysis, ParseTableGenerator } from '../lib/analyzer';
import { distinct, HyperG } from '../lib';
import { IncVariator } from '../lib/index';
import { GenerateParseDeferrerMainGen } from '../lib/analyzer-level3';
import {
  PActContainer, PActionKind, PFunction,
  PGrammar, PLogicNode, PNode, PNodeKind, PRule,
  PRuleRef, PSemanticAnd, PSemanticNot, PTerminal,
  PTerminalRef, PValueNode, PConss, StrMapLike
} from '../lib';

var options;
const terminals: string[] = [];
const terminalConsts: Map<string, number> = new Map;
const terminalDeconsts = {};
var ctx: Context;


// Generates parser JavaScript code.
function generate(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  options = args[args.length - 1];

  Analysis.ast = ast;
  ast.terminals = terminals;
  ast.terminalConsts = terminalConsts;
  ast.terminalDeconsts = terminalDeconsts;

  if (options.deferredRules) {
    options.deferredRules = distinct(options.deferredRules);

    console.log("User-defined deferred rules: " + options.deferredRules.join(", "));
  }


  Analysis.startRules = options.deferredRules ? [].concat(options.deferredRules) : [];
  Analysis.deferredRules = options.deferredRules ? [].concat(options.deferredRules) : [];


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
        terminalDeconsts[tokenId] = context.terminal;
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

  var err = 0;

  function analyzeAst() {
    // must be circle-free :
    var T = (node: PNode) => {
      if (node["$$"]) throw new Error("Circle:" + node);
      node["$$"] = 1;
      node.children.forEach(child => {
        T(child);
      });
      node["$$"] = 0;
    }
    T(ctx.grammar);

    ctx.ruleRefs.forEach(rr => {
      var target = ctx.rules.get(rr.rule);
      if (target) {
        rr.ruleIndex = target.index;
      } else {
        console.error("No rule for rule ref : " + rr.rule);
        err = 1;
      }
    });
    var maxTknId = 0;
    ctx.terminalRefs.forEach(tr => {
      var target = ctx.terminals.get(tr.terminal);
      if (target) {
        //tr.terminalIndex = target.index;
        if (tr.value > maxTknId) {
          maxTknId = tr.value;
        }
      } else {
        console.error("No terminal for terminal ref : " + tr.terminal);
        err = 1;
      }
    });

    HyperG.ruleTable = ctx.grammar.rules;
    HyperG.ruleRefTable = ctx.ruleRefs;
    Analysis.maxTokenId = maxTknId;

    HyperG.countRuleRefs();
  }

  function createParseTables() {
    var allstarts = [];
    var created: StrMapLike<number> = {};

    var ruleMap = {};
    var ri = 0;
    ast.rules.forEach(r => { ruleMap[r.name] = ri++; });

    var grammar: PGrammar = ctx.grammar;

    console.log("");
    console.log("-- CREATE RAW TABLES ------------------------------");

    const doit = (r: string) => {
      if (!created[r]) {
        created[r] = 1;
        ri = ruleMap[r];
        var rule = grammar.children[ri] as PRule;

        var ptg = ParseTableGenerator.createForRule(rule, false);
        var pt = Analysis.parseTable(rule, ptg);
        return true;
      }
    };


    if (options.allowedStartRules) {
      console.log("allowedStartRules:" + options.allowedStartRules.join(", "));
      options.allowedStartRules.forEach(r => {
        if (doit(r)) allstarts.push(r);
      });
    }

    Analysis.startRules = distinct(Analysis.startRules);
    Analysis.localDeferredRules = distinct(Analysis.localDeferredRules);

    var def0 = 0, ldef0 = 0;
    for (var first = true; ;) {
      var ds0 = Analysis.startRules.slice(def0).concat(Analysis.localDeferredRules.slice(ldef0));
      var ds = distinct(ds0);

      if (ds.length) {
        console.log("Remaining deferred rules: " + ds.join(", "));
      } else if (first) {
        first = false;
      } else {
        break;
      }

      def0 = Analysis.startRules.length;
      ldef0 = Analysis.localDeferredRules.length;
      ds.forEach(r => {
        if (doit(r)) allstarts.push(r);
      });
    }


    allstarts.sort();
    allstarts.splice(allstarts.indexOf(options.allowedStartRules[0]), 1);
    allstarts.unshift(options.allowedStartRules[0]);

    console.log("Raw parse tables created  :" + allstarts.length + "  entry points(nonterminals):" + Analysis.varEntryPts + "  all nodes:" + Analysis.varAllNds + "  all rule refs:" + Analysis.varAllRuleRefs + "  L1 rule refs:" + Analysis.varRuleRefs + "  L1 terminal refs:" + Analysis.varTerminalRefs + "  tokens:" + Analysis.maxTokenId + "   states:" + Analysis.varLfStates);



    var lastr = allstarts[allstarts.length - 1];

    console.log("");
    console.log("-- PACK STAGES ------------------------------");

    var savedStack: Analysis.Backup[] = [];

    // 0 level, less optimization, local transition tables only
    // runtime automaton heavily traverses across stack operations
    HyperG.totallyReinitializableTransaction(() => {

      allstarts.forEach(r => {

        var ptg = Analysis.parseTableGens[r];
        var parseTable = Analysis.parseTable(ptg.rule, ptg);

        parseTable.pack(false, r === lastr, "OPTIMIZATION LEVEL 0");
      });

      savedStack[0] = Analysis.backup();
    });

    // 1 level, LL(0) optimization, merged transition tables with 0 lookahead
    // runtime automaton does not do stack operation traversal, but 
    // it still has several if-else situations with ambigous transition tokens 
    HyperG.totallyReinitializableTransaction(() => {

      allstarts.forEach(r => {

        var ptg = Analysis.parseTableGens[r];
        var parseTable = Analysis.parseTable(ptg.rule, ptg);

        //console.log("Rule " + r);

        // NOTE Its dependencies is not reset, but this is an optimization 
        // and gives an equivalent result :
        parseTable.resetOptimization();

        for (var phase = 0; phase <= 3; phase++) {
          //console.log("Phase " + phase);

          parseTable.fillStackOpenerTransitions(phase);

        }

        new GenerateParseDeferrerMainGen(ast, parseTable);

        parseTable.pack(true, r === lastr, "OPTIMIZATION LEVEL 1 : PEG-LL(0)");

      });

      savedStack[1] = Analysis.backup();
    });

    Analysis.stack = savedStack;


    ast.allstarts = allstarts;
  }


  parseGrammarAst(null, ast);
  analyzeAst();
  createParseTables();

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
      code: gencode(node.code), args: [], fun: null,
      diagnosticEqualityCheck: null
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






