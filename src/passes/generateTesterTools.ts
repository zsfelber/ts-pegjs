import * as fs from "fs";
import { Analysis, ParseTableGenerator } from "../../lib";
import { PGrammar, PRule, PNode, PRuleRef } from '../../lib/parsers';
import { RuleElementTraverser, StrMapLike } from '../../lib/analyzer';


// Generates parser JavaScript code.
function generateTT(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  //options.returnTypes = {};
  const param0 = options.param0 ? options.param0 + ', ' : '';


  //console.log("parsed grammar : "+stringify(ctx.grammar, ""));
  var grammar: PGrammar = ast.grammar;
  var ruleMap = {};
  var ri = 0;
  ast.rules.forEach(r => { ruleMap[r.name] = ri++; });

  Analysis.ruleTable = grammar.rules;
  Analysis.bigStartRules = options.bigStartRules ? options.bigStartRules : [];

  var deps:StrMapLike<PRuleRef> = {};

  const doit=(r: string)=>{
    ri = ruleMap[r];
    var rule = grammar.children[ri] as PRule;

    console.log("Generate visualizer tree for " + rule.rule);

    var g = ParseTableGenerator.createForRule(rule);
    Object.assign(deps, g.startRuleDependencies);

    var items = g.allLeafStateNodes.map(itm => itm.traverser);
    var i = 0;
    do {
      var parents = [];
      items.forEach(tnode => {
        generateVisualizerTreeUpwards(tnode, parents);
      });
      console.log(i++ + "." + parents.length);
      items = parents;
    } while (items.length);

    var main = Object.values(g.entryPoints)[0];
    var main2 = g.startingStateNode.traverser;
    if (main !== main2) throw new Error();

    var vtree = main["$$$"];
    if (!vtree) throw new Error("Could not generate visual tree up to : "+main);
    var j = tothingyjson(vtree);

    const fnm = "../www/pnodes-graph-" + rule.rule + ".json";
    fs.writeFileSync(fnm, j);
  };
  var allstarts = [];
  if (options.bigStartRules) {
    console.log("bigStartRules:"+options.bigStartRules.join(", "));
    options.bigStartRules.forEach(r => {
      doit(r);
      allstarts.push(r);
    });
  }
  if (options.allowedStartRules) {
    console.log("allowedStartRules:"+options.allowedStartRules.join(", "));
    options.allowedStartRules.forEach(r => {
      delete deps[r];
      doit(r);
      allstarts.push(r);
    });
  }
  var depks = Object.keys(deps);
  if (depks.length) {
    console.log("Remaining dependencies:"+depks.join(", "));
    depks.forEach(r => {
      doit(r);
      allstarts.push(r);
    });
  }

  const fnm0 = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm0, JSON.stringify(allstarts));

}

function generateVisualizerTreeUpwards(tnode: RuleElementTraverser, parents: RuleElementTraverser[]) {
  var p$, n$;
  if (!(n$=tnode["$$$"])) {
    tnode["$$$"] = n$ = { name: tnode.node.toString(), children: [], n: 1 };
  }
  if (!tnode.parent) {
    return;
  }
  if (!(p$=tnode.parent["$$$"])) {
    tnode.parent["$$$"] = p$ = { name: tnode.parent.node.toString(), children: [], n: 1 };
    parents.push(tnode.parent);
  }
  p$.children.push(n$);
  p$.n += n$.n;
}


function tothingyjson(obj: any, ind = "") {
  if (obj["$jsproc"]) return undefined;
  if (ind.length > 50) return undefined;

  obj["$jsproc"] = 1;

  var chbuf = [];
  obj.children.forEach(itm => {
    var ij = tothingyjson(itm, ind + "  ");
    if (ij) chbuf.push(ij);
  });

  var buffer = [];
  buffer.push(ind + '{ "name":"' + obj.name + '", "n":' + (obj.n ? obj.n : 0) + ', "children":[');
  buffer.push(chbuf.join(",\n"));
  buffer.push(ind + "]  }");

  obj["$jsproc"] = 0;

  return buffer.join("\n");
}

module.exports = generateTT;
