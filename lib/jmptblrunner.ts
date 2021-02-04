

export abstract class JmpTblRunner {

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
  abstract rule(index: number): EntryPointParser;
  
  run(rule: EntryPointParser): any {
    const key = this.cacheKey(rule);
    const cached: ICached = this.peg$resultsCache[key];
    if (cached) {
      this.pos = cached.nextPos;
    }
    if (cached) {
      return cached.result;
    }

    var stack = new RuleProcessStack(this, null, []);

    // TODO
    var ruleMaxFailPos = 0;

    var result = rule.child.parse(stack);

    this.peg$resultsCache[key] = { nextPos: this.pos, maxFailPos: ruleMaxFailPos, 
      result };
  }
}


