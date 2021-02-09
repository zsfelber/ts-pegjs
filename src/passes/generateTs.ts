/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

import * as pack from '../../package.json';
import * as ppack from 'pegjs/package.json';
import {
  JSstringEscape, CodeTblToHex, PGrammar, PRule, PFunction,
  PNodeKind, PActionKind, PRuleRef, PTerminalRef, SerDeser
} from "../../lib";

import { EntryPointTraverser, ParseTable, ParseTableGenerator } from '../../lib/analyzer';
import {
  Analysis
} from "../../lib";
import { Console } from 'console';

// Generates parser JavaScript code.
function generateTS(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  //options.returnTypes = {};
  const param0 = options.param0 ? options.param0 + ', ' : '';

  var allstarts: string[];
  allstarts = ast.allstarts;

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

  console.log("Generate parser...");

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

  function generateBaseClass() {
    var parts = [];
    const baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
    var r0 = allstarts.length === 1 ? allstarts[0] : '';
    var startType = ast.inferredTypes[r0];
    startType = startType ? ': ' + startType : '';

    parts.push(
      [
        '',
        '',
        'export class PegjsParser0<T extends ' + baseTokenType + ', I extends PegjsParseStream<T>> {',
        '',
        '  options: IParseOptions;',
        '  input: I;',
        '',
        '  localFailPos = 0;',
        '  maxFailExpected: Expectation[] = [];',
        '  peg$silentFails = 0;', // 0 = report failures, > 0 = silence failures
        '  peg$result' + startType + ';',
        '  currentRule: RuleId;',
        '',
        '  get result' + startType + '() { return this.peg$result; }',
        ''
      ].join('\n')
    );
    if (options.tspegjs.customFields) {
      parts.push(indent2(options.tspegjs.customFields.join('\n')));
    }


    parts.push(
      [
        '',
        '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
        '    this.input = input;',
        '    this.options = options !== undefined ? options : {};',
        '',
      ].join('\n')
    );

    if (options.tspegjs.customInit) {
      parts.push(indent4(options.tspegjs.customInit.join('\n')));
    }



    parts.push(
      [
        '  }',
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
        '  cacheKey(rule: EntryPointInterpreter) {',
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
        '  rule(index: number): EntryPointInterpreter {',
        '    return peg$rulesPackrat[index];',
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
        var argName = a.label;
        var argType = ast.inferredTypes[a.evaluate.nodeIdx];
        sargs.push(argName + ": " + argType + "/*" + a.evaluate.nodeIdx + "*/");
      });

      var outputType = ast.inferredTypes[action.nodeIdx];
      var name = "";
      if (action.ownerRule.symbol) {
        name = action.ownerRule.symbol;
      }
      name += "$" + action.index;

      sresult.push("  " + name + "(" + sargs.join(", ") + "): " + outputType + "/*" + action.nodeIdx + "*/" + " {  // " + action.target.kind + (action.kind === PActionKind.PREDICATE ? "/" + action.kind : ""));
      sresult = sresult.concat(action.code.map(line => "    " + line));
      sresult.push("  }");
      sresult.push("");

      return sresult;
    }

    grammar.actions.forEach(action => {
      parts = parts.concat(genMainFunc(action));
    });

    parts.push(indent2(ast.fields.join('\n')));
    parts.push(['}', ''].join('\n'));

    return parts.join('\n');


  }


  function generatePackratRunner() {
    var parts = [];
    const baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
    var r0 = allstarts.length === 1 ? allstarts[0] : '';
    var startType = ast.inferredTypes[r0];
    startType = startType ? ': ' + startType : '';

    parts.push(
      [
        '',
        '',
        'export class PegjsPackratRunner<T extends ' + baseTokenType + ', I extends PegjsParseStream<T>> extends PackratRunner {',
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

    parts.push('    var entry = peg$rulesPackrat[peg$startRuleIndex];');
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
    parts.push(['}', ''].join('\n'));

    return parts.join('\n');

  }

  function generateJumpTableRunner() {
    
    var parts = [];
    const baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
    var r0 = allstarts.length === 1 ? allstarts[0] : '';
    var startType = ast.inferredTypes[r0];
    startType = startType ? ': ' + startType : '';

    parts.push(
      [
        '',
        '',
        'export class PegjsJumpTableRunner<T extends ' + baseTokenType + ', I extends PegjsParseStream<T>> extends JumpTableRunner {',
        '',
        '  options: IParseOptions;',
        '  input: I;',
        '',
        '  currentRule: RuleId;',
        '',
        '  get result' + startType + '() { return this.peg$result; }',
        ''
      ].join('\n')
    );

    parts.push(['  readonly peg$resultsCache: {[id: number]: ICached};', ''].join('\n'));

    parts.push(
      [
        '',
        '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
        '    super();',
        '    this.input = input;',
        '    this.options = options !== undefined ? options : {};',
        '  }',
        '}'
      ].join('\n')
    );

    return parts.join('\n');
  }

  function generateToplevel() {
    let parts = [];

    // interfaces removed from here , it is better to import

    var r0 = allstarts.length === 1 ? allstarts[0] : '';
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
    parts.push(generateBaseClass());
    parts.push('');
    parts.push(generatePackratRunner());
    parts.push('');
    parts.push(generateJumpTableRunner());

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
        allstarts.map(
          (r) => 'StartRules.set(RuleId.' + r + ', "' + r + '");'
        )
      )
      .join('\n');

    res = res.concat([
      "import { IFilePosition, IFileRange, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, PegjsParseStream, PackratRunner, PRule, IFailure, PegjsParseErrorInfo, mergeFailures, mergeLocalFailures, IToken, ITokenExpectation, PNode, EntryPointInterpreter, SerDeser, peg$FAILED, ParseTable, Packrat } from 'ts-pegjs/lib';",
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


  function generateParseTable() {

    var ri = 0;
    var ruleMap = {};
    ast.rules.forEach(r => { ruleMap[r.name] = ri++; });
    var parseTbl = [];

    Analysis.ruleTable = grammar.rules;

    const doit = (r) => {
      ri = ruleMap[r];
      var rule = grammar.children[ri] as PRule;
      if (rule.rule !== r) {
        console.error("Something wrong '" + r + "' != '" + rule.rule + "'");
        throw new Error();
      }
      var g = ParseTableGenerator.createForRule(rule);
      var parseTable = g.generateParseTable();

      parseTbl.push("const peg$PrsTbl" + r + ' = "' + encodePrsTbl(parseTable) + '";');
    };

    allstarts.forEach(r => {
      doit(r);
    });

    parseTbl.push("");
    parseTbl.push("const peg$PrsTbls = {" + allstarts.map(r => ruleMap[r] + ": peg$decodePrsTbl("+ruleMap[r]+", peg$PrsTbl" + r + ")").join(", ") + "};");

    if (Analysis.ERRORS) {
      console.error("Errors. Not generating (but for debugging only).");
    }

    return parseTbl;
  }

  function encodePrsTbl(parseTable: ParseTable): string {
    return verySimplePackMany0(CodeTblToHex(parseTable.ser()).join(''));
  }
  function verySimplePackMany0(raw: string) {
    var result = "";
    var R = /(x...|X....)?(0{10,})/g;
    var li = 0;
    for (var ra: RegExpExecArray; ra = R.exec(raw);) {
      result += raw.substring(li, ra.index);
      result += (ra[1]?ra[1]:"")+ "{" + ra[2].length.toString(16).toUpperCase() + "}";
      li = R.lastIndex;
    }
    return result;
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
      "const HTOD = {",
      "  '0': 0,'1': 1,'2': 2,'3': 3,'4': 4,",
      "  '5': 5,'6': 6,'7': 7,'8': 8,'9': 9,",
      "  'A': 10,'B': 11,'C': 12,'D': 13,'E': 14,'F': 15,",
      "}",
      '',
      'function peg$decode(s: string) {',
      '  var code: number[] = [];',
      '  for (var i=0; i<s.length; ) {',
      '    var char1 = s.charAt(i);',
      '    switch (char1) {',
      '    case "{":',
      '      var R = /\\{(.*?)\\}/;',
      '      var ra = R.exec(s);',
      '      var len = 0;',
      '      for (var j=0; j<ra[1].length; j++) {',
      '        len = (len<<4) + HTOD[ra[1][j]];',
      '      }',
      '      for (var k=0; k<len; k++) code.push(0);',
      '      i = R.lastIndex;',
      '      break;',
      '    case "X":',
      '      code.push(HTOD[char1]<<12 + HTOD[s.charAt(i+1)]<<8 + HTOD[s.charAt(i+2)]<<4 + HTOD[s.charAt(i+3)]);',
      '      i += 4;',
      '      break;',
      '    case "x":',
      '      code.push(HTOD[char1]<<8 + HTOD[s.charAt(i+1)]<<4 + HTOD[s.charAt(i+2)]);',
      '      i += 3;',
      '      break;',
      '    default:',
      '      code.push(HTOD[char1]<<4 + HTOD[s.charAt(i+1)]);',
      '      i += 2;',
      '      break;',
      '    }',
      '  }',
      '  return code;',
      '}',
      '',
      'const GNidx = ' + (grammar.nodeIdx + 1) + ";",
      'SerDeser.cnt = GNidx;',
      '',
      'function peg$decodeRule(s: string): PRule {',
      '  var code = peg$decode(s);',
      '  var node = PNode.deserialize(code);',
      '  var rule = node as PRule;',
      '  return rule;',
      '}',
      '',
      'function peg$decodePrsTbl(ri: RuleId, s: string) {',
      '  var rule = peg$rules[ri];',
      '  var code = peg$decode(s);',
      '  var parseTable = ParseTable.deserialize(rule, code);',
      '  return parseTable;',
      '}',
      '',
    ];

    if (options.trace) {
      tables.push(
        ['const peg$tracer = new DefaultTracer(' + options.trace + ');', ''].join('\n')
      );
    }

    tables.push(
      ['const peg$functions = [',
        "    " + grammar.actions.map(action => {
          var name = "";
          if (action.ownerRule.symbol) {
            name = action.ownerRule.symbol;
          }
          name += "$" + action.index;
          return "PegjsParser0.prototype." + name;
        }).join(", "),
        "];"
      ].join('\n'));

    SerDeser.cnt = grammar.nodeIdx + 1;
    // peg$rules
    tables.push(
      ['const peg$rules = [',
        "    " + grammar.rules.map(rule =>
          'peg$decodeRule("' +
          CodeTblToHex(rule.ser()).join('') +
          '")'
        ).join(", "),
        "];"
      ].join('\n'));
    var ri = 0;
    tables.push(
      ['const peg$rulesPackrat = [',
        "    " + grammar.rules.map(rule =>
          'new EntryPointInterpreter(peg$rules[' + (ri++) + '])'
        ).join(", "),
        "];"
      ].join('\n'));

    tables.push([
      "",
      "SerDeser.functionTable = peg$functions;",
      "SerDeser.ruleTable = peg$rules;",
      "Packrat.ruleTable = peg$rulesPackrat;"
    ].join('\n'));

    tables.push("");
    tables.push("");
    tables = tables.concat(generateParseTable());
    tables.push("");
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
