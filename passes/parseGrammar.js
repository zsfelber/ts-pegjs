"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var compiler_1 = require("pegjs/lib/compiler");
var analyzer_1 = require("../lib/analyzer");
var lib_1 = require("../lib");
var lib_2 = require("../lib");
var stringifySafe = require('json-stringify-safe');
var options;
var terminals = [];
var terminalConsts = new Map;
var ctx;
// Generates parser JavaScript code.
function generate(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    options = args[args.length - 1];
    ast.terminals = terminals;
    ast.terminalConsts = terminalConsts;
    analyzer_1.Analysis.deferredRules = options.deferredRules ? options.deferredRules : [];
    var findTerminals = compiler_1.visitor.build({
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
    function parseGrammarAst(parent, node) {
        var child;
        switch (node.type) {
            case lib_2.PNodeKind.GRAMMAR:
                ctx.grammar = node.grammar = ctx.pushNode(lib_2.PGrammar);
                ctx.grammar.actions = [];
                ctx.grammar.ruleActions = [];
                ctx.grammar.rules = [];
                node.rules.forEach(function (rule) {
                    parseGrammarAst(node, rule);
                });
                return ctx.popNode();
            case lib_2.PNodeKind.RULE:
                // terminal/nonterminal 
                if (/^Ł/.exec(node.name)) {
                    var t = ctx.pushNode(lib_2.PTerminal);
                    t.terminal = node.name.substring(1);
                    ctx.rule = t;
                    ctx.terminals.set(t.terminal, t);
                }
                else {
                    var r = ctx.pushIdxNode(lib_2.PRule, ctx.ruleIndices++);
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
                ctx.generateAction(child, child, lib_2.PActionKind.RULE, node);
                break;
            case lib_2.PNodeKind.CHOICE:
                var choice = ctx.pushNode(lib_2.PValueNode, lib_2.PNodeKind.CHOICE);
                node.alternatives.forEach(function (elem) {
                    parseGrammarAst(node, elem);
                });
                return ctx.popNode();
            case lib_2.PNodeKind.SEQUENCE:
                var sequence = ctx.pushNode(lib_2.PValueNode, lib_2.PNodeKind.SEQUENCE);
                node.elements.forEach(function (elem) {
                    parseGrammarAst(node, elem);
                });
                if (sequence.children.length === 0) {
                    sequence.kind = lib_2.PNodeKind.EMPTY;
                }
                else if (sequence.children.length === 0) {
                    sequence.kind = lib_2.PNodeKind.SINGLE;
                }
                return ctx.popNode();
            case "labeled":
                var v = parseGrammarAst(node, node.expression);
                v.label = node.label;
                child = v;
                break;
            case lib_2.PNodeKind.OPTIONAL:
            case lib_2.PNodeKind.ZERO_OR_MORE:
            case lib_2.PNodeKind.ONE_OR_MORE:
            case lib_2.PNodeKind.PREDICATE_AND:
            case lib_2.PNodeKind.PREDICATE_NOT:
                ctx.pushNode(lib_2.PConss[node.type], node.type);
                parseGrammarAst(node, node.expression);
                return ctx.popNode();
            case lib_2.PNodeKind.SEMANTIC_AND:
            case lib_2.PNodeKind.SEMANTIC_NOT:
                var current = ctx.current;
                child = ctx.pushNode(lib_2.PConss[node.type], node.type);
                // this generates the function arguments from preceeding nodes, as expected 
                var action = ctx.generateAction(child, current, lib_2.PActionKind.PREDICATE, node);
                return ctx.popNode();
            case lib_2.PNodeKind.RULE_REF:
                // terminal rule
                if (/^Ł/.exec(node.name)) {
                    var tr = ctx.pushNode(lib_2.PTerminalRef);
                    tr.terminal = node.name.substring(1);
                    tr.value = terminalConsts.get(tr.terminal);
                    ctx.terminalRefs.push(tr);
                }
                else {
                    var rr = ctx.pushNode(lib_2.PRuleRef);
                    rr.rule = node.name;
                    ctx.ruleRefs.push(rr);
                }
                return ctx.popNode();
            case lib_2.PNodeKind.LITERAL:
            case lib_2.PNodeKind.TEXT:
                ctx.pushNode(lib_2.PValueNode, lib_2.PNodeKind.EMPTY);
                return ctx.popNode();
        }
        return child;
    }
    var err = 0;
    function analyzeAst() {
        // must be circle-free :
        var T = function (node) {
            if (node["$$"])
                throw new Error("Circle:" + node);
            node["$$"] = 1;
            node.children.forEach(function (child) {
                T(child);
            });
            node["$$"] = 0;
        };
        T(ctx.grammar);
        ctx.ruleRefs.forEach(function (rr) {
            var target = ctx.rules.get(rr.rule);
            if (target) {
                rr.ruleIndex = target.index;
            }
            else {
                console.error("No rule for rule ref : " + rr.rule);
                err = 1;
            }
        });
        var maxTknId = 0;
        ctx.terminalRefs.forEach(function (tr) {
            var target = ctx.terminals.get(tr.terminal);
            if (target) {
                //tr.terminalIndex = target.index;
                if (tr.value > maxTknId) {
                    maxTknId = tr.value;
                }
            }
            else {
                console.error("No terminal for terminal ref : " + tr.terminal);
                err = 1;
            }
        });
        lib_1.HyperG.ruleTable = ctx.grammar.rules;
        lib_1.HyperG.ruleRefTable = ctx.ruleRefs;
        analyzer_1.Analysis.maxTokenId = maxTknId;
        lib_1.HyperG.countRuleRefs();
    }
    function createParseTables() {
        var allstarts = [];
        var created = {};
        var ruleMap = {};
        var ri = 0;
        ast.rules.forEach(function (r) { ruleMap[r.name] = ri++; });
        var grammar = ctx.grammar;
        var doit = function (r) {
            if (!created[r]) {
                created[r] = 1;
                ri = ruleMap[r];
                var rule = grammar.children[ri];
                var ptg = analyzer_1.ParseTableGenerator.createForRule(rule);
                var pt = analyzer_1.Analysis.parseTable(rule, ptg);
                return true;
            }
        };
        if (options.allowedStartRules) {
            console.log("allowedStartRules:" + options.allowedStartRules.join(", "));
            options.allowedStartRules.forEach(function (r) {
                if (doit(r))
                    allstarts.push(r);
            });
        }
        if (options.deferredRules) {
            options.deferredRules = lib_1.distinct(options.deferredRules);
            console.log("User-defined deferred rules: " + options.deferredRules.join(", "));
        }
        analyzer_1.Analysis.deferredRules = lib_1.distinct(analyzer_1.Analysis.deferredRules);
        analyzer_1.Analysis.localDeferredRules = lib_1.distinct(analyzer_1.Analysis.localDeferredRules);
        var def0 = 0, ldef0 = 0;
        for (var first = true;;) {
            var ds = analyzer_1.Analysis.deferredRules.slice(def0).concat(analyzer_1.Analysis.localDeferredRules.slice(ldef0));
            ds = lib_1.distinct(ds);
            if (ds.length) {
                console.log("Remaining deferred rules: " + ds.join(", "));
            }
            else if (first) {
                first = false;
            }
            else {
                break;
            }
            def0 = analyzer_1.Analysis.deferredRules.length;
            ldef0 = analyzer_1.Analysis.localDeferredRules.length;
            ds.forEach(function (r) {
                if (doit(r))
                    allstarts.push(r);
            });
        }
        allstarts.sort();
        allstarts.splice(allstarts.indexOf(options.allowedStartRules[0]), 1);
        allstarts.unshift(options.allowedStartRules[0]);
        console.log("-- PACK STAGES ------------------------------");
        var savedStack = [];
        for (var phase = 0; phase <= 3; phase++) {
            console.log("Phase " + phase);
            lib_1.HyperG.totallyReinitializableTransaction(function () {
                console.log("initial no.leafStateCommons:" + analyzer_1.Analysis.leafStateCommons.length);
                var ind = 0;
                allstarts.forEach(function (r) {
                    var ptg = analyzer_1.Analysis.parseTableGens[r];
                    var parseTable = analyzer_1.Analysis.parseTable(ptg.rule, ptg);
                    parseTable.resetOptimization();
                });
                var ind = 0;
                console.log("-- STACKS GEN --");
                allstarts.forEach(function (r) {
                    var ptg = analyzer_1.Analysis.parseTableGens[r];
                    var parseTable = analyzer_1.Analysis.parseTable(ptg.rule, ptg);
                    parseTable.fillStackOpenerTransitions(phase);
                    ind++;
                });
                console.log("-- PACK --");
                var ind = 0;
                allstarts.forEach(function (r) {
                    var ptg = analyzer_1.Analysis.parseTableGens[r];
                    var parseTable = analyzer_1.Analysis.parseTable(ptg.rule, ptg);
                    var toLog = (ind === (allstarts.length - 1));
                    parseTable.pack(toLog);
                    ind++;
                });
                savedStack[phase] = analyzer_1.Analysis.backup();
            });
        }
        analyzer_1.Analysis.stack = savedStack;
        ast.allstarts = allstarts;
    }
    parseGrammarAst(null, ast);
    analyzeAst();
    createParseTables();
    if (err) {
        throw new Error("Grammar parsing error(s).");
    }
}
function gencode(code) {
    var result = [];
    result = code.split("\n").map(function (line) { return line.trim(); });
    return result;
}
var Context = /** @class */ (function () {
    function Context() {
        this.nodeIdxs = 0;
        this.ruleIndices = 0;
        this.functionIndices = 0;
        this.ruleRefs = [];
        this.terminalRefs = [];
        this.rules = new Map;
        this.terminals = new Map;
    }
    Context.prototype.pushIdxNode = function (cons, index, kind) {
        var child = new cons(this.current, index);
        if (kind !== undefined)
            child.kind = kind;
        this.current = child;
        child.nodeIdx = this.nodeIdxs++;
        return child;
    };
    Context.prototype.pushNode = function (cons, kind) {
        var child = new cons(this.current);
        if (kind !== undefined)
            child.kind = kind;
        this.current = child;
        child.nodeIdx = this.nodeIdxs++;
        return child;
    };
    Context.prototype.popNode = function () {
        var generatedNode = this.current;
        this.current = this.current.parent;
        return generatedNode;
    };
    Context.prototype.generateAction = function (_target, argumentsOwner, kind, node) {
        var target = _target;
        var action = {
            kind: kind,
            ownerRule: ctx.rule,
            target: target,
            nodeIdx: this.nodeIdxs++, index: ctx.functionIndices++,
            code: gencode(node.code), args: [], fun: null,
            diagnosticEqualityCheck: null
        };
        target.action = action;
        this.grammar.actions.push(action);
        this.rule.actions.push(action);
        if (kind === lib_2.PActionKind.RULE) {
            this.grammar.ruleActions.push(action);
            this.rule.ruleActions.push(action);
        }
        var i = 0;
        var addlabels = function (chch) {
            if (chch.label) {
                var a = { label: chch.label, index: i, evaluate: chch };
                action.args.push(a);
            }
            else {
                //child.action.args.set(chch.label, {label: "$"+i, index: i, evaluate: chch});
            }
            i++;
        };
        if (argumentsOwner.kind === lib_2.PNodeKind.SEQUENCE || argumentsOwner.kind === lib_2.PNodeKind.CHOICE) {
            argumentsOwner.children.forEach(function (chch) {
                addlabels(chch);
            });
        }
        else {
            addlabels(argumentsOwner);
        }
        return action;
    };
    return Context;
}());
module.exports = generate;
//# sourceMappingURL=parseGrammar.js.map