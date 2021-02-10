import { ParseTable, GrammarParsingLeafState } from '.';
import { IToken } from '.';
import { SerDeser } from 'ts-pegjs/lib';


export abstract class JumpTableRunner {

  _numRules: number;
  
  constructor() {
  }
  init() {
    this._numRules = this.numRules;
  }


  abstract get pos(): number;
  abstract set pos(topos: number);
  
  abstract get numRules(): number;
  abstract next(): IToken;
  abstract rule(index: number): ParseTblJumper;
  
  run(parseTable: ParseTable): any {

    var jumper = new ParseTblJumper(this, parseTable);

    jumper.run();
  }
}


class ParseTblJumper {

  readonly runner: JumpTableRunner;
  readonly parseTable: ParseTable;
  currentState: GrammarParsingLeafState;

  constructor(runner: JumpTableRunner, parseTable: ParseTable) {
    this.runner = runner;
    this.parseTable = parseTable;
    this.currentState = parseTable.startingState;
  }

  run() {
    while (this.process());
  }
  process() {
    var token = this.runner.next();
    if (token) {
      this.currentState = this.currentState.transitions[token.tokenId];
    } else {
      this.currentState = null;
    }
    return this.currentState;
  }
  reduceAll() {
    this.currentState.reduceActions.forEach(node=>{
      
    });
  }
}
