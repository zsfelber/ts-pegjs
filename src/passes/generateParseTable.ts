/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';
import * as fs from "fs";

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

import * as pack from '../../package.json';
import * as ppack from 'pegjs/package.json';
import { EntryPointTraverser, ParseTable } from '../../lib/analyzer';
import {
  JSstringEscape, CodeTblToHex, PGrammar, PRule, PFunction,
  PNodeKind, PActionKind, PRuleRef, PTerminalRef, Analysis
} from "../../lib";

// Generates parser JavaScript code.
function generateParseTable(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  //options.returnTypes = {};
  const param0 = options.param0 ? options.param0 + ', ' : '';
  var grammar = ast.grammar as PGrammar;

  var ri = 0;
  var ruleMap = {};
  ast.rules.forEach(r=>{ruleMap[r.name] = ri++;});
  var result = [];

  Analysis.ruleTable = grammar.rules;

  options.allowedStartRules.forEach(r=>{
    ri = ruleMap[r];
    var rule = grammar.children[ri] as PRule;
    if (rule.rule !== r) {
      console.error("Something wrong '"+r+"' != '"+rule.rule+"'");
      throw new Error();
    }
    var parseTable = new ParseTable(rule);
    result.push("const Tbl"+r+' = "'+CodeTblToHex(parseTable.ser()).join('')+'";');
    var chi = 0;
    parseTable.dependencies.forEach(parseTable=>{
      if (!ast.rules[parseTable.rule.rule]) {
        result.push("const Tbl"+parseTable.rule.rule+' /*generated dependency*/ = "'+CodeTblToHex(parseTable.ser()).join('')+'";');
      }
      chi++;
    });
  });

  const fnm = options.tmppref + "_ParseTables.ts";
  fs.writeFileSync(fnm, result.join("\n"));


}

module.exports = generateParseTable;
