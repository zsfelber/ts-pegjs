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

  const doit = (r: string) => {
      ri = ruleMap[r];
      var rule = grammar.children[ri] as PRule;

      console.log("Generate visualizer tree for " + rule.rule);

      var g = ParseTableGenerator.createForRule(rule);

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
  };

  var allstarts = ast.allstarts;

  allstarts.forEach(r => {
    doit(r);
  });

  const fnm0 = "../www/pnodes-graph.json";
  fs.writeFileSync(fnm0, JSON.stringify(allstarts));
}


function generateVisualizerTreeUpwards(tnode: RuleElementTraverser, parents: RuleElementTraverser[]) {
  var p$, n$;
  if (!(n$ = tnode["$$$"])) {
    tnode["$$$"] = n$ = { name: tnode.shortLabel, children: [], n: 1, kind: tnode.node.kind };
  }
  if (!tnode.parent) {
    return;
  }
  var p = tnode.parent, plab = "", pkind, inshortenedrule = 0;
  if (p) {
    plab = p.shortLabel;
    pkind = p.node.kind;
  }
  fin: while (p.parent) {
    switch (p.parent.node.kind) {
      case PNodeKind.ONE_OR_MORE:
        if (inshortenedrule) throw new Error();
        plab = p.parent.shortLabel.substring(0, p.parent.shortLabel.length - 1) +
          plab + "+";
        pkind = p.parent.node.kind;
        p = p.parent;
        break;
      case PNodeKind.ZERO_OR_MORE:
        if (inshortenedrule) throw new Error();
        plab = p.parent.shortLabel.substring(0, p.parent.shortLabel.length - 1) +
          plab + "*";
        pkind = p.parent.node.kind;
        p = p.parent;
        break;
      case PNodeKind.OPTIONAL:
        if (inshortenedrule) throw new Error();
        plab = p.parent.shortLabel.substring(0, p.parent.shortLabel.length - 1) +
          plab + "?";
        pkind = p.parent.node.kind;
        p = p.parent;
        break;
      case PNodeKind.RULE_REF:
        plab = p.parent.shortLabel;
        p = p.parent;
        if (inshortenedrule) break fin;
        break;
      case PNodeKind.RULE:
        if (inshortenedrule) throw new Error();
        if (!plab) {
          plab = p.parent.shortLabel;
          p = p.parent;
          inshortenedrule = 1;
        } else {
          break fin;
        }
        break;
      default:
        if (inshortenedrule) throw new Error();
        break fin;
    }
  }
  if (!(p$ = p["$$$"])) {
    if (!pkind) pkind = p.node.kind;
    p["$$$"] = p$ = { name: plab, kind: pkind, children: [], n: 1 };
    parents.push(p);
  }
  if (p["$leaf$"]) {
    throw new Error("Bad leaf with children : " + p);
  }
  p$.children.push(n$);
}

function countVisualizerTree($node: any) {
  $node.children.forEach($child => {
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
  buffer.push(ind + '{ "name":"' + (obj.name ? obj.name : "") + '", "kind":"' + obj.kind + '", "n":' + (obj.n ? obj.n : 0) + (obj.numleaves ? ', "numleaves":' + obj.numleaves : "") + (obj.numlevels ? ', "numlevels":' + obj.numlevels : "") + ', "children":[');
  buffer.push(chbuf.join(",\n"));
  buffer.push(ind + "]  }");

  obj["$jsproc"] = 0;

  return buffer.join("\n");
}

module.exports = generateTT;
