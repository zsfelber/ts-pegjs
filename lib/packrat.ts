import { EntryPointInterpreter, ICached, IToken, PNodeKind, PRule, PRuleRef, PTerminalRef, PValueNode, HyperG } from '.';
import { IParserProgram } from './interpreter';



//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the main entry point                     !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   r  o  c  e  s  s  o  r     object
//   !!
//

export class Packrat {

  readonly peg$resultsCache: {[id: number]: ICached} = {};

  owner: IParserProgram;
  numRules: number;
  
  constructor(owner: IParserProgram) {
    this.owner = owner;
    this.numRules = owner.numRules;
  }

  readCacheEntry(rule: PRule): ICached {
    const p = this.owner;
    const key = p.cacheKey(rule);
    var cached: ICached = this.peg$resultsCache[key];
    if (!cached) {
      this.peg$resultsCache[key] = cached = {  };
    }
    return cached;
  }
}
