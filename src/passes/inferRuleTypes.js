"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var fs = require("fs");
var lib_1 = require("../../lib");
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
    var baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
    var inferredTypes = {};
    ast.inferredTypes = inferredTypes;
    ast.fields = [];
    function ot(node) {
        var outputType;
        if (options && options.returnTypes) {
            switch (node.kind) {
                case lib_1.PNodeKind.RULE:
                    outputType = options.returnTypes[node.rule];
                    break;
                case lib_1.PNodeKind.TERMINAL:
                    outputType = options.returnTypes["Ł" + node.terminal];
                    break;
            }
        }
        outputType = outputType ? ": " + outputType : "";
        return outputType;
    }
    function generateTmpClasses() {
        var grammar = ast.grammar;
        var result = [];
        var i = 0;
        var subTmpFuncs = [];
        function genTmpFunc(node, tmpfuncname, outputType) {
            var sresult = [];
            sresult.push("  " + tmpfuncname + "()" + outputType + " { // Tmp " + node.kind + " " + (node.name ? node.name : ""));
            var j = 0;
            if (node.kind === lib_1.PNodeKind.SEQUENCE) {
                sresult.push("    var result = [");
            }
            var condret = 0;
            node.children.forEach(function (child) {
                var tmpChildFuncName;
                switch (child.kind) {
                    case lib_1.PNodeKind.RULE_REF:
                        tmpChildFuncName = "$_" + child.name;
                        break;
                    case lib_1.PNodeKind.TERMINAL_REF:
                        tmpChildFuncName = "$_$" + child.name;
                        break;
                    default:
                        tmpChildFuncName = genTmpFunc(child, "$_" + (i++), "");
                        break;
                }
                switch (node.kind) {
                    case lib_1.PNodeKind.CHOICE:
                        condret = 1;
                        sresult.push("    if (theVeryNothing['randomVar']===" + (j++) + ") {");
                        sresult.push("      return this." + tmpChildFuncName + "();");
                        sresult.push("    }");
                        break;
                    case lib_1.PNodeKind.SEQUENCE:
                        sresult.push("      this." + tmpChildFuncName + "(),");
                        break;
                    case lib_1.PNodeKind.ONE_OR_MORE:
                    case lib_1.PNodeKind.ZERO_OR_MORE:
                        sresult.push("    return [ this." + tmpChildFuncName + "() ];");
                        break;
                    default:
                        sresult.push("    return this." + tmpChildFuncName + "();");
                        break;
                }
            });
            if (node.kind === lib_1.PNodeKind.SEQUENCE) {
                sresult.push("    ];");
                sresult.push("    return result;");
            }
            else if (condret) {
                sresult.push("    return undefined;");
            }
            sresult.push("  }");
            sresult.push("");
            subTmpFuncs = subTmpFuncs.concat(sresult);
            return tmpfuncname;
        }
        function genMainFuncs() {
            var sresult = [];
            grammar.actions.forEach(function (action) {
                var outputType;
                var name;
                switch (action.ownerRule.kind) {
                    case lib_1.PNodeKind.RULE:
                        outputType = action.kind === lib_1.PActionKind.RULE ? ot(action.ownerRule)
                            : ": boolean";
                        name = action.name;
                        break;
                    default:
                        outputType = action.kind === lib_1.PActionKind.RULE ? "" : ": boolean";
                        name = "$" + action.name;
                        break;
                }
                sresult.push("  $_" + name + "()" + outputType + " {  // " + action.target.kind + "/" + action.kind);
                action.args.forEach(function (a) {
                    var argFuncName, inf;
                    if (a.evaluate.rule) {
                        argFuncName = "$_" + a.evaluate.rule;
                        inf = "rule";
                    }
                    else if (a.evaluate.terminal) {
                        argFuncName = "$_$" + a.evaluate.terminal;
                        inf = "term";
                    }
                    else {
                        argFuncName = genTmpFunc(a.evaluate, "$_" + (i++), "");
                        inf = "tmp";
                    }
                    sresult.push("    let " + a.label + " = this." + argFuncName + "(); // " + inf);
                });
                sresult = sresult.concat(action.code.map(function (line) { return "    " + line; }));
                sresult.push("  }");
            });
            var j = 0;
            grammar.children.forEach(function (rule) {
                var outputType = ot(rule);
                var name, ass;
                if (rule.kind === lib_1.PNodeKind.TERMINAL) {
                    name = "$" + rule.name;
                    ass = outputType.replace(":", " as ");
                }
                else {
                    name = rule.name;
                    ass = "";
                }
                if (rule.ruleActions.length) {
                    var condret = 0;
                    sresult.push("  $_" + name + "()" + outputType + " {  // (" + rule.kind + ") " + rule.name);
                    rule.ruleActions.forEach(function (action) {
                        var aname;
                        if (rule.kind === lib_1.PNodeKind.TERMINAL) {
                            aname = "$" + action.name;
                        }
                        else {
                            aname = action.name;
                        }
                        condret = 1;
                        sresult.push("    if (theVeryNothing['butSomething']===" + (j++) + ") {");
                        sresult.push("      return this.$_" + aname + "()" + ass + ";");
                        sresult.push("    }");
                    });
                    if (condret) {
                        sresult.push("    return undefined;");
                    }
                    sresult.push("  }");
                    sresult.push("");
                }
                else if (rule.kind === lib_1.PNodeKind.TERMINAL) {
                    sresult.push("  $_" + name + "()" + outputType + " {  // generated (" + rule.kind + ") " + rule.name);
                    sresult.push("    return this.token()" + ass + ";");
                    sresult.push("  }");
                }
                else {
                    genTmpFunc(rule, "$_" + name, outputType);
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
        "  peg$silentFails = 0;",
        "",
        "  token(): " + baseTokenType + " { return null; } ",
        "",
        ""].join("\n"));
    genclss.push("");
    if (options.tspegjs.customFields) {
        genclss.push(options.tspegjs.customFields
            .join("\n"));
        genclss.push("");
    }
    genclss = genclss.concat(generateTmpClasses());
    genclss.push("");
    genclss.push("}");
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
    tsrc.statements.forEach(function (cl) {
        if (ts.isClassDeclaration(cl)) {
            cl.members.forEach(function (method) {
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
//# sourceMappingURL=inferRuleTypes.js.map