/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina
var pack = require("../../package.json");
var ppack = require("pegjs/package.json");
var lib_1 = require("../../lib");
var analyzer_1 = require("../../lib/analyzer");
var lib_2 = require("../../lib");
// Generates parser JavaScript code.
function generateTS(ast) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // pegjs 0.10  api pass(ast, options)
    // pegjs 0.11+ api pass(ast, config, options);
    var options = args[args.length - 1];
    //options.returnTypes = {};
    var param0 = options.param0 ? options.param0 + ', ' : '';
    var param00 = options.param00 ? options.param00 + ', ' : '';
    var allstarts;
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
    var grammar = ast.grammar;
    console.log("Generate parser...");
    function generateRuleHeader(ruleNameCode, ruleIndexCode) {
        var parts = [];
        parts.push('');
        if (options.trace) {
            parts.push([
                'peg$tracer.trace({',
                '  type: "rule.enter",',
                '  rule: ' + ruleNameCode + ',',
                '  location: this.peg$computeLocation(startPos, input.currPos)',
                '});',
                ''
            ].join('\n'));
        }
        if (options.profiling) {
            parts.push([
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
            parts.push([
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
            ].join('\n'));
            if (options.profiling) {
                parts.push([
                    '  ProfilingInfo.mainEntries.cachedcnt++;',
                    '  currentMain.cachedcnt++;',
                    '  ruleEntries.cachedcnt++;',
                    '  ruleOfMainEntries.cachedcnt++;',
                    '',
                ].join('\n'));
            }
            if (options.trace) {
                parts.push([
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
                ].join('\n'));
            }
            parts.push(['  return cached.result;', '}', ''].join('\n'));
        }
        return parts.join('\n');
    }
    function generateRuleFooter(ruleNameCode, resultCode) {
        var parts = [];
        if (options.trace) {
            parts.push([
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
            ].join('\n'));
        }
        parts.push(['', 'return ' + resultCode + ';'].join('\n'));
        return parts.join('\n');
    }
    function generateBaseClass() {
        var parts = [];
        var baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
        var r0 = allstarts.length === 1 ? allstarts[0] : '';
        var startType = ast.inferredTypes[r0];
        startType = startType ? ': ' + startType : '';
        parts.push([
            '',
            '',
            'export abstract class HyperGParser<T extends ' + baseTokenType + ', I extends HyperGParseStream<T>> {',
            '',
            '  options: IParseOptions;',
            '  input: I;',
            '',
            '  peg$result;',
            '',
            '  currentRule: RuleId;',
            '  // TODO',
            '  maxFailExpected: Expectation[] = [];',
            '  maxFailPos: number;',
            ''
        ].join('\n'));
        if (options.tspegjs.customFields) {
            parts.push(indent2(options.tspegjs.customFields.join('\n')));
        }
        parts.push([
            '',
            '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
            '    this.input = input;',
            '    this.options = options !== undefined ? options : {};',
            '',
        ].join('\n'));
        if (options.tspegjs.customInit) {
            parts.push(indent4(options.tspegjs.customInit.join('\n')));
        }
        parts.push([
            '  }',
            '',
            '  get result() { return this.peg$result; }',
            '',
            '  token() {',
            '    return this.input.tokenAt(this.input.currPos);',
            '  }',
            '',
            '  parse(silent: boolean, startRuleIndex: RuleId = 0): IFailure {',
            '    const input = this.input;',
            '',
            '    if (startRuleIndex) {',
            '      if (!(StartRules.get(startRuleIndex))) {',
            '        throw new Error("Can\'t start parsing from rule \\"" + RuleNames[startRuleIndex] + "\\".");',
            '      }',
            '    }',
            '',
            '    var M = ProfilingInfo.mainEntries = pushc(ProfilingInfo, "mainEntries");',
            '    ProfilingInfo.ruleEntries = pushc(ProfilingInfo, "ruleEntries");',
            '',
            '    currentMain = pushc(M, RuleNames[startRuleIndex]);',
            '    M.mainentriescnt = M.mainentriescnt? M.mainentriescnt+1 : 1;',
            '    currentMain.mainentriescnt = currentMain.mainentriescnt? currentMain.mainentriescnt+1 : 1;',
            '',
            '    this.run(silent, startRuleIndex);',
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
            '  }',
            '',
            '  abstract run(silent: boolean, startRuleIndex?: RuleId): IFailure;',
            '',
            '',
            '  next() {',
            '    const input = this.input;',
            '    input.currPos++;',
            '    if (input.currPos >= input.length) return undefined;',
            '    return input.tokenAt(input.currPos);',
            '  }',
            '',
            '  cacheKey(rule: PRule) {',
            '    return this.input.currPos * 132 + rule.index;',
            '  }',
            '  ',
            '  fail(token: IToken): void {',
            '    throw new Error("Method not implemented.");',
            '  }',
            '',
            '  get inputPos(): number {',
            '    return this.input.currPos;',
            '  }',
            '  set inputPos(topos: number) {',
            '    this.input.currPos = topos;',
            '  }',
            '',
            '  get inputLength(): number {',
            '    return this.input.length;',
            '  }',
            '',
            '  get numRules(): number {',
            '    return 132;',
            '  }',
            '',
            '  peg$failure() {',
            '    return {  maxFailExpected:     this.maxFailExpected,',
            '              maxFailPos:          this.maxFailPos,',
            '              found:               this.peg$foundErrorLiteral()   };',
            '  }',
            '',
            '  peg$foundErrorLiteral(): ITokenExpectation {',
            '    return    this.input.length > this.maxFailPos',
            '          ?   { type: "token", tokenId: this.input.tokenAt(this.maxFailPos).tokenId }',
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
            '    mergeFailures(this, { maxFailExpected: [ expected1 ],',
            '                          maxFailPos:    this.input.currPos }  );',
            '  }',
            '',
            '  /*function peg$buildSimpleError(message: string, location1: IFileRange) {',
            '    return new SyntaxError(input, message, [], "", location1);',
            '  }*/',
            '',
            '  peg$buildFailureReport(failure: IFailure) {',
            '    return new HyperGParseErrorInfo(',
            '      this.input, "", failure.maxFailExpected,',
            '      failure.found, failure.maxFailPos',
            '    );',
            '  }',
            '',
            '',
            '',
            ''
        ].join('\n'));
        function genMainFunc(action) {
            var sresult = [];
            var sargs = [];
            action.args.forEach(function (a) {
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
            sresult.push("  " + name + "(" + sargs.join(", ") + "): " + outputType + "/*" + action.nodeIdx + "*/" + " {  // " + action.target.kind + (action.kind === lib_1.PActionKind.PREDICATE ? "/" + action.kind : ""));
            sresult = sresult.concat(action.code.map(function (line) { return "    " + line; }));
            sresult.push("  }");
            sresult.push("");
            return sresult;
        }
        grammar.actions.forEach(function (action) {
            parts = parts.concat(genMainFunc(action));
        });
        parts.push(indent2(ast.fields.join('\n')));
        parts.push(['}', ''].join('\n'));
        return parts.join('\n');
    }
    function generatePackratRunner() {
        var parts = [];
        var baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
        var r0 = allstarts.length === 1 ? allstarts[0] : '';
        var startType = ast.inferredTypes[r0];
        startType = startType ? ': ' + startType : '';
        parts.push([
            '',
            '',
            'export  class       HyperGInterpretedParser<T extends ' + baseTokenType + ', I extends HyperGParseStream<T>> ',
            '        extends     HyperGParser<T,I> ',
            '        implements  IParserProgram {',
            '',
            '  runner: InterpreterRunner;',
            '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
            '    super(' + param00 + 'input, options);',
            '    this.runner = new InterpreterRunner(this);',
            '    this.input = input;',
            '    this.options = options !== undefined ? options : {};',
            '',
            '  }',
            '',
            '  run(silent: boolean, startRuleIndex: RuleId = 0): IFailure {',
            '    var entry = peg$ruleInterpreters[startRuleIndex];',
            '    this.peg$result = this.runner.run(entry);',
            '    ',
            '    // TODO failure',
            '    return null;',
            '  }',
            '}',
            '',
        ].join('\n'));
        return parts.join('\n');
    }
    function generateJumpTableRunner() {
        var parts = [];
        var baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
        var r0 = allstarts.length === 1 ? allstarts[0] : '';
        var startType = ast.inferredTypes[r0];
        startType = startType ? ': ' + startType : '';
        parts.push([
            '',
            '',
            '',
            '',
            'export  class       HyperGPrecompiledParser<T extends ' + baseTokenType + ', I extends HyperGParseStream<T>> ',
            '        extends     HyperGParser<T,I>',
            '        implements  IJumpTableProgram {',
            '',
            '  constructor(' + param0 + 'input: I, options?: IParseOptions) {',
            '    super(' + param00 + 'input, options);',
            '    this.input = input;',
            '    this.options = options !== undefined ? options : {};',
            '  }',
            '',
            '',
            '  run(silent: boolean, startRuleIndex: RuleId = 0): IFailure {',
            '',
            '    var parseTable = peg$PrsTbls[startRuleIndex] as ParseTable;',
            '',
            '    const runner = new JumpTableRunner(this, parseTable);',
            '',
            '    this.peg$result = runner.run();',
            '',
            '    // TODO failure',
            '    return null;',
            '  }',
            '}',
            '',
            ''
        ].join('\n'));
        return parts.join('\n');
    }
    function generateToplevel() {
        var parts = [];
        // interfaces removed from here , it is better to import
        var r0 = allstarts.length === 1 ? allstarts[0] : '';
        var startType = ast.inferredTypes[r0];
        startType = startType ? ': ' + startType : '';
        parts.push([
            'export interface IParseOptions {',
            '  filename?: string;',
            '  startRule?: (string | RuleId);',
            '  tracer?: any;',
            '  [key: string]: any;',
            '  customCache?: {[id: number]: ICached};',
            '}',
            ''
        ].join('\n'));
        var baseTokenType = options.baseTokenType ? options.baseTokenType : "IToken";
        if (options.profiling) {
            var ProfilingInfo = "export var ProfilingInfo = {\n  mainEntries: null,  ruleEntries: null\n};\n\nvar currentMain;\n\nfunction pushc(cache: any, item: any): any {\n    var items = cache[item];\n    if (!items) {\n        cache[item] = items = {entriescnt:0, cachedcnt:0, iterationscnt:0};\n    }\n    return items;\n}";
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
        var res = [];
        var ruleNamesEtc = '';
        var ruleIds = '{' + ast.rules.map(function (r) { return r.name; }).join(', ') + '}';
        var ruleNames = '[' + ast.rules.map(function (r) { return '"' + lib_1.JSstringEscape(r.name) + '"'; }).join(', ') + ']';
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
            .concat(allstarts.map(function (r) { return 'StartRules.set(RuleId.' + r + ', "' + r + '");'; }))
            .join('\n');
        res = res.concat([
            "import { IFilePosition, IFileRange, IAnyExpectation, IEndExpectation, IOtherExpectation, Expectation, SyntaxError, ITraceEvent, DefaultTracer, ICached, HyperGParseStream, InterpreterRunner, PRule, IFailure } from 'ts-pegjs/lib';",
            "import { HyperGParseErrorInfo, mergeFailures, IToken, ITokenExpectation, PNode, EntryPointInterpreter, SerDeser, peg$FAILED, ParseTable, Packrat, JumpTableRunner, Interpreters, JumpTables, IJumpTableProgram, IParserProgram, Analysis } from 'ts-pegjs/lib';",
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
        ast.rules.forEach(function (r) { ruleMap[r.name] = ri++; });
        var parseTbl = [];
        lib_2.Analysis.ruleTable = grammar.rules;
        var doit = function (r) {
            ri = ruleMap[r];
            var rule = grammar.children[ri];
            if (rule.rule !== r) {
                console.error("Something wrong '" + r + "' != '" + rule.rule + "'");
                throw new Error();
            }
            var g = analyzer_1.ParseTableGenerator.createForRule(rule);
            var parseTable = g.generateParseTable();
            parseTbl.push("const peg$PrsTbl" + r + ' = "' + encodePrsTbl(parseTable) + '";');
        };
        allstarts.forEach(function (r) {
            doit(r);
        });
        var ttbuf = [];
        lib_2.Analysis.writeAllSerializedTables(ttbuf);
        parseTbl.push("");
        parseTbl.push("const peg$PrsTblBuf = '" + encodeVsimPck(ttbuf) + "';");
        parseTbl.push("");
        parseTbl.push("const peg$PrsTblTbls = peg$decodePrsTblTbls(peg$PrsTblBuf);");
        parseTbl.push("");
        parseTbl.push("const peg$PrsTbls = {" + allstarts.map(function (r) { return ruleMap[r] + ": peg$decodePrsTbl(" + ruleMap[r] + ", peg$PrsTbl" + r + ")"; }).join(", ") + "};");
        parseTbl.push([
            'JumpTables.parseTables = peg$PrsTbls;',
            "",
        ].join('\n'));
        if (lib_2.Analysis.ERRORS) {
            console.error("Errors. Not generating (but for debugging only).");
        }
        return parseTbl;
    }
    function encodePrsTbl(parseTable) {
        var code = parseTable.ser();
        var enc = encodeVsimPck(code);
        return enc;
    }
    function encodeVsimPck(code) {
        var hex = lib_1.CodeTblToHex(code).join('');
        var enc = verySimplePackMany0(hex);
        return enc;
    }
    function verySimplePackMany0(raw) {
        var result = "";
        var R = /(x...|X....)?(0{10,})/g;
        var li = 0;
        for (var ra; ra = R.exec(raw);) {
            result += raw.substring(li, ra.index);
            result += (ra[1] ? ra[1] : "") + "{" + ra[2].length.toString(16).toUpperCase() + "}";
            li = R.lastIndex;
        }
        result += raw.substring(li);
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
            '      code.push((HTOD[char1]<<12) + (HTOD[s.charAt(i+1)]<<8) + (HTOD[s.charAt(i+2)]<<4) + HTOD[s.charAt(i+3)]);',
            '      i += 4;',
            '      break;',
            '    case "x":',
            '      code.push((HTOD[char1]<<8) + (HTOD[s.charAt(i+1)]<<4) + HTOD[s.charAt(i+2)]);',
            '      i += 3;',
            '      break;',
            '    default:',
            '      code.push((HTOD[char1]<<4) + HTOD[s.charAt(i+1)]);',
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
            'function peg$decodePrsTblTbls(s: string) {',
            '  var code = peg$decode(s);',
            '  var parseTableTbls = Analysis.readAllSerializedTables(code, 0);',
            '  return parseTableTbls;',
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
            tables.push(['const peg$tracer = new DefaultTracer(' + options.trace + ');', ''].join('\n'));
        }
        tables.push(['const peg$functions = [', "    " + grammar.actions.map(function (action) {
                var name = "";
                if (action.ownerRule.symbol) {
                    name = action.ownerRule.symbol;
                }
                name += "$" + action.index;
                return "HyperGParser.prototype." + name;
            }).join(", "), "];"].join('\n'));
        tables.push([
            'SerDeser.functionTable = peg$functions;',
            "",
        ].join('\n'));
        lib_1.SerDeser.cnt = grammar.nodeIdx + 1;
        // peg$rules
        tables.push(['const peg$rules = [', "    " + grammar.rules.map(function (rule) {
                return 'peg$decodeRule("' +
                    lib_1.CodeTblToHex(rule.ser()).join('') +
                    '")';
            }).join(", "), "];"].join('\n'));
        tables.push([
            'SerDeser.ruleTable = peg$rules;',
            "",
        ].join('\n'));
        var ri = 0;
        tables.push(['const peg$ruleInterpreters = [', "    " + grammar.rules.map(function (rule) {
                return 'new EntryPointInterpreter(peg$rules[' + (ri++) + '])';
            }).join(", "), "];"].join('\n'));
        tables.push([
            'Interpreters.ruleTable = peg$ruleInterpreters;',
            "",
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
//# sourceMappingURL=generateTs.js.map