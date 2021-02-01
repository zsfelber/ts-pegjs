"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lib_1 = require("../../lib");
var compiler_1 = require("pegjs/lib/compiler");
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
        "grammar": lib_1.PNodeKind.GRAMMAR,
        "rule": lib_1.PNodeKind.RULE,
        "choice": lib_1.PNodeKind.CHOICE,
        "sequence": lib_1.PNodeKind.SEQUENCE,
        "optional": lib_1.PNodeKind.OPTIONAL,
        "one_or_more": lib_1.PNodeKind.ONE_OR_MORE,
        "zero_or_more": lib_1.PNodeKind.ZERO_OR_MORE,
        "semantic_and": lib_1.PNodeKind.SEMANTIC_AND,
        "semantic_not": lib_1.PNodeKind.SEMANTIC_NOT
    };
    function gencode(code) {
        var result = [];
        result = code.split("\n").map(function (line) { return line.trim(); });
        return result;
    }
    var Context = /** @class */ (function () {
        function Context() {
        }
        Context.prototype.pushNode = function (kind) {
            var child = { parent: this.current, kind: kind, children: [] };
            if (this.current)
                this.current.children.push(child);
            this.current = child;
            return child;
        };
        Context.prototype.popNode = function () {
            var generatedNode = this.current;
            this.current = this.current.parent;
            return generatedNode;
        };
        Context.prototype.generateAction = function (target, argumentsOwner, node) {
            var ta = { owner: target, code: gencode(node.code), index: this.rule.actions.length, args: new Map, argsarr: [] };
            target.action = ta;
            this.grammar.actions.push(ta);
            this.rule.actions.push(ta);
            var i = 0;
            argumentsOwner.children.forEach(function (chch) {
                if (chch.label) {
                    var a = { label: chch.label, index: i, evaluate: chch };
                    ta.args.set(chch.label, a);
                    ta.argsarr.push(a);
                }
                else {
                    //child.action.args.set(chch.label, {label: "$"+i, index: i, evaluate: chch});
                }
                i++;
            });
            return ta;
        };
        return Context;
    }());
    var ctx = new Context();
    function parseGrammarAst(parent, node) {
        var child;
        switch (node.type) {
            case "grammar":
                ctx.grammar = node.gramar = ctx.pushNode(lib_1.PNodeKind.GRAMMAR);
                ctx.grammar.actions = [];
                node.rules.forEach(function (rule) {
                    child = parseGrammarAst(node, rule);
                });
                return ctx.popNode();
            case "rule":
                // terminal/nonterminal 
                if (/^Ł/.exec(node.name)) {
                    //node.name.substring(1)
                }
                else {
                    ctx.rule = ctx.pushNode(lib_1.PNodeKind.RULE);
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
                var sequence = ctx.pushNode(lib_1.PNodeKind.SEQUENCE);
                node.elements.forEach(function (elem) {
                    child = parseGrammarAst(node, elem);
                });
                return ctx.popNode();
            case "labeled":
                child = parseGrammarAst(node, node.expression);
                child.label = node.label;
                break;
            case "choice":
                var choice = ctx.pushNode(lib_1.PNodeKind.CHOICE);
                node.alternatives.forEach(function (elem) {
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
                child.name = ctx.rule.name + "$" + action.index;
                return ctx.popNode();
            case "rule_ref":
                // terminal rule
                if (/^Ł/.exec(node.name)) {
                    child = ctx.pushNode(lib_1.PNodeKind.TERMINAL_REF);
                    child.terminal = node.name.substring(1);
                    child.value = terminalConsts[child.terminal];
                }
                else {
                    child = ctx.pushNode(lib_1.PNodeKind.RULE_REF);
                    child.rule = node.name;
                }
                return ctx.popNode();
        }
    }
    parseGrammarAst(null, ast);
    //console.log("ast : "+JSON.stringify(ast, null, "  "));
}
module.exports = generate;
//# sourceMappingURL=parseGrammar.js.map