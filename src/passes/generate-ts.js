/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

var asts = require('pegjs/lib/compiler/asts');
var op = require('pegjs/lib/compiler/opcodes');
var pluginVersion = require('../../package.json').version;
var pegJsVersion = require('pegjs/package.json').version;
var api = require("../../lib");
const MATCH_TOKEN = api.MATCH_TOKEN;
const ACCEPT_TOKEN = api.ACCEPT_TOKEN;
const JSstringEscape = api.JSstringEscape;

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

    const streamTypeI = `export interface IParseStream<T extends `+baseTokenType+`> extends IPegjsParseStream<T> {

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
    const streamType = `export class ParseStream<T extends `+baseTokenType+`> extends PegjsParseStream<T> {
    
  /** NOTE string also implements IBasicPegjsBuffer 
    * buffer initialized as "" if initialBuf is omitted
    */
  constructor(initialBuf?: IPegjsBuffer<T>) {
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


    parts.push(['', streamTypeI, '', streamType, ''].join('\n'));

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
        'export class PegjsParser<T extends '+baseTokenType+', I extends ParseStream<T>> {',
        '',
        '  options: IParseOptions;',
        '  input: I;',
        '  inputBuf: IPegjsBuffer<T>;',
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
        '  token() {',
        '    return this.inputBuf.tokenAt();',
        '  }',
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
        '  peg$foundErrorLiteral(): ITokenExpectation {',
        '    return    this.input.isAvailableAt(this.localFailPos)',
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
      "import { IFilePosition, IFileRange, ILiteralExpectation, IClassParts, IClassExpectation, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, IPegjsParseStream, PegjsParseStream, IBasicPegjsBuffer, IPegjsBuffer, IFailure, PegjsParseErrorInfo, mergeFailures, mergeLocalFailures, IToken, ITokenExpectation } from 'ts-pegjs/lib';",
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
      'function peg$tokenExpectation(tokenId: number): ITokenExpectation {',
      '  return { type: "token", tokenId: tokenId };',
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
                rule.bytecode ?
                  'peg$decode("' +
                  JSstringEscape(
                    rule.bytecode.map((b) => String.fromCharCode(b + 32)).join('')
                  ) +
                  '")'
                : '[0]'
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
