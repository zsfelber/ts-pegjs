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
    var deps = {};
    var doit = function (r) {
        ri = ruleMap[r];
        var rule = grammar.children[ri];
        console.log("Generate visualizer tree for " + rule.rule);
        var g = lib_1.ParseTableGenerator.createForRule(rule);
        Object.assign(deps, g.startRuleDependencies);
        var i = 0;
        do {
            var parents = [];
            g.allLeafStateNodes.forEach(function (itm) {
                generateVisualizerTreeUpwards(itm.traverser, parents);
            });
            console.log(i++ + "." + parents.length);
        } while (parents.length);
        var main = Object.values(g.entryPoints)[0];
        var main2 = g.startingStateNode.traverser;
        if (main !== main2)
            throw new Error();
        var vtree = main["$$$"];
        if (!vtree)
            throw new Error("Could not generate visual tree up to : " + main);
        var j = tothingyjson(vtree);
        var fnm = "../www/pnodes-graph-" + rule.rule + ".json";
        fs.writeFileSync(fnm, j);
    };
    if (options.bigStartRules) {
        console.log("bigStartRules:" + options.bigStartRules.join(", "));
        options.bigStartRules.forEach(function (r) {
            doit(r);
        });
    }
    if (options.allowedStartRules) {
        console.log("allowedStartRules:" + options.allowedStartRules.join(", "));
        options.allowedStartRules.forEach(function (r) {
            delete deps[r];
            doit(r);
        });
    }
    var depks = Object.keys(deps);
    if (depks.length) {
        console.log("Remaining dependencies:" + depks.join(", "));
        depks.forEach(function (r) {
            doit(r);
        });
    }
    var fnm0 = "../www/pnodes-graph.json";
    fs.writeFileSync(fnm0, JSON.stringify(options.allowedStartRules));
}
function generateVisualizerTreeUpwards(tnode, parents) {
    var p$, n$;
    if (!(n$ = tnode["$$$"])) {
        tnode["$$$"] = n$ = { name: tnode.node.toString(), children: [], n: 1 };
    }
    if (!tnode.parent) {
        return;
    }
    if (!(p$ = tnode.parent["$$$"])) {
        tnode.parent["$$$"] = p$ = { name: tnode.parent.node.toString(), children: [], n: 1 };
        parents.push(tnode.parent);
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