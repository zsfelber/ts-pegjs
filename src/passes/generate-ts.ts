/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

import * as asts from 'pegjs/lib/compiler/asts';
import * as op from 'pegjs/lib/compiler/opcodes';
import * as pack from '../../package.json';
import * as ppack from 'pegjs/package.json';
import {MATCH_TOKEN, ACCEPT_TOKEN, JSstringEscape, PGrammar, PRule, PFunction,
  PNodeKind, PActionKind, PRuleRef, PTerminalRef} from "../../lib";
import { setFlagsFromString } from 'v8';

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
        'export class PegjsParser<T extends ' + baseTokenType + ', I extends PegjsParseStream<T>> extends PackratRunner {',
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

    if (options.optimize === 'size') {
      parts.push('    this.peg$result = this.peg$parseRule(peg$startRuleIndex);');
    } else {
      parts.push('    this.peg$result = this.peg$startRuleFunction();');
    }

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
        '    return this.input.tokenAt(++this.input.currPos);',
        '  }',
        '',
        '  get pos(): number {',
        '    return this.input.currPos;',
        '  }',
        '  set pos(topos: number) {',
        '    this.input.currPos = topos;',
        '  }',
        '  get numRules(): number {',
        '    return ...;',
        '  }',
        '  rule(index: number): PRule {',
        '    return this.peg$rules[index];',
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

    
    function genMainFunc(action: PFunction) {

      var sresult = [];
      var sargs = [];
      action.args.forEach(a => {
        var argName = a.evaluate.label;
        var argType = ast.inferredTypes[a.evaluate.nodeIdx];
        sargs.push(argName+": "+argType);
      });

      var outputType = ast.inferredTypes[action.target.nodeIdx];

      sresult.push("  " + name + "("+sargs.push(", ")+"): " + outputType + " {  // " + action.target.kind + (action.kind===PActionKind.PREDICATE?"/" + action.kind:""));
      sresult = sresult.concat(action.code.map(line => "    " + line));
      sresult.push("  }");
      sresult.push("");

      return sresult;
    }

    var grammar: PGrammar = ast.grammar;
    grammar.actions.forEach(action=>{
      parts = parts.concat(genMainFunc(action));
    });

    parts.push(indent2(ast.fields.join('\n')));

    parts.push(['', '}', ''].join('\n'));

    return parts.join('\n');
  }

  function generateGeneratedByComment() {
    let res = [];

    var ruleNamesEtc = '';
    let ruleIds = '{' + ast.rules.map((r) => r.name).join(', ') + '}';
    let ruleNames =
      '[' + ast.rules.map((r) => '"' + JSstringEscape(r.name) + '"').join(', ') + ']';

    ruleNamesEtc = [
      'export enum RuleId ' + ruleIds + ';',
      'export var RuleNames = ' + ruleNames + ';',
      '',
      'export enum Terminal {',
      indent2(ast.terminals.join(',\n')),
      '}',
      ''
    ].join('\n');

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
      "import { IFilePosition, IFileRange, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, PegjsParseStream, PackratRunner, PRule, IFailure, PegjsParseErrorInfo, mergeFailures, mergeLocalFailures, IToken, ITokenExpectation } from 'ts-pegjs/lib';",
      '',
      '// Generated by PEG.js v. ' +
      ppack.version +
      ' (ts-pegjs plugin v. ' +
      pack.version +
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
      'function peg$tokenExpectation(tokenId: number): ITokenExpectation {',
      '  return { type: "token", tokenId: tokenId };',
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

    var grammar: PGrammar = ast.grammar;
    grammar.actions.forEach(action=>{

    });
    grammar.children.forEach(_rule=>{
      var rule = _rule.as(PRule);
      if (rule) {

      }
    });
    //TODO
    /*
    if (options.optimize === 'size') {
      tables = tables.concat([
        '',
        'const peg$consts = [',
        indent2(ast.consts.join(',\n')),
        '];'
      ]);
    } else {
      tables = tables.concat(ast.consts.map((c, i) => 'const peg$c' + i + ' = ' + c + ';'));
    }*/

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
    //indent2("return " + generateParserObject() + ";"),
    generateTables()
    //"})()"
  ].join('\n');
}

module.exports = generateTS;
