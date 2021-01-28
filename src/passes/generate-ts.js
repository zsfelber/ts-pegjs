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
  const param0 = options.param0 ? options.param0+", " : "";

  /* Features that should be generated in the parser. */
  const features = options.features || {};
  function use( feature, use ) {

      return feature in features
          ? !! features[ feature ]
          : use == null
          ? true
          : !! use;

  }

  // These only indent non-empty lines to avoid trailing whitespace.
  function indent2(code) {
    return code.replace(/^(.+)$/gm, "  $1");
  }
  function indent4(code) {
    return code.replace(/^(.+)$/gm, "    $1");
  }

  function indent12(code) {
    return code.replace(/^(.+)$/gm, "            $1");
  }

  const l = i => "peg$c" + i; // |literals[i]| of the abstract machine
  const r = i => "peg$r" + i; // |classes[i]| of the abstract machine
  const e = i => "peg$e" + i; // |expectations[i]| of the abstract machine
  const f = i => "peg$f" + i; // |actions[i]| of the abstract machine

  function generateTables() {

    function buildLiteral( literal ) {

        return `"${ util.stringEscape( literal ) }"`;

    }

    function buildRegexp( cls ) {

        return "/^["
            + ( cls.inverted ? "^" : "" )
            + cls.value
                .map( part => (

                    Array.isArray( part )
                        ? util.regexpEscape( part[ 0 ] )
                            + "-"
                            + util.regexpEscape( part[ 1 ] )
                        : util.regexpEscape( part )

                ) )
                .join( "" )
            + "]/"
            + ( cls.ignoreCase ? "i" : "" );

    }

    function buildExpectation( e ) {

        switch ( e.type ) {

            case "rule":
                return `peg$otherExpectation("${ util.stringEscape( e.value ) }")`;

            case "literal":
                return "peg$literalExpectation(\""
                       + util.stringEscape( e.value )
                       + "\", "
                       + e.ignoreCase
                       + ")";

            case "class": {

                const parts = e.value.map( part =>
                    ( Array.isArray( part )
                        ? `["${ util.stringEscape( part[ 0 ] ) }", "${ util.stringEscape( part[ 1 ] ) }"]`
                        : `"${ util.stringEscape( part ) }"` ) );

                return "peg$classExpectation(["
                       + parts.join( ", " ) + "], "
                       + e.inverted + ", "
                       + e.ignoreCase
                       + ")";

            }

            case "any":
                return "peg$anyExpectation()";

            // istanbul ignore next
            default:
                session.fatal( `Unknown expectation type (${ JSON.stringify( e ) })` );

        }

    }

    function buildFunc( f ) {

        return `function(${ f.params.join( ", " ) }) {${ f.body }}`;

    }

    if ( options.optimize === "size" ) {

        return [
            "static readonly peg$literals = [",
            indent2( ast.literals.map( buildLiteral ).join( ",\n" ) ),
            "];",
            "static readonly peg$regexps = [",
            indent2( ast.classes.map( buildRegexp ).join( ",\n" ) ),
            "];",
            "static readonly peg$expectations = [",
            indent2( ast.expectations.map( buildExpectation ).join( ",\n" ) ),
            "];",
            "static readonly peg$functions = [",
            indent2( ast.functions.map( buildFunc ).join( ",\n" ) ),
            "];",
            "",
            "static readonly peg$bytecode = [",
            indent2( ast.rules
                .map( rule =>
                    `peg$decode("${
                        util.stringEscape( rule.bytecode
                            .map( b => String.fromCharCode( b + 32 ) )
                            .join( "" ) )
                    }")` )
                .join( ",\n" ) ),
            "];",
        ].join( "\n" );

    }

    return ast.literals
        .map( ( c, i ) => "var " + l( i ) + " = " + buildLiteral( c ) + ";" )
        .concat( "", ast.classes.map(
            ( c, i ) => "var " + r( i ) + " = " + buildRegexp( c ) + ";",
        ) )
        .concat( "", ast.expectations.map(
            ( c, i ) => "var " + e( i ) + " = " + buildExpectation( c ) + ";",
        ) )
        .concat( "", ast.functions.map(
            ( c, i ) => "var " + f( i ) + " = " + buildFunc( c ) + ";",
        ) )
        .join( "\n" );

  }


  function generateRuleHeader( ruleNameCode, ruleIndexCode ) {

      const parts = [];

      parts.push( [
          "",
          "var rule$expects = function (expected) {",
          "  if (peg$silentFails === 0) peg$expect(expected);",
          "}",
          "",
      ].join( "\n" ) );

      if ( options.trace ) {

          parts.push( [
              "peg$tracer.trace({",
              "  type: \"rule.enter\",",
              "  rule: " + ruleNameCode + ",",
              "  location: peg$computeLocation(startPos, startPos)",
              "});",
              "",
          ].join( "\n" ) );

      }

      if ( options.cache ) {

          parts.push( [
              "var key = this.inputBuf.currPos * " + ast.rules.length + " + " + ruleIndexCode + ";",
              "var cached = peg$resultsCache[key];",
              "var rule$expectations = [];",
              "",
              "rule$expects = function (expected) {",
              "  if (peg$silentFails === 0) peg$expect(expected);",
              "  rule$expectations.push(expected);",
              "}",
              "",
              "if (cached) {",
              "  this.inputBuf.currPos = cached.nextPos;",
              "",
              "  rule$expectations = cached.expectations;",
              "  if (peg$silentFails === 0) {",
              "    rule$expectations.forEach(peg$expect);",
              "  }",
              "",
          ].join( "\n" ) );

          if ( options.trace ) {

              parts.push( [
                  "if (cached.result !== peg$FAILED) {",
                  "  peg$tracer.trace({",
                  "    type: \"rule.match\",",
                  "    rule: " + ruleNameCode + ",",
                  "    result: cached.result,",
                  "    location: peg$computeLocation(startPos, this.inputBuf.currPos)",
                  "  });",
                  "} else {",
                  "  peg$tracer.trace({",
                  "    type: \"rule.fail\",",
                  "    rule: " + ruleNameCode + ",",
                  "    location: peg$computeLocation(startPos, startPos)",
                  "  });",
                  "}",
                  "",
              ].join( "\n" ) );

          }

          parts.push( [
              "  return cached.result;",
              "}",
              "",
          ].join( "\n" ) );

      }

      return parts.join( "\n" );

  }

  function generateRuleFooter( ruleNameCode, resultCode ) {

      const parts = [];

      if ( options.cache ) {

          parts.push( [
              "",
              "peg$resultsCache[key] = {",
              "  nextPos: this.inputBuf.currPos,",
              "  result: " + resultCode + ",",
              "  expectations: rule$expectations",
              "};",
          ].join( "\n" ) );

      }

      if ( options.trace ) {

          parts.push( [
              "",
              "if (" + resultCode + " !== peg$FAILED) {",
              "  peg$tracer.trace({",
              "    type: \"rule.match\",",
              "    rule: " + ruleNameCode + ",",
              "    result: " + resultCode + ",",
              "    location: peg$computeLocation(startPos, this.inputBuf.currPos)",
              "  });",
              "} else {",
              "  peg$tracer.trace({",
              "    type: \"rule.fail\",",
              "    rule: " + ruleNameCode + ",",
              "    location: peg$computeLocation(startPos, startPos)",
              "  });",
              "}",
          ].join( "\n" ) );

      }

      parts.push( [
          "",
          "return " + resultCode + ";",
      ].join( "\n" ) );

      return parts.join( "\n" );

  }

    
  function generateInterpreter() {

    const parts = [];

    function generateCondition( cond, argsLength ) {
      const baseLength = argsLength + 3;
      const thenLengthCode = "bc[ip + " + ( baseLength - 2 ) + "]";
      const elseLengthCode = "bc[ip + " + ( baseLength - 1 ) + "]";

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
        "break;",
      ].join( "\n" );

    }

    function generateLoop( cond ) {
      const baseLength = 2;
      const bodyLengthCode = "bc[ip + " + ( baseLength - 1 ) + "]";

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
        "break;",
      ].join( "\n" );

    }

    function generateCall() {
      const baseLength = 4;
      const paramsLengthCode = "bc[ip + " + ( baseLength - 1 ) + "]";

      return [
        "params = bc.slice(ip + " + baseLength + ", ip + " + baseLength + " + " + paramsLengthCode + ")",
        "  .map(function(p) { return stack[stack.length - 1 - p]; });",
        "",
        "stack.splice(",
        "  stack.length - bc[ip + 2],",
        "  bc[ip + 2],",
        "  peg$functions[bc[ip + 1]].apply(this, params)",
        ");",
        "",
        "ip += " + baseLength + " + " + paramsLengthCode + ";",
        "break;",
      ].join( "\n" );
    }

    parts.push([
      "  peg$parseRule(index: number): any {",
      "    const input = this.input;",
      "    const inputBuf = this.inputBuf;",
      "    const peg$consts = PegjsParser.peg$consts;",
      ].join("\n"));


    if ( options.trace ) {
      parts.push( [
        "    const bc = peg$bytecode[index];",
        "    const ip = 0;",
        "    const ips = [];",
        "    const end = bc.length;",
        "    const ends = [];",
        "    const stack = [];",
        "    const startPos = this.inputBuf.currPos;",
        "    const params, paramsLength, paramsN;",
      ].join( "\n"));
    } else {
      parts.push( [
        "    const bc = peg$bytecode[index];",
        "    const ip = 0;",
        "    const ips = [];",
        "    const end = bc.length;",
        "    const ends = [];",
        "    const stack = [];",
        "    var params, paramsLength, paramsN;",
      ].join( "\n"));
    }

    parts.push( indent4( generateRuleHeader( "RuleNames[index]", "index")) );
    // bc[ip]    statement code
    // bc[ip+1]  statement parameter index (used in [peg$/ast.] consts and ast.rules)

    parts.push( [
        // The point of the outer loop and the |ips| & |ends| stacks is to avoid
      // recursive calls for interpreting parts of bytecode. In other words, we
      // implement the |interpret| operation of the abstract machine without
      // function calls. Such calls would likely slow the parser down and more
      // importantly cause stack overflows for complex grammars.
      "    while (true) {",
      "      while (ip < end) {",
      "        switch (bc[ip]) {",
      "          case " + op.PUSH_EMPTY_STRING + ":",  // PUSH_EMPTY_STRING
      "            stack.push('');",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PUSH_UNDEFINED + ":",     // PUSH_UNDEFINED
      "            stack.push(undefined);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PUSH_NULL + ":",          // PUSH_NULL
      "            stack.push(null);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PUSH_FAILED + ":",        // PUSH_FAILED
      "            stack.push(peg$FAILED);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PUSH_EMPTY_ARRAY + ":",   // PUSH_EMPTY_ARRAY
      "            stack.push([]);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PUSH_CURR_POS + ":",      // PUSH_CURR_POS
      "            stack.push(inputBuf.currPos);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.POP + ":",                // POP
      "            stack.pop();",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.POP_CURR_POS + ":",       // POP_CURR_POS
      "            inputBuf.currPos = stack.pop();",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.POP_N + ":",              // POP_N n
      "            stack.length -= bc[ip + 1];",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.NIP + ":",                // NIP
      "            stack.splice(-2, 1);",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.APPEND + ":",             // APPEND
      "            stack[stack.length - 2].push(stack.pop());",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.WRAP + ":",               // WRAP n
      "            stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.TEXT + ":",               // TEXT
      "            stack.push(input.substring(stack.pop(), inputBuf.currPos));",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.PLUCK + ":",               // PLUCK n, k, p1, ..., pK
      "            paramsLength = bc[ip + 2];",
      "            paramsN = 3 + paramsLength",
      "",
      "            params = bc.slice(ip + 3, ip + paramsN);",
      "            params = paramsLength === 1",
      "              ? stack[stack.length - 1 - params[ 0 ]]",
      "              : params.map(function(p) { return stack[stack.length - 1 - p]; });",
      "",
      "            stack.splice(",
      "              stack.length - bc[ip + 1],",
      "              bc[ip + 1],",
      "              params",
      "            );",
      "",
      "            ip += paramsN;",
      "            break;",
      "",
      "          case " + op.IF + ":",                 // IF t, f
      indent12(generateCondition("stack[stack.length - 1]", 0)),
      "",
      "          case " + op.IF_ERROR + ":",           // IF_ERROR t, f
      indent12(generateCondition(
        "stack[stack.length - 1] === peg$FAILED",
        0
     )),
      "",
      "          case " + op.IF_NOT_ERROR + ":",       // IF_NOT_ERROR t, f
      indent12(
        generateCondition("stack[stack.length - 1] !== peg$FAILED",
          0
        )),
      "",
      "          case " + op.WHILE_NOT_ERROR + ":",    // WHILE_NOT_ERROR b
      indent12(generateLoop("stack[stack.length - 1] !== peg$FAILED")),
      "",
      "          case " + op.MATCH_ANY + ":",          // MATCH_ANY a, f, ...
      indent12(generateCondition("input.isAvailableAt(inputBuf.currPos)", 0)),
      "",
      "          case " + op.MATCH_STRING + ":",       // MATCH_STRING s, a, f, ...
      indent12(generateCondition(
        "input.expect(index, peg$literals[bc[ip + 1]] as string)",
        1
      )),
      "",
      "          case " + op.MATCH_STRING_IC + ":",    // MATCH_STRING_IC s, a, f, ...
      indent12(generateCondition(
        "input.expectLowerCase(index, peg$literals[bc[ip + 1]] as string)",
        1
      )),
      "",
      "          case " + op.MATCH_CLASS + ":",        // MATCH_CLASS c, a, f, ...
      indent12(generateCondition(
        "peg$regexps[bc[ip + 1]].test(input.charAt(inputBuf.currPos))",
        1
      )),
      "",
      "          case " + op.ACCEPT_N + ":",           // ACCEPT_N n
      "            stack.push(input.readForward(index, bc[ip + 1]));",
      "            inputBuf.currPos += bc[ip + 1];",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.ACCEPT_STRING + ":",      // ACCEPT_STRING s
      "            stack.push(peg$literals[bc[ip + 1]]);",
      "            inputBuf.currPos += peg$literals[bc[ip + 1]].length;",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.EXPECT + ":",             // EXPECT e
      "            rule$expects(peg$expectations[bc[ip + 1]]);",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.LOAD_SAVED_POS + ":",     // LOAD_SAVED_POS p
      "            inputBuf.savedPos = stack[stack.length - 1 - bc[ip + 1]];",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.UPDATE_SAVED_POS + ":",   // UPDATE_SAVED_POS
      "            inputBuf.savedPos = inputBuf.currPos;",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.CALL + ":",               // CALL f, n, pc, p1, p2, ..., pN
      indent12(generateCall()),
      "",
      "          case " + op.RULE + ":",               // RULE r
      "            stack.push(this.peg$parseRule(bc[ip + 1]));",
      "            ip += 2;",
      "            break;",
      "",
      "          case " + op.SILENT_FAILS_ON + ":",    // SILENT_FAILS_ON
      "            this.peg$silentFails++;",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.SILENT_FAILS_OFF + ":",   // SILENT_FAILS_OFF
      "            this.peg$silentFails--;",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.EXPECT_NS_BEGIN + ":",    // EXPECT_NS_BEGIN
      "            peg$begin();",
      "            ip++;",
      "            break;",
      "",
      "          case " + op.EXPECT_NS_END + ":",      // EXPECT_NS_END invert
      "            peg$end(bc[ip + 1]);",
      "            ip += 2;",
      "            break;",
      "",
      "          // istanbul ignore next",
      "          default:",
      "            throw new Error(",
      "              \"Rule #\" + index + \"" + " ('\" + RuleNames[ index ] + \"')" + ", position \" + ip + \": \"",
      "              + \"Invalid opcode \" + bc[ip] + \".\"",
      "            );",
      "        }",
      "      }",
      "",
      "      if (ends.length > 0) {",
      "        end = ends.pop();",
      "        ip = ips.pop();",
      "      } else {",
      "        break;",
      "      }",
      "    }"
    ].join("\n"));

    parts.push(indent4(generateRuleFooter("RuleNames[index]", "stack[0]")));
    parts.push("  }");

    return parts.join("\n");
  }

  function generateRuleFunction( rule ) {
    const parts = [];
    const stackVars = [];

    function s( i ) {
      // istanbul ignore next
      if ( i < 0 ) session.fatal( "Rule '" + rule.name + "': Var stack underflow: attempt to use var at index " + i );

      return "s" + i;
    } // |stack[i]| of the abstract machine

    const stack = {
      sp: -1,
      maxSp: -1,

      push( exprCode ) {
        const code = s( ++this.sp ) + " = " + exprCode + ";";

        if ( this.sp > this.maxSp ) this.maxSp = this.sp;

        return code;

      },

      pop( n ) {
        if ( typeof n === "undefined" ) return s( this.sp-- );
        const values = Array( n );

        for ( let i = 0; i < n; i++ ) {
          values[ i ] = s( this.sp - n + 1 + i );
        }

        this.sp -= n;

        return values;
      },

      top() {
        return s( this.sp );
      },

      index( i ) {
        return s( this.sp - i );
      },
    };

    function compile( bc ) {

      let ip = 0;
      const end = bc.length;
      const parts = [];
      let value;

      function compileCondition( cond, argCount ) {

        const pos = ip;
        const baseLength = argCount + 3;
        const thenLength = bc[ ip + baseLength - 2 ];
        const elseLength = bc[ ip + baseLength - 1 ];
        const baseSp = stack.sp;
        let thenCode, elseCode, thenSp, elseSp;

        ip += baseLength;
        thenCode = compile( bc.slice( ip, ip + thenLength ) );
        thenSp = stack.sp;
        ip += thenLength;

        if ( elseLength > 0 ) {

          stack.sp = baseSp;
          elseCode = compile( bc.slice( ip, ip + elseLength ) );
          elseSp = stack.sp;
          ip += elseLength;

          // istanbul ignore if
          if ( thenSp !== elseSp ) {

            session.fatal(
                "Rule '" + rule.name + "', position " + pos + ": "
                + "Branches of a condition can't move the stack pointer differently "
                + "(before: " + baseSp + ", after then: " + thenSp + ", after else: " + elseSp + ")."
            );

          }

        }

        parts.push( "if (" + cond + ") {" );
        parts.push( indent2( thenCode ) );
        if ( elseLength > 0 ) {
          parts.push( "} else {" );
          parts.push( indent2( elseCode ) );
        }
        parts.push( "}" );

      }

      function compileLoop( cond ) {

          const pos = ip;
          const baseLength = 2;
          const bodyLength = bc[ ip + baseLength - 1 ];
          const baseSp = stack.sp;
          let bodyCode, bodySp;

          ip += baseLength;
          bodyCode = compile( bc.slice( ip, ip + bodyLength ) );
          bodySp = stack.sp;
          ip += bodyLength;

          // istanbul ignore if
          if ( bodySp !== baseSp ) {

              session.fatal(
                  "Rule '" + rule.name + "', position " + pos + ": "
                  + "Body of a loop can't move the stack pointer "
                  + "(before: " + baseSp + ", after: " + bodySp + ")."
              );

          }

          parts.push( "while (" + cond + ") {" );
          parts.push( indent2( bodyCode ) );
          parts.push( "}" );

      }

      function compileCall() {

          const baseLength = 4;
          const paramsLength = bc[ ip + baseLength - 1 ];

          const value = f( bc[ ip + 1 ] )
              + "("
              + bc
                  .slice( ip + baseLength, ip + baseLength + paramsLength )
                  .map( p => stack.index( p ) )
                  .join( ", " )
              + ")";

          stack.pop( bc[ ip + 2 ] );
          parts.push( stack.push( value ) );
          ip += baseLength + paramsLength;

      }

      while ( ip < end ) {

          switch ( bc[ ip ] ) {

              case op.PUSH_EMPTY_STRING:  // PUSH_EMPTY_STRING
                  parts.push( stack.push( "''" ) );
                  ip++;
                  break;

              case op.PUSH_CURR_POS:      // PUSH_CURR_POS
                  parts.push( stack.push( "this.inputBuf.currPos" ) );
                  ip++;
                  break;

              case op.PUSH_UNDEFINED:     // PUSH_UNDEFINED
                  parts.push( stack.push( "undefined" ) );
                  ip++;
                  break;

              case op.PUSH_NULL:          // PUSH_NULL
                  parts.push( stack.push( "null" ) );
                  ip++;
                  break;

              case op.PUSH_FAILED:        // PUSH_FAILED
                  parts.push( stack.push( "peg$FAILED" ) );
                  ip++;
                  break;

              case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
                  parts.push( stack.push( "[]" ) );
                  ip++;
                  break;

              case op.POP:                // POP
                  stack.pop();
                  ip++;
                  break;

              case op.POP_CURR_POS:       // POP_CURR_POS
                  parts.push( "this.inputBuf.currPos = " + stack.pop() + ";" );
                  ip++;
                  break;

              case op.POP_N:              // POP_N n
                  stack.pop( bc[ ip + 1 ] );
                  ip += 2;
                  break;

              case op.NIP:                // NIP
                  value = stack.pop();
                  stack.pop();
                  parts.push( stack.push( value ) );
                  ip++;
                  break;

              case op.APPEND:             // APPEND
                  value = stack.pop();
                  parts.push( stack.top() + ".push(" + value + ");" );
                  ip++;
                  break;

              case op.WRAP:               // WRAP n
                  parts.push(
                      stack.push( "[" + stack.pop( bc[ ip + 1 ] ).join( ", " ) + "]" )
                  );
                  ip += 2;
                  break;

              case op.TEXT:               // TEXT
                  parts.push(
                      stack.push( "input.substring(" + stack.pop() + ", this.inputBuf.currPos)" )
                  );
                  ip++;
                  break;

              case op.PLUCK:               // PLUCK n, k, p1, ..., pK
                  const baseLength = 3;
                  const paramsLength = bc[ ip + baseLength - 1 ];
                  const n = baseLength + paramsLength;
                  value = bc.slice( ip + baseLength, ip + n );
                  value = paramsLength === 1
                      ? stack.index( value[ 0 ] )
                      : `[ ${
                          value.map( p => stack.index( p ) )
                              .join( ", " )
                      } ]`;
                  stack.pop( bc[ ip + 1 ] );
                  parts.push( stack.push( value ) );
                  ip += n;
                  break;

              case op.IF:                 // IF t, f
                  compileCondition( stack.top(), 0 );
                  break;

              case op.IF_ERROR:           // IF_ERROR t, f
                  compileCondition( stack.top() + " === peg$FAILED", 0 );
                  break;

              case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
                  compileCondition( stack.top() + " !== peg$FAILED", 0 );
                  break;

              case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
                  compileLoop( stack.top() + " !== peg$FAILED", 0 );
                  break;

              case op.MATCH_ANY:          // MATCH_ANY a, f, ...
                  compileCondition( "input.length > this.inputBuf.currPos", 0 );
                  break;

              case op.MATCH_STRING:       // MATCH_STRING s, a, f, ...
                  compileCondition(
                      ast.literals[ bc[ ip + 1 ] ].length > 1
                          ? "input.substr(this.inputBuf.currPos, "
                              + ast.literals[ bc[ ip + 1 ] ].length
                              + ") === "
                              + l( bc[ ip + 1 ] )
                          : "input.charCodeAt(this.inputBuf.currPos) === "
                              + ast.literals[ bc[ ip + 1 ] ].charCodeAt( 0 )
                      , 1
                  );
                  break;

              case op.MATCH_STRING_IC:    // MATCH_STRING_IC s, a, f, ...
                  compileCondition(
                      "input.substr(this.inputBuf.currPos, "
                          + ast.literals[ bc[ ip + 1 ] ].length
                          + ").toLowerCase() === "
                          + l( bc[ ip + 1 ] )
                      , 1
                  );
                  break;

              case op.MATCH_CLASS:        // MATCH_CLASS c, a, f, ...
                  compileCondition( r( bc[ ip + 1 ] ) + ".test(input.charAt(this.inputBuf.currPos))", 1 );
                  break;

              case op.ACCEPT_N:           // ACCEPT_N n
                  parts.push( stack.push(
                      bc[ ip + 1 ] > 1
                          ? "input.substr(this.inputBuf.currPos, " + bc[ ip + 1 ] + ")"
                          : "input.charAt(this.inputBuf.currPos)"
                  ) );
                  parts.push(
                      bc[ ip + 1 ] > 1
                          ? "this.inputBuf.currPos += " + bc[ ip + 1 ] + ";"
                          : "this.inputBuf.currPos++;"
                  );
                  ip += 2;
                  break;

              case op.ACCEPT_STRING:      // ACCEPT_STRING s
                  parts.push( stack.push( l( bc[ ip + 1 ] ) ) );
                  parts.push(
                      ast.literals[ bc[ ip + 1 ] ].length > 1
                          ? "this.inputBuf.currPos += " + ast.literals[ bc[ ip + 1 ] ].length + ";"
                          : "this.inputBuf.currPos++;"
                  );
                  ip += 2;
                  break;

              case op.EXPECT:             // EXPECT e
                  parts.push( "rule$expects(" + e( bc[ ip + 1 ] ) + ");" );
                  ip += 2;
                  break;

              case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS p
                  parts.push( "this.inputBuf.savedPos = " + stack.index( bc[ ip + 1 ] ) + ";" );
                  ip += 2;
                  break;

              case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
                  parts.push( "this.inputBuf.savedPos = this.inputBuf.currPos;" );
                  ip++;
                  break;

              case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
                  compileCall();
                  break;

              case op.RULE:               // RULE r
                  parts.push( stack.push( "peg$parse" + ast.rules[ bc[ ip + 1 ] ].name + "()" ) );
                  ip += 2;
                  break;

              case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
                  parts.push( "peg$silentFails++;" );
                  ip++;
                  break;

              case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
                  parts.push( "peg$silentFails--;" );
                  ip++;
                  break;

              case op.EXPECT_NS_BEGIN:    // EXPECT_NS_BEGIN
                  parts.push( "peg$begin();" );
                  ip++;
                  break;

              case op.EXPECT_NS_END:      // EXPECT_NS_END invert
                  parts.push( "peg$end(" + ( bc[ ip + 1 ] !== 0 ) + ");" );
                  ip += 2;
                  break;

              // istanbul ignore next
              default:
                session.fatal(
                    "Rule '" + rule.name + "', position " + ip + ": "
                    + "Invalid opcode " + bc[ ip ] + ".",
                );

            }

        }

        return parts.join( "\n" );

    }

    const code = compile( rule.bytecode );

    parts.push( "function peg$parse" + rule.name + "() {" );

    if ( options.trace ) {

        parts.push( "  var startPos = this.inputBuf.currPos;" );

    }

    for ( let i = 0; i <= stack.maxSp; i++ ) {

        stackVars[ i ] = s( i );

    }

    parts.push( "  var " + stackVars.join( ", " ) + ";" );

    parts.push( indent2( generateRuleHeader(
        "\"" + util.stringEscape( rule.name ) + "\"",
        ast.indexOfRule( rule.name ),
    ) ) );
    parts.push( indent2( code ) );
    parts.push( indent2( generateRuleFooter(
        "\"" + util.stringEscape( rule.name ) + "\"",
        s( 0 ),
    ) ) );

    parts.push( "}" );

    return parts.join( "\n" );

  }

  function generateToplevel() {
    let parts = [];

    // interfaces removed from here , it is better to import

    var r0 = options.allowedStartRules.length===1 ? options.allowedStartRules[0] : "";
    var startType = ast.inferredTypes[r0];
    startType = startType ? ": "+startType : "";

    
    parts.push([
      "export interface IParseOptions {",
      "  filename?: string;",
      "  startRule?: (string | RuleId);",
      "  tracer?: any;",
      "  [key: string]: any;",
      "}",
      "",
      "const peg$FAILED: Readonly<any> = {};",
      "",
    ].join("\n"));

    parts.push([
      "",
      "function peg$literalExpectation(text1: string, ignoreCase: boolean): ILiteralExpectation {",
      "  return { type: \"literal\", text: text1, ignoreCase: ignoreCase };",
      "}",
      "",
      "function peg$classExpectation(parts: IClassParts, inverted: boolean, ignoreCase: boolean): IClassExpectation {",
      "  return { type: \"class\", parts: parts, inverted: inverted, ignoreCase: ignoreCase };",
      "}",
      "",
      "function peg$anyExpectation(): IAnyExpectation {",
      "  return { type: \"any\" };",
      "}",
      "",
      "function peg$endExpectation(): IEndExpectation {",
      "  return { type: \"end\" };",
      "}",
      "",
      "function peg$otherExpectation(description: string): IOtherExpectation {",
      "  return { type: \"other\", description: description };",
      "}",
      "",
      "function peg$decode(s: string): number[] {",
      "  return s.split(\"\").map((ch) =>  ch.charCodeAt(0) - 32 );",
      "}",
      "",
      ].join("\n"));




      if (options.optimize === "size") {
        parts.push([
          "const peg$startRuleIndices = new Map<RuleId,number>();",
        ].join("\n"));

        parts.push(options.allowedStartRules.map(
          r => "peg$startRuleIndices.set(RuleId."+r + ", " + asts.indexOfRule(ast, r)+");"
        ).join("\n"));

      } else {
        let startRuleFunctions = "new Map<RuleId,() => any>(); " +
          options.allowedStartRules.map(
            r => "peg$startRuleFunctions[RuleId."+r + "] = peg$parse" + r
          ).join("; ") +
          "";
        let startRuleFunction = "peg$parse" + options.allowedStartRules[0];
  
        parts.push([
          "  const peg$startRuleFunctions = " + startRuleFunctions + ";",
          "  let peg$startRuleFunction: () => any = " + startRuleFunction + ";"
        ].join("\n"));
      }
  
      parts.push("");

    parts.push([
      "export class PegjsParser<I extends ParseStream> {",
      "",
      "  input: I;",
      "  inputBuf: IPegjsParseStreamBuffer2;",
      "",
      "  peg$maxFailPos = 0;",
      "  peg$maxFailExpected: Expectation[] = [];",
      "  peg$expected = [];",
      "  peg$silentFails = 0;", // 0 = report failures, > 0 = silence failures
      "  peg$result;",
      "",
      "  get result"+startType+"() { return this.peg$result; }",
      "",
    ].join("\n"));

    if (options.tspegjs.customFields) {
      parts.push(indent2(
        options.tspegjs.customFields
      .join("\n")));
    }

    if (options.cache) {
      parts.push([
        "  readonly peg$resultsCache: {[id: number]: ICached} = {};",
        ""
      ].join("\n"));
    }

    parts.push([
      "  constructor("+param0+"input: I, options?: IParseOptions) {",
      "    this.input = input;",
      "    this.inputBuf = input.buffer;",
      "    options = options !== undefined ? options : {};",
      ""
    ].join("\n"));

    if (options.tspegjs.customInit) {
      parts.push(indent4(
        options.tspegjs.customInit
      .join("\n")));
    }


    
    if (options.optimize === "size") {
      let startRuleIndex = asts.indexOfRule(ast, options.allowedStartRules[0]);

      parts.push([
        "    let peg$startRuleIndex = " + startRuleIndex + ";"
      ].join("\n"));
    }

    parts.push([
      "",
      "    // inputBuf.currPos = 0;",
      "    // inputBuf.savedPos = 0;",
      ""
    ].join("\n"));


    if (options.trace) {
        if ( use( "DefaultTracer" ) )
            parts.push( [
                "  var peg$tracer = \"tracer\" in options ? options.tracer : new peg$DefaultTracer();",
                "",
            ].join( "\n" ) );
        else
            parts.push( [
                "  var peg$tracer = \"tracer\" in options ? options.tracer : peg$FauxTracer;",
                "",
            ].join( "\n" ) );
    }

    parts.push([
      ""
    ].join("\n"));

    if (options.optimize === "size") {
      parts.push([
        "    if (options.startRule !== undefined) {",
        "      var ri = typeof options.startRule === \"string\"?eval(\"RuleId.\"+options.startRule):options.startRule;",
        "      if (!(peg$startRuleIndices.get(ri))) {",
        "        throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
        "      }",
        "",
        "      peg$startRuleIndex = ri;",
        "    }"
      ].join("\n"));
    } else {
      parts.push([
        "    if (options.startRule !== undefined) {",
        "      var ri = typeof options.startRule===\"string\"?eval(\"RuleId.\"+options.startRule):options.startRule;",
        "      if (!(peg$startRuleFunctions.get(ri))) {",
        "        throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
        "      }",
        "",
        "      peg$startRuleFunction = peg$startRuleFunctions[ri];",
        "    }"
      ].join("\n"));
    }

    if ( use( "text" ) ) {

        parts.push( [
            "",
            "  function text() {",
            "    return input.substring(peg$savedPos, peg$currPos);",
            "  }",
        ].join( "\n" ) );

    }

    if ( use( "offset" ) ) {

        parts.push( [
            "",
            "  function offset() {",
            "    return peg$savedPos;",
            "  }",
        ].join( "\n" ) );

    }

    if ( use( "range" ) ) {

        parts.push( [
            "",
            "  function range() {",
            "    return [peg$savedPos, peg$currPos];",
            "  }",
        ].join( "\n" ) );

    }

    if ( use( "location" ) ) {

        parts.push( [
            "",
            "  function location() {",
            "    return peg$computeLocation(peg$savedPos, peg$currPos);",
            "  }",
        ].join( "\n" ) );

    }

    if ( use( "expected" ) ) {

        parts.push( [
            "",
            "  function expected(description, location) {",
            "    location = location !== undefined",
            "      ? location",
            "      : peg$computeLocation(peg$savedPos, peg$currPos);",
            "",
            "    throw peg$buildStructuredError(",
            "      [peg$otherExpectation(description)],",
            "      input.substring(peg$savedPos, peg$currPos),",
            "      location",
            "    );",
            "  }",
        ].join( "\n" ) );

    }

    if ( use( "error" ) ) {

        parts.push( [
            "",
            "  function error(message, location) {",
            "    location = location !== undefined",
            "      ? location",
            "      : peg$computeLocation(peg$savedPos, peg$currPos);",
            "",
            "    throw peg$buildSimpleError(message, location);",
            "  }",
        ].join( "\n" ) );

    }


    if (ast.initializer) {
      parts.push(indent4(ast.initializer.code));
      parts.push("");
    }
    parts.push("");
    parts.push("");

    parts.push("    peg$begin();");

    if (options.optimize === "size") {
      parts.push("    this.peg$result = this.peg$parseRule(peg$startRuleIndex);");
    } else {
      parts.push("    this.peg$result = this.peg$startRuleFunction();");
    }

    parts.push([
      "",
      "    if (this.peg$result !== peg$FAILED) {",
      "      if (input.isAvailableAt(this.inputBuf.currPos)) {",
      "        this.peg$expect(peg$endExpectation());",
      "      } else {",
      "        return;",
      "      }",
      "    }",
      "",
      "    throw peg$buildError();",
      "",
      "  }"
    ].join("\n"));


    parts.push([
      "",
      "  peg$computeLocation(startPos: number, endPos: number): IFileRange {",
      "    const startPosDetails = this.input.calculatePosition(startPos);",
      "    const endPosDetails = this.input.calculatePosition(endPos);",
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
      "  peg$begin() {",
      "    this.peg$expected.push({ pos: this.inputBuf.currPos, variants: [] });",
      "  }",
      "",
      "  peg$expect(expected) {",
      "    var top = this.peg$expected[this.peg$expected.length - 1];",
      "",
      "    if (this.inputBuf.currPos < top.pos) { return; }",
      "",
      "    if (this.inputBuf.currPos > top.pos) {",
      "      top.pos = this.inputBuf.currPos;",
      "      top.variants = [];",
      "    }",
      "",
      "    top.variants.push(expected);",
      "  }",
      "",
      "  peg$end(invert) {",
      "    var expected = peg$expected.pop();",
      "    var top = peg$expected[peg$expected.length - 1];",
      "    var variants = expected.variants;",
      "",
      "    if (top.pos !== expected.pos) { return; }",
      "",
      "    if (invert) {",
      "      variants = variants.map(function(e) {",
      "        return e.type === \"not\" ? e.expected : { type: \"not\", expected: e };",
      "      });",
      "    }",
      "",
      "    Array.prototype.push.apply(top.variants, variants);",
      "  }",
      "",
      "  peg$buildSimpleError(message, location) {",
      "    return new peg$SyntaxError(message, null, null, location);",
      "  }",
      "",
      "  peg$buildStructuredError(expected, found, location) {",
      "    return new peg$SyntaxError(",
      "      peg$SyntaxError.buildMessage(expected, found, location),",
      "      expected,",
      "      found,",
      "      location",
      "    );",
      "  }",
      "",
      "  peg$buildError() {",
      "    var expected = peg$expected[0];",
      "    var failPos = expected.pos;",
      "",
      "    throw this.peg$buildStructuredError(",
      "      expected.variants,",
      "      input.isAvailableAt(failPos) ? input.charAt(failPos) : null,",
      "      failPos",
      "    );",
      "  }",
      ""
      ].join("\n"));

    if (options.optimize === "size") {
      parts.push(generateInterpreter());
      parts.push("");
    } else {
      ast.rules.forEach(rule => {
        parts.push(generateRuleFunction(rule));
        parts.push("");
      });
    }
    parts.push([
      "",
      "",
    ].join("\n"));

    parts.push(indent2(generateTables()));

    parts.push([
      "",
      "}",
      ""
    ].join("\n"));

    return parts.join("\n");
  }

  function generateWrapper(toplevelCode) {
    function generateGeneratedByComment() {
      let res = [];
      
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

      var customHeader = "";
      if (options.tspegjs.customHeader) {
        customHeader = options.tspegjs.customHeader;
      }

      res = res.concat([
        "import { IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IPegjsParseStream, PegjsParseStream, IPegjsParseStreamBuffer, IPegjsParseStreamBuffer2 } from 'ts-pegjs/lib';",
        "",
        "// Generated by PEG.js v. " + pegJsVersion + " (ts-pegjs plugin v. " + pluginVersion + " )",
        "//",
        "// https://pegjs.org/   https://github.com/metadevpro/ts-pegjs",
        "//",
        "",
        ruleNamesEtc,
        customHeader,
        "",

      ]);

      return res.join("\n");
    }

    function generateParserObject() {
      const streamTypeI = `export interface IParseStream extends IPegjsParseStream {

  // should return this.substr(inputBuf.currPos, len)
  readForward(rule: RuleId, len: number): string;

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: RuleId, expectedText: string): boolean;

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectLowerCase(rule: RuleId, expectedText: string): boolean;

}`;
    const streamType = `export class ParseStream extends PegjsParseStream {

  /** NOTE string also implements IPegjsParseStreamBuffer 
    * buffer initialized as "" if initialBuf is omitted
    */
  constructor(initialBuf?: IPegjsParseStreamBuffer) {
    super(initialBuf, RuleNames);
  }
  // should return this.substr(inputBuf.currPos, len)
  readForward(rule: RuleId, len: number): string {
    return super.readForward(rule, len);
  }

  //"input.readForward(rule, expectedText.length) === expectedText",
  //=
  //"input.expect(rule, expectedText)",
  expect(rule: RuleId, expectedText: string): boolean {
    return super.expect(rule, expectedText);
  }

  //"input.readForward(rule, expectedText.length).toLowerCase() === expectedText",
  //=
  //"input.expectLowerCase(rule, expectedText)",
  expectLowerCase(rule: RuleId, expectedText: string): boolean {
    return super.expectLowerCase(rule, expectedText);
  }

}`;


      return options.trace ?
        [
          streamTypeI,
          streamType,
          // "{",
          // "  SyntaxError: peg$SyntaxError,",
          // "  DefaultTracer: peg$DefaultTracer,",
          // "  parse: peg$parse",
          // "}"
        ].join("\n") :
        [
          streamTypeI,
          streamType,
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
          indent4(toplevelCode),
          "",
          indent4("return " + generateParserObject() + ";"),
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
          indent4(toplevelCode),
          "",
          indent4("root." + options.exportVar + " = " + generateParserObject() + ";"),
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
          indent4(toplevelCode),
          "",
          indent4("return " + generateParserObject() + ";"),
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
