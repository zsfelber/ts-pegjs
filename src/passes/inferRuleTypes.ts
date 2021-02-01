import * as ts from "typescript";
import * as fs from "fs";
import { PNodeKind, PActionKind, PNode, PFunction, PCallArg } from "../../lib";

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

  ast.inferredTypes = inferredTypes;
  ast.fields = [];

  function ot(node: PNode) {
    var outputType = (node.kind === PNodeKind.RULE && options && options.returnTypes) ?
      options.returnTypes[node.name] : "";
    outputType = outputType ? ": " + outputType : "";
    return outputType;
  }

  function generateTmpClasses(): string[] {
    var grammar: PNode = ast.grammar;
    var result = [];
    var i = 0;
    var subTmpFuncs = [];

    function genTmpFunc(node: PNode, tmpfuncname: string, outputType: string) {
      var sresult = [];
      sresult.push("  " + tmpfuncname + "()" + outputType + " { // Tmp "+node.kind+" "+(node.name?node.name:""));
      var j = 0;
      if (node.kind === PNodeKind.SEQUENCE) {
        sresult.push("    var result = [");
      }
      node.children.forEach(child => {
        var tmpChildFuncName: string;
        switch (child.kind) {
          case PNodeKind.RULE_REF:
          case PNodeKind.TERMINAL_REF:
            tmpChildFuncName = "$_" + child.name;
            break;
          default:
            tmpChildFuncName = genTmpFunc(child, "$_" + (i++), "");
            break;
        }
        switch (node.kind) {
          case PNodeKind.CHOICE:
            sresult.push("    if (theVeryNothing['randomVar']===" + (j++) + ") {");
            sresult.push("      return " + tmpChildFuncName + "();");
            sresult.push("    }");
            break;
          case PNodeKind.SEQUENCE:
            sresult.push("      " + tmpChildFuncName + "(),");
            break;
          case PNodeKind.ONE_OR_MORE:
          case PNodeKind.ZERO_OR_MORE:
            sresult.push("    return [ " + tmpChildFuncName + "() ];");
            break;
          default:
            sresult.push("    return " + tmpChildFuncName + "();");
            break;
        }
      });
      if (node.kind === PNodeKind.SEQUENCE) {
        sresult.push("    ];");
      }
      sresult.push("  }");
      sresult.push("");
      subTmpFuncs = subTmpFuncs.concat(sresult);
      return tmpfuncname;
    }

    grammar.actions.forEach(action => {
      var outputType = 
        action.kind===PActionKind.RULE ? ot(action.ownerRule)
          : ": boolean";
      result.push("  $_" + action.name + "()" + outputType + " {  // " + action.target.kind+"/"+action.kind);
      action.args.forEach(a => {
        var argFuncName;
        if (a.evaluate.name) {
          argFuncName = "$_" + a.evaluate.name;
        } else {
          argFuncName = genTmpFunc(a.evaluate, "$_" + (i++), "");
        }
        result.push("    let " + a.label + " = " + argFuncName + "();");
      });
      result = result.concat(action.code.map(line => "    " + line));
      result.push("  }");
    });

    var j = 0;

    grammar.children.forEach(rule => {

      var outputType = ot(rule);
      result.push("  $_" + rule.name + "()" + outputType + " {  // Rule " + rule.name);
      rule.children.forEach(child => {

        if (child.action && child.action.kind === PActionKind.RULE) {

          switch (rule.kind) {
            case PNodeKind.CHOICE:
              result.push("    if (theVeryNothing['randomVar']===" + (j++) + ") {");
              result.push("      return $_" + child.action.name + "();");
              result.push("    }");
              break;
            default:
              result.push("    return $_" + child.action.name + "();");
              break;
          }
        }
      });

      result.push("  }");
      result.push("");
    });

    grammar.children.forEach(rule => {
      if (!rule.actions.length) {
        var outputType = ot(rule);
        genTmpFunc(rule, "$_" + rule.name, outputType);
      }
    });
    result = result.concat(subTmpFuncs);
    return result;
  }


  var genclss = [];
  genclss.push("import { IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IPegjsParseStream, PegjsParseStream, IPegjsBuffer, IToken } from 'ts-pegjs/lib';");

  if (options.tspegjs.customHeader) {
    genclss.push(options.tspegjs.customHeader.length ? options.tspegjs.customHeader.join("\n") : options.tspegjs.customHeader + "");
  }
  if (options.tspegjs.inferCustomHeader) {
    genclss.push(options.tspegjs.inferCustomHeader.length ? options.tspegjs.inferCustomHeader.join("\n") : options.tspegjs.inferCustomHeader + '');
  }

  genclss.push("const theVeryNothing = new Object();");
  genclss.push("");
  genclss.push("class UselessClassJustToResolveTypes<T extends " + baseTokenType + "> {");
  genclss.push(["",
    '  input: IPegjsParseStream<T>;',
    '  inputBuf: IPegjsBuffer<T>;',
    "",
    "  peg$maxFailPos = 0;",
    "  peg$maxFailExpected: Expectation[] = [];",
    "  peg$silentFails = 0;", // 0 = report failures, > 0 = silence failures
    "",
    "  token(): T { return null; } ",
    "",
    ""].join("\n"));
  genclss.push("");
  if (options.tspegjs.customFields) {
    genclss.push(
      options.tspegjs.customFields
        .join("\n"));
    genclss.push("");
  }

  genclss = genclss.concat(generateTmpClasses());

  genclss.push("");
  genclss.push("}");

  genclss = genclss.filter((elem: string) => {
    if (!elem) {
      return false;
    }
    elem = elem.replace(/^(\s|\n)+/g, "");
    elem = elem.replace(/(\s|\n)+$/g, "");
    return elem;
  });

  const fnm = options.tmppref + "$$infer$tmp.ts";
  fs.writeFileSync(fnm, genclss.join("\n"));

  var program = ts.createProgram([fnm], {});
  var tsrc = program.getSourceFile(fnm);

  const checker = program.getTypeChecker();
  tsrc.statements.forEach(cl => {
    if (ts.isClassDeclaration(cl)) {
      cl.members.forEach(method => {
        if (ts.isMethodDeclaration(method)) {
          var fname = method.name.getText(tsrc).substring(2);
          //var tp = checker.getTypeAtLocation(fun);
          var outputType = (options && options.returnTypes) ? options.returnTypes[fname] : "";
          if (!outputType) {
            var tp = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method));
            outputType = checker.typeToString(tp);

            if (tp.isUnionOrIntersection()) {
              if (tp.types && tp.types.length > 1) {
                if (outputType.indexOf(" | ") !== -1 || outputType.indexOf(" & ") !== -1) {
                  outputType = "(" + outputType + ")";
                }
              }
            }

          }

          inferredTypes[fname] = outputType;
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
