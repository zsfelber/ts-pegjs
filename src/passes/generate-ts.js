"use strict";

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

var asts = require("pegjs/lib/compiler/asts");
var js = require("pegjs/lib/compiler/js");
var op = require("pegjs/lib/compiler/opcodes");
var pluginVersion = require("../../package.json").version;
var pegJsVersion = require("pegjs/package.json").version;

// Generates parser JavaScript code.
function generateTS(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length -1];
  //options.returnTypes = {};

  // These only indent non-empty lines to avoid trailing whitespace.
  function indent2(code) {
    return code.replace(/^(.+)$/gm, "  $1");
  }

  function indent10(code) {
    return code.replace(/^(.+)$/gm, "          $1");
  }

  function generateTables() {
    if (options.optimize === "size") {
      return [
        "const peg$consts = [",
        indent2(ast.consts.join(",\n")),
        "];",
        "",
        "const peg$bytecode = [",
        indent2(ast.rules.map(rule =>
          "peg$decode(\"" +
          js.stringEscape(rule.bytecode.map(
            b => String.fromCharCode(b + 32)
          ).join("")) +
          "\")"
        ).join(",\n")),
        "];"
      ].join("\n");
    } else {
      return ast.consts.map((c, i) => "const peg$c" + i + " = " + c + ";").join("\n");
    }
  }

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    let parts = [];

    parts.push("");

    if (options.trace) {
      parts.push([
        "peg$tracer.trace({",
        "  type: \"rule.enter\",",
        "  rule: " + ruleNameCode + ",",
        "  location: peg$computeLocation(startPos, startPos)",
        "});",
        ""
      ].join("\n"));
    }

    if (options.cache) {
      parts.push([
        "const key = input.currPos * " + ast.rules.length + " + " + ruleIndexCode + ";",
        "const cached: ICached = peg$resultsCache[key];",
        "let position: number;",
        "",
        "if (cached) {",
        "  input.currPos = cached.nextPos;",
        ""
      ].join("\n"));

      if (options.trace) {
        parts.push([
          "if (cached.result !== peg$FAILED) {",
          "  peg$tracer.trace({",
          "    type: \"rule.match\",",
          "    rule: " + ruleNameCode + ",",
          "    result: cached.result,",
          "    location: peg$computeLocation(startPos, input.currPos)",
          "  });",
          "} else {",
          "  peg$tracer.trace({",
          "    type: \"rule.fail\",",
          "    rule: " + ruleNameCode + ",",
          "    location: peg$computeLocation(startPos, startPos)",
          "  });",
          "}",
          ""
        ].join("\n"));
      }

      parts.push([
        "  return cached.result;",
        "}",
        ""
      ].join("\n"));
    }

    return parts.join("\n");
  }

  function generateRuleFooter(ruleNameCode, resultCode) {
    let parts = [];

    if (options.cache) {
      parts.push([
        "",
        "peg$resultsCache[key] = { nextPos: input.currPos, result: " + resultCode + " };"
      ].join("\n"));
    }

    if (options.trace) {
      parts.push([
        "",
        "if (" + resultCode + " !== peg$FAILED) {",
        "  peg$tracer.trace({",
        "    type: \"rule.match\",",
        "    rule: " + ruleNameCode + ",",
        "    result: " + resultCode + ",",
        "    location: peg$computeLocation(startPos, input.currPos)",
        "  });",
        "} else {",
        "  peg$tracer.trace({",
        "    type: \"rule.fail\",",
        "    rule: " + ruleNameCode + ",",
        "    location: peg$computeLocation(startPos, startPos)",
        "  });",
        "}"
      ].join("\n"));
    }

    parts.push([
      "",
      "return " + resultCode + ";"
    ].join("\n"));

    return parts.join("\n");
  }

  function generateInterpreter() {
    let parts = [];

    function generateCondition(cond, argsLength) {
      let baseLength = argsLength + 3;
      let thenLengthCode = "bc[ip + " + (baseLength - 2) + "]";
      let elseLengthCode = "bc[ip + " + (baseLength - 1) + "]";

      return [
        "ends.push(end);",
        "ips.push(ip + " + baseLength + " + " + thenLengthCode + " + " + elseLengthCode + ");",
        "",
        "if (" + cond + ") {",
        "  end = ip + " + baseLength + " + " + thenLengthCode + ";",
        "  ip += " + baseLength + ";",
        "} else {",
        "  end = ip + " + baseLength + " + " + thenLengthCode + " + " + elseLengthCode + ";",
        "  ip += " + baseLength + " + " + thenLengthCode + ";",
        "}",
        "",
        "break;"
      ].join("\n");
    }

    function generateLoop(cond) {
      let baseLength = 2;
      let bodyLengthCode = "bc[ip + " + (baseLength - 1) + "]";

      return [
        "if (" + cond + ") {",
        "  ends.push(end);",
        "  ips.push(ip);",
        "",
        "  end = ip + " + baseLength + " + " + bodyLengthCode + ";",
        "  ip += " + baseLength + ";",
        "} else {",
        "  ip += " + baseLength + " + " + bodyLengthCode + ";",
        "}",
        "",
        "break;"
      ].join("\n");
    }

    function generateCall() {
      let baseLength = 4;
      let paramsLengthCode = "bc[ip + " + (baseLength - 1) + "]";

      return [
        "params = bc.slice(ip + " + baseLength + ", ip + " + baseLength + " + " + paramsLengthCode + ")",
        "  .map(function(p) { return stack[stack.length - 1 - p]; });",
        "",
        "stack.splice(",
        "  stack.length - bc[ip + 2],",
        "  bc[ip + 2],",
        "  (peg$consts[bc[ip + 1]] as ((...args: any[]) => any)).apply(null, params)",
        ");",
        "",
        "ip += " + baseLength + " + " + paramsLengthCode + ";",
        "break;"
      ].join("\n");
    }

    parts.push([
      "function peg$decode(s: string): number[] {",
      "  return s.split(\"\").map((ch) =>  ch.charCodeAt(0) - 32 );",
      "}",
      "",
      "function peg$parseRule(index: number): any {"
    ].join("\n"));

    if (options.trace) {
      parts.push([
        "  const bc = peg$bytecode[index];",
        "  let ip = 0;",
        "  const ips: any[] = [];",
        "  let end = bc.length;",
        "  const ends: any[] = [];",
        "  const stack: any[] = [];",
        "  let startPos = input.currPos;",
        "  let params;"
      ].join("\n"));
    } else {
      parts.push([
        "  const bc = peg$bytecode[index];",
        "  let ip = 0;",
        "  const ips: any[] = [];",
        "  let end = bc.length;",
        "  const ends: any[] = [];",
        "  const stack: any[] = [];",
        "  let params;"
      ].join("\n"));
    }

    parts.push(indent2(generateRuleHeader("RuleNames[index]", "index")));

    // bc[ip]    statement code
    // bc[ip+1]  statement parameter index (used in [peg$/ast.] consts and ast.rules)

    parts.push([
      // The point of the outer loop and the |ips| & |ends| stacks is to avoid
      // recursive calls for interpreting parts of bytecode. In other words, we
      // implement the |interpret| operation of the abstract machine without
      // function calls. Such calls would likely slow the parser down and more
      // importantly cause stack overflows for complex grammars.
      "  while (true) {",
      "    while (ip < end) {",
      "      switch (bc[ip]) {",
      "        case " + op.PUSH + ":", // PUSH c
      "          stack.push(peg$consts[bc[ip + 1]]);",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.PUSH_UNDEFINED + ":", // PUSH_UNDEFINED
      "          stack.push(undefined);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.PUSH_NULL + ":", // PUSH_NULL
      "          stack.push(null);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.PUSH_FAILED + ":", // PUSH_FAILED
      "          stack.push(peg$FAILED);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.PUSH_EMPTY_ARRAY + ":", // PUSH_EMPTY_ARRAY
      "          stack.push([]);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.PUSH_CURR_POS + ":", // PUSH_CURR_POS
      "          stack.push(input.currPos);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.POP + ":", // POP
      "          stack.pop();",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.POP_CURR_POS + ":", // POP_CURR_POS
      "          input.currPos = stack.pop();",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.POP_N + ":", // POP_N n
      "          stack.length -= bc[ip + 1];",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.NIP + ":", // NIP
      "          stack.splice(-2, 1);",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.APPEND + ":", // APPEND
      "          stack[stack.length - 2].push(stack.pop());",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.WRAP + ":", // WRAP n
      "          stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.TEXT + ":", // TEXT
      "          stack.push(input.substring(stack.pop(), input.currPos));",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.IF + ":", // IF t, f
      indent10(generateCondition("stack[stack.length - 1]", 0)),
      "",
      "        case " + op.IF_ERROR + ":", // IF_ERROR t, f
      indent10(generateCondition(
        "stack[stack.length - 1] === peg$FAILED",
        0
      )),
      "",
      "        case " + op.IF_NOT_ERROR + ":", // IF_NOT_ERROR t, f
      indent10(
        generateCondition("stack[stack.length - 1] !== peg$FAILED",
          0
        )),
      "",
      "        case " + op.WHILE_NOT_ERROR + ":", // WHILE_NOT_ERROR b
      indent10(generateLoop("stack[stack.length - 1] !== peg$FAILED")),
      "",
      "        case " + op.MATCH_ANY + ":", // MATCH_ANY a, f, ...
      //indent10(generateCondition("input.length > input.currPos", 0)),
      indent10(generateCondition("input.isAvailableAt(input.currPos)", 0)),
      "",
      "        case " + op.MATCH_STRING + ":", // MATCH_STRING s, a, f, ...
      indent10(generateCondition(
        "input.expect(index, peg$consts[bc[ip + 1]] as string)",
        1
      )),
      "",
      "        case " + op.MATCH_STRING_IC + ":", // MATCH_STRING_IC s, a, f, ...
      indent10(generateCondition(
        "input.expectLowerCase(index, peg$consts[bc[ip + 1]] as string)",
        1
      )),
      "",
      "        case " + op.MATCH_REGEXP + ":", // MATCH_REGEXP r, a, f, ...
      indent10(generateCondition(
        "(peg$consts[bc[ip + 1]] as any as RegExp).test(input.charAt(input.currPos))",
        1
      )),
      "",
      "        case " + op.ACCEPT_N + ":", // ACCEPT_N n
      "          stack.push(input.readForward(index, bc[ip + 1]));",
      "          input.currPos += bc[ip + 1];",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.ACCEPT_STRING + ":", // ACCEPT_STRING s
      "          stack.push(peg$consts[bc[ip + 1]]);",
      "          input.currPos += (peg$consts[bc[ip + 1]] as string).length;",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.FAIL + ":", // FAIL e
      "          stack.push(peg$FAILED);",
      "          if (peg$silentFails === 0) {",
      "            peg$fail(peg$consts[bc[ip + 1]] as ILiteralExpectation);",
      "          }",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.LOAD_SAVED_POS + ":", // LOAD_SAVED_POS p
      "          input.savedPos = stack[stack.length - 1 - bc[ip + 1]];",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.UPDATE_SAVED_POS + ":", // UPDATE_SAVED_POS
      "          input.savedPos = input.currPos;",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.CALL + ":", // CALL f, n, pc, p1, p2, ..., pN
      indent10(generateCall()),
      "",
      "        case " + op.RULE + ":", // RULE r
      "          stack.push(peg$parseRule(bc[ip + 1]));",
      "          ip += 2;",
      "          break;",
      "",
      "        case " + op.SILENT_FAILS_ON + ":", // SILENT_FAILS_ON
      "          peg$silentFails++;",
      "          ip++;",
      "          break;",
      "",
      "        case " + op.SILENT_FAILS_OFF + ":", // SILENT_FAILS_OFF
      "          peg$silentFails--;",
      "          ip++;",
      "          break;",
      "",
      "        default:",
      "          throw new Error(\"Invalid opcode: \" + bc[ip] + \".\");",
      "      }",
      "    }",
      "",
      "    if (ends.length > 0) {",
      "      end = ends.pop();",
      "      ip = ips.pop();",
      "    } else {",
      "      break;",
      "    }",
      "  }"
    ].join("\n"));

    parts.push(indent2(generateRuleFooter("RuleNames[index]", "stack[0]")));
    parts.push("}");

    return parts.join("\n");
  }

  function generateRuleFunction(rule) {
    let parts = [];
    let stackVars = [];
    let code;

    function c(i) {
      return "peg$c" + i;
    } // |consts[i]| of the abstract machine
    function s(i) {
      return "s" + i;
    } // |stack[i]| of the abstract machine

    let stack = {
      sp: -1,
      maxSp: -1,

      push(exprCode) {
        let code = s(++this.sp) + " = " + exprCode + ";";

        if (this.sp > this.maxSp) {
          this.maxSp = this.sp;
        }

        return code;
      },

      pop(n) {
        if (n === undefined) {
          return s(this.sp--);
        } else {
          let values = Array(n);

          for (let i = 0; i < n; i++) {
            values[i] = s(this.sp - n + 1 + i);
          }

          this.sp -= n;

          return values;
        }
      },

      top() {
        return s(this.sp);
      },

      index(i) {
        return s(this.sp - i);
      }
    };

    function compile(bc) {
      let ip = 0;
      let end = bc.length;
      let parts = [];
      let value;

      function compileCondition(cond, argCount) {
        let baseLength = argCount + 3;
        let thenLength = bc[ip + baseLength - 2];
        let elseLength = bc[ip + baseLength - 1];
        let baseSp = stack.sp;
        let thenCode, elseCode, thenSp, elseSp;

        ip += baseLength;
        thenCode = compile(bc.slice(ip, ip + thenLength));
        thenSp = stack.sp;
        ip += thenLength;

        if (elseLength > 0) {
          stack.sp = baseSp;
          elseCode = compile(bc.slice(ip, ip + elseLength));
          elseSp = stack.sp;
          ip += elseLength;

          if (thenSp !== elseSp) {
            throw new Error(
              "Branches of a condition must move the stack pointer in the same way."
            );
          }
        }

        parts.push("if (" + cond + ") {");
        parts.push(indent2(thenCode));
        if (elseLength > 0) {
          parts.push("} else {");
          parts.push(indent2(elseCode));
        }
        parts.push("}");
      }

      function compileLoop(cond) {
        let baseLength = 2;
        let bodyLength = bc[ip + baseLength - 1];
        let baseSp = stack.sp;
        let bodyCode, bodySp;

        ip += baseLength;
        bodyCode = compile(bc.slice(ip, ip + bodyLength));
        bodySp = stack.sp;
        ip += bodyLength;

        if (bodySp !== baseSp) {
          throw new Error("Body of a loop can't move the stack pointer.");
        }

        parts.push("while (" + cond + ") {");
        parts.push(indent2(bodyCode));
        parts.push("}");
      }

      function compileCall() {
        let baseLength = 4;
        let paramsLength = bc[ip + baseLength - 1];

        let value = c(bc[ip + 1]) + "(" +
          bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
            p => stack.index(p)
          ).join(", ") +
          ")";
        stack.pop(bc[ip + 2]);
        parts.push(stack.push(value));
        ip += baseLength + paramsLength;
      }

      // bc[ip]    statement code
      // bc[ip+1]  statement parameter index (used in [peg$/ast.] consts and ast.rules)

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH: // PUSH c
            parts.push(stack.push(c(bc[ip + 1])));
            ip += 2;
            break;

          case op.PUSH_CURR_POS: // PUSH_CURR_POS
            //parts.push(stack.push("input.currPos"));
            stack.push("input.currPos");
            parts.push("position = input.currPos;");
            ip++;
            break;

          case op.PUSH_UNDEFINED: // PUSH_UNDEFINED
            parts.push(stack.push("undefined"));
            ip++;
            break;

          case op.PUSH_NULL: // PUSH_NULL
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_FAILED: // PUSH_FAILED
            parts.push(stack.push("peg$FAILED"));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY: // PUSH_EMPTY_ARRAY
            parts.push(stack.push("[]"));
            ip++;
            break;

          case op.POP: // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS: // POP_CURR_POS
            //parts.push("input.currPos = " + stack.pop() + ";");
            stack.pop();
            parts.push("input.currPos = position;");
            ip++;
            break;

          case op.POP_N: // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP: // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND: // APPEND
            value = stack.pop();
            parts.push(stack.top() + ".push(" + value + ");");
            ip++;
            break;

          case op.WRAP: // WRAP n
            parts.push(
              stack.push("[" + stack.pop(bc[ip + 1]).join(", ") + "]")
            );
            ip += 2;
            break;

          case op.TEXT: // TEXT
            parts.push(
              stack.push("input.substring(" + stack.pop() + ", input.currPos)")
            );
            ip++;
            break;

          case op.IF: // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR: // IF_ERROR t, f
            compileCondition(stack.top() + " === peg$FAILED", 0);
            break;

          case op.IF_NOT_ERROR: // IF_NOT_ERROR t, f
            compileCondition(stack.top() + " !== peg$FAILED", 0);
            break;

          case op.WHILE_NOT_ERROR: // WHILE_NOT_ERROR b
            compileLoop(stack.top() + " !== peg$FAILED", 0);
            break;

          case op.MATCH_ANY: // MATCH_ANY a, f, ...
            //compileCondition("input.length > input.currPos", 0);
            compileCondition("input.isAvailableAt(input.currPos)", 0);
            break;

          case op.MATCH_STRING: // MATCH_STRING s, a, f, ...
            compileCondition(
              eval(ast.consts[bc[ip + 1]]).length > 1 ?
              "input.readForward(RuleId." + rule.name + ", "+
              eval(ast.consts[bc[ip + 1]]).length +
              ") === " +
              c(bc[ip + 1]) :
              "input.charCodeAt(input.currPos) === " +
              eval(ast.consts[bc[ip + 1]]).charCodeAt(0),
              1
            );
            break;

          case op.MATCH_STRING_IC: // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              "input.readForward(RuleId." + rule.name+", "+
              eval(ast.consts[bc[ip + 1]]).length +
              ").toLowerCase() === " +
              c(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_REGEXP: // MATCH_REGEXP r, a, f, ...
            compileCondition(
              c(bc[ip + 1]) + ".test(input.charAt(input.currPos))",
              1
            );
            break;

          case op.ACCEPT_N: // ACCEPT_N n
            parts.push(stack.push(
              bc[ip + 1] > 1 ?
              "input.readForward(RuleId." + rule.name+", "+
              bc[ip + 1] + ")" :
              "input.charAt(input.currPos)"
            ));
            parts.push(
              bc[ip + 1] > 1 ?
              "input.currPos += " + bc[ip + 1] + ";" :
              "input.currPos++;"
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING: // ACCEPT_STRING s
            parts.push(stack.push(c(bc[ip + 1])));
            parts.push(
              eval(ast.consts[bc[ip + 1]]).length > 1 ?
              "input.currPos += " + eval(ast.consts[bc[ip + 1]]).length + ";" :
              "input.currPos++;"
            );
            ip += 2;
            break;

          case op.FAIL: // FAIL e
            parts.push(stack.push("peg$FAILED"));
            parts.push("if (peg$silentFails === 0) { peg$fail(" + c(bc[ip + 1]) + "); }");
            ip += 2;
            break;

          case op.LOAD_SAVED_POS: // LOAD_SAVED_POS p
            //parts.push("input.savedPos = " + stack.index(bc[ip + 1]) + ";");
            parts.push("input.savedPos = position;");
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS: // UPDATE_SAVED_POS
            parts.push("input.savedPos = input.currPos;");
            ip++;
            break;

          case op.CALL: // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE: // RULE r
            parts.push(stack.push("peg$parse" + ast.rules[bc[ip + 1]].name + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON: // SILENT_FAILS_ON
            parts.push("peg$silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF: // SILENT_FAILS_OFF
            parts.push("peg$silentFails--;");
            ip++;
            break;

          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".");
        }
      }

      return parts.join("\n");
    }

    code = compile(rule.bytecode);

    const outputType = (options && options.returnTypes && options.returnTypes[rule.name]) ?
                       ": "+options.returnTypes[rule.name] : "";//": any";
    
    parts.push("function peg$parse" + rule.name + "()" + outputType +" {");

    if (options.trace) {
      parts.push("  const startPos = input.currPos;");
    }

    for (let i = 0; i <= stack.maxSp; i++) {
      stackVars[i] = s(i);
    }

    parts.push("  let " + stackVars.join(", ") + ";");

    parts.push(indent2(generateRuleHeader(
      "\"" + js.stringEscape(rule.name) + "\"",
      asts.indexOfRule(ast, rule.name)
    )));
    parts.push(indent2(code));
    parts.push(indent2(generateRuleFooter(
      "\"" + js.stringEscape(rule.name) + "\"",
      s(0)
    )));

    parts.push("}");

    return parts.join("\n");
  }

  function generateToplevel() {
    let parts = [];

    // interfaces removed from here , it is better to import

    parts.push([
      "function peg$parse(input: IParseStream, options?: IParseOptions) {",
      "  options = options !== undefined ? options : {};",
      "",
      "  const peg$FAILED: Readonly<any> = {};",
      ""
    ].join("\n"));

    if (options.optimize === "size") {
      let startRuleIndices = "{ " +
        options.allowedStartRules.map(
          r => r + ": " + asts.indexOfRule(ast, r)
        ).join(", ") +
        " }";
      let startRuleIndex = asts.indexOfRule(ast, options.allowedStartRules[0]);

      parts.push([
        "  const peg$startRuleIndices: {[id: string]: number}  = " + startRuleIndices + ";",
        "  let peg$startRuleIndex = " + startRuleIndex + ";"
      ].join("\n"));
    } else {
      let startRuleFunctions = "{ " +
        options.allowedStartRules.map(
          r => r + ": peg$parse" + r
        ).join(", ") +
        " }";
      let startRuleFunction = "peg$parse" + options.allowedStartRules[0];

      parts.push([
        "  const peg$startRuleFunctions: {[id: string]: any} = " + startRuleFunctions + ";",
        "  let peg$startRuleFunction: () => any = " + startRuleFunction + ";"
      ].join("\n"));
    }

    parts.push("");

    parts.push(indent2(generateTables()));

    parts.push([
      "",
      "  input.currPos = 0;",
      "  input.savedPos = 0;",
      "  const peg$posDetailsCache = [{ line: 1, column: 1 }];",
      "  let peg$maxFailPos = 0;",
      "  let peg$maxFailExpected: Expectation[] = [];",
      "  let peg$silentFails = 0;", // 0 = report failures, > 0 = silence failures
      ""
    ].join("\n"));

    if (options.cache) {
      parts.push([
        "  const peg$resultsCache: {[id: number]: ICached} = {};",
        ""
      ].join("\n"));
    }

    /*if (options.optimize === "size") {
      let ruleNames = "[" +
        ast.rules.map(
          r => "\"" + js.stringEscape(r.name) + "\""
        ).join(", ") +
      "]";

      parts.push([
        "  let Rules = " + ruleNames + ";",
        ""
      ].join("\n"));
    }*/

    //   ^
    //   |
    if (options.trace) {
      // |<-------|
      //          |
      //if (options.optimize === "size") {
      //}

      parts.push([
        "  const peg$tracer = \"tracer\" in options ? options.tracer : new DefaultTracer();",
        ""
      ].join("\n"));
    }

    parts.push([
      "  let peg$result;",
      ""
    ].join("\n"));

    if (options.optimize === "size") {
      parts.push([
        "  if (options.startRule !== undefined) {",
        "    if (!(options.startRule in peg$startRuleIndices)) {",
        "      throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
        "    }",
        "",
        "    peg$startRuleIndex = peg$startRuleIndices[options.startRule];",
        "  }"
      ].join("\n"));
    } else {
      parts.push([
        "  if (options.startRule !== undefined) {",
        "    if (!(options.startRule in peg$startRuleFunctions)) {",
        "      throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
        "    }",
        "",
        "    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];",
        "  }"
      ].join("\n"));
    }

    parts.push([
      "",
      "  function text(): string {",
      "    return input.substring(input.savedPos, input.currPos);",
      "  }",
      "",
      "  function location(): IFileRange {",
      "    return peg$computeLocation(input.savedPos, input.currPos);",
      "  }",
      "",
      "  function expected(description: string, location1?: IFileRange) {",
      "    location1 = location1 !== undefined",
      "      ? location1",
      "      : peg$computeLocation(input.savedPos, input.currPos);",
      "",
      "    throw peg$buildStructuredError(",
      "      [peg$otherExpectation(description)],",
      "      input.substring(input.savedPos, input.currPos),",
      "      location1",
      "    );",
      "  }",
      "",
      "  function error(message: string, location1?: IFileRange) {",
      "    location1 = location1 !== undefined",
      "      ? location1",
      "      : peg$computeLocation(input.savedPos, input.currPos);",
      "",
      "    throw peg$buildSimpleError(message, location1);",
      "  }",
      "",
      "  function peg$literalExpectation(text1: string, ignoreCase: boolean): ILiteralExpectation {",
      "    return { type: \"literal\", text: text1, ignoreCase: ignoreCase };",
      "  }",
      "",
      "  function peg$classExpectation(parts: IClassParts, inverted: boolean, ignoreCase: boolean): IClassExpectation {",
      "    return { type: \"class\", parts: parts, inverted: inverted, ignoreCase: ignoreCase };",
      "  }",
      "",
      "  function peg$anyExpectation(): IAnyExpectation {",
      "    return { type: \"any\" };",
      "  }",
      "",
      "  function peg$endExpectation(): IEndExpectation {",
      "    return { type: \"end\" };",
      "  }",
      "",
      "  function peg$otherExpectation(description: string): IOtherExpectation {",
      "    return { type: \"other\", description: description };",
      "  }",
      "",
      "  function peg$computePosDetails(pos: number) {",
      "    let details = peg$posDetailsCache[pos];",
      "    let p;",
      "",
      "    if (details) {",
      "      return details;",
      "    } else {",
      "      p = pos - 1;",
      "      while (!peg$posDetailsCache[p]) {",
      "        p--;",
      "      }",
      "",
      "      details = peg$posDetailsCache[p];",
      "      details = {",
      "        line: details.line,",
      "        column: details.column",
      "      };",
      "",
      "      while (p < pos) {",
      "        if (input.charCodeAt(p) === 10) {",
      "          details.line++;",
      "          details.column = 1;",
      "        } else {",
      "          details.column++;",
      "        }",
      "",
      "        p++;",
      "      }",
      "",
      "      peg$posDetailsCache[pos] = details;",
      "",
      "      return details;",
      "    }",
      "  }",
      "",
      "  function peg$computeLocation(startPos: number, endPos: number): IFileRange {",
      "    const startPosDetails = peg$computePosDetails(startPos);",
      "    const endPosDetails = peg$computePosDetails(endPos);",
      "",
      "    return {",
      "      start: {",
      "        offset: startPos,",
      "        line: startPosDetails.line,",
      "        column: startPosDetails.column",
      "      },",
      "      end: {",
      "        offset: endPos,",
      "        line: endPosDetails.line,",
      "        column: endPosDetails.column",
      "      }",
      "    };",
      "  }",
      "",
      "  function peg$fail(expected1: Expectation) {",
      "    if (input.currPos < peg$maxFailPos) { return; }",
      "",
      "    if (input.currPos > peg$maxFailPos) {",
      "      peg$maxFailPos = input.currPos;",
      "      peg$maxFailExpected = [];",
      "    }",
      "",
      "    peg$maxFailExpected.push(expected1);",
      "  }",
      "",
      "  function peg$buildSimpleError(message: string, location1: IFileRange) {",
      "    return new SyntaxError(input, message, [], \"\", location1);",
      "  }",
      "",
      "  function peg$buildStructuredError(expected1: Expectation[], found: string | null, location1: IFileRange) {",
      "    return new SyntaxError(",
      "      input, SyntaxError.buildMessage(expected1, found),",
      "      expected1,",
      "      found,",
      "      location1",
      "    );",
      "  }",
      ""
    ].join("\n"));

    if (options.optimize === "size") {
      parts.push(indent2(generateInterpreter()));
      parts.push("");
    } else {
      ast.rules.forEach(rule => {
        parts.push(indent2(generateRuleFunction(rule)));
        parts.push("");
      });
    }

    if (ast.initializer) {
      parts.push(indent2(ast.initializer.code));
      parts.push("");
    }

    if (options.optimize === "size") {
      parts.push("  peg$result = peg$parseRule(peg$startRuleIndex);");
    } else {
      parts.push("  peg$result = peg$startRuleFunction();");
    }

    parts.push([
      "",
      "  if (peg$result !== peg$FAILED) {",
      "    if (input.isAvailableAt(input.currPos)) {",
      "      peg$fail(peg$endExpectation());",
      "    } else {",
      "      return peg$result;",
      "    }",
      "  }",
      "",
      "  throw peg$buildStructuredError(",
      "    peg$maxFailExpected,",
      "    input.isAvailableAt(peg$maxFailPos) ? input.charAt(peg$maxFailPos) : null,",
      "    input.isAvailableAt(peg$maxFailPos)",
      "      ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)",
      "      : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)",
      "  );",
      "",
      "}"
    ].join("\n"));

    return parts.join("\n");
  }

  function generateWrapper(toplevelCode) {
    function generateGeneratedByComment() {
      let res = [];
      if (options.tspegjs.customHeader) {
        res.push(options.tspegjs.customHeader);
      }
      res = res.concat([
        "import {IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IParseOptions, PegjsParseFunction, PegjsParser, IPegjsParseStream} from 'ts-pegjs/lib/interfaces';",
        "",
        "// Generated by PEG.js v. " + pegJsVersion + " (ts-pegjs plugin v. " + pluginVersion + " )",
        "//",
        "// https://pegjs.org/   https://github.com/metadevpro/ts-pegjs"
      ]);

      return res.join("\n");
    }

    function generateParserObject() {
      const streamType = `export interface IParseStream extends IPegjsParseStream {

  // should return this.substr(input.currPos, len)
  readForward(rule: RuleId, len: number): string;

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: RuleId, expectedText: string): boolean;

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectIgnoreCase(rule: RuleId, expectedText: string): boolean;

}`;

      var ruleNamesEtc = "";
      if (options.optimize === "size") {
        let ruleIds = "{" +
          ast.rules.map(
            r => r.name
          ).join(", ") +
        "}";
        let ruleNames = "[" +
          ast.rules.map(
            r => "\"" + js.stringEscape(r.name) + "\""
          ).join(", ") +
        "]";

        ruleNamesEtc = [
          "export enum RuleId " + ruleIds + ";",
          "export var RuleNames = " + ruleNames + ";",
          ""
        ].join("\n");
      }

      const parseFunctionType = "export type ParseFunction = (input: IParseStream, options?: IParseOptions) => any;";
      const parseExport = "export const parse: ParseFunction = peg$parse;";

      return options.trace ?
        [
          streamType,
          parseFunctionType,
          parseExport,
          ruleNamesEtc,
          // "{",
          // "  SyntaxError: peg$SyntaxError,",
          // "  DefaultTracer: peg$DefaultTracer,",
          // "  parse: peg$parse",
          // "}"
        ].join("\n") :
        [
          streamType,
          parseFunctionType,
          parseExport,
          ruleNamesEtc,
          // "{",
          // "  SyntaxError: peg$SyntaxError,",
          // "  parse: peg$parse",
          // "}"
        ].join("\n");
    }

    function generateParserExports() {
      return options.trace ?
        [
          "{",
          "  SyntaxError as SyntaxError,",
          "  DefaultTracer as DefaultTracer,",
          "  peg$parse as parse",
          "}"
        ].join("\n") :
        [
          "{",
          "  SyntaxError as SyntaxError,",
          "  peg$parse as parse",
          "}"
        ].join("\n");
    }

    let generators = {
      bare() {
        return [
          generateGeneratedByComment(),
          // "(function() {",
          // "  \"use strict\";",
          "",
          toplevelCode,
          "",
          //indent2("return " + generateParserObject() + ";"),
          generateParserObject(),
          //"})()"
        ].join("\n");
      },

      commonjs() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);

        parts.push([
          generateGeneratedByComment(),
          "",
          "\"use strict\";",
          ""
        ].join("\n"));

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push("let " + variable +
              " = require(\"" +
              js.stringEscape(options.dependencies[variable]) +
              "\");"
            );
          });
          parts.push("");
        }

        parts.push([
          toplevelCode,
          "",
          //"module.exports = " + generateParserObject() + ";",
          generateParserObject(),
          ""
        ].join("\n"));

        return parts.join("\n");
      },

      es() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);

        parts.push(
          generateGeneratedByComment(),
          ""
        );

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push("import " + variable +
              " from \"" +
              js.stringEscape(options.dependencies[variable]) +
              "\";"
            );
          });
          parts.push("");
        }

        parts.push(
          toplevelCode,
          "",
          "export " + generateParserExports() + ";",
          ""
        );

        return parts.join("\n");
      },

      amd() {
        let dependencyVars = Object.keys(options.dependencies);
        let dependencyIds = dependencyVars.map(v => options.dependencies[v]);
        let dependencies = "[" +
          dependencyIds.map(
            id => "\"" + js.stringEscape(id) + "\""
          ).join(", ") +
          "]";
        let params = dependencyVars.map(v => v + ": any").join(", ");

        return [
          generateGeneratedByComment(),
          "define(" + dependencies + ", function(" + params + ") {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("return " + generateParserObject() + ";"),
          "});",
          ""
        ].join("\n");
      },

      globals() {
        return [
          generateGeneratedByComment(),
          "(function(root) {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("root." + options.exportVar + " = " + generateParserObject() + ";"),
          "})(this);",
          ""
        ].join("\n");
      },

      umd() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);
        let dependencyIds = dependencyVars.map(v => options.dependencies[v]);
        let dependencies = "[" +
          dependencyIds.map(
            id => "\"" + js.stringEscape(id) + "\""
          ).join(", ") +
          "]";
        let requires = dependencyIds.map(
          id => "require(\"" + js.stringEscape(id) + "\")"
        ).join(", ");
        let params = dependencyVars.map(v => v + ": any").join(", ");

        parts.push([
          generateGeneratedByComment(),
          "(function(root, factory) {",
          "  if (typeof define === \"function\" && define.amd) {",
          "    define(" + dependencies + ", factory);",
          "  } else if (typeof module === \"object\" && module.exports) {",
          "    module.exports = factory(" + requires + ");"
        ].join("\n"));

        if (options.exportVar !== null) {
          parts.push([
            "  } else {",
            "    root." + options.exportVar + " = factory();"
          ].join("\n"));
        }

        parts.push([
          "  }",
          "})(this, function(" + params + ") {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("return " + generateParserObject() + ";"),
          "});",
          ""
        ].join("\n"));

        return parts.join("\n");
      }
    };

    return generators[options.format]();
  }

  ast.code = generateWrapper(generateToplevel());
}

module.exports = generateTS;
