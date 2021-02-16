import * as fs from "fs";
import * as glob from "glob";
import { Analysis, ParseTableGenerator } from "../lib";
import { PGrammar, PRule, PNode, PRuleRef, PNodeKind } from '../lib/parsers';
import {  StrMapLike } from '../lib/analyzer';
import { RuleElementTraverser } from '../lib/analyzer-nodes';
import { HyperG } from '../lib';


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

  HyperG.ruleTable = grammar.rules;
  Analysis.deferredRules = options.deferredRules ? options.deferredRules : [];

  var allstarts = ast.allstarts;

  console.log("Generate visualizer trees...");

  var asrgx = new RegExp("../www/ast/pnodes-graph-(.*)\\.json");
  glob.sync("../www/ast/pnodes-graph-*.json").forEach(f => {
    var x = asrgx.exec(f);
    if (allstarts.indexOf(x[1])===-1) {
      console.log("Remove old :"+x[1]+" "+f);
      fs.unlinkSync(f);
    }
  });

  const doit = (r: string) => {
    ri = ruleMap[r];
    var rule = grammar.children[ri] as PRule;

    console.log("Generate visualizer tree for " + rule.rule);

    var g = ParseTableGenerator.createForRule(rule);

    var main = Object.values(g.entryPoints)[0];
    var main2 = g.startingStateNode.traverser;
    if (main !== main2) throw new Error();

    var expectedStateId = 2;
    var rleaves = [];
    var leaves = [];
    g.allLeafStateNodes.forEach(itm => {
      if (itm.index !== expectedStateId) {
        throw new Error("Expected stateId:" + expectedStateId + " missed for leaf :" + itm);
      }
      var tnode = itm.traverser;
      if (tnode.node.kind === PNodeKind.CHOICE) {
        tnode.children.forEach(child=>{
          child["$leaf$"] = 1;
          leaves.push(child);
        });        
        rleaves.push(tnode);
      } else {
        tnode["$leaf$"] = 1;
        leaves.push(tnode);
        rleaves.push(tnode);
      }
      expectedStateId++;
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
    finishVisualTreeInOriginalOrder(main);

    countVisualizerTree(vtree);
    vtree.numleaves = leaves.length;
    vtree.numlevels = i;
    vtree.leaf1id = "0"+rleaves[0]["stateNode"].index;
    var j = tothingyjson(vtree);

    const fnm = "../www/ast/pnodes-graph-" + rule.rule + ".json";
    fs.writeFileSync(fnm, j);
    return true;
  };

  allstarts.forEach(r => {
    doit(r);
  });

  const fnm0 = "../www/ast/pnodes-graph.json";
  fs.writeFileSync(fnm0, JSON.stringify(allstarts));
}


function shortenTreeUpwards(tnode: RuleElementTraverser, parents: RuleElementTraverser[]) {
  var p$, n$;
  if (!(n$ = tnode["$$$"])) {
    tnode["$$$"] = n$ = { name: tnode.shortLabel, n: 1, kind: tnode.node.kind, id: tnodeId(tnode) };
  }
  if (!tnode.parent) {
    return;
  }
  var p = tnode.parent, plab = "", pkind;
  if (p) {
    plab = p.shortLabel;
  }
  var p0 = p.node.kind===PNodeKind.RULE ? null : p;
  shortenTree: while (p.parent) {
    switch (p.parent.node.kind) {
      case PNodeKind.ONE_OR_MORE:
      case PNodeKind.ZERO_OR_MORE:
      case PNodeKind.OPTIONAL:
        plab = plab + p.parent.shortLabel;
        if (!pkind) pkind = p.node.kind;
        p = p.parent;
        if (!p0) p0 = p;
        p["$$$collapsed"] = 1;
        break;
      case PNodeKind.RULE_REF:
        plab = p.parent.shortLabel;
        if (!pkind) pkind = p.node.kind;
        p = p.parent;
        if (!p0) p0 = p;
        p["$$$collapsed"] = 1;
        break;
      case PNodeKind.RULE:
        if (!plab) {
          plab = p.parent.shortLabel;
          if (!pkind) pkind = p.node.kind;
          p = p.parent;
          p["$$$collapsed"] = 1;
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
    if (!p0) {
      if (p.node.kind===PNodeKind.RULE) {
        if (p.parent) p0 = p.parent;
        else p0 = p;
      } else {
        p0 = p;
      }
    }
    p["$$$"] = p$ = { name: plab, kind: pkind, n: 1, id: tnodeId(p0) };
    parents.push(p);
  }
  if (p["$leaf$"]) {
    throw new Error("Bad leaf with children : " + p);
  }
}

function tnodeId(tnode: RuleElementTraverser) {
  if (tnode["stateNode"]) {
    return "0"+tnode["stateNode"].index;
  } else {
    return tnode.node.nodeIdx;
  }
}

function finishVisualTreeInOriginalOrder(node: RuleElementTraverser, $node?) {
  if (!$node) $node = node["$$$"];
  if (node["$$$collapsed"]) {
    if (!node.children || node.children.length !== 1) throw new Error("Bad tree node here:" + node);
    finishVisualTreeInOriginalOrder(node.children[0], $node);
  } else if (node.children.length) {
    $node.children = [];
    node.children.forEach((child) => {
      switch (child.node.kind) {
        case PNodeKind.SEMANTIC_AND:
        case PNodeKind.SEMANTIC_NOT:
        case PNodeKind.PREDICATE_AND:
        case PNodeKind.PREDICATE_NOT:
        case PNodeKind.EMPTY:
          // omit
          break;
        default:
          var $child = finishVisualTreeInOriginalOrder(child);
          $node.children.push($child);
          break;
      }
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

  var row = [
    '{ "name":"' + (obj.name ? obj.name : "") + '"',
    '"kind":"' + obj.kind + '"',
    '"n":' + (obj.n ? obj.n : 0),
    '"id":"'+obj.id+'"'
  ];
  if (obj.numleaves) row.push('"numleaves":' + obj.numleaves);
  if (obj.numlevels) row.push('"numlevels":' + obj.numlevels);
  if (obj.leaf1id) row.push('"leaf1id":"' + obj.leaf1id+'"');
  


  var buffer = [];
  if (obj.children) {

    row.push('"children":[');

    var chbuf = [];
    if (obj.children) obj.children.forEach(itm => {
      var ij = tothingyjson(itm, ind + "  ");
      if (ij) chbuf.push(ij);
    });

    buffer.push(ind + row.join(", "));
    buffer.push(chbuf.join(",\n"));
    buffer.push(ind + "]  }");
  } else {
    buffer.push(ind + row.join(", ") + ' }');
  }


  obj["$jsproc"] = 0;

  return buffer.join("\n");
}

module.exports = generateTT;
