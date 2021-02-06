"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var compiler_1 = require("pegjs/lib/compiler");
var lib_1 = require("../../lib");
// Generates parser JavaScript code.
function generate(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
    var terminals = [];
    var terminalConsts = new Map;
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
        Context.prototype.generateAction = function (target, argumentsOwner, kind, node) {
            var action = { kind: kind, ownerRule: ctx.rule, target: target, nodeIdx: this.nodeIdxs++, index: ctx.functionIndices++,
                code: gencode(node.code), args: [], fun: null };
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
    var ctx = new Context();
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
    var gs = new GraphStat();
    var json = { nodes: [], edges: [] };
    countGraph(this.grammar, gs);
    generateGraph(this.grammar, gs, json);
    var fnm = "pnodes-graph.json";
    fs.writeFileSync(fnm, JSON.stringify(json, null, "  "));
}
var i = 0;
var GraphStat = /** @class */ (function () {
    function GraphStat() {
        this.maxN = 0;
        this.totalN = 0;
        this.now = 0;
        this._perLevel = [];
    }
    GraphStat.prototype.perLevel = function (level) {
        var lgs = this._perLevel[level];
        if (!lgs) {
            this.perLevel[level] = lgs = new GraphStat();
        }
        return lgs;
    };
    return GraphStat;
}());
;
function countGraph(node, graphStat, l) {
    if (l === void 0) { l = 0; }
    var n = 0;
    node.children.forEach(function (child) {
        n += countGraph(child, graphStat, l + 1);
    });
    var lev = graphStat.perLevel(l);
    var max = lev.maxN;
    if (n > max)
        lev.maxN = n;
    lev.totalN += n;
    return n;
}
function generateGraph(node, graphStat, json, l) {
    if (l === void 0) { l = 0; }
    var n = 0;
    var l0graphStat = graphStat.perLevel(0);
    var lgraphStat = graphStat.perLevel(l);
    node.children.forEach(function (child) {
        n += generateGraph(child, graphStat, json, l + 1);
        var edge = {
            "id": "e" + node.nodeIdx + ":" + child.nodeIdx,
            "source": "n" + node.nodeIdx,
            "target": "n" + child.nodeIdx,
            "label": child.label
        };
        json.edges.push(edge);
    });
    var levheight = l0graphStat.totalN * 3;
    var radius = levheight * l;
    var angle0 = -0.5;
    var angleFromAngle0 = 2 * lgraphStat.now / lgraphStat.totalN;
    var angle = angle0 + angleFromAngle0;
    var x = radius * Math.cos(angle * Math.PI);
    var y = radius * Math.sin(angle * Math.PI);
    lgraphStat.now += n;
    var gnode = {
        "id": "n" + node.nodeIdx,
        "label": node.toString(),
        "x": x,
        "y": y,
        "size": n
    };
    json.nodes.push(gnode);
    return n;
}
function stringify(obj, indent) {
    if (!indent)
        indent = "";
    if (typeof obj !== 'object' || obj === null || obj instanceof Array) {
        return value(obj, indent);
    }
    if (obj["$pr"]) {
        return obj["$pr"];
    }
    obj["$pr"] = "$" + i;
    var result = " " + i + "." + indent + ' {\n' + Object.keys(obj).map(function (k) {
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
            if (val instanceof Date)
                return '"' + val.toISOString() + '"';
            if (val instanceof Array)
                return " " + i + "." + indent + '[\n' + val.map(function (v) { return value(v, indent + "  "); }).join(',\n') + +"/" + i + "." + indent + ']\n';
            if (val === null)
                return 'null';
            return stringify(val, indent);
    }
}
module.exports = generate;
//# sourceMappingURL=parseGrammar.js.map