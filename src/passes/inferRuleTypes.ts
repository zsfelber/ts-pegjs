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

  // console.log("infer : "+JSON.stringify(ast.funcs, null, "  "));
  // console.log("ast : "+JSON.stringify(ast, null, "  "));

  var inferredTypes = {};
  let funcs = {};
  ast.funcs = funcs;
  ast.inferredTypes = inferredTypes;

  ast.rules.forEach(function (rule) {
    var currentRule = rule.name;
    var r = funcs[currentRule];
    if (!r) {
      r = { rule: currentRule, funcs: [] };
      funcs[currentRule] = r;
    }
    var fun = simplifyStructure(rule, rule.expression, false);

    r.funcs.push(fun);
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
  function generateTmpClass(node, parent, indent, lab?): string[] {
    var r = [];
    var opt;
    if (!parent) {
      islab = 0;
      waslab = 0;
      isaction = 0;
      wasaction = 0;
    }
    switch (node.type) {
      case "action":
        isaction = 1;
        r = generateTmpClass(node.element, node, indent);
        isaction = 0;
        wasaction = 1;
        r = r.concat(node.code.trim().split(/\n/).map(line => indent + line.trim()));
        break;
      case "sequence":
        node.elements.forEach(elem => {
          r = r.concat(generateTmpClass(elem, node, indent));
        });
        break;
      case "choice":
        if (islab) {
          r = [node.elements.map(elem => generateTmpClass(elem, node, indent)[0]).join(" || ")];
        } else {
          var i = 0;
          node.elements.forEach(elem => {
            r.push(indent + "if (input['randomVar']===" + (i++) + ") {");
            r = r.concat(generateTmpClass(elem, node, indent + "    "));
            r.push(indent + "}");
          });

        }
        break;
      case "optional":
        //opt = true;
        if (islab) r = generateTmpClass(node.element, node, indent);
        break;
      case "zero_or_more":
      case "one_or_more":
        if (islab) r = ["[ " + generateTmpClass(node.element, node, indent)[0] + " ]"];
        break;
      case "labeled":
        islab = 1;
        r = [indent + "var " + node.label + " = " + generateTmpClass(node.element, node, indent, true)[0] + ";"];
        islab = 0;
        waslab = 0;
        if (!isaction) {
          r.push(indent + "return " + node.label + ";");
        }
        break;
      case undefined:
        // it's a rule name
        if (islab) r = [node + "()"];
        else if (!isaction) r = [indent + "return " + node + "()"];
        break;
      default:
        r = [indent + "// ? " + node.type];
        break;
    }

    return r;
  }


  function generateNodeClasses(funs, node, parent, indent, lab?): string[] {
    function gf() {
      if (node.code) {
        var f = [];
         f.push("function (");
        f.push(generateNodeClasses(funs, node.element, node, indent).join(", ") + "): " + inferredTypes[funs.rule] + "{ ");
        f = f.concat(node.code.trim().split(/\n/).map(line => indent + line.trim()));
        f.push(indent + " }");
        return f.join("");
      }
    }

    var r = [];
    var opt;
    if (parent) {
      if (typeof node !== "string") {
        node.parentAction = parent.parentAction;
      }
    } else {
      islab = 0;
      waslab = 0;
      isaction = 0;
      wasaction = 0;
    }
    switch (node.type) {
      case "action":
        isaction = 1;
        node.parentAction = node;
        var f = gf();
        node.node.templateFunction = f;
        generateNodeClasses(funs, node.element, node, indent);
        isaction = 0;
        wasaction = 1;
        break;
      case "sequence":
        if (node.parentAction) {
          node.node.templateFunction = node.parentAction.node.templateFunction;
        }
        return node.elements.map(elem => {
          return generateNodeClasses(funs, elem, node, indent)[0];
        });

        break;
      case "choice":
        if (isaction) {
          var uniqtps = {};
          node.elements.map(elem => generateNodeClasses(funs, elem, node, indent)[0]).forEach(tp=>{
            uniqtps[tp] = tp;
          });
          r = [Object.keys(uniqtps).join(" | ")];
        } else {
          node.elements.forEach(elem => {
            generateNodeClasses(funs, elem, node, indent);
          });
        }
        break;
      case "optional":
        //opt = true;
        if (islab) r = generateNodeClasses(funs, node.element, node, indent);
        break;
      case "zero_or_more":
      case "one_or_more":
        if (islab) r = [generateNodeClasses(funs, node.element, node, indent)[0] + "[]"];
        break;
      case "labeled":
        islab = 1;
        r = [node.label + ": " + generateNodeClasses(funs, node.element, node, indent, true)[0]];
        islab = 0;
        waslab = 0;
        break;
      case undefined:
        // it's a rule name
        return [inferredTypes[node]];
      default:
        r = ["/* ? " + node.type + "*/"];
        break;
    }

    return r;
  }


  /*
    function generateArgs(node, lab?): string {
      var r = "";
      var opt;
      switch (node.type) {
        case "sequence":
          r = node.elements.map(elem => generateArgs(elem)).filter(str => !!str).join(", ");
          break;
        case "choice":
          r = node.elements.map(elem => generateArgs(elem)).filter(str => !!str).join(" | ");
          break;
        case "optional":
          //opt = true;
          r = generateArgs(node.element);
          break;
        case "zero_or_more":
          r = generateArgs(node.element);
          break;
        case "labeled":
          r = node.label + generateArgs(node.element, true);
          break;
        case undefined:
          // it's a rule name
          r = inferredTypes[node];
      }
  
      if (r && lab) {
        var pf = "";
        if (opt) pf = "?";
        r = pf + ": " + r;
      }
      return r;
    }
  
    function predefType(rule) {
      const outputType = (options && options.returnTypes && options.returnTypes[rule]) ?
        options.returnTypes[rule] : null;
      return outputType;
    }
  */

  //var lstfiles = glob.sync(srcd + "**/_all_here_root.ts", {});

  //console.log("infer : "+JSON.stringify(funcs, null, "  "));

  var genclss = [];
  genclss.push("import {IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IParseOptions, IPegjsParseStream, PegjsParseStream} from 'ts-pegjs/lib';");

  genclss.push("var input: IPegjsParseStream;");

  if (options.param0) {
    genclss.push("var " + options.param0 + ";");
  }
  if (options.tspegjs.customHeader) {
    genclss.push(options.tspegjs.customHeader + "");
  }

  Object.values(funcs).forEach((funs: any) => {
    funs.funcs.forEach((fun: any) => {
      genclss.push("function " + funs.rule + "() {");
      genclss = genclss.concat(generateTmpClass(fun, null, "    "));
      genclss.push("}");
    });
  });

  genclss = genclss.filter((elem: string) => {
    if (!elem) {
      return false;
    }
    elem = elem.replace(/^(\s|\n)+/g, "");
    elem = elem.replace(/(\s|\n)+$/g, "");
    return elem;
  });

  const fnm = options.dir + "/$$infer$tmp.ts";
  fs.writeFileSync(fnm, genclss.join("\n"));

  var program = ts.createProgram([fnm], {});
  var tsrc = program.getSourceFile(fnm);

  const checker = program.getTypeChecker();
  tsrc.statements.forEach(fun => {
    if (ts.isFunctionDeclaration(fun)) {
      //var tp = checker.getTypeAtLocation(fun);

      var tp = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(fun));
      var ttxt = checker.typeToString(tp);

      inferredTypes[fun.name.text] = ttxt;
    }
  });
  //console.log("inferred types:"+JSON.stringify(inferredTypes, null, "   "));


  Object.values(funcs).forEach((funs: any) => {
    funs.funcs.forEach((fun: any) => {
      generateNodeClasses(funs, fun, null, "    ");
    });
  });

}

module.exports = generate;
