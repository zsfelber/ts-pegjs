import { distinctIndexed } from './hyperg';
import {
  Analysis,
  CodeTblToHex,
  gGrammarParsingLeafStateTransitions,
  GrammarParsingLeafState,
  GrammarParsingLeafStateCommon,
  GrammarParsingLeafStateReduces,
  GrammarParsingLeafStateTransitions,
  groupByIndexed,
  gRTShift,
  HyperGEnvType,
  IncVariator,
  ParseTable,
  PNodeKind,
  PRule,
  PRuleRef,
  RTShift,
  removeArrayItemMore,
  RTStackShiftItem,
  StrMapLike,
  UNIQUE_OBJECT_ID,
  UNIQUE_OBJECT_INDEX
} from '.';



export class CompressParseTable {

  parseTable: ParseTable;
  allowReindexTransitions: boolean;
  log = true;
  info = "";
  t0: number;
  r0: number;
  sl0: number;
  sc0: number;
  transidx: number;
  redidx: number;
  lfidx: number;
  lfidx0: number;
  cmnidx: number;
  cmnidx0: number;

  serializedLeafStates: { [index: string]: GrammarParsingLeafState } = {};

  serializedStateCommons: { [index: string]: GrammarParsingLeafStateCommon } = {};

  constructor(parseTable: ParseTable, allowReindexTransitions: boolean, log = true, info = "") {
    this.parseTable = parseTable;
    this.allowReindexTransitions = allowReindexTransitions;
    this.log = log;
    this.info = info;

    if (parseTable.allStates.length > Analysis.uniformMaxStateId) {
      throw new Error("State id overflow. Grammar too big. uniformMaxStateId:" + Analysis.uniformMaxStateId + "  Too many states:" + parseTable.allStates.length);
    }

  }

  pack(): boolean {

    this.t0 = Object.keys(Analysis.serializedTransitions).length;
    this.r0 = Object.keys(Analysis.serializedReduces).length;
    this.sl0 = Object.keys(Analysis.serializedLeafStates).length;
    this.sc0 = Object.keys(Analysis.serializedStateCommons).length;

    // indexes
    // 1 based
    // 0 means empty
    this.transidx = this.t0 + 1;
    this.redidx = this.r0 + 1;
    this.lfidx = this.sl0 + 1;
    this.lfidx0 = 1;
    this.cmnidx = this.sc0 + 1;
    this.cmnidx0 = 1;


    var changed: boolean = false;
    this.parseTable.allStates.forEach(state => {
      changed = state && (this.prstate(state) || changed);
    });

    const sts = this.parseTable.allStates.length;
    Analysis.totalStates += sts;

    if (!this.parseTable.packedIndex) {
      this.parseTable.packedIndex = Analysis.serializedParseTablesCnt++;
    }
    Analysis.serializedParseTables[this.parseTable.packedIndex] = {
      index: this.parseTable.packedIndex,
      output: this.parseTable.ser(HyperGEnvType.ANALYZING)
    };

    if (this.log) {
      console.log((this.info ? this.info : this.parseTable.rule.rule) + "   Total: [ total states:" + Analysis.totalStates + "  distinct:" + (this.lfidx) + "   distinct states/common:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "    rec shifts:" + Analysis.varShReqs + "   jmp.tokens:" + Analysis.varTkns + "   shift/tkns:" + Analysis.varShs + "   stack deepness:" + Analysis.varDeep + "   reduces:" + Analysis.varRds + " ]");
    }

    return changed;
  }

  prstate(state: GrammarParsingLeafState): boolean {
    if (state && !state.serializedTuple) {
      // lazy
      state.lazy(this.parseTable);


      var changed = this.prscmn(state.common);

      var rs1: [number] = [0];
      changed = this.red(state.reduceActions, rs1) || changed;
      Analysis.varRds.add(rs1[0]);

      var tuple: [number, number, number] = state.ser();
      var tkey = CodeTblToHex(tuple).join("");

      var state0 = Analysis.serializedLeafStates[tkey];
      if (state0) {
        var state00 = this.serializedLeafStates[tkey];
        // NOTE we keep old indeces for now because we should update all at once
        // on all dependent objects (like RTShift-s)
        state.packedIndex = state0.index;
        if (state00) state.replacedIndex = state00.replacedIndex;
        else state.replacedIndex = this.lfidx0++;
        state.serializedTuple = tuple;
        return true;
      } else {
        // NOTE we keep old indeces for now because we should update all at once
        // on all dependent objects (like RTShift-s)
        state.packedIndex = this.lfidx++;
        state.replacedIndex = this.lfidx0++;
        state.serializedTuple = tuple;
        Analysis.serializedLeafStates[tkey] = { index: state.packedIndex, output: state.serializedTuple };
        this.serializedLeafStates[tkey] = state;
        return changed;
      }
    } else {
      return false;
    }
  }

  prscmn(state: GrammarParsingLeafStateCommon): boolean {
    if (state && !state.serializedTuple) {
      // lazy
      state.transitions;

      var tots: [number, number, number, number] = [0, 0, 0, 0];

      var trans = state.serialStateMap;
      if (this.allowReindexTransitions) {
        trans = trans.fixedClone();
      }

      var changed = this.tra(trans, tots);

      state.serialStateMap.index = trans.index;

      var [nonreq, nonreqtot, req, reqtot] = tots;

      if (nonreq) {
        Analysis.varTkns.add(nonreq);
        Analysis.varShs.add(nonreqtot / nonreq);
      }
      if (req) {
        if (req !== 1) {
          throw new Error("req !== 1  " + req + " !== " + 1);
        }
      }
      Analysis.varShReqs.add(reqtot);

      var rs1: [number] = [0];
      changed = this.red(state.reduceActions, rs1) || changed;
      Analysis.varRds.add(rs1[0]);

      var tuple: [number, number] = state.ser();
      var tkey = CodeTblToHex(tuple).join("");

      var state0 = Analysis.serializedStateCommons[tkey];
      if (state0) {
        var state00 = this.serializedStateCommons[tkey];
        state.packedIndex = state0.index;
        if (state00) state.replacedIndex = state00.replacedIndex;
        else state.replacedIndex = this.cmnidx0++;
        state.serializedTuple = tuple;
        return true;
      } else {
        state.packedIndex = this.cmnidx++;
        state.replacedIndex = this.cmnidx0++;
        state.serializedTuple = tuple;
        Analysis.serializedStateCommons[tkey] = { index: state.packedIndex, output: state.serializedTuple };;
        this.serializedStateCommons[tkey] = state;
        return changed;
      }
    } else {
      return false;
    }
  }

  tra(trans: GrammarParsingLeafStateTransitions, maplen: [number, number, number, number]): boolean {

    var shiftses: [string, RTShift[]][] = Object.entries(trans.map);
    if (shiftses.length) {
      var nonreq = 0;
      var nonreqtot = 0;
      var req = 0;
      var reqtot = 0;
      shiftses.forEach(([key, shs]) => {
        shs.forEach(sh => {
          Analysis.varDeep.add(sh.stepIntoRecursive ? sh.stepIntoRecursive.depth : 0);
        })
        var tki = Number(key);
        if (tki) {
          nonreq++;
          nonreqtot += shs.length;
        } else {
          req++;
          reqtot += shs.length;
        }
      });
      maplen[0] = nonreq;
      maplen[1] = nonreqtot;
      maplen[2] = req;
      maplen[3] = reqtot;

      var buf = [];
      trans.ser(buf);

      var encoded = CodeTblToHex(buf).join("");

      var trans0 = Analysis.serializedTransitions[encoded];
      if (trans0) {
        trans.index = trans0.index;
        return true;
      } else {
        trans.index = this.transidx++;
        Analysis.serializedTransitions[encoded] = { index: trans.index, output: buf };
        return false;
      }
    } else if (trans.index !== 0) {
      trans.index = 0;
      return true;
    } else {
      return false;
    }
  }

  red(rr: GrammarParsingLeafStateReduces, maplen: [number]): boolean {
    var rlen = rr.reducedNodes.length;
    maplen[0] = rlen;
    if (rlen) {
      var buf = [];
      rr.alreadySerialized = null;
      rr.ser(buf);
      rr.alreadySerialized = buf;
      var encred = CodeTblToHex(buf).join("");

      var rr0 = Analysis.serializedReduces[encred];
      if (rr0) {
        rr.index = rr0.index;
        return true;
      } else {
        rr.index = this.redidx++;
        Analysis.serializedReduces[encred] = { index: rr.index, output: buf };
        return false;
      }
    } else if (rr.index !== 0) {
      rr.index = 0;
      return true;
    } else {
      return false;
    }
  }
}





















type UnresolvedTuple = [GenerateParseTableStackBox, GenerateParseTableStackMainGen, RTShift, PRuleRef];
type DependantTuple = [GenerateParseTableStackBox, RTShift, PRuleRef];
type BoxImportTuple = [GenerateParseTableStackMainGen, RTShift, PRuleRef];

// One parse table may have multiple GenerateParseTableStackMainGen s
export class UniqueParseTableInGenStack {

  useCnt = 0;

  dependants: DependantTuple[] = [];

}

export class GenerateParseTableStackMainGen {

  readonly parent: GenerateParseTableStackBox;
  readonly top: GenerateParseTableStackMainGen;
  readonly indent: string = "";
  readonly stack: StrMapLike<GenerateParseTableStackMainGen>;

  readonly parseTable: ParseTable;
  readonly rr: PRuleRef;
  readonly rule: PRule | PRuleRef;

  mainRuleBox: GenerateParseTableStackBox;
  children: GenerateParseTableStackBox[] = [];

  parseTableVars: UniqueParseTableInGenStack;

  // used only in top :

  unresolvedRecursiveBoxes: UnresolvedTuple[];

  parseTableVarsPool: UniqueParseTableInGenStack[];


  constructor(parent: GenerateParseTableStackBox, parseTable: ParseTable, rr?: PRuleRef) {
    this.parseTable = parseTable;

    this.rr = rr;
    this.rule = rr ? rr : parseTable.rule;

    this.stack = {};
    this.stack[this.rule.rule] = this;

    if (parent) {
      this.parent = parent;
      this.top = parent.top;
      Object.setPrototypeOf(this.stack, parent.stack);
      this.indent = parent.parent.indent + "  ";
    } else {
      this.top = this;
      this.unresolvedRecursiveBoxes = [];
      this.parseTableVarsPool = [];

    }

    this.parseTableVars = this.top.parseTableVarsPool[this.parseTable[UNIQUE_OBJECT_INDEX]];
    if (this.parseTableVars) {
      this.parseTableVars.useCnt++;
    } else {
      this.top.parseTableVarsPool[this.parseTable[UNIQUE_OBJECT_INDEX]] =
        this.parseTableVars = new UniqueParseTableInGenStack();
    }

    this.top.stack[this.rule.rule] = this;

  }

  get dependants() {
    return this.parseTableVars.dependants;
  }

  // not recursive, it is in a while (true) 
  // it triggers updating the first level (not indirect) dependencies in the next turn
  // in which each one passing its dependants' update to the 2nd round ... etc 
  addAsUnresolved() {
    this.parseTableVars.dependants.forEach(([importer, recshift, rr]) => {
      this.top.unresolvedRecursiveBoxes.push([importer, this, recshift, rr]);
    });
  }


  generate(phase: number) {
    //console.log(this.indent + phase + ">" + (this.rr ? this.rr : this.parseTable.rule+"#0"));

    var top = !this.rr;
    const debug = 0;
    const deepStats = 0;

    this.parseTable.allStates.forEach(s => {
      if (s) s.lazy(this.parseTable);
    });
    this.parseTable.myCommons.forEach(s => {
      if (s) {
        // lazy
        s.transitions;
      }
    });

    switch (phase) {
      case 0:

        var was1st = 0, wasNon1st = 0;

        this.parseTable.myCommons.forEach(c => {
          if (c === this.parseTable.startingState.common) {
            was1st = 1;
          } else {
            wasNon1st = 1;
          }

          if (this.stack[this.rule.rule] !== this) {
            throw new Error("this.stack[this.parseTable.rule.rule:'" + this.rule.rule + "'] !== this   " + this.stack[this.parseTable.rule.rule] + " !== " + this);
          }

          var forNode = new GenerateParseTableStackBox(this, this.parseTable, c, this.stack);
          this.children.push(forNode);
          if (c === this.parseTable.startingState.common) {
            this.mainRuleBox = forNode;
          }

          forNode.generate(phase);

        });

        if (wasNon1st) {
          if (!was1st) {
            throw new Error("wasNon1st && !was1st");
          }
        }
        break;

      case 1:
      case 2:
      case 4:
        this.children.forEach(child => {
          child.generate(phase);
        });
        break;

      case 3:
        this.children.forEach(child => {
          child.generate(phase);
        });

        if (top) {
          if (this.top !== this) {
            throw new Error("It is top or is not top ?");
          }

          var i;
          for (i = 0; this.unresolvedRecursiveBoxes.length && i < 100; i++) {
            if (debug) {
              console.log(" * * * * * *   circular dependencies round " + i + "  now:" + this.unresolvedRecursiveBoxes.length);
            }
            var unresolvedRecursiveBoxesNow = this.unresolvedRecursiveBoxes;
            this.unresolvedRecursiveBoxes = [];

            var unresolvedRecursiveBoxesNowProc = groupByIndexed(unresolvedRecursiveBoxesNow,
              (a) => {
                return a[0][UNIQUE_OBJECT_INDEX];
              });

            var childrenAffctd = 0;
            var newUnresolved: GenerateParseTableStackBox[] = [];

            var unrs: UnresolvedTuple[][] = Object.values(unresolvedRecursiveBoxesNowProc);
            unrs.forEach(group => {

              var gimp = group[0][0];

              // NOTE precondition ok : dependencies updated
              var tokens = Object.keys(gimp.allShifts).join(",");

              var updateRequired = false;
              var gs = Object.values(group);
              gs.forEach(([importer, child, recshift, rr]) => {
                if (gimp !== importer) {
                  throw new Error("groupBy didn't work");
                }
                if (importer.appendChildTransitions(child, recshift, rr)) {
                  updateRequired = true;
                }
              });

              gimp.generateShifts(phase);

              var tokens2;
              if (debug) {
                tokens2 = Object.keys(gimp.allShifts).join(",");
                if (updateRequired) {
                  console.log("UPDATED  " + gimp.parent.rule.rule + ":" + gimp.common.index + " " + gs.length + "  " + tokens + "  ->  " + tokens2);
                } else {
                  console.log("NOT UPDATED  " + gimp.parent.rule.rule + ":" + gimp.common.index + " " + gs.length + "  " + tokens);
                }
              }

              if (updateRequired) {
                newUnresolved.push(gimp);
                if (debug) {
                  console.log("triggered updates ----> " + gimp.dependants.map(itm => (itm[0] + "(from " + itm[2].rule + ")")));
                }
              } else {
                if (!tokens2) {
                  tokens2 = Object.keys(gimp.allShifts).join(",");
                }
                if (tokens !== tokens2) {
                  throw new Error("tokens !== tokens2    " + tokens + " !== " + tokens2);
                }
              }

              childrenAffctd++;

            });

            newUnresolved.forEach(unr => {
              unr.addAsUnresolved();
            });

            if (deepStats) {
              console.log("Phase " + phase + " " + this.rule.rule + "/" + i + ". Additional cyclic dependencies updated.     Processed : " + unresolvedRecursiveBoxesNow.length + " items    Affected boxes : " +
                childrenAffctd + "    of which Made updates for next round : " + newUnresolved.length + "   all items next round : " + this.unresolvedRecursiveBoxes.length);
            }
          }
          if (i && deepStats) {
            if (this.unresolvedRecursiveBoxes.length) {
              console.log("Phase " + phase + " " + this.rule.rule + ", token sets growing in inifinite loop.  Still in next round : " + this.unresolvedRecursiveBoxes.length);
            } else {
              console.log("Phase " + phase + " " + this.rule.rule + ", all cyclic token shifts updated successfully (in " + i + " round" + (i > 1 ? "s" : "") + ").");
            }
          }

        }
        break;
    }

    if (top) {

    }

    if (top && deepStats) {
      type Stp = {
        vShifts: IncVariator,
        vRecs: IncVariator,
        vTkn: IncVariator
      };
      const sum = () => {
        return {
          vShifts: new IncVariator(),
          vRecs: new IncVariator(),
          vTkn: new IncVariator()
        };
      };

      const summ = (sums: Stp, shifts: GrammarParsingLeafStateTransitions) => {
        var es: [string, RTShift[]][] = Object.entries(shifts.map);

        sums.vTkn.add(es.length);

        es.forEach(([key, shifts]) => {
          sums.vShifts.add(shifts.length);
          shifts.forEach(shift => {
            sums.vRecs.add(shift.stepIntoRecursive ? shift.stepIntoRecursive.depth : 0);
          })
        });
      };

      const summ2 = (sums: Stp, parseTable: ParseTable) => {
        const stack = {};
        parseTable.allStates.forEach(state => {
          if (state) {
            var common = state.common;
            if (!common) {
              state.lazy(parseTable);
              common = state.common;
            }
            if (common) {
              if (!stack[common[UNIQUE_OBJECT_ID]]) {
                stack[common[UNIQUE_OBJECT_ID]] = 1;
                summ(sums, common.transitions);
              }
            }
          }
        });
      };

      var sums = sum();
      summ2(sums, this.parseTable);
      console.log(this.indent + "Phase " + phase + " " + this.rule.rule + " : from parseTable   tokens:" + sums.vTkn + "  shifts:" + sums.vShifts + "  recursive deep shifts:" + sums.vRecs);
    }

    //console.log(this.indent + phase + "<" + this.rule.rule);
  }

  toString() {
    return this.rule.rule;
  }

}






























export class GenerateParseTableStackBox {

  top: GenerateParseTableStackMainGen;

  parent: GenerateParseTableStackMainGen;

  parseTable: ParseTable;

  common: GrammarParsingLeafStateCommon;
  preGeneratedAndOrDefault: GrammarParsingLeafStateTransitions;

  stack: StrMapLike<GenerateParseTableStackMainGen>;

  //shifts: GrammarParsingLeafStateTransitions;

  // tokenId+state path -> RTShift
  allShifts: StrMapLike<gRTShift>
  // tokenId -> RTShift[]
  allShiftsByToken: gGrammarParsingLeafStateTransitions;

  children: BoxImportTuple[] = [];

  recursiveShifts: RTShift[];

  constructor(parent: GenerateParseTableStackMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon, stack: StrMapLike<GenerateParseTableStackMainGen>) {

    this[UNIQUE_OBJECT_ID];

    this.parent = parent;
    this.top = parent.top;
    this.parseTable = parseTable;
    this.common = common;

    this.stack = stack;

    this.allShifts = {};
    this.allShiftsByToken = new gGrammarParsingLeafStateTransitions();
  }

  generate(phase: number) {

    switch (phase) {
      case 0:

        // lazy
        this.common.transitions;

        this.preGeneratedAndOrDefault = this.common.transitions;

        this.recursiveShifts = this.common.recursiveShifts.map[0];

        if (this.recursiveShifts) {
          this.recursiveShifts.forEach(rshift => {
            this.insertStackOpenShifts(phase, rshift);
          });
        }

        // phase 0:
        this.children.forEach(([ruleMain, shift, rr]) => {
          ruleMain.generate(phase);
        });
        break;

      case 1:
        this.resetShitsToPreGenDef();

        // NOTE this ensures a processing order of dependants first :
        this.children.forEach(([ruleMain, shift, rr]) => {
          ruleMain.generate(phase);
        });

        // Trivial and pregenerated shifts copied  
        // but no additional recursion added anywhere after ROUND 1
        this.generateShifts(phase);
        break;

      default:
        this.resetShitsToPreGenDef();

        // NOTE this ensures a processing order of dependencies first :
        this.children.forEach(([ruleMain, shift, rr]) => {
          ruleMain.generate(phase);
        });
        this.children.forEach(([ruleMain, shift, rr]) => {
          // NOTE precondition ok : dependencies updated
          this.appendChildTransitions(ruleMain, shift, rr);
        });

        this.generateShifts(phase);
        break;

    }
  }


  insertStackOpenShifts(phase: number, recursiveShift: RTShift) {
    if (!recursiveShift.toStateIndex) {
      throw new Error("recursiveShift.toStateIndex   " + recursiveShift.toStateIndex);
    }

    var state = this.parseTable.allStates[recursiveShift.toStateIndex];
    if (state.startingPoint.kind !== PNodeKind.RULE_REF) {
      throw new Error("state.startingPoint.kind !== PNodeKind.RULE_REF   " + state.startingPoint.kind + " !== " + PNodeKind.RULE_REF);
    }
    if (recursiveShift.toStateIndex !== state.index) {
      throw new Error("recursiveShift.toStateIndex !== state.index   " + recursiveShift.toStateIndex + " !== " + state.index);
    }

    switch (phase) {
      case 0:

        var rr = state.startingPoint as PRuleRef;
        var importedRuleMain: GenerateParseTableStackMainGen = this.stack[rr.rule];
        if (importedRuleMain) {

          importedRuleMain.parseTableVars.dependants.push([this, recursiveShift, rr]);

          this.top.unresolvedRecursiveBoxes.push([this, importedRuleMain, recursiveShift, rr]);

        } else {

          var importedTable: ParseTable = Analysis.parseTables[rr.rule];
          if (rr.rule !== importedTable.rule.rule) {
            throw new Error("rr.rule !== importedTable.rule.rule   " + rr.rule + " !== " + importedTable.rule.rule);
          }

          importedRuleMain = new GenerateParseTableStackMainGen(this, importedTable, rr);
          importedRuleMain.parseTableVars.dependants.push([this, recursiveShift, rr]);

          this.children.push([importedRuleMain, recursiveShift, rr]);

        }
        break;

      default:
        throw new Error("unexpected phase : " + phase);
    }
  }


  resetShitsToPreGenDef() {
    this.allShifts = {};
    this.allShiftsByToken = new gGrammarParsingLeafStateTransitions();

    var esths: [string, RTShift[]][] = Object.entries(this.preGeneratedAndOrDefault.map);
    esths.forEach(([key, shifts]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        var shift2 = new gRTShift(shift.shiftIndex, shift.toStateIndex,
          tokenId, shift.stepIntoRecursive);
        this.newShift(shift2);
      });
    });
  }

  addAsUnresolved() {
    // it is a starting node, which has dependencies required to update
    if (this === this.parent.mainRuleBox) {
      this.parent.addAsUnresolved();
    }
  }

  get dependants() {
    if (this === this.parent.mainRuleBox) {
      return this.parent.dependants;
    } else {
      return [] as DependantTuple[];
    }
  }

  private newShift(shift: gRTShift) {

    var updateRequired = false;

    var r = shift.stepIntoRecursive;
    var buf = r ? [shift.tokenId, shift.toStateIndex, r.toStateIndex, r.child ? r.child.index : 0]
      : [shift.tokenId, shift.toStateIndex];
    var key = buf.join("/");

    var oldshift: gRTShift = this.allShifts[key];
    if (oldshift) {
      if (oldshift.shiftIndex !== shift.shiftIndex) {
        throw new Error("oldshift.shiftIndex !== shift.shiftIndex   " + oldshift.shiftIndex + " !== " + shift.shiftIndex);
      }
      if (oldshift.tokenId !== shift.tokenId) {
        throw new Error("oldshift.tokenId !== shift.tokenId   " + oldshift.tokenId + " !== " + shift.tokenId);
      }

    } else {
      this.allShifts[key] = shift;
      this.allShiftsByToken.add(shift);
      updateRequired = true;
    }

    return updateRequired;
  }

  generateShifts(phase: number) {

    var shifts = this.allShiftsByToken.clone();

    this.common.replace(shifts);
  }


  // NOTE precondition : dependencies updated
  appendChildTransitions(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef) {

    // after generateShifts
    var sm = child.mainRuleBox.common.serialStateMap;
    if (!(sm instanceof gGrammarParsingLeafStateTransitions)) {
      throw new Error("Invalid class at generation time : " + sm.constructor.name);
    }
    var es: gRTShift[][] = Object.values(sm.map);

    var updateRequired = false;

    es.forEach((childShifts) => {

      childShifts.forEach((childShift) => {
        var newImportShift = new gRTShift(recursiveShift.shiftIndex,
          recursiveShift.toStateIndex, childShift.tokenId);

        newImportShift.stepIntoRecursive =
          Analysis.createStackShiftNode(childShift.toStateIndex,
            childShift.stepIntoRecursive);

        if (this.newShift(newImportShift)) {
          updateRequired = true;
        }
      });

    });

    return updateRequired;
  }

  toString() {
    return this.parent.rule.rule + ":" + this.common.index;
  }
}

