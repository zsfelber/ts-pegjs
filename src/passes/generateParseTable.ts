/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
'use strict';

// Adapted from base: (original file: generate-bycode.js for codegen JS)
// Adapted for Typescript codegen (c) 2017, Pedro J. Molina

import * as pack from '../../package.json';
import * as ppack from 'pegjs/package.json';
import { EntryPointTraverser } from '../../lib/analyzer';
import {
  JSstringEscape, CodeTblToHex, PGrammar, PRule, PFunction,
  PNodeKind, PActionKind, PRuleRef, PTerminalRef
} from "../../lib";

// Generates parser JavaScript code.
function generateParseTable(ast, ...args) {
  // pegjs 0.10  api pass(ast, options)
  // pegjs 0.11+ api pass(ast, config, options);
  const options = args[args.length - 1];
  //options.returnTypes = {};
  const param0 = options.param0 ? options.param0 + ', ' : '';
  var grammar = ast.grammar as PGrammar;

  var traverser = new EntryPointTraverser(grammar.children[0] as PRule);
  var parseTable = traverser.generateParseTreeTraversionTable();
  parseTable.

  CodeTblToHex(rule.ser()).join('') +

}

module.exports = generateParseTable;
