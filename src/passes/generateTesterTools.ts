import * as fs from "fs";
import { Analysis, ParseTableGenerator } from "../../lib";
import { PGrammar, PRule, PNode } from '../../lib/parsers';


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

  options.allowedStartRules.forEach(r => {
    ri = ruleMap[r];
    var rule = grammar.children[ri] as PRule;

    console.log("Generate visualizer tree for " + rule.rule);

    var g = ParseTableGenerator.createForRule(rule);

    var i = 0;
    do {
      var parents = [];
      g.allLeafStateNodes.forEach(itm => {
        var node = itm.traverser.node;
        generateVisualizerTreeUpwards(node, parents);
      });
      console.log(i++ + "." + parents.length);
    } while (parents.length);

    var main = Object.values(g.entryPoints)[0];
    var main2 = g.startingStateNode.traverser;
    if (main !== main2) throw new Error();

    var vtree = main["$$$"];
    if (!vtree) throw new Error();
    var j = tothingyjson(vtree);

    const fnm = "../www/pnodes-graph-" + rule.rule + ".json";
    fs.writeFileSync(fnm, j);
  });

  const fnm0 = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm0, JSON.stringify(options.allowedStartRules));

}

function generateVisualizerTreeUpwards(node: PNode, parents: PNode[]) {
  if (!node.parent) {
    return;
  }
  if (!node.parent["$$$"]) {
    node.parent["$$$"] = { name: node.parent.toString(), children: [], n: 1 };
    parents.push(node.parent);
  }
  var $node = { name: node.toString(), children: [], n: 1 };
  node.parent["$$$"].children.push($node);
  node.parent["$$$"].n += $node.n;
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
