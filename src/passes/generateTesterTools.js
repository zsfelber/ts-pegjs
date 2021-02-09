"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var lib_1 = require("../../lib");
var parsers_1 = require("../../lib/parsers");
// Generates parser JavaScript code.
function generateTT(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
    //options.returnTypes = {};
    var param0 = options.param0 ? options.param0 + ', ' : '';
    //console.log("parsed grammar : "+stringify(ctx.grammar, ""));
    var grammar = ast.grammar;
    var ruleMap = {};
    var ri = 0;
    ast.rules.forEach(function (r) { ruleMap[r.name] = ri++; });
    lib_1.Analysis.ruleTable = grammar.rules;
    lib_1.Analysis.bigStartRules = options.bigStartRules ? options.bigStartRules : [];
    var doit = function (r) {
        ri = ruleMap[r];
        var rule = grammar.children[ri];
        console.log("Generate visualizer tree for " + rule.rule);
        var g = lib_1.ParseTableGenerator.createForRule(rule);
        var leaves = g.allLeafStateNodes.map(function (itm) {
            var tnode = itm.traverser;
            tnode["$leaf$"] = 1;
            return tnode;
        });
        var items = leaves;
        var i = 0;
        do {
            var parents = [];
            items.forEach(function (tnode) {
                generateVisualizerTreeUpwards(tnode, parents);
            });
            //console.log(i++ + "." + parents.length);
            items = parents;
            i++;
        } while (items.length);
        var main = Object.values(g.entryPoints)[0];
        var main2 = g.startingStateNode.traverser;
        if (main !== main2)
            throw new Error();
        var vtree = main["$$$"];
        if (!vtree)
            throw new Error("Could not generate visual tree up to : " + main);
        countVisualizerTree(vtree);
        vtree.numleaves = leaves.length;
        vtree.numlevels = i;
        var j = tothingyjson(vtree);
        var fnm = "../www/pnodes-graph-" + rule.rule + ".json";
        fs.writeFileSync(fnm, j);
        return true;
    };
    var allstarts = ast.allstarts;
    allstarts.forEach(function (r) {
        doit(r);
    });
    var fnm0 = "../www/pnodes-graph.json";
    fs.writeFileSync(fnm0, JSON.stringify(allstarts));
}
function generateVisualizerTreeUpwards(tnode, parents) {
    var p$, n$;
    if (!(n$ = tnode["$$$"])) {
        tnode["$$$"] = n$ = { name: tnode.shortLabel, children: [], n: 1, kind: tnode.node.kind };
    }
    if (!tnode.parent) {
        return;
    }
    var p = tnode.parent, plab = "", pkind;
    if (p) {
        plab = p.shortLabel;
    }
    shortenTree: while (p.parent) {
        switch (p.parent.node.kind) {
            case parsers_1.PNodeKind.ONE_OR_MORE:
            case parsers_1.PNodeKind.ZERO_OR_MORE:
            case parsers_1.PNodeKind.OPTIONAL:
                plab = plab + p.parent.shortLabel;
                if (!pkind)
                    pkind = p.node.kind;
                p = p.parent;
                break;
            case parsers_1.PNodeKind.RULE_REF:
                plab = p.parent.shortLabel;
                if (!pkind)
                    pkind = p.node.kind;
                p = p.parent;
                break;
            case parsers_1.PNodeKind.RULE:
                if (!plab) {
                    plab = p.parent.shortLabel;
                    if (!pkind)
                        pkind = p.node.kind;
                    p = p.parent;
                }
                else {
                    break shortenTree;
                }
                break;
            default:
                break shortenTree;
        }
    }
    if (!(p$ = p["$$$"])) {
        if (!pkind)
            pkind = p.node.kind;
        p["$$$"] = p$ = { name: plab, kind: pkind, children: [], n: 1 };
        parents.push(p);
    }
    if (p["$leaf$"]) {
        throw new Error("Bad leaf with children : " + p);
    }
    p$.children.push(n$);
}
function countVisualizerTree($node) {
    $node.children.forEach(function ($child) {
        $node.n += countVisualizerTree($child);
    });
    return $node.n;
}
function tothingyjson(obj, ind) {
    if (ind === void 0) { ind = ""; }
    if (obj["$jsproc"])
        return undefined;
    if (ind.length > 50)
        return undefined;
    obj["$jsproc"] = 1;
    var chbuf = [];
    obj.children.forEach(function (itm) {
        var ij = tothingyjson(itm, ind + "  ");
        if (ij)
            chbuf.push(ij);
    });
    var buffer = [];
    buffer.push(ind + '{ "name":"' + (obj.name ? obj.name : "") + '", "kind":"' + obj.kind + '", "n":' + (obj.n ? obj.n : 0) + (obj.numleaves ? ', "numleaves":' + obj.numleaves : "") + (obj.numlevels ? ', "numlevels":' + obj.numlevels : "") + ', "children":[');
    buffer.push(chbuf.join(",\n"));
    buffer.push(ind + "]  }");
    obj["$jsproc"] = 0;
    return buffer.join("\n");
}
module.exports = generateTT;
//# sourceMappingURL=generateTesterTools.js.map