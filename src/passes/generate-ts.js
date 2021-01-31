/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

var asts = require('pegjs/lib/compiler/asts');
var js = require('pegjs/lib/compiler/js');
var op = require('pegjs/lib/compiler/opcodes');
var pluginVersion = require('../../package.json').version;
var pegJsVersion = require('pegjs/package.json').version;

// Generates parser JavaScript code.
function generateTS(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  //options.returnTypes = {};
  const param0 = options.param0 ? options.param0 + ', ' : '';

  // These only indent non-empty lines to avoid trailing whitespace.
  function indent2(code) {
    return code.replace(/^(.+)$/gm, '  $1');
  }
  function indent4(code) {
    return code.replace(/^(.+)$/gm, '    $1');
  }

  function indent12(code) {
    return code.replace(/^(.+)$/gm, '            $1');
  }

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    let parts = [];

    parts.push('');

    if (options.trace) {
      parts.push(
        [
          'peg$tracer.trace({',
          '  type: "rule.enter",',
          '  rule: ' + ruleNameCode + ',',
          '  location: this.peg$computeLocation(startPos, inputBuf.currPos)',
          '});',
          ''
        ].join('\n')
      );
    }

    if (options.profiling) {
      parts.push(
        [
          'var rnm = RuleNames[index];',
          'var ruleEntries = pushc(ProfilingInfo.ruleEntries, rnm);',
          'var ruleOfMainEntries = pushc(mainEntries, rnm);',
          'ruleEntries.totalcnt++;',
          'ruleOfMainEntries.totalcnt++;'
        ].join('\n'));
    }

    if (options.cache) {
      parts.push(
        [
          'const key = inputBuf.currPos * ' +
          ast.rules.length +
          ' + ' +
          ruleIndexCode +
          ';',
          'const cached: ICached = this.peg$resultsCache[key];',
          'let position: number;',
          '',
          'if (cached) {',
          '  inputBuf.currPos = cached.nextPos;',
          ''
        ].join('\n')
      );

      if (options.trace) {
        parts.push(
          [
            'if (cached.result !== peg$FAILED) {',
            '  peg$tracer.trace({',
            '    type: "rule.match",',
            '    rule: ' + ruleNameCode + ',',
            '    result: cached.result,',
            '    cached: true,',
            '    location: this.peg$computeLocation(startPos, inputBuf.currPos)',
            '  });',
            '} else {',
            '  peg$tracer.trace({',
            '    type: "rule.fail",',
            '    rule: ' + ruleNameCode + ',',
            '    cached: true,',
            '    location: this.peg$computeLocation(startPos, cached.maxFailPos)',
            '  });',
            '}',
            ''
          ].join('\n')
        );
      }

      parts.push(['  return cached.result;', '}', ''].join('\n'));
    }

    if (options.profiling) {
      parts.push([
        'ProfilingInfo.childcnt++;',
        'ruleEntries.noncachedcnt=ruleEntries.noncachedcnt?ruleEntries.noncachedcnt+1:1;',
        'ruleOfMainEntries.noncachedcnt=ruleOfMainEntries.noncachedcnt?ruleOfMainEntries.noncachedcnt+1:1;'
      ].join('\n'));
    }

    return parts.join('\n');
  }

  function generateRuleFooter(ruleNameCode, resultCode) {
    let parts = [];

    if (options.cache) {
      parts.push(
        [
          '',
          'this.peg$resultsCache[key] = { nextPos: inputBuf.currPos, maxFailPos: ruleMaxFailPos, result: ' +
          resultCode +
          ' };'
        ].join('\n')
      );
    }

    if (options.trace) {
      parts.push(
        [
          '',
          'if (' + resultCode + ' !== peg$FAILED) {',
          '  peg$tracer.trace({',
          '    type: "rule.match",',
          '    rule: ' + ruleNameCode + ',',
          '    result: ' + resultCode + ',',
          '    location: this.peg$computeLocation(startPos, inputBuf.currPos)',
          '  });',
          '} else {',
          '  peg$tracer.trace({',
          '    type: "rule.fail",',
          '    rule: ' + ruleNameCode + ',',
          '    location: this.peg$computeLocation(startPos, ruleMaxFailPos)',
          '  });',
          '}'
        ].join('\n')
      );
    }

    parts.push(['', 'return ' + resultCode + ';'].join('\n'));

    return parts.join('\n');
  }

  function generateInterpreter() {
    let parts = [];

    function generateCondition(cond, argsLength) {
      let baseLength = argsLength + 3;
      let thenLengthCode = 'bc[ip + ' + (baseLength - 2) + ']';
      let elseLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'ends.push(end);',
        'ips.push(ip + ' +
        baseLength +
        ' + ' +
        thenLengthCode +
        ' + ' +
        elseLengthCode +
        ');',
        '',
        'if (' + cond + ') {',
        '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  end = ip + ' +
        baseLength +
        ' + ' +
        thenLengthCode +
        ' + ' +
        elseLengthCode +
        ';',
        '  ip += ' + baseLength + ' + ' + thenLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateLoop(cond) {
      let baseLength = 2;
      let bodyLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'if (' + cond + ') {',
        '  ends.push(end);',
        '  ips.push(ip);',
        '',
        '  end = ip + ' + baseLength + ' + ' + bodyLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  ip += ' + baseLength + ' + ' + bodyLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateCall() {
      let baseLength = 4;
      let paramsLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'params = bc.slice(ip + ' +
        baseLength +
        ', ip + ' +
        baseLength +
        ' + ' +
        paramsLengthCode +
        ')',
        '  .map(function(p) { return stack[stack.length - 1 - p]; });',
        '',
        'stack.splice(',
        '  stack.length - bc[ip + 2],',
        '  bc[ip + 2],',
        '  (peg$consts[bc[ip + 1]] as ((...args: any[]) => any)).apply(this, params)',
        ');',
        '',
        'ip += ' + baseLength + ' + ' + paramsLengthCode + ';',
        'break;'
      ].join('\n');
    }

    parts.push(
      [
        '  peg$parseRule(index: number): any {',
        '    const input = this.input;',
        '    const inputBuf = this.inputBuf;',
        '    this.currentRule = index;'
      ].join('\n')
    );

    if (options.trace) {
      parts.push(
        [
          '    const bc = peg$bytecode[index];',
          '    let ip = 0;',
          '    const ips: any[] = [];',
          '    let end = bc.length;',
          '    const ends: any[] = [];',
          '    const stack: any[] = [];',
          '    let startPos = inputBuf.currPos;',
          '    let ruleMaxFailPos = inputBuf.currPos;',
          '    let params;'
        ].join('\n')
      );
    } else {
      parts.push(
        [
          '    const bc = peg$bytecode[index];',
          '    let ip = 0;',
          '    const ips: any[] = [];',
          '    let end = bc.length;',
          '    const ends: any[] = [];',
          '    const stack: any[] = [];',
          '    let ruleMaxFailPos = inputBuf.currPos;',
          '    let params;'
        ].join('\n')
      );
    }

    parts.push(indent4(generateRuleHeader('RuleNames[index]', 'index')));

    // bc[ip]    statement code
    // bc[ip+1]  statement parameter index (used in [peg$/ast.] consts and ast.rules)

    parts.push(
      [
        // The point of the outer loop and the |ips| & |ends| stacks is to avoid
        // recursive calls for interpreting parts of bytecode. In other words, we
        // implement the |interpret| operation of the abstract machine without
        // function calls. Such calls would likely slow the parser down and more
        // importantly cause stack overflows for complex grammars.
        '    while (true) {',
        '      while (ip < end) {',
        '        switch (bc[ip]) {',
        '          case ' + op.PUSH + ':', // PUSH c
        '            stack.push(peg$consts[bc[ip + 1]]);',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.PUSH_UNDEFINED + ':', // PUSH_UNDEFINED
        '            stack.push(undefined);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.PUSH_NULL + ':', // PUSH_NULL
        '            stack.push(null);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.PUSH_FAILED + ':', // PUSH_FAILED
        '            stack.push(peg$FAILED);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.PUSH_EMPTY_ARRAY + ':', // PUSH_EMPTY_ARRAY
        '            stack.push([]);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.PUSH_CURR_POS + ':', // PUSH_CURR_POS
        '            stack.push(inputBuf.currPos);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.POP + ':', // POP
        '            stack.pop();',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.POP_CURR_POS + ':', // POP_CURR_POS
        '            inputBuf.currPos = stack.pop();',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.POP_N + ':', // POP_N n
        '            stack.length -= bc[ip + 1];',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.NIP + ':', // NIP
        '            stack.splice(-2, 1);',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.APPEND + ':', // APPEND
        '            stack[stack.length - 2].push(stack.pop());',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.WRAP + ':', // WRAP n
        '            stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.TEXT + ':', // TEXT
        '            stack.push(input.substring(stack.pop(), inputBuf.currPos));',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.IF + ':', // IF t, f
        indent12(generateCondition('stack[stack.length - 1]', 0)),
        '',
        '          case ' + op.IF_ERROR + ':', // IF_ERROR t, f
        indent12(generateCondition('stack[stack.length - 1] === peg$FAILED', 0)),
        '',
        '          case ' + op.IF_NOT_ERROR + ':', // IF_NOT_ERROR t, f
        indent12(generateCondition('stack[stack.length - 1] !== peg$FAILED', 0)),
        '',
        '          case ' + op.WHILE_NOT_ERROR + ':', // WHILE_NOT_ERROR b
        indent12(generateLoop('stack[stack.length - 1] !== peg$FAILED')),
        '',
        '          case ' + op.MATCH_ANY + ':', // MATCH_ANY a, f, ...
        //indent10(generateCondition("input.length > inputBuf.currPos", 0)),
        indent12(generateCondition('input.isAvailableAt(inputBuf.currPos)', 0)),
        '',
        '          case ' + op.MATCH_STRING + ':', // MATCH_STRING s, a, f, ...
        indent12(
          generateCondition('input.expect(index, peg$consts[bc[ip + 1]] as string)', 1)
        ),
        '',
        '          case ' + op.MATCH_STRING_IC + ':', // MATCH_STRING_IC s, a, f, ...
        indent12(
          generateCondition(
            'input.expectLowerCase(index, peg$consts[bc[ip + 1]] as string)',
            1
          )
        ),
        '',
        '          case ' + op.MATCH_REGEXP + ':', // MATCH_REGEXP r, a, f, ...
        indent12(
          generateCondition(
            '(peg$consts[bc[ip + 1]] as any as RegExp).test(input.charAt(inputBuf.currPos))',
            1
          )
        ),
        '',
        '          case ' + op.ACCEPT_N + ':', // ACCEPT_N n
        '            stack.push(input.readForward(index, bc[ip + 1]));',
        '            inputBuf.currPos += bc[ip + 1];',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.ACCEPT_STRING + ':', // ACCEPT_STRING s
        '            stack.push(peg$consts[bc[ip + 1]]);',
        '            inputBuf.currPos += (peg$consts[bc[ip + 1]] as string).length;',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.FAIL + ':', // FAIL e
        '            stack.push(peg$FAILED);',
        '            if (this.peg$silentFails === 0) {',
        '              if (input.currPos >= ruleMaxFailPos) {',
        '                ruleMaxFailPos = input.currPos;',
        '                this.peg$fail(peg$consts[bc[ip + 1]] as ILiteralExpectation);',
        '              }',
        '            }',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.LOAD_SAVED_POS + ':', // LOAD_SAVED_POS p
        '            inputBuf.savedPos = stack[stack.length - 1 - bc[ip + 1]];',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.UPDATE_SAVED_POS + ':', // UPDATE_SAVED_POS
        '            inputBuf.savedPos = inputBuf.currPos;',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.CALL + ':', // CALL f, n, pc, p1, p2, ..., pN
        indent12(generateCall()),
        '',
        '          case ' + op.RULE + ':', // RULE r
        '            stack.push(this.peg$parseRule(bc[ip + 1]));',
        '            this.currentRule = index;',
        '            ip += 2;',
        '            break;',
        '',
        '          case ' + op.SILENT_FAILS_ON + ':', // SILENT_FAILS_ON
        '            this.peg$silentFails++;',
        '            ip++;',
        '            break;',
        '',
        '          case ' + op.SILENT_FAILS_OFF + ':', // SILENT_FAILS_OFF
        '            this.peg$silentFails--;',
        '            ip++;',
        '            break;',
        '',
        '          default:',
        '            throw new Error("Invalid opcode: " + bc[ip] + ".");',
        '        }',
        '      }',
        '',
        '      if (ends.length > 0) {',
        '        end = ends.pop();',
        '        ip = ips.pop();',
        '      } else {',
        '        break;',
        '      }',
        '    }'
      ].join('\n')
    );

    parts.push(indent4(generateRuleFooter('RuleNames[index]', 'stack[0]')));
    parts.push('  }');

    return parts.join('\n');
  }

  function generateRuleFunction(rule) {
    let parts = [];
    let stackVars = [];
    let code;

    function c(i) {
      return 'peg$c' + i;
    } // |consts[i]| of the abstract machine
    function s(i) {
      return 's' + i;
    } // |stack[i]| of the abstract machine

    let stack = {
      sp: -1,
      maxSp: -1,

      push(exprCode) {
        let code = s(++this.sp) + ' = ' + exprCode + ';';

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
              'Branches of a condition must move the stack pointer in the same way.'
            );
          }
        }

        parts.push('if (' + cond + ') {');
        parts.push(indent4(thenCode));
        if (elseLength > 0) {
          parts.push('} else {');
          parts.push(indent4(elseCode));
        }
        parts.push('}');
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

        parts.push('while (' + cond + ') {');
        parts.push(indent4(bodyCode));
        parts.push('}');
      }

      function compileCall() {
        let baseLength = 4;
        let paramsLength = bc[ip + baseLength - 1];

        let value =
          c(bc[ip + 1]) +
          '(' +
          bc
            .slice(ip + baseLength, ip + baseLength + paramsLength)
            .map((p) => stack.index(p))
            .join(', ') +
          ')';
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
            //parts.push(stack.push("inputBuf.currPos"));
            stack.push('inputBuf.currPos');
            parts.push('position = inputBuf.currPos;');
            ip++;
            break;

          case op.PUSH_UNDEFINED: // PUSH_UNDEFINED
            parts.push(stack.push('undefined'));
            ip++;
            break;

          case op.PUSH_NULL: // PUSH_NULL
            parts.push(stack.push('null'));
            ip++;
            break;

          case op.PUSH_FAILED: // PUSH_FAILED
            parts.push(stack.push('peg$FAILED'));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY: // PUSH_EMPTY_ARRAY
            parts.push(stack.push('[]'));
            ip++;
            break;

          case op.POP: // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS: // POP_CURR_POS
            //parts.push("inputBuf.currPos = " + stack.pop() + ";");
            stack.pop();
            parts.push('inputBuf.currPos = position;');
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
            parts.push(stack.top() + '.push(' + value + ');');
            ip++;
            break;

          case op.WRAP: // WRAP n
            parts.push(stack.push('[' + stack.pop(bc[ip + 1]).join(', ') + ']'));
            ip += 2;
            break;

          case op.TEXT: // TEXT
            parts.push(
              stack.push('input.substring(' + stack.pop() + ', inputBuf.currPos)')
            );
            ip++;
            break;

          case op.IF: // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR: // IF_ERROR t, f
            compileCondition(stack.top() + ' === peg$FAILED', 0);
            break;

          case op.IF_NOT_ERROR: // IF_NOT_ERROR t, f
            compileCondition(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.WHILE_NOT_ERROR: // WHILE_NOT_ERROR b
            compileLoop(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.MATCH_ANY: // MATCH_ANY a, f, ...
            //compileCondition("input.length > inputBuf.currPos", 0);
            compileCondition('input.isAvailableAt(inputBuf.currPos)', 0);
            break;

          case op.MATCH_STRING: // MATCH_STRING s, a, f, ...
            compileCondition(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'input.readForward(RuleId.' +
                rule.name +
                ', ' +
                eval(ast.consts[bc[ip + 1]]).length +
                ') === ' +
                c(bc[ip + 1])
                : 'input.charCodeAt(inputBuf.currPos) === ' +
                eval(ast.consts[bc[ip + 1]]).charCodeAt(0),
              1
            );
            break;

          case op.MATCH_STRING_IC: // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              'input.readForward(RuleId.' +
              rule.name +
              ', ' +
              eval(ast.consts[bc[ip + 1]]).length +
              ').toLowerCase() === ' +
              c(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_REGEXP: // MATCH_REGEXP r, a, f, ...
            compileCondition(
              c(bc[ip + 1]) + '.test(input.charAt(inputBuf.currPos))',
              1
            );
            break;

          case op.ACCEPT_N: // ACCEPT_N n
            parts.push(
              stack.push(
                bc[ip + 1] > 1
                  ? 'input.readForward(RuleId.' +
                  rule.name +
                  ', ' +
                  bc[ip + 1] +
                  ')'
                  : 'input.charAt(inputBuf.currPos)'
              )
            );
            parts.push(
              bc[ip + 1] > 1
                ? 'inputBuf.currPos += ' + bc[ip + 1] + ';'
                : 'inputBuf.currPos++;'
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING: // ACCEPT_STRING s
            parts.push(stack.push(c(bc[ip + 1])));
            parts.push(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'inputBuf.currPos += ' + eval(ast.consts[bc[ip + 1]]).length + ';'
                : 'inputBuf.currPos++;'
            );
            ip += 2;
            break;

          case op.FAIL: // FAIL e
            parts.push(stack.push('peg$FAILED'));
            parts.push(
              'if (this.peg$silentFails === 0) { this.peg$fail(' +
              c(bc[ip + 1]) +
              '); }'
            );
            ip += 2;
            break;

          case op.LOAD_SAVED_POS: // LOAD_SAVED_POS p
            //parts.push("inputBuf.savedPos = " + stack.index(bc[ip + 1]) + ";");
            parts.push('inputBuf.savedPos = position;');
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS: // UPDATE_SAVED_POS
            parts.push('inputBuf.savedPos = inputBuf.currPos;');
            ip++;
            break;

          case op.CALL: // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE: // RULE r
            parts.push(stack.push('peg$parse' + ast.rules[bc[ip + 1]].name + '()'));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON: // SILENT_FAILS_ON
            parts.push('this.peg$silentFails++;');
            ip++;
            break;

          case op.SILENT_FAILS_OFF: // SILENT_FAILS_OFF
            parts.push('this.peg$silentFails--;');
            ip++;
            break;

          default:
            throw new Error('Invalid opcode: ' + bc[ip] + '.');
        }
      }

      return parts.join('\n');
    }

    code = compile(rule.bytecode);

    var outputType = ast.inferredTypes[rule.name];
    outputType = outputType ? ': ' + outputType : '';

    parts.push('function peg$parse' + rule.name + '()' + outputType + ' {');

    if (options.trace) {
      parts.push('  const startPos = inputBuf.currPos;');
    }

    for (let i = 0; i <= stack.maxSp; i++) {
      stackVars[i] = s(i);
    }

    parts.push('  let ' + stackVars.join(', ') + ';');

    parts.push(
      indent4(
        generateRuleHeader(
          '"' + js.stringEscape(rule.name) + '"',
          asts.indexOfRule(ast, rule.name)
        )
      )
    );
    parts.push(indent4(code));
    parts.push(indent4(generateRuleFooter('"' + js.stringEscape(rule.name) + '"', s(0))));

    parts.push('}');

    return parts.join('\n');
  }

  function generateToplevel() {
    let parts = [];

    // interfaces removed from here , it is better to import

    var r0 = options.allowedStartRules.length === 1 ? options.allowedStartRules[0] : '';
    var startType = ast.inferredTypes[r0];
    startType = startType ? ': ' + startType : '';

    parts.push(
      [
        'export interface IParseOptions {',
        '  filename?: string;',
        '  startRule?: (string | RuleId);',
        '  tracer?: any;',
        '  [key: string]: any;',
        '  customCache?: {[id: number]: ICached};',
        '}',
        ''
      ].join('\n')
    );

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


    parts.push(['', streamTypeI, '', streamType, '', ''].join('\n'));

    if (options.optimize === 'size') {
      parts.push('');
    } else {
      let startRuleFunctions =
        'new Map<RuleId,() => any>(); ' +
        options.allowedStartRules
          .map((r) => 'peg$startRuleFunctions[RuleId.' + r + '] = peg$parse' + r)
          .join('; ') +
        '';
      let startRuleFunction = 'peg$parse' + options.allowedStartRules[0];

      parts.push(
        [
          '  const peg$startRuleFunctions = ' + startRuleFunctions + ';',
          '  let peg$startRuleFunction: () => any = ' + startRuleFunction + ';'
        ].join('\n')
      );
    }

    if (options.profiling) {
      const ProfilingInfo = `
export var ProfilingInfo = {
    mainEntries: {

    },
    ruleEntries: {

    },
    childcnt: 0
};

var mainEntries;

function pushc(cache: any, item: any): any {
    var items = cache[item];
    if (!items) {
        cache[item] = items = {totalcnt:0};
    }
    return items;
}`;

      parts.push(ProfilingInfo);
    }

    parts.push('');

    parts.push(
      [
        '',
        '',
        'export class PegjsParser<I extends ParseStream> {',
        '',
        '  options: IParseOptions;',
        '  input: I;',
        '  inputBuf: IPegjsParseStreamBuffer2;',
        '',
        '  localFailPos = 0;',
        '  maxFailExpected: Expectation[] = [];',
        '  peg$silentFails = 0;', // 0 = report failures, > 0 = silence failures
        '  peg$result;',
        '  currentRule: RuleId;',
        '',
        '  get result' + startType + '() { return this.peg$result; }',
        ''
      ].join('\n')
    );

    if (options.tspegjs.customFields) {
      parts.push(indent2(options.tspegjs.customFields.join('\n')));
    }

    if (options.cache) {
      parts.push(['  readonly peg$resultsCache: {[id: number]: ICached};', ''].join('\n'));
    }

    parts.push(
      [
        '',
        '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
        '    this.input = input;',
        '    this.inputBuf = input.buffer;',
        '    this.options = options !== undefined ? options : {};',
        '',
        '    if (this.options.customCache)',
        '      this.peg$resultsCache = this.options.customCache;',
        '    else',
        '      this.peg$resultsCache = {};',
        ''
      ].join('\n')
    );

    if (options.tspegjs.customInit) {
      parts.push(indent4(options.tspegjs.customInit.join('\n')));
    }

    parts.push(
      [
        '  }',
        '',
        '  parse(silent?: boolean): IFailure {',
        '    const input = this.input;',
        '    const inputBuf = this.inputBuf;',
        ''
      ].join('\n')
    );

    if (options.optimize === 'size') {
      let startRuleIndex = asts.indexOfRule(ast, options.allowedStartRules[0]);

      parts.push(['    let peg$startRuleIndex = ' + startRuleIndex + ';'].join('\n'));
    }

    parts.push(
      ['', '    // inputBuf.currPos = 0;', '    // inputBuf.savedPos = 0;', ''].join('\n')
    );

    parts.push([''].join('\n'));

    if (options.optimize === 'size') {
      parts.push(
        [
          '    if (this.options.startRule !== undefined) {',
          '      var ri = typeof this.options.startRule === "string"?eval("RuleId."+this.options.startRule):this.options.startRule;',
          '      if (!(StartRules.get(ri))) {',
          '        throw new Error("Can\'t start parsing from rule \\"" + this.options.startRule + "\\".");',
          '      }',
          '',
          '      peg$startRuleIndex = ri;',
          '    }'
        ].join('\n')
      );
    } else {
      parts.push(
        [
          '    if (this.options.startRule !== undefined) {',
          '      var ri = typeof this.options.startRule==="string"?eval("RuleId."+this.options.startRule):this.options.startRule;',
          '      if (!(peg$startRuleFunctions.get(ri))) {',
          '        throw new Error("Can\'t start parsing from rule \\"" + this.options.startRule + "\\".");',
          '      }',
          '',
          '      peg$startRuleFunction = peg$startRuleFunctions[ri];',
          '    }'
        ].join('\n')
      );
    }
    if (options.profiling) {
      parts.push(
        [
          '    mainEntries = pushc(ProfilingInfo.mainEntries, RuleNames[peg$startRuleIndex]);',
          '    mainEntries.totalcnt++;'
        ].join('\n')
        }

    if (ast.initializer) {
      parts.push(indent4(ast.initializer.code));
      parts.push('');
    }
    parts.push('');
    parts.push('');

    if (options.optimize === 'size') {
      parts.push('    this.peg$result = this.peg$parseRule(peg$startRuleIndex);');
    } else {
      parts.push('    this.peg$result = this.peg$startRuleFunction();');
    }

    parts.push(
      [
        '',
        '    if (this.peg$result !== peg$FAILED) {',
        '      if (input.isAvailableAt(this.inputBuf.currPos)) {',
        '        this.peg$fail(peg$endExpectation());',
        '      } else {',
        '        return;',
        '      }',
        '    }',
        '',
        '    const f = this.peg$failure();',
        '    if (silent) {',
        '       return f;',
        '    } else {',
        '       throw new SyntaxError(this.peg$buildFailureReport(f));',
        '    }',
        '',
        '  }'
      ].join('\n')
    );

    parts.push(
      [
        '',
        '  peg$failure() {',
        '    return {  maxFailExpected:     this.maxFailExpected,',
        '              absoluteFailPos:     this.peg$absoluteFailPos(),',
        '              found:               this.peg$foundErrorLiteral()   };',
        '  }',
        '',
        '  peg$absoluteFailPos() {',
        '    return this.inputBuf.toAbsolutePosition(this.localFailPos);',
        '  }',
        '',
        '  peg$foundErrorLiteral() {',
        '    return    this.input.isAvailableAt(this.localFailPos)',
        '          ?   this.input.charAt(this.localFailPos)',
        '          :   null     ;',
        '  }',
        '',
        '  peg$computeLocation(startPos: number, endPos: number): IFileRange {',
        '    const startPosDetails = this.input.calculatePosition(startPos);',
        '    const endPosDetails = startPos===endPos ? startPosDetails : this.input.calculatePosition(endPos);',
        '',
        '    return {',
        '      start: {',
        '        offset: startPos,',
        '        line: startPosDetails.line,',
        '        column: startPosDetails.column',
        '      },',
        '      end: {',
        '        offset: endPos,',
        '        line: endPosDetails.line,',
        '        column: endPosDetails.column',
        '      }',
        '    };',
        '  }',
        '',
        '  peg$fail(expected1: Expectation) {',
        '    mergeLocalFailures(this, { maxFailExpected: [ expected1 ],',
        '                               localFailPos:    this.inputBuf.currPos }  );',
        '  }',
        '',
        '  /*function peg$buildSimpleError(message: string, location1: IFileRange) {',
        '    return new SyntaxError(input, message, [], "", location1);',
        '  }*/',
        '',
        '  peg$buildFailureReport(failure: IFailure) {',
        '    return new PegjsParseErrorInfo(',
        '      this.input, "", failure.maxFailExpected,',
        '      failure.found, failure.absoluteFailPos',
        '    );',
        '  }',
        '',
        ''
      ].join('\n')
    );

    if (options.optimize === 'size') {
      parts.push(generateInterpreter());
      parts.push('');
    } else {
      ast.rules.forEach((rule) => {
        parts.push(generateRuleFunction(rule));
        parts.push('');
      });
    }

    parts.push(indent2(ast.fields.join('\n')));

    parts.push(['', '}', ''].join('\n'));

    return parts.join('\n');
  }

  function generateGeneratedByComment() {
    let res = [];

    var ruleNamesEtc = '';
    if (options.optimize === 'size') {
      let ruleIds = '{' + ast.rules.map((r) => r.name).join(', ') + '}';
      let ruleNames =
        '[' + ast.rules.map((r) => '"' + js.stringEscape(r.name) + '"').join(', ') + ']';

      ruleNamesEtc = [
        'export enum RuleId ' + ruleIds + ';',
        'export var RuleNames = ' + ruleNames + ';',
        ''
      ].join('\n');
    }

    var customHeader = '';
    if (options.tspegjs.customHeader) {
      customHeader = options.tspegjs.customHeader.length
        ? options.tspegjs.customHeader.join('\n')
        : options.tspegjs.customHeader.toString();
    }

    var startRules = ['export const StartRules = new Map<RuleId,string>();']
      .concat(
        options.allowedStartRules.map(
          (r) => 'StartRules.set(RuleId.' + r + ', "' + r + '");'
        )
      )
      .join('\n');

    res = res.concat([
      "import { IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IPegjsParseStream, PegjsParseStream, IPegjsParseStreamBuffer, IPegjsParseStreamBuffer2, IFailure, PegjsParseErrorInfo, mergeFailures, mergeLocalFailures } from 'ts-pegjs/lib';",
      '',
      '// Generated by PEG.js v. ' +
      pegJsVersion +
      ' (ts-pegjs plugin v. ' +
      pluginVersion +
      ' )',
      '//',
      '// https://pegjs.org/   https://github.com/metadevpro/ts-pegjs',
      '//',
      '',
      ruleNamesEtc,
      customHeader,
      '',
      startRules,
      ''
    ]);

    return res.join('\n');
  }

  function generateTables() {
    var tables = [
      '',
      'function peg$literalExpectation(text1: string, ignoreCase: boolean): ILiteralExpectation {',
      '  return { type: "literal", text: text1, ignoreCase: ignoreCase };',
      '}',
      '',
      'function peg$classExpectation(parts: IClassParts, inverted: boolean, ignoreCase: boolean): IClassExpectation {',
      '  return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };',
      '}',
      '',
      'function peg$anyExpectation(): IAnyExpectation {',
      '  return { type: "any" };',
      '}',
      '',
      'function peg$endExpectation(): IEndExpectation {',
      '  return { type: "end" };',
      '}',
      '',
      'function peg$otherExpectation(description: string): IOtherExpectation {',
      '  return { type: "other", description: description };',
      '}',
      '',
      'function peg$decode(s: string): number[] {',
      '  return s.split("").map((ch) =>  ch.charCodeAt(0) - 32 );',
      '}',
      '',
      'const peg$FAILED: Readonly<any> = {};',
      ''
    ];

    if (options.trace) {
      tables.push(
        ['const peg$tracer = new DefaultTracer(' + options.trace + ');', ''].join('\n')
      );
    }

    if (options.optimize === 'size') {
      tables = tables.concat([
        'const peg$bytecode = [',
        indent2(
          ast.rules
            .map(
              (rule) =>
                'peg$decode("' +
                js.stringEscape(
                  rule.bytecode.map((b) => String.fromCharCode(b + 32)).join('')
                ) +
                '")'
            )
            .join(',\n')
        ),
        '];',
        '',
        'const peg$consts = [',
        indent2(ast.consts.join(',\n')),
        '];'
      ]);
    } else {
      tables = tables.concat(ast.consts.map((c, i) => 'const peg$c' + i + ' = ' + c + ';'));
    }

    return tables.join('\n');
  }

  ast.code = [
    generateGeneratedByComment(),
    // "(function() {",
    // "  \"use strict\";",
    '',
    generateToplevel(),
    '',
    '',
    '',
    '',
    '',
    //indent2("return " + generateParserObject() + ";"),
    generateTables()
    //"})()"
  ].join('\n');
}

module.exports = generateTS;
