import * as fs from "fs";
import { Analysis, ParseTableGenerator } from "../../lib";
import { PGrammar, PRule, PNode, PRuleRef, PNodeKind } from '../../lib/parsers';
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

  var deps: StrMapLike<PRuleRef> = {};
  var created: StrMapLike<number> = {};

  const doit = (r: string) => {
    if (!created[r]) {
      created[r] = 1;
      ri = ruleMap[r];
      var rule = grammar.children[ri] as PRule;

      console.log("Generate visualizer tree for " + rule.rule);

      var g = ParseTableGenerator.createForRule(rule);
      var main2 = g.startingStateNode.traverser;
      Object.assign(deps, g.startRuleDependencies);

      var leaves = g.allLeafStateNodes.map(itm => {
        var tnode = itm.traverser;
        tnode["$leaf$"] = 1;
        return tnode;
      });
      var items = leaves;
      var i = 0;
      do {
        var parents = [];
        items.forEach(tnode => {
          generateVisualizerTreeUpwards(tnode, parents);
        });
        //console.log(i++ + "." + parents.length);
        items = parents;
        i++;
      } while (items.length);

      var main = Object.values(g.entryPoints)[0];
      var main2 = g.startingStateNode.traverser;
      if (main !== main2) throw new Error();

      var vtree = main["$$$"];
      if (!vtree) throw new Error("Could not generate visual tree up to : " + main);

      countVisualizerTree(vtree);
      vtree.numleaves = leaves.length;
      vtree.numlevels = i;
      var j = tothingyjson(vtree);

      const fnm = "../www/pnodes-graph-" + rule.rule + ".json";
      fs.writeFileSync(fnm, j);
      return true;
    } else {
      return false;
    }
  };
  var allstarts = [];
  if (options.bigStartRules) {
    console.log("bigStartRules:" + options.bigStartRules.join(", "));
    options.bigStartRules.forEach(r => {
      if (doit(r))
        allstarts.push(r);
    });
  }
  if (options.allowedStartRules) {
    console.log("allowedStartRules:" + options.allowedStartRules.join(", "));
    options.allowedStartRules.forEach(r => {
      delete deps[r];
      if (doit(r))
        allstarts.push(r);
    });
  }
  var depks = Object.keys(deps);
  if (depks.length) {
    console.log("Remaining dependencies:" + depks.join(", "));
    depks.forEach(r => {
      if (doit(r))
        allstarts.push(r);
    });
  }

  allstarts.sort();

  const fnm0 = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm0, JSON.stringify(allstarts));
}


function generateVisualizerTreeUpwards(tnode: RuleElementTraverser, parents: RuleElementTraverser[]) {
  var p$, n$;
  if (!(n$ = tnode["$$$"])) {
    tnode["$$$"] = n$ = { name: tnode.shortLabel(), children: [], n: 1, kind:tnode.node.kind };
  }
  if (!tnode.parent) {
    return;
  }
  var p = tnode.parent;
  if (p.node.kind === PNodeKind.RULE && p.parent) {
    p = p.parent;
  }
  if (!(p$ = p["$$$"])) {
    p["$$$"] = p$ = { name: p.shortLabel(), children: [], n: 1, kind:p.node.kind };
    parents.push(p);
  }
  if (p["$leaf$"]) {
    throw new Error("Bad leaf with children : "+p);
  }
  p$.children.push(n$);
}

function countVisualizerTree($node: any) {
  $node.children.forEach($child=>{
    $node.n += countVisualizerTree($child);
  });
  return $node.n;
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
  buffer.push(ind + '{ "name":"' + (obj.name?obj.name:"") + '", "kind":"' + obj.kind + '", "n":' + (obj.n ? obj.n : 0) + (obj.numleaves ? ', "numleaves":'+obj.numleaves : "") + (obj.numlevels ? ', "numlevels":'+obj.numlevels : "") + ', "children":[');
  buffer.push(chbuf.join(",\n"));
  buffer.push(ind + "]  }");

  obj["$jsproc"] = 0;

  return buffer.join("\n");
}

module.exports = generateTT;
