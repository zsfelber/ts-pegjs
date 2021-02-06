"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var compiler_1 = require("pegjs/lib/compiler");
var lib_1 = require("../../lib");
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
    var KT = {
        "grammar": lib_1.PGrammar,
        "rule": lib_1.PRule,
        "choice": lib_1.PValueNode,
        "sequence": lib_1.PValueNode,
        "optional": lib_1.PValueNode,
        "one_or_more": lib_1.PValueNode,
        "zero_or_more": lib_1.PValueNode,
        "semantic_and": lib_1.PSemanticAnd,
        "semantic_not": lib_1.PSemanticNot,
        "simple_and": lib_1.PValueNode,
        "simple_not": lib_1.PValueNode,
    };
    var KK = {
        "grammar": lib_1.PNodeKind.GRAMMAR,
        "rule": lib_1.PNodeKind.RULE,
        "choice": lib_1.PNodeKind.CHOICE,
        "sequence": lib_1.PNodeKind.SEQUENCE,
        "optional": lib_1.PNodeKind.OPTIONAL,
        "one_or_more": lib_1.PNodeKind.ONE_OR_MORE,
        "zero_or_more": lib_1.PNodeKind.ZERO_OR_MORE,
        "semantic_and": lib_1.PNodeKind.SEMANTIC_AND,
        "semantic_not": lib_1.PNodeKind.SEMANTIC_NOT,
        "simple_and": lib_1.PNodeKind.PREDICATE_AND,
        "simple_not": lib_1.PNodeKind.PREDICATE_NOT,
    };
    ctx = new Context();
    function parseGrammarAst(parent, node) {
        var child;
        switch (node.type) {
            case "grammar":
                ctx.grammar = node.grammar = ctx.pushNode(lib_1.PGrammar);
                ctx.grammar.actions = [];
                ctx.grammar.ruleActions = [];
                ctx.grammar.rules = [];
                node.rules.forEach(function (rule) {
                    parseGrammarAst(node, rule);
                });
                return ctx.popNode();
            case "rule":
                // terminal/nonterminal 
                if (/^Ł/.exec(node.name)) {
                    var t = ctx.pushNode(lib_1.PTerminal);
                    t.terminal = node.name.substring(1);
                    ctx.rule = t;
                    ctx.terminals.set(t.terminal, t);
                }
                else {
                    var r = ctx.pushIdxNode(lib_1.PRule, ctx.ruleIndices++);
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
                ctx.generateAction(child, child, lib_1.PActionKind.RULE, node);
                break;
            case "choice":
                var choice = ctx.pushNode(lib_1.PValueNode, lib_1.PNodeKind.CHOICE);
                node.alternatives.forEach(function (elem) {
                    parseGrammarAst(node, elem);
                });
                return ctx.popNode();
            case "sequence":
                var sequence = ctx.pushNode(lib_1.PValueNode, lib_1.PNodeKind.SEQUENCE);
                node.elements.forEach(function (elem) {
                    parseGrammarAst(node, elem);
                });
                if (sequence.children.length === 0) {
                    sequence.kind = lib_1.PNodeKind.EMPTY;
                }
                else if (sequence.children.length === 0) {
                    sequence.kind = lib_1.PNodeKind.SINGLE;
                }
                return ctx.popNode();
            case "labeled":
                var v = parseGrammarAst(node, node.expression);
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
                var action = ctx.generateAction(child, current, lib_1.PActionKind.PREDICATE, node);
                return ctx.popNode();
            case "rule_ref":
                // terminal rule
                if (/^Ł/.exec(node.name)) {
                    var tr = ctx.pushNode(lib_1.PTerminalRef);
                    tr.terminal = node.name.substring(1);
                    tr.value = terminalConsts.get(tr.terminal);
                    ctx.terminalRefs.push(tr);
                }
                else {
                    var rr = ctx.pushNode(lib_1.PRuleRef);
                    rr.rule = node.name;
                    ctx.ruleRefs.push(rr);
                }
                return ctx.popNode();
            case "literal":
                ctx.pushNode(lib_1.PValueNode, lib_1.PNodeKind.EMPTY);
                return ctx.popNode();
        }
        return child;
    }
    parseGrammarAst(null, ast);
    var err = 0;
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
    ctx.terminalRefs.forEach(function (tr) {
        var target = ctx.terminals.get(tr.terminal);
        if (target) {
            //tr.terminalIndex = target.index;
        }
        else {
            console.error("No terminal for terminal ref : " + tr.terminal);
            err = 1;
        }
    });
    if (err) {
        throw new Error("Grammar parsing error(s).");
    }
    //console.log("parsed grammar : "+stringify(ctx.grammar, ""));
    options.allowedStartRules.forEach(function (rnm) {
        console.log("Generating " + rnm + "...");
        var rule = ctx.rules.get(rnm);
        var vtree = nodeToGraph(rule, { n: 0, alreadyProc: {} });
        var j = tojson(vtree, { n: 0, alreadyProc: {} });
        var fnm = "../www/pnodes-graph-" + rule.rule + ".json";
        fs.writeFileSync(fnm, j);
    });
    var fnm0 = "../www/pnodes-graph.json";
    fs.writeFileSync(fnm0, JSON.stringify(options.allowedStartRules));
}
var RetekBufferMár = /** @class */ (function () {
    function RetekBufferMár() {
        this.n = 0;
    }
    return RetekBufferMár;
}());
function tojson(obj, processing, ind) {
    if (ind === void 0) { ind = ""; }
    if (obj["$jsproc"])
        return undefined;
    if (ind.length > 50)
        return undefined;
    obj["$jsproc"] = 1;
    var chbuf = [];
    obj.children.forEach(function (itm) {
        var ij = tojson(itm, processing, ind + "  ");
        if (ij)
            chbuf.push(ij);
    });
    var buffer = [];
    buffer.push(ind + '{ "name":"' + obj.name + '", "n":' + (obj.n ? obj.n : 0) + ', "children":[');
    buffer.push(chbuf.join(",\n"));
    buffer.push(ind + "]  }");
    obj["$jsproc"] = 0;
    return buffer.join("\n");
}
function gencode(code) {
    var result = [];
    result = code.split("\n").map(function (line) { return line.trim(); });
    return result;
}
var Thingy = /** @class */ (function () {
    function Thingy() {
        this.clauseN = 0;
    }
    return Thingy;
}());
function nodesToGraph(src, processing, target) {
    src.forEach(function (srcitm) {
        var targetitm = nodeToGraph(srcitm, processing);
        if (!targetitm)
            return; //continue;
        target.push(targetitm);
    });
}
function nodeToGraph(node, processing) {
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
        case lib_1.PNodeKind.GRAMMAR:
            var buf = [];
            nodesToGraph(node.children, processing, buf);
            result = { name: "O", label: "", children: buf, nodeIdx: node.nodeIdx, n: 1 };
            processing.n++;
            result.n = processing.n - branchTotal0;
            break;
        case lib_1.PNodeKind.RULE:
            var rule = node.rule;
            if (rule) {
                if (processing.alreadyProc[rule]) {
                    result = { name: rule + "oo", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
                    processing.n++;
                }
                else {
                    processing.alreadyProc[rule] = 1;
                    var n2 = nodeToGraph(node.children[0], processing);
                    result = { name: rule, label: node.label, children: [n2], nodeIdx: node.nodeIdx, n: 1 };
                    processing.n++;
                    result.n = processing.n - branchTotal0;
                    processing.alreadyProc[rule] = 0;
                }
            }
            else {
                result = null;
            }
            break;
        case lib_1.PNodeKind.TERMINAL_REF:
            result = { name: "Ł" + node.terminal, label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
            processing.n++;
            break;
        case lib_1.PNodeKind.RULE_REF:
            var rule = node.rule;
            var rule0 = ctx.rules.get(rule);
            var n2 = nodeToGraph(rule0, processing);
            result = { name: n2.name + "->", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.ZERO_OR_MORE:
            var n2 = nodeToGraph(node.children[0], processing);
            result = { name: n2.name + "*", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.ONE_OR_MORE:
            var n2 = nodeToGraph(node.children[0], processing);
            result = { name: n2.name + "+", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.OPTIONAL:
            var n2 = nodeToGraph(node.children[0], processing);
            result = { name: n2.name + "?", label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.SEMANTIC_AND:
            result = { name: "&{...}", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
            processing.n++;
            break;
        case lib_1.PNodeKind.PREDICATE_AND:
            var n2 = nodeToGraph(node.children[0], processing);
            result = { name: "&" + n2.name, label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.SEMANTIC_NOT:
            result = { name: "!{...}", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
            processing.n++;
            break;
        case lib_1.PNodeKind.PREDICATE_NOT:
            var n2 = nodeToGraph(node.children[0], processing);
            result = { name: "!" + n2.name, label: node.label, children: n2.children, nodeIdx: node.nodeIdx, n: n2.n };
            processing.n++;
            break;
        case lib_1.PNodeKind.CHOICE:
            result = { name: "", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
            var f = 1;
            node.children.forEach(function (ch) {
                var c = nodeToGraph(ch, processing);
                if (!c)
                    return; //continue;
                result.children.push({ name: " / " + c.name, children: c.children, nodeIdx: c.nodeIdx, label: c.label, n: c.n });
                f = 0;
            });
            processing.n++;
            result.n = processing.n - branchTotal0;
            break;
        case lib_1.PNodeKind.SEQUENCE:
            result = { name: "", label: node.label, children: [], nodeIdx: node.nodeIdx, n: 1 };
            node.children.forEach(function (ch) {
                var c = nodeToGraph(ch, processing);
                if (!c)
                    return; //continue;
                result.children.push(c);
            });
            processing.n++;
            result.n = processing.n - branchTotal0;
            break;
        case lib_1.PNodeKind.TERMINAL:
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
    Context.prototype.generateAction = function (target, argumentsOwner, kind, node) {
        var action = {
            kind: kind,
            ownerRule: ctx.rule,
            target: target,
            nodeIdx: this.nodeIdxs++, index: ctx.functionIndices++,
            code: gencode(node.code), args: [], fun: null
        };
        target.action = action;
        this.grammar.actions.push(action);
        this.rule.actions.push(action);
        if (kind === lib_1.PActionKind.RULE) {
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
        if (argumentsOwner.kind === lib_1.PNodeKind.SEQUENCE || argumentsOwner.kind === lib_1.PNodeKind.CHOICE) {
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