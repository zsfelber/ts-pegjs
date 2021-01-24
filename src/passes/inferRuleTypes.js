"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var fs = require("fs");
var visitor = require("pegjs/lib/compiler/visitor");
// Generates parser JavaScript code.
function generate(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
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
    function simplifyStructure(parent, node, lab) {
        if (node.name) {
            return node.name;
        }
        else {
            var r = { type: node.type };
            var opt;
            switch (node.type) {
                case "action":
                    r = { type: node.type, node: node, code: node.code, element: simplifyStructure(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "sequence":
                    r = { type: node.type, node: node, elements: node.elements.map(function (elem) { return simplifyStructure(node, elem); }) };
                    break;
                case "choice":
                    r = { type: node.type, node: node, elements: node.alternatives.map(function (alt) { return simplifyStructure(node, alt); }) };
                    break;
                case "optional":
                    //opt = true;
                    r = { type: node.type, node: node, element: simplifyStructure(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "zero_or_more":
                case "one_or_more":
                    r = { type: node.type, node: node, element: simplifyStructure(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "labeled":
                    r = { type: node.type, node: node, label: node.label, element: simplifyStructure(node, node.expression, true) };
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
    function generateTmpClass(simpleNode, simpleParent, indent, lab) {
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
                r = r.concat(simpleNode.code.trim().split(/\n/).map(function (line) { return indent + line.trim(); }));
                break;
            case "sequence":
                simpleNode.elements.forEach(function (simplEelem) {
                    r = r.concat(generateTmpClass(simplEelem, simpleNode, indent));
                });
                break;
            case "choice":
                if (islab) {
                    r = [simpleNode.elements.map(function (simpleElem) { return generateTmpClass(simpleElem, simpleNode, indent)[0]; }).join(" || ")];
                }
                else {
                    var i = 0;
                    simpleNode.elements.forEach(function (simpleElem) {
                        r.push(indent + "if (input['randomVar']===" + (i++) + ") {");
                        r = r.concat(generateTmpClass(simpleElem, simpleNode, indent + "    "));
                        r.push(indent + "}");
                    });
                }
                break;
            case "optional":
                //opt = true;
                if (islab)
                    r = generateTmpClass(simpleNode.element, simpleNode, indent);
                break;
            case "zero_or_more":
            case "one_or_more":
                if (islab)
                    r = ["[ " + generateTmpClass(simpleNode.element, simpleNode, indent)[0] + " ]"];
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
                if (islab)
                    r = ["$_" + simpleNode + "()"];
                else if (!isaction)
                    r = [indent + "return $_" + simpleNode + "()"];
                break;
            default:
                r = [indent + "// ? " + simpleNode.type];
                break;
        }
        return r;
    }
    function generateNodeClasses(simpleRule, simpleNode, simpleParent, indent, lab) {
        function gf() {
            if (simpleNode.code) {
                var f = [];
                f.push("function (");
                f.push(generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent).filter(function (e) { return e ? e.length : false; }).join(", "));
                f.push("): ");
                f.push(inferredTypes[simpleRule.rule]);
                f.push(" {");
                f = f.concat(simpleNode.code.trim().split(/\n/).map(function (line) { return " " + line.trim(); }));
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
        }
        else {
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
                if (!simpleNode.node.checkids)
                    simpleNode.node.checkids = [];
                isaction = 0;
                wasaction = 1;
                break;
            case "sequence":
                if (simpleNode.parentAction) {
                    simpleNode.node.templateFunction = simpleNode.parentAction.node.templateFunction;
                }
                simpleNode.node.checkids = simpleNode.checkids = [];
                return simpleNode.elements.map(function (simpleElem) {
                    var r = generateNodeClasses(simpleRule, simpleElem, simpleNode, indent)[0];
                    if (simpleElem.checkid)
                        simpleNode.checkids.push(simpleElem.checkid);
                    return r;
                });
                break;
            case "choice":
                if (isaction) {
                    var uniqtps = {};
                    simpleNode.elements.map(function (simpleElem) { return generateNodeClasses(simpleRule, simpleElem, simpleNode, indent)[0]; }).forEach(function (tp) {
                        uniqtps[tp] = tp;
                    });
                    var tps = Object.keys(uniqtps);
                    var tpst = tps.join(" | ");
                    if (tps.length > 1)
                        tpst = "(" + tpst + ")";
                    r = [tpst];
                }
                else {
                    simpleNode.elements.forEach(function (simpleElem) {
                        generateNodeClasses(simpleRule, simpleElem, simpleNode, indent);
                    });
                }
                break;
            case "optional":
                //opt = true;
                if (islab)
                    r = generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent);
                break;
            case "zero_or_more":
            case "one_or_more":
                if (islab)
                    r = [generateNodeClasses(simpleRule, simpleNode.element, simpleNode, indent)[0] + "[]"];
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
                if (islab)
                    r = [inferredTypes[simpleNode]];
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
    Object.values(simplifiedRules).forEach(function (simpleRule) {
        var outputType = (options && options.returnTypes) ? options.returnTypes[simpleRule.rule] : "";
        outputType = outputType ? ": " + outputType : "";
        genclss.push("function $_" + simpleRule.rule + "()" + outputType + " {");
        genclss = genclss.concat(generateTmpClass(simpleRule, null, "    "));
        genclss.push("}");
    });
    genclss = genclss.filter(function (elem) {
        if (!elem) {
            return false;
        }
        elem = elem.replace(/^(\s|\n)+/g, "");
        elem = elem.replace(/(\s|\n)+$/g, "");
        return elem;
    });
    var fnm = options.tmppref + "$$infer$tmp.ts";
    fs.writeFileSync(fnm, genclss.join("\n"));
    var program = ts.createProgram([fnm], {});
    var tsrc = program.getSourceFile(fnm);
    var checker = program.getTypeChecker();
    tsrc.statements.forEach(function (fun) {
        if (ts.isFunctionDeclaration(fun)) {
            var fname = fun.name.text.substring(2);
            //var tp = checker.getTypeAtLocation(fun);
            var outputType = (options && options.returnTypes) ? options.returnTypes[fname] : "";
            if (!outputType) {
                var tp = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(fun));
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
    Object.values(simplifiedRules).forEach(function (simpleRule) {
        generateNodeClasses(simpleRule, simpleRule, null, "    ");
    });
    //console.log("ast : "+JSON.stringify(ast, null, "  "));
}
module.exports = generate;
