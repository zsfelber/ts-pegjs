"use strict";
exports.__esModule = true;
var fs = require("fs");
var visitor = require("pegjs/lib/compiler/visitor");
// Generates parser JavaScript code.
function generate(ast) {
    // console.log("infer : "+JSON.stringify(ast.funcs, null, "  "));
    // console.log("ast : "+JSON.stringify(ast, null, "  "));
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var inferredTypes = {};
    var funcs = {};
    ast.funcs = funcs;
    ast.rules.forEach(function (rule) {
        var currentRule = rule.name;
        var r = funcs[currentRule];
        if (!r) {
            r = { rule: currentRule, funcs: [] };
            funcs[currentRule] = r;
        }
        var fun = generateTypeArgs(rule, rule.expression, false);
        r.funcs.push(fun);
    });
    function generateTypeArgs(parent, node, lab) {
        if (node.name) {
            return node.name;
        }
        else {
            var r = { type: node.type };
            var opt;
            switch (node.type) {
                case "action":
                    r = { type: "action", code: node.code, element: generateTypeArgs(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "sequence":
                    r = { type: node.type, elements: node.elements.map(function (elem) { return generateTypeArgs(node, elem); }) };
                    break;
                case "choice":
                    r = { type: node.type, elements: node.alternatives.map(function (alt) { return generateTypeArgs(node, alt); }) };
                    break;
                case "optional":
                    //opt = true;
                    r = { type: node.type, element: generateTypeArgs(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "zero_or_more":
                case "one_or_more":
                    r = { type: node.type, element: generateTypeArgs(node, node.expression) };
                    r.elements = [r.element];
                    break;
                case "labeled":
                    r = { type: node.type, label: node.label, element: generateTypeArgs(node, node.expression, true) };
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
    function generateTmpClass(node, parent, indent, lab) {
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
                r = r.concat(node.code.trim().split(/\n/).map(function (line) { return indent + line.trim(); }));
                break;
            case "sequence":
                node.elements.forEach(function (elem) {
                    r = r.concat(generateTmpClass(elem, node, indent));
                });
                break;
            case "choice":
                if (islab) {
                    r = [node.elements.map(function (elem) { return generateTmpClass(elem, node, indent)[0]; }).join(" || ")];
                }
                else {
                    var i = 0;
                    node.elements.forEach(function (elem) {
                        r.push(indent + "if (input['randomVar']===" + (i++) + ") {");
                        r = r.concat(generateTmpClass(elem, node, indent + "    "));
                        r.push(indent + "}");
                    });
                }
                break;
            case "optional":
                //opt = true;
                if (islab)
                    r = generateTmpClass(node.element, node, indent);
                break;
            case "zero_or_more":
            case "one_or_more":
                if (islab)
                    r = ["[ " + generateTmpClass(node.element, node, indent)[0] + " ]"];
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
                if (islab)
                    r = [node + "()"];
                else if (!isaction)
                    r = [indent + "return " + node + "()"];
                break;
            default:
                r = [indent + "// ? " + node.type];
                break;
        }
        return r;
    }
    function generateArgs(node, lab) {
        var r = "";
        var opt;
        switch (node.type) {
            case "sequence":
                r = node.elements.map(function (elem) { return generateArgs(elem); }).filter(function (str) { return !!str; }).join(", ");
                break;
            case "choice":
                r = node.elements.map(function (elem) { return generateArgs(elem); }).filter(function (str) { return !!str; }).join(" | ");
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
            if (opt)
                pf = "?";
            r = pf + ": " + r;
        }
        return r;
    }
    function predefType(rule) {
        var outputType = (options && options.returnTypes && options.returnTypes[rule]) ?
            options.returnTypes[rule] : null;
        return outputType;
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
    //var lstfiles = glob.sync(srcd + "**/_all_here_root.ts", {});
    //console.log("infer : "+JSON.stringify(ast.funcs, null, "  "));
    var genclss = [];
    genclss.push("import {IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IParseOptions, IPegjsParseStream, PegjsParseStream} from 'ts-pegjs/lib';");
    genclss.push("var input: IPegjsParseStream;");
    if (options.param0) {
        genclss.push("var " + options.param0 + ";");
    }
    if (options.tspegjs.customHeader) {
        genclss.push(options.tspegjs.customHeader + "");
    }
    Object.values(ast.funcs).forEach(function (funs) {
        funs.funcs.forEach(function (fun) {
            genclss.push("function " + funs.rule + "() {");
            genclss = genclss.concat(generateTmpClass(fun, null, "    "));
            genclss.push("}");
        });
    });
    genclss = genclss.filter(function (elem) {
        if (!elem) {
            return false;
        }
        elem = elem.replace(/^(\s|\n)+/g, "");
        elem = elem.replace(/(\s|\n)+$/g, "");
        return elem;
    });
    var fnm = options.dir + "/$$infer$tmp.ts";
    fs.writeFileSync(fnm, genclss.join("\n"));
    //var program = ts.createProgram([], {});
    //program.add
    //const checker = program.getTypeChecker();
}
module.exports = generate;
