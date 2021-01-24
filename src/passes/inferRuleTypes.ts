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

  var simplifiedRules = {};
  var inferredTypes = {};

  ast.inferredTypes = inferredTypes;

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
            r.push(indent + "if (input['randomVar']===" + (i++) + ") {");
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
        r = [indent + "var " + simpleNode.label + " = " + generateTmpClass(simpleNode.element, simpleNode, indent, true)[0] + ";"];
        islab = 0;
        waslab = 0;
        if (!isaction) {
          r.push(indent + "return " + simpleNode.label + ";");
        }
        break;
      case undefined:
        // it's a rule name
        if (islab) r = [simpleNode + "()"];
        else if (!isaction) r = [indent + "return " + simpleNode + "()"];
        break;
      default:
        r = [indent + "// ? " + simpleNode.type];
        break;
    }

    return r;
  }


  function generateNodeClasses(simpleRule, simpleNode, simpleParent, indent, lab?): string[] {
    function gf() {
      if (simpleNode.code) {
        var f = [];
        f.push("function (");
        f.push(generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent).filter(e=>e?e.length:false).join(", "));
        f.push("): ");
        f.push(inferredTypes[simpleRule.rule]);
        f.push(" {");
        f = f.concat(simpleNode.code.trim().split(/\n/).map(line => " "+line.trim()));
        f.push(" }");
        return f.join("");
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
        simpleNode.node.templateFunction = f;
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
          r = [Object.keys(uniqtps).join(" | ")];

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
  genclss.push("import {IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IParseOptions, IPegjsParseStream, PegjsParseStream} from 'ts-pegjs/lib';");

  genclss.push("var input: IPegjsParseStream;");

  if (options.param0) {
    genclss.push("var " + options.param0 + ";");
  }
  if (options.tspegjs.customHeader) {
    genclss.push(options.tspegjs.customHeader + "");
  }

  Object.values(simplifiedRules).forEach((simpleRule: any) => {
    var outputType = (options && options.returnTypes) ? options.returnTypes[simpleRule.rule] : "";
    outputType = outputType?": "+outputType:"";
    genclss.push("function " + simpleRule.rule + "()"+outputType+" {");
    genclss = genclss.concat(generateTmpClass(simpleRule, null, "    "));
    genclss.push("}");
  });

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
  tsrc.statements.forEach(fun => {
    if (ts.isFunctionDeclaration(fun)) {
      //var tp = checker.getTypeAtLocation(fun);
      var outputType = (options && options.returnTypes) ? options.returnTypes[fun.name.text] : "";
      if (!outputType) {
        var tp = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(fun));
        outputType = checker.typeToString(tp);
      }

      inferredTypes[fun.name.text] = outputType;
    }
  });


  Object.values(simplifiedRules).forEach((simpleRule: any) => {
    generateNodeClasses(simpleRule, simpleRule, null, "    ");
  });

  //console.log("ast : "+JSON.stringify(ast, null, "  "));

}

module.exports = generate;
