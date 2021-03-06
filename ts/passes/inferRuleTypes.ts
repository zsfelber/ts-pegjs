import * as ts from "typescript";
import * as fs from "fs";
import {
  PNodeKind, PActionKind, PNode, PGrammar, PRef, PFunction, PCallArg, PRule,
  PRuleRef, PTerminalRef, PActContainer
} from "../lib";

// Generates parser JavaScript code.
function generate(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];

  // console.log("infer : "+JSON.stringify(ast.simplified, null, "  "));
  // console.log("ast : "+JSON.stringify(ast, null, "  "));
  //console.log("infer : "+JSON.stringify(simplified, null, "  "));
  //console.log("inferred types:"+JSON.stringify(inferredTypes, null, "   "));

  const baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";

  var inferredTypes = {};
  var generatedFuncs: Map<string,number> = new Map;
  var referenceNodes: Map<string,number[]> = new Map;

  ast.inferredTypes = inferredTypes;
  ast.fields = [];

  function ot(node: PActContainer) {
    var outputType: string;
    if (options && options.returnTypes) {
      switch (node.kind) {
        case PNodeKind.RULE:
          outputType = options.returnTypes[node.symbol];
          break;
        case PNodeKind.TERMINAL:
          outputType = options.returnTypes["Ł" + node.symbol];
          break;
      }
    }
    outputType = outputType ? ": " + outputType : "";
    return outputType;
  }

  function generateTmpClasses(): string[] {
    var grammar: PGrammar = ast.grammar;
    var result = [];
    var subTmpFuncs = [];

    function genTmpFunc(node: PNode, tmpfuncname: string, outputType: string, extraComments="") {
      var sresult = [];
      generatedFuncs.set(tmpfuncname, node.nodeIdx);
      sresult.push("  " + tmpfuncname + "()" + outputType + " { // generated action for " + node.toString()+extraComments);
      var j = 0;
      if (node.kind === PNodeKind.SEQUENCE) {
        sresult.push("    var result = [");
      }
      var condret = 0;
      node.children.forEach(child => {
        var tmpChildFuncName: string;
        switch (child.kind) {
          case PNodeKind.RULE_REF:
            tmpChildFuncName = "$_" + (child as PRuleRef).rule;
            break;
          case PNodeKind.TERMINAL_REF:
            tmpChildFuncName = "$_$" + (child as PTerminalRef).terminal;
            break;
          default:
            tmpChildFuncName = genTmpFunc(child, "$_" + child.nodeIdx, "");
            break;
        }
        switch (node.kind) {
          case PNodeKind.CHOICE:
            condret = 1;
            sresult.push("    if (theVeryNothing['randomVar']===" + (j++) + ") {");
            sresult.push("      return this." + tmpChildFuncName + "();");
            sresult.push("    }");
            break;
          case PNodeKind.SEQUENCE:
            sresult.push("      this." + tmpChildFuncName + "(),");
            break;
          case PNodeKind.ONE_OR_MORE:
          case PNodeKind.ZERO_OR_MORE:
            sresult.push("    return [ this." + tmpChildFuncName + "() ];");
            break;
          default:
            sresult.push("    return this." + tmpChildFuncName + "();");
            break;
        }
      });
      if (node.kind === PNodeKind.SEQUENCE) {
        sresult.push("    ];");
        sresult.push("    return result;");
      } else if (condret) {
        sresult.push("    return undefined;");
      }
      sresult.push("  }");
      sresult.push("");
      subTmpFuncs = subTmpFuncs.concat(sresult);
      return tmpfuncname;
    }

    function genMainFuncs() {
      var sresult = [];
      grammar.actions.forEach(action => {

        var outputType;
        var name = action.ownerRule.symbol + "_" + action.nodeIdx;
        switch (action.ownerRule.kind) {
          case PNodeKind.RULE:
            outputType = action.kind === PActionKind.RULE ? ot(action.ownerRule)
              : ": boolean";
            break;
          default:
            outputType = action.kind === PActionKind.RULE ? "" : ": boolean";
            break;
        }

        generatedFuncs.set("$_"+name, action.nodeIdx);
        sresult.push("  $_" + name + "()" + outputType + " {  // " + action.target.kind + "/" + action.kind+" action#"+action.index);
        action.args.forEach(a => {
          var argFuncName, inf;
          if (a.evaluate.kind === PNodeKind.RULE_REF) {
            var rr = a.evaluate as PRuleRef;
            argFuncName = "$_" + rr.rule;
            var frefs = referenceNodes.get(argFuncName);
            if (!frefs) referenceNodes.set(argFuncName, frefs = []);
            frefs.push(rr.nodeIdx);
            inf = "rule ref#"+rr.nodeIdx;
          } else if (a.evaluate.kind === PNodeKind.TERMINAL_REF) {
            var tr = a.evaluate as PTerminalRef;
            argFuncName = "$_$" + tr.terminal;
            var frefs = referenceNodes.get(argFuncName);
            if (!frefs) referenceNodes.set(argFuncName, frefs = []);
            frefs.push(tr.nodeIdx);
            inf = "term ref#"+tr.nodeIdx;
          } else {
            argFuncName = genTmpFunc(a.evaluate, "$_" + a.evaluate.nodeIdx, "");
            inf = "tmp";
          }
          sresult.push("    let " + a.label + " = this." + argFuncName + "(); // " + inf);
        });
        sresult = sresult.concat(action.code.map(line => "    " + line));
        sresult.push("  }");
      });

      var j = 0;

      grammar.children.forEach(rule => {

        var outputType = ot(rule);
        var name, ass;
        if (rule.kind === PNodeKind.TERMINAL) {
          name = "$" + rule.symbol;
          ass = outputType.replace(":", " as ");
        } else {
          name = rule.symbol;
          ass = "";
        }

        if (rule.ruleActions.length) {
          var condret = 0;
          generatedFuncs.set("$_"+name, rule.nodeIdx);
          sresult.push("  $_" + name + "()" + outputType + " {  // (" + rule.kind + ") " + rule.symbol+(rule.index!==undefined?" rule#"+rule.index:""));
          if (rule.ruleActions.length === 1) {
            var action = rule.ruleActions[0];
            var aname;
            if (rule.kind === PNodeKind.TERMINAL) {
              aname = "$" + action.ownerRule.symbol + "_" + action.nodeIdx;
            } else {
              aname = action.ownerRule.symbol + "_" + action.nodeIdx;
            }

            sresult.push("    return this.$_" + aname + "()" + ass + ";");
          } else {
            rule.ruleActions.forEach(action => {
              var aname;
              if (rule.kind === PNodeKind.TERMINAL) {
                aname = "$" + action.ownerRule.symbol + "_" + action.nodeIdx;
              } else {
                aname = action.ownerRule.symbol + "_" + action.nodeIdx;
              }

              condret = 1;
              sresult.push("    if (theVeryNothing['butSomething']===" + (j++) + ") {");
              sresult.push("      return this.$_" + aname + "()" + ass + ";");
              sresult.push("    }");
            });
          }
          if (condret) {
            sresult.push("    return undefined;");
          }
          sresult.push("  }");
          sresult.push("");
        } else if (rule.kind === PNodeKind.TERMINAL) {
          generatedFuncs.set("$_"+name, rule.nodeIdx);
          sresult.push("  $_" + name + "()" + outputType + " {  // generated terminal action " + rule.symbol);
          sresult.push("    return this.token()" + ass + ";");
          sresult.push("  }");
        } else {
          genTmpFunc(rule, "$_" + name, outputType, (rule.index!==undefined?" rule#"+rule.index:""));
        }
      });
      return sresult;
    }

    var mainFuncs = genMainFuncs();

    result = result.concat(subTmpFuncs);
    result = result.concat(mainFuncs);

    return result;
  }


  var genclss = [];
  genclss.push("import { IFilePosition, IFileRange, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, HyperGParseStream, IToken } from 'ts-pegjs/lib';");

  if (options.tspegjs.customHeader) {
    genclss.push(options.tspegjs.customHeader.length ? options.tspegjs.customHeader.join("\n") : options.tspegjs.customHeader + "");
  }
  if (options.tspegjs.inferCustomHeader) {
    genclss.push(options.tspegjs.inferCustomHeader.length ? options.tspegjs.inferCustomHeader.join("\n") : options.tspegjs.inferCustomHeader + '');
  }

  genclss.push("const theVeryNothing = new Object();");
  genclss.push("");
  genclss.push("class UselessClassJustToResolveTypes<T extends " + baseTokenType + "> {");
  genclss.push([
    "",
    '  input: HyperGParseStream<T>;',
    "",
    "  peg$maxFailPos = 0;",
    "  peg$maxFailExpected: Expectation[] = [];",
    "  peg$silentFails = 0;", // 0 = report failures, > 0 = silence failures
    "",
    "  token(): " + baseTokenType + " { return null; } ",
    "",
    ""].join("\n"));
  genclss.push("");
  if (options.tspegjs.customFields) {
    genclss.push(
      options.tspegjs.customFields
        .join("\n"));
    genclss.push("");
  }

  var tmpc = [];
  tmpc = generateTmpClasses();
  genclss = genclss.concat(tmpc);

  genclss.push("");
  genclss.push("}");

  const fnm = options.tmppref + "$$infer$tmp.ts";
  fs.writeFileSync(fnm, genclss.join("\n"));

  var program = ts.createProgram([fnm], {});
  var tsrc = program.getSourceFile(fnm);

  const checker = program.getTypeChecker();

  function generateFullName(tp: ts.Type, parenthisize = false) {
    var inferredTp: string;

    if (tp.isUnionOrIntersection() && tp.types && tp.types.length > 1) {
      var chs = [];
      tp.types.forEach(cht => {
        var ch = generateFullName(cht, true);
        chs.push(ch);
      });
      if (tp.isUnion()) {
        inferredTp = chs.join("|");
      } else {
        inferredTp = chs.join("&");
      }
      if (inferredTp === "true|false" || inferredTp === "false|true") {
        inferredTp = "boolean";
      } else if (parenthisize && tp.types.length >= 2) {
        inferredTp = "(" + inferredTp + ")";
      }
    } else {
      inferredTp = checker.typeToString(tp);
      if (/\[\]$/.exec(inferredTp)) {
        const typeArgs = checker.getTypeArguments(tp as ts.TypeReference);
        const elementType = typeArgs[0];
        var e = generateFullName(elementType, true);
        inferredTp = e + "[]";
      }
    }

    return inferredTp;
  }

  tsrc.statements.forEach(cl => {
    if (ts.isClassDeclaration(cl)) {
      cl.members.forEach(method => {
        if (ts.isMethodDeclaration(method)) {
          var mn = method.name.getText(tsrc);
          var nodeId = generatedFuncs.get(mn);
          if (nodeId === undefined) {
            console.warn("No generated method for : "+mn);
          } else {
            //var tp = checker.getTypeAtLocation(fun);

            var tp = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method));
            var gname = generateFullName(tp);
            inferredTypes[nodeId] = gname;

            var refs = referenceNodes.get(mn);
            if (refs) refs.forEach(refNodeId=>{
              inferredTypes[refNodeId] = gname;
            });
          }
        }
      });
    }
  });

  // console.log(inferredTypes);

  // TODO

  //Object.values(simplifiedRules).forEach((simpleRule: any) => {
  //  generateNodeClasses(simpleRule, simpleRule, null, "    ");
  //});

  //console.log("ast : "+JSON.stringify(ast, null, "  "));

}

module.exports = generate;
