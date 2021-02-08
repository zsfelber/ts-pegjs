"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var lib_1 = require("../../lib");
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
        var i = 0;
        do {
            var parents = [];
            g.allLeafStateNodes.forEach(function (itm) {
                var node = itm.traverser.node;
                generateVisualizerTreeUpwards(node, parents);
            });
            console.log(i++ + "." + parents.length);
        } while (parents.length);
        var main = Object.values(g.entryPoints)[0];
        var main2 = g.startingStateNode.traverser;
        if (main !== main2)
            throw new Error();
        var vtree = main["$$$"];
        if (!vtree)
            throw new Error();
        var j = tothingyjson(vtree);
        var fnm = "../www/pnodes-graph-" + rule.rule + ".json";
        fs.writeFileSync(fnm, j);
    };
    options.bigStartRules.forEach(function (r) {
        doit(r);
    });
    options.allowedStartRules.forEach(function (r) {
        doit(r);
    });
    var fnm0 = "../www/pnodes-graph.json";
    fs.writeFileSync(fnm0, JSON.stringify(options.allowedStartRules));
}
function generateVisualizerTreeUpwards(node, parents) {
    if (!node.parent) {
        return;
    }
    var p$, n$;
    if (!(p$ = node.parent["$$$"])) {
        node.parent["$$$"] = p$ = { name: node.parent.toString(), children: [], n: 1 };
        parents.push(node.parent);
    }
    if (!(n$ = node["$$$"])) {
        node["$$$"] = n$ = { name: node.toString(), children: [], n: 1 };
    }
    p$.children.push(n$);
    p$.n += n$.n;
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
    buffer.push(ind + '{ "name":"' + obj.name + '", "n":' + (obj.n ? obj.n : 0) + ', "children":[');
    buffer.push(chbuf.join(",\n"));
    buffer.push(ind + "]  }");
    obj["$jsproc"] = 0;
    return buffer.join("\n");
}
module.exports = generateTT;
//# sourceMappingURL=generateTesterTools.js.map