import { ParseTable, Analysis, GrammarParsingLeafState, CodeTblToHex, GrammarParsingLeafStateCommon, GrammarParsingLeafStateTransitions, RTShift, GrammarParsingLeafStateReduces, PRuleRef, StrMapLike, PRule, UNIQUE_OBJECT_ID, distinct, IncVariator, NumMapLike, PNodeKind, minimum, RTStackShiftItem } from ".";
import { DefaultComparator } from './index';



export class CompressParseTable {

  parseTable: ParseTable;
  log = true;
  t0: number;
  r0: number;
  sl0: number;
  sc0: number;
  transidx: number;
  redidx: number;
  lfidx: number;
  cmnidx: number;

  constructor(parseTable: ParseTable, log = true) {
    this.parseTable = parseTable;
    this.log = log;

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
    this.cmnidx = this.sc0 + 1;


    var changed: boolean = false;
    this.parseTable.allStates.forEach(state => {
      changed = state && (this.prstate(state) || changed);
    });

    const sts = this.parseTable.allStates.length;
    Analysis.totalStates += sts;

    if (this.log) {
      console.log("Total: [ total states:" + Analysis.totalStates + "  distinct:" + (this.lfidx) + "   distinct states/common:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "    rec shifts:" + Analysis.varShReqs + "   jmp.tokens:" + Analysis.varTkns + "   shift/tkns:" + Analysis.varShs + "  reduces:" + Analysis.varRds + " ]");
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

      var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
      var stcmidx = state.common ? state.common.packedIndex : 0;

      var tuple: [number, number, number] = [spidx, state.reduceActions.index, stcmidx];
      var tkey = CodeTblToHex(tuple).join("");

      var state0 = Analysis.serializedLeafStates[tkey];
      if (state0) {
        // NOTE we keep old indeces for now because we should update all at once
        // on all dependent objects (like RTShift-s)
        state.packedIndex = state0.packedIndex;
        state.serializedTuple = tuple;
        return true;
      } else {
        // NOTE we keep old indeces for now because we should update all at once
        // on all dependent objects (like RTShift-s)
        state.packedIndex = this.lfidx++;
        state.serializedTuple = tuple;
        Analysis.serializedLeafStates[tkey] = state;
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

      var changed = this.tra(state.serialStateMap, tots);
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

      var tuple: [number, number] = [state.serialStateMap.index, state.reduceActions.index];
      var tkey = CodeTblToHex(tuple).join("");

      var state0 = Analysis.serializedStateCommons[tkey];
      if (state0) {
        state.packedIndex = state0.packedIndex;
        state.serializedTuple = tuple;
        return true;
      } else {
        state.packedIndex = this.cmnidx++;
        state.serializedTuple = tuple;
        Analysis.serializedStateCommons[tkey] = state;
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
      trans.alreadySerialized = null;
      trans.ser(buf);
      trans.alreadySerialized = buf;

      var encoded = CodeTblToHex(buf).join("");

      var trans0 = Analysis.serializedTransitions[encoded];
      if (trans0) {
        trans.index = trans0.index;
        return true;
      } else {
        trans.index = this.transidx++;
        Analysis.serializedTransitions[encoded] = trans;
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
        Analysis.serializedReduces[encred] = rr;
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
// tokenId, shift
type TknShiftTuple = [number, RTShift];

export class GenerateParseTableStackMainGen {

  readonly parent: GenerateParseTableStackBox;
  readonly top: GenerateParseTableStackMainGen;
  readonly indent: string = "";
  readonly stack: StrMapLike<GenerateParseTableStackMainGen>;

  readonly parseTable: ParseTable;
  readonly rr: PRuleRef;
  readonly rule: PRule | PRuleRef;

  unresolvedRecursiveBoxes: UnresolvedTuple[] = [];

  mainRuleBox: GenerateParseTableStackBox;
  children: GenerateParseTableStackBox[] = [];

  dependants: DependantTuple[] = [];

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
    }

    this.top.stack[this.rule.rule] = this;

  }

  addAsUnresolved(stack: StrMapLike<GenerateParseTableStackMainGen>) {
    // infinite-loop-anti-maker
    if (stack[this[UNIQUE_OBJECT_ID]]) {
      return;
    }
    stack[this[UNIQUE_OBJECT_ID]] = this;

    this.dependants.forEach(([importer, recshift, rr]) => {
      this.top.unresolvedRecursiveBoxes.push([importer, this, recshift, rr]);
    });
    this.dependants.forEach(([importer, recshift, rr]) => {
      importer.addAsUnresolved(stack);
    });
  }


  generate(phase: number) {
    //console.log(this.indent + phase + ">" + (this.rr ? this.rr : this.parseTable.rule+"#0"));

    var top = !this.rr;
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

          if (!c.filledWithRecursive) {

            if (this.stack[this.rule.rule] !== this) {
              throw new Error("this.stack[this.parseTable.rule.rule:'" + this.rule.rule + "'] !== this   " + this.stack[this.parseTable.rule.rule] + " !== " + this);
            }

            var forNode = new GenerateParseTableStackBox(this, this.parseTable, c, this.stack);
            this.children.push(forNode);
            if (c === this.parseTable.startingState.common) {
              this.mainRuleBox = forNode;
            }

            forNode.generate(phase);
          }
        });

        if (wasNon1st) {
          if (!was1st) {
            throw new Error("wasNon1st && !was1st");
          }
        }
        break;

      case 1:
      case 2:
      case 3:
      case 4:
        this.children.forEach(child => {
          child.generate(phase);
        });
        break;

      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
        this.children.forEach(child => {
          child.generate(phase);
        });

        if (top) {
          var i;
          for (i = 0; this.unresolvedRecursiveBoxes.length && i<100; i++) {
            var unresolvedRecursiveBoxesNow = this.unresolvedRecursiveBoxes;
            this.unresolvedRecursiveBoxes = [];

            var childrenAffctd: GenerateParseTableStackBox[] = [];
            unresolvedRecursiveBoxesNow.forEach(([importer, child, recshift, rr]) => {
              // NOTE precondition ok : dependants updated
              importer.appendChild(child, recshift, rr);
              childrenAffctd.push(importer);
            });

            childrenAffctd = distinct(childrenAffctd);
            childrenAffctd.forEach(chbox => {
              chbox.generateShiftsAgain(phase);
            });

            if (deepStats) {
              console.log("Phase " + phase + " " + this.rule.rule + "/"+i+". Additional cyclic dependencies updated.  Affected distinct : " + childrenAffctd.length + "    With dependencies : " + unresolvedRecursiveBoxesNow.length + "    In next round : " + this.unresolvedRecursiveBoxes.length);
            }
          }
          if (i) {
            if (this.unresolvedRecursiveBoxes.length) {
              console.log("Phase " + phase + " " + this.rule.rule + ", token sets growing in inifinite loop.  Still in next round : " + this.unresolvedRecursiveBoxes.length);
            } else {
              console.log("Phase " + phase + " " + this.rule.rule + ", all cyclic token shifts updated successfully.");
            }
          }
        }
        break;
    }

    if (top && deepStats) {
      type Stp = {
        vShifts: IncVariator,
        vRecs: IncVariator,
        vPrep: IncVariator
      };
      const sum = () => {
        return {
          vShifts: new IncVariator(),
          vRecs: new IncVariator(),
          vPrep: new IncVariator()
        };
      };

      const summ = (sums: Stp, shifts: GrammarParsingLeafStateTransitions, box: GenerateParseTableStackBox) => {
        var es: [string, RTShift[]][] = Object.entries(shifts.map);

        if (box) {
          sums.vPrep.add(Object.keys(box.allShifts).length);
        }
        es.forEach(([key, shifts]) => {
          sums.vShifts.add(shifts.length);
          shifts.forEach(shift => {
            sums.vRecs.add(shift.stepIntoRecursive.length);
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
                summ(sums, common.transitions, null);
              }
            }
          }
        });
      };

      var sums = sum();
      summ2(sums, this.parseTable);
      console.log(this.indent + "Phase " + phase + " " + this.rule.rule + " : from parseTable  tokens:" + " shifts:" + sums.vShifts + "  recursive deep shifts:" + sums.vRecs);
    }

    //console.log(this.indent + phase + "<" + this.rule.rule);
  }

}






























export class GenerateParseTableStackBox {

  top: GenerateParseTableStackMainGen;

  parent: GenerateParseTableStackMainGen;

  parseTable: ParseTable;

  common: GrammarParsingLeafStateCommon;
  trivial: GrammarParsingLeafStateTransitions;
  lastTokens: string;

  stack: StrMapLike<GenerateParseTableStackMainGen>;

  //shifts: GrammarParsingLeafStateTransitions;

  // tokenId+shiftIndex -> RTShift
  allShifts: StrMapLike<TknShiftTuple>
  // tokenId -> RTShift[] ordered by shiftindices
  allShiftsByToken: NumMapLike<RTShift[]>;

  cntGenerationSecondaryIndex = 0;

  children: BoxImportTuple[] = [];

  recursiveShifts: RTShift[];

  constructor(parent: GenerateParseTableStackMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon, stack: StrMapLike<GenerateParseTableStackMainGen>) {
    this.parent = parent;
    this.top = parent.top;
    this.parseTable = parseTable;
    this.common = common;

    this.trivial = this.common.transitions;

    this.stack = stack;

    this.allShifts = {};
    this.allShiftsByToken = {};
  }

  generate(phase: number) {

    switch (phase) {
      case 0:

        // lazy
        this.common.transitions;

        this.recursiveShifts = this.common.recursiveShifts.map[0];

        if (this.recursiveShifts) {
          this.recursiveShifts.forEach(rshift => {
            this.insertStackOpenShifts(phase, rshift);
          });
        }
        break;

      case 1:
        this.resetShitsToTrivial();

        // NOTE this ensures a processing order of dependants first :
        this.children.forEach(([ruleMain, shift, rr]) => {
          ruleMain.generate(phase);
        });

        // Trivial shifts copied  but no recursion anywhere after ROUND 1
        this.generateShifts(phase);
        break;

      default:
        this.resetShitsToTrivial();

        // NOTE this ensures a processing order of dependants first :
        this.children.forEach(([ruleMain, shift, rr]) => {
          ruleMain.generate(phase);
        });
        this.children.forEach(([ruleMain, shift, rr]) => {
          // NOTE precondition ok : dependants updated
          this.appendChild(ruleMain, shift, rr);
        });

        this.generateShifts(phase);
        break;

    }
  }

  resetShitsToTrivial() {
    this.allShifts = {};
    this.allShiftsByToken = {};
    this.cntGenerationSecondaryIndex = 0;
    if (this.trivial["$$generated$$"]) {
      throw new Error("serialStateMap should be the original one here");
    }
    var esths: [string, RTShift[]][] = Object.entries(this.trivial.map);
    esths.forEach(([key, shifts]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        shift = new RTShift(shift.shiftIndex, shift.toStateIndex);
        shift.generationSecondaryIndex = this.cntGenerationSecondaryIndex++;
        this.newShift(shift.shiftIndex, tokenId, shift);
      });
    });
  }

  generateShiftsAgain(phase: number) {

    var tokens = this.lastTokens;

    this.generateShifts(phase);

    var tokens2 = this.lastTokens;

    if (tokens !== tokens2) {
      this.addAsUnresolved({});
    }
  }

  addAsUnresolved(stack: StrMapLike<GenerateParseTableStackMainGen>) {
    // it is a starting node, which has dependencies required to update
    if (this === this.parent.mainRuleBox) {
      this.parent.addAsUnresolved(stack);
    }
  }

  private newShift(oldShiftIndexAsSlotId: number, tokenId: number, shift: RTShift) {
    var key = oldShiftIndexAsSlotId + ":" + tokenId;
    var olditm = this.allShifts[key];
    if (olditm) {
      var os = olditm[1];
      if (os.shiftIndex !== oldShiftIndexAsSlotId) {
        throw new Error("tokenId !== olditm[0] ||  os.shiftIndex !== shiftIndex   " + tokenId + " !== " + olditm[0] + " ||  " + os.shiftIndex + " !== " + oldShiftIndexAsSlotId);
      }
      var buf = [os.toStateIndex];
      os.serStackItms(buf);
      var srold = CodeTblToHex(buf).join(",");
      buf = [shift.toStateIndex];
      shift.serStackItms(buf);
      var srnew = CodeTblToHex(buf).join(",");
      if (srold !== srnew) {
        throw new Error("srold !== srnew   " + srold + " !== " + srnew);
      }
    } else {
      this.allShifts[key] = [tokenId, shift];

      var tshs = this.allShiftsByToken[tokenId];
      if (!tshs) {
        this.allShiftsByToken[tokenId] = tshs = [shift];
      } else {
        tshs.push(shift);
        var n = tshs.length;
        this.allShiftsByToken[tokenId] = tshs = distinct(tshs, (a, b) => {
          return a.generationSecondaryIndex - b.generationSecondaryIndex;
        });
        if (tshs.length !== n) {
          throw new Error("tshs.length !== n   " + tshs.length + " !== " + n);
        }
      }
    }
  }

  private generateShifts(phase: number) {

    var shifts = new GrammarParsingLeafStateTransitions();
    shifts["$$generated$$"] = 1;

    var es: [string, RTShift[]][] = Object.entries(this.allShiftsByToken);

    var shi = 0;
    es.forEach(([key, shs0]) => {
      var tokenId = Number(key);
      var shs = shifts.map[tokenId];
      if (!shs) {
        shifts.map[tokenId] = shs = [];
      }
      shs0.forEach(sh0 => {
        var sh = new RTShift(shi, sh0.toStateIndex, sh0.stepIntoRecursive);
        shs.push(sh);
        shi++;
      });
    });

    var lastTokens = Object.keys(shifts.map);
    lastTokens.sort(DefaultComparator);
    this.lastTokens = lastTokens.join(",");

    this.common.replace(shifts);
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
        var importedRuleMain = this.stack[rr.rule];
        if (importedRuleMain) {

          importedRuleMain.dependants.push([this, recursiveShift, rr]);

          this.top.unresolvedRecursiveBoxes.push([this, importedRuleMain, recursiveShift, rr]);

        } else {

          var importedTable: ParseTable = Analysis.parseTables[rr.rule];
          if (rr.rule !== importedTable.rule.rule) {
            throw new Error("rr.rule !== importedTable.rule.rule   " + rr.rule + " !== " + importedTable.rule.rule);
          }

          importedRuleMain = new GenerateParseTableStackMainGen(this, importedTable, rr);
          importedRuleMain.dependants.push([this, recursiveShift, rr]);

          this.children.push([importedRuleMain, recursiveShift, rr]);

          // phase 0:
          importedRuleMain.generate(phase);
        }
        break;

      default:
        throw new Error("unexpected phase : " + phase);
    }
  }

  // NOTE precondition : dependants updated
  appendChild(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef) {

    var byTokenId = child.mainRuleBox.allShiftsByToken;

    var es: [string, RTShift[]][] = Object.entries(byTokenId);
    es.forEach(([key, childShifts]) => {
      var tokenId = Number(key);
      var min = minimum(childShifts, (a, b) => {
        return a.generationSecondaryIndex - b.generationSecondaryIndex;
      });
      var childShift = min[1];

      var newImportShift = new RTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex);
      newImportShift.generationSecondaryIndex = this.cntGenerationSecondaryIndex++;

      var newStackItem = new RTStackShiftItem(rr, childShift.toStateIndex);
      newImportShift.stepIntoRecursive =
        [newStackItem].concat(childShift.stepIntoRecursive);

      this.newShift(recursiveShift.shiftIndex, tokenId, newImportShift);
    });
  }
}

