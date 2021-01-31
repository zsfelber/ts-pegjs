import * as ts from "typescript";
import * as fs from "fs";
import { checkServerIdentity } from "tls";
import { type } from "os";
var visitor = require("pegjs/lib/compiler/visitor");

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

  var simplifiedRules = {};
  var inferredTypes = {};

  ast.inferredTypes = inferredTypes;
  ast.fields = [];

  ast.rules.forEach(function (rule0) {
    var currentRule = rule0.name;
    simplifiedRules[currentRule] = simplifyStructure(rule0, rule0.expression, false);
    simplifiedRules[currentRule].rule = currentRule;
  });


  function simplifyStructure(parent, node, lab?) {
    if (node.name) {

      return node.name;

    } else {

      var r: any = { type: node.type };
      var opt;
      switch (node.type) {
        case "action":
          r = { type: node.type, node, code: node.code, element: simplifyStructure(node, node.expression) };
          r.elements = [r.element];
          break;
        case "sequence":
          r = { type: node.type, node, elements: node.elements.map(elem => simplifyStructure(node, elem)) };
          break;
        case "choice":
          r = { type: node.type, node, elements: node.alternatives.map(alt => simplifyStructure(node, alt)) };
          break;
        case "optional":
          //opt = true;
          r = { type: node.type, node, element: simplifyStructure(node, node.expression) };
          r.elements = [r.element];
          break;
        case "zero_or_more":
        case "one_or_more":
          r = { type: node.type, node, element: simplifyStructure(node, node.expression) };
          r.elements = [r.element];
          break;
        case "labeled":
          r = { type: node.type, node, label: node.label, element: simplifyStructure(node, node.expression, true) };
          r.elements = [r.element];
          break;
      }

      return r;
    }
    //if (lab) {
    //  if (opt) r = "?: "+r;
    //  else r = ": "+r;
    //}
  }

  var islab = 0;
  var waslab = 0;
  var isaction = 0;
  var wasaction = 0;
  function generateTmpClass(simpleNode, simpleParent, indent, lab?): string[] {
    var r = [];
    var opt;
    if (!simpleParent) {
      islab = 0;
      waslab = 0;
      isaction = 0;
      wasaction = 0;
    }
    switch (simpleNode.type) {
      case "action":
        isaction = 1;
        r = generateTmpClass(simpleNode.element, simpleNode, indent);
        isaction = 0;
        wasaction = 1;
        r = r.concat(simpleNode.code.trim().split(/\n/).map(line => indent + line.trim()));
        break;
      case "sequence":
        simpleNode.elements.forEach(simplEelem => {
          r = r.concat(generateTmpClass(simplEelem, simpleNode, indent));
        });
        break;
      case "choice":
        if (islab) {
          r = [simpleNode.elements.map(simpleElem => generateTmpClass(simpleElem, simpleNode, indent)[0]).join(" || ")];
        } else {
          var i = 0;
          simpleNode.elements.forEach(simpleElem => {
            r.push(indent + "if (theVeryNothing['randomVar']===" + (i++) + ") {");
            r = r.concat(generateTmpClass(simpleElem, simpleNode, indent + "    "));
            r.push(indent + "}");
          });

        }
        break;
      case "optional":
        //opt = true;
        if (islab) r = generateTmpClass(simpleNode.element, simpleNode, indent);
        break;
      case "zero_or_more":
      case "one_or_more":
        if (islab) r = ["[ " + generateTmpClass(simpleNode.element, simpleNode, indent)[0] + " ]"];
        break;
      case "labeled":
        islab = 1;
        r = [indent + "let " + simpleNode.label + " = " + generateTmpClass(simpleNode.element, simpleNode, indent, true)[0] + ";"];
        islab = 0;
        waslab = 0;
        if (!isaction) {
          r.push(indent + "return " + simpleNode.label + ";");
        }
        break;
      case undefined:
        // it's a rule name
        if (islab) r = ["this.$_" + simpleNode + "()"];
        else if (!isaction) r = [indent + "return this.$_" + simpleNode + "()"];
        break;
      default:
        r = [indent + "// ? " + simpleNode.type];
        break;
    }

    return r;
  }

  var fieldCodes = {};
  var functIndex = 0;
  function addField(value) {
    let name = fieldCodes[value];
    if (!name) {
      name = "function" + functIndex;
      fieldCodes[value] = name;
      ast.fields.push(name + value);
      functIndex++;
    }
    return name;
  }

  function generateNodeClasses(simpleRule, simpleNode, simpleParent, indent, lab?): string[] {
    function gf() {
      if (simpleNode.code) {
        var f = [];
        f.push("(" + generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent).filter(e => e ? e.length : false).join(", ") +
          "): " + inferredTypes[simpleRule.rule] + " {");
        f = f.concat(simpleNode.code.trim().split(/\n/).map(line => "  " + line.trim()));
        f.push("}");
        var genName = addField(f.join("\n"));
        return genName;
      }
    }

    var r = [];
    var opt;
    if (simpleParent) {
      if (typeof simpleNode !== "string") {
        simpleNode.parentAction = simpleParent.parentAction;
      }
    } else {
      islab = 0;
      waslab = 0;
      isaction = 0;
      wasaction = 0;
    }
    switch (simpleNode.type) {
      case "action":
        isaction = 1;
        simpleNode.parentAction = simpleNode;
        var f = gf();
        simpleNode.node.templateFunction = "PegjsParser.prototype." + f;
        generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent);
        simpleNode.node.checkids = simpleNode.element.checkids;
        if (!simpleNode.node.checkids) simpleNode.node.checkids = [];
        isaction = 0;
        wasaction = 1;
        break;
      case "sequence":
        if (simpleNode.parentAction) {
          simpleNode.node.templateFunction = simpleNode.parentAction.node.templateFunction;
        }
        simpleNode.node.checkids = simpleNode.checkids = [];
        return simpleNode.elements.map(simpleElem => {
          var r = generateNodeClasses(simpleRule, simpleElem, simpleNode, indent)[0];
          if (simpleElem.checkid) simpleNode.checkids.push(simpleElem.checkid);
          return r;
        });

        break;
      case "choice":
        if (isaction) {
          var uniqtps = {};
          simpleNode.elements.map(simpleElem => generateNodeClasses(simpleRule, simpleElem, simpleNode, indent)[0]).forEach(tp => {
            uniqtps[tp] = tp;
          });
          var tps = Object.keys(uniqtps);
          var tpst = tps.join(" | ");
          if (tps.length > 1) tpst = "(" + tpst + ")";
          r = [tpst];

        } else {
          simpleNode.elements.forEach(simpleElem => {
            generateNodeClasses(simpleRule, simpleElem, simpleNode, indent);
          });
        }
        break;
      case "optional":
        //opt = true;
        if (islab) r = generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent);
        break;
      case "zero_or_more":
      case "one_or_more":
        if (islab) r = [generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent)[0] + "[]"];
        break;
      case "labeled":
        islab = 1;
        r = [simpleNode.label + ": " + generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent, true)[0]];
        simpleNode.checkid = simpleNode.label;
        simpleNode.node.checkids = simpleNode.checkids = [simpleNode.label];
        islab = 0;
        waslab = 0;
        break;
      case undefined:
        // it's a rule name
        if (islab) r = [inferredTypes[simpleNode]];
        break;
      default:
        r = ["/* ? " + simpleNode.type + "*/"];
        break;
    }

    return r;
  }


  var genclss = [];
  genclss.push("import { IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IPegjsParseStream, PegjsParseStream, IPegjsBuffer, IToken } from 'ts-pegjs/lib';");

  if (options.tspegjs.customHeader) {
    genclss.push(options.tspegjs.customHeader.length? options.tspegjs.customHeader.join("\n"):options.tspegjs.customHeader + "");
  }
  if (options.tspegjs.inferCustomHeader) {
    genclss.push(options.tspegjs.inferCustomHeader.length? options.tspegjs.inferCustomHeader.join("\n"):options.tspegjs.inferCustomHeader + '');
  }

  genclss.push("const theVeryNothing = new Object();");
  genclss.push("");
  genclss.push("class UselessClassJustToResolveTypes<T extends "+baseTokenType+"> {");
  genclss.push(["",
  'input: IPegjsParseStream<T>;',
  'inputBuf: IPegjsBuffer<T>;',
  "",
  "peg$maxFailPos = 0;",
  "peg$maxFailExpected: Expectation[] = [];",
  "peg$silentFails = 0;", // 0 = report failures, > 0 = silence failures
  "",
  "token(): T { return null; } ",
  ""].join("\n"));
  genclss.push("");
  if (options.tspegjs.customFields) {
    genclss.push(
      options.tspegjs.customFields
    .join("\n"));
    genclss.push("");
  }

  Object.values(simplifiedRules).forEach((simpleRule: any) => {
    var outputType = (options && options.returnTypes) ? options.returnTypes[simpleRule.rule] : "";
    outputType = outputType ? ": " + outputType : "";
    genclss.push("$_" + simpleRule.rule + "()" + outputType + " {");
    genclss = genclss.concat(generateTmpClass(simpleRule, null, "    "));
    genclss.push("  return undefined;");
    genclss.push("}");
  });

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



  Object.values(simplifiedRules).forEach((simpleRule: any) => {
    generateNodeClasses(simpleRule, simpleRule, null, "    ");
  });

  //console.log("ast : "+JSON.stringify(ast, null, "  "));

}

module.exports = generate;
