"use strict";
exports.__esModule = true;
var fs = require("fs");
// Generates parser JavaScript code.
function generate(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var inferredTypes = {};
    function generateTmpClass(node, lab) {
        var r = "";
        var opt;
        switch (node.type) {
            case "sequence":
                r = node.elements.map(function (elem) { return generateTmpClass(elem); }).join("\n");
                break;
            case "choice":
                r = node.elements.map(function (elem) { return generateTmpClass(elem); }).join(" || ");
                break;
            case "optional":
                //opt = true;
                r = "[ " + generateTmpClass(node.element) + " ]";
                break;
            case "zero_or_more":
                r = generateTmpClass(node.element);
                break;
            case "labeled":
                r = "    var " + node.label + " = " + generateTmpClass(node.element, true) + ";";
                break;
            case undefined:
                // it's a rule name
                r = node + "()";
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
    var genclss = [];
    if (options.param0) {
        genclss.push("var " + options.param0 + ";");
    }
    if (options.tspegjs.customHeader) {
        genclss.push(options.tspegjs.customHeader);
    }
    console.log("infer : " + JSON.stringify(ast.funcs, null, "  "));
    Object.values(ast.funcs).forEach(function (fun) {
        var ftxt = "function " + fun.rule + "() {\n";
        ftxt += "    " + generateTmpClass(fun);
        ftxt += fun.code;
        ftxt += "}\n";
        genclss.push(ftxt);
    });
    var fnm = options.dir + "/$$infer$tmp.ts";
    fs.writeFileSync(fnm, genclss.join("\n"));
    //var program = ts.createProgram([], {});
    //program.add
    //const checker = program.getTypeChecker();
}
module.exports = generate;
