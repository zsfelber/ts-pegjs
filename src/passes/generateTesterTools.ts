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

      var main = Object.values(g.entryPoints)[0];
      var main2 = g.startingStateNode.traverser;
      if (main !== main2) throw new Error();

      var expectedStateId = 2;
      var leaves = g.allLeafStateNodes.map(itm => {
        if (itm.index !== expectedStateId) {
          throw new Error("Expected stateId:"+expectedStateId+" missed for leaf :"+itm);
        }
        var tnode = itm.traverser;
        tnode["$leaf$"] = 1;
        expectedStateId++;
        return tnode;
      });

      // Checked ordered, it is ok:
      //console.log("Leaf states : " + leaves.map(itm=>itm.shortLabel));

      var items = leaves;
      var i = 0;
      do {
        var parents = [];
        items.forEach(tnode => {
          shortenTreeUpwards(tnode, parents);
        });
        //console.log(i++ + "." + parents.length);
        items = parents;
        i++;
      } while (items.length);

      var vtree = main["$$$"];
      if (!vtree) throw new Error("Could not generate visual tree up to : " + main);
      resetVisualTreeOrderToOriginal(vtree);

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


function shortenTreeUpwards(tnode: RuleElementTraverser, parents: RuleElementTraverser[]) {
  var p$, n$;
  if (!(n$ = tnode["$$$"])) {
    tnode["$$$"] = n$ = { name: tnode.shortLabel, n: 1, kind: tnode.node.kind, node:tnode };
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
      case PNodeKind.ONE_OR_MORE:
      case PNodeKind.ZERO_OR_MORE:
      case PNodeKind.OPTIONAL:
        plab = plab + p.parent.shortLabel;
        if (!pkind) pkind = p.node.kind;
        p = p.parent;
        break;
      case PNodeKind.RULE_REF:
        plab = p.parent.shortLabel;
        if (!pkind) pkind = p.node.kind;
        p = p.parent;
        break;
      case PNodeKind.RULE:
        if (!plab) {
          plab = p.parent.shortLabel;
          if (!pkind) pkind = p.node.kind;
          p = p.parent;
        } else {
          break shortenTree;
        }
        break;
      default:
        break shortenTree;
    }
  }
  if (!(p$ = p["$$$"])) {
    if (!pkind) pkind = p.node.kind;
    p["$$$"] = p$ = { name: plab, kind: pkind, children: [], n: 1, node:p };
    parents.push(p);
  }
  if (p["$leaf$"]) {
    throw new Error("Bad leaf with children : " + p);
  }
  p$.children.push(n$);
}

function resetVisualTreeOrderToOriginal($node) {
  if ($node && $node.children) {
    $node.children.sort(($a,$b)=>{
      resetVisualTreeOrderToOriginal($a);
      resetVisualTreeOrderToOriginal($b);
      var i = $node.node.children.indexOf($a.node);
      var j = $node.node.children.indexOf($b.node);
      return i-j;
    });
  } 
  return $node;
}


function countVisualizerTree($node: any) {
  if ($node.children) $node.children.forEach($child => {
    $node.n += countVisualizerTree($child);
  });
  return $node.n;
}


function tothingyjson(obj: any, ind = "") {
  if (obj["$jsproc"]) return undefined;
  if (ind.length > 150) throw new Error("Too recursive... (75 deep)");

  obj["$jsproc"] = 1;

  var row = [ind,
     '{ "name":"'+(obj.name ? obj.name : "")+'"', 
     '"kind":"'+obj.kind+'"', 
     '"n":'+(obj.n ? obj.n : 0)
  ];
  if (obj.numleaves) row.push('"numleaves":' + obj.numleaves);
  if (obj.numlevels) row.push('"numlevels":' + obj.numlevels);


  var buffer = [];
  if (obj.children) {
  
    row.push('"children":[');

    var chbuf = [];
    if (obj.children) obj.children.forEach(itm => {
      var ij = tothingyjson(itm, ind + "  ");
      if (ij) chbuf.push(ij);
    });

    buffer.push(row.join(", "));
    buffer.push(chbuf.join(",\n"));
    buffer.push(ind + "]  }");
  } else {
    buffer.push(row.join(", ")+' }');
  }


  obj["$jsproc"] = 0;

  return buffer.join("\n");
}

module.exports = generateTT;
