/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

import * as fs from "fs";
import * as pack from '../../package.json';
import * as ppack from 'pegjs/package.json';
import {
  JSstringEscape, CodeTblToHex, PGrammar, PRule, PFunction,
  PNodeKind, PActionKind, PRuleRef, PTerminalRef
} from "../../lib";

import { EntryPointTraverser, ParseTable } from '../../lib/analyzer';
import {
  Analysis
} from "../../lib";

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

  var grammar: PGrammar = ast.grammar;

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    let parts = [];

    parts.push('');

    if (options.trace) {
      parts.push(
        [
          'peg$tracer.trace({',
          '  type: "rule.enter",',
          '  rule: ' + ruleNameCode + ',',
          '  location: this.peg$computeLocation(startPos, input.currPos)',
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
          'var ruleOfMainEntries = pushc(currentMain, rnm);',
          'ProfilingInfo.mainEntries.entriescnt++;',
          'currentMain.entriescnt++;',
          'ruleEntries.entriescnt++;',
          'ruleOfMainEntries.entriescnt++;',
          ''
        ].join('\n'));
    }

    if (options.cache) {
      parts.push(
        [
          'const key = input.currPos * ' +
          ast.rules.length +
          ' + ' +
          ruleIndexCode +
          ';',
          'let position: number;',
          '',
          'if (cached) {',
          '  input.currPos = cached.nextPos;',
          ''
        ].join('\n')
      );
      if (options.profiling) {
        parts.push(
          [
            '  ProfilingInfo.mainEntries.cachedcnt++;',
            '  currentMain.cachedcnt++;',
            '  ruleEntries.cachedcnt++;',
            '  ruleOfMainEntries.cachedcnt++;',
            '',
          ].join('\n'));

      }

      if (options.trace) {
        parts.push(
          [
            'if (cached.result !== peg$FAILED) {',
            '  peg$tracer.trace({',
            '    type: "rule.match",',
            '    rule: ' + ruleNameCode + ',',
            '    result: cached.result,',
            '    cached: true,',
            '    location: this.peg$computeLocation(startPos, input.currPos)',
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

    return parts.join('\n');
  }

  function generateRuleFooter(ruleNameCode, resultCode) {
    let parts = [];

    if (options.trace) {
      parts.push(
        [
          '',
          'if (' + resultCode + ' !== peg$FAILED) {',
          '  peg$tracer.trace({',
          '    type: "rule.match",',
          '    rule: ' + ruleNameCode + ',',
          '    result: ' + resultCode + ',',
          '    location: this.peg$computeLocation(startPos, input.currPos)',
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



  function generateToplevel() {
    let parts = [];

    // interfaces removed from here , it is better to import

    var r0 = options.allowedStartRules.length === 1 ? options.allowedStartRules[0] : '';
    var startType = ast.inferredTypes[r0];
    startType = startType ? ': ' + startType : '';

    const baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";

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
      const ProfilingInfo = `export var ProfilingInfo = {
  mainEntries: null,  ruleEntries: null
};

var currentMain;

function pushc(cache: any, item: any): any {
    var items = cache[item];
    if (!items) {
        cache[item] = items = {entriescnt:0, cachedcnt:0, iterationscnt:0};
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
        'export class PegjsJmpTblParser<T extends ' + baseTokenType + ', I extends PegjsParseStream<T>> extends JmpTblRunner {',
        '',
        '  options: IParseOptions;',
        '  input: I;',
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

    parts.push(['  readonly peg$resultsCache: {[id: number]: ICached};', ''].join('\n'));

    parts.push(
      [
        '',
        '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
        '    super();',
        '    this.input = input;',
        '    this.options = options !== undefined ? options : {};',
        '',
        '    if (this.options.customCache)',
        '      this.peg$resultsCache = this.options.customCache;',
        ''
      ].join('\n')
    );


    if (options.tspegjs.customInit) {
      parts.push(indent4(options.tspegjs.customInit.join('\n')));
    }

    parts.push(
      [
        '    this.init();',
        '  }',
        '',
        '  parse(silent: boolean, peg$startRuleIndex: RuleId = 0): IFailure {',
        '    const input = this.input;',
        ''
      ].join('\n')
    );

    parts.push([
      '    if (peg$startRuleIndex) {',
      '      if (!(StartRules.get(peg$startRuleIndex))) {',
      '        throw new Error("Can\'t start parsing from rule \\"" + RuleNames[peg$startRuleIndex] + "\\".");',
      '      }',
      '    }'
    ].join('\n'));

    if (options.profiling) {
      parts.push(
        [
          '',
          '    var M = ProfilingInfo.mainEntries = pushc(ProfilingInfo, "mainEntries");',
          '    ProfilingInfo.ruleEntries = pushc(ProfilingInfo, "ruleEntries");',
          '',
          '    currentMain = pushc(M, RuleNames[peg$startRuleIndex]);',
          '    M.mainentriescnt = M.mainentriescnt? M.mainentriescnt+1 : 1;',
          '    currentMain.mainentriescnt = currentMain.mainentriescnt? currentMain.mainentriescnt+1 : 1;',
        ].join('\n'));
    }

    if (ast.initializer) {
      parts.push(indent4(ast.initializer.code));
      parts.push('');
    }
    parts.push('');
    parts.push('');

    parts.push('    var entry = peg$rules[peg$startRuleIndex];');
    parts.push('    this.peg$result = this.run(entry);');

    parts.push(
      [
        '',
        '    if (this.peg$result !== peg$FAILED) {',
        '      if (input.length > this.input.currPos) {',
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
        '  token() {',
        '    return this.input.tokenAt(this.input.currPos);',
        '  }',
        '',
        '  next() {',
        '    const input = this.input;',
        '    input.currPos++;',
        '    if (input.currPos >= input.length) return undefined;',
        '    return input.tokenAt(input.currPos);',
        '  }',
        '',
        '  cacheKey(rule: EntryPointParser) {',
        '    return this.input.currPos * ' + grammar.rules.length + ' + rule.index;',
        '  }',
        '',
        '  get pos(): number {',
        '    return this.input.currPos;',
        '  }',
        '  set pos(topos: number) {',
        '    this.input.currPos = topos;',
        '  }',
        '  get numRules(): number {',
        '    return ' + grammar.rules.length + ';',
        '  }',
        '  rule(index: number): EntryPointParser {',
        '    return peg$rules[index];',
        '  }',
        '',
        '  peg$failure() {',
        '    return {  maxFailExpected:     this.maxFailExpected,',
        '              absoluteFailPos:     this.peg$absoluteFailPos(),',
        '              found:               this.peg$foundErrorLiteral()   };',
        '  }',
        '',
        '  peg$absoluteFailPos() {',
        '    return this.input.toAbsolutePosition(this.localFailPos);',
        '  }',
        '',
        '  peg$foundErrorLiteral(): ITokenExpectation {',
        '    return    this.input.length > this.localFailPos',
        '          ?   { type: "token", tokenId: this.input.tokenAt(this.localFailPos).tokenId }',
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
        '                               localFailPos:    this.input.currPos }  );',
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


    parts.push(['', '}', ''].join('\n'));

    return parts.join('\n');
  }

  function generateTables() {

    var tables = [];

    tables = tables.concat(generateParseTable());

    tables.push([
      "SerDeser.functionTable = peg$functions;",
      "SerDeser.ruleTable = peg$rules;"
    ].join('\n'));

    return tables.join('\n');
  }

  ast.code2 = [
    generateToplevel(),
    '',
    '',
    generateTables()
  ].join('\n');

  if (ast.code1 && ast.code2) {
    ast.code =  ast.code1 + ast.code2;
  }

}

module.exports = generateTS;
