import {
  Analysis,
  CodeTblToHex,
  DefaultComparator,
  distinct,
  GrammarParsingLeafState,
  GrammarParsingLeafStateCommon,
  GrammarParsingLeafStateReduces,
  GrammarParsingLeafStateTransitions,
  HyperGEnvType,
  IncVariator,
  NumMapLike,
  ParseTable,
  PNodeKind,
  PRule,
  PRuleRef,
  RTShift,
  RTStackShiftItem,
  StrMapLike,
  UNIQUE_OBJECT_ID,
} from '.';



export class CompressParseTable {

  parseTable: ParseTable;
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

  constructor(parseTable: ParseTable, log = true, info = "") {
    this.parseTable = parseTable;
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
      console.log((this.info?this.info:this.parseTable.rule.rule) + "   Total: [ total states:" + Analysis.totalStates + "  distinct:" + (this.lfidx) + "   distinct states/common:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "    rec shifts:" + Analysis.varShReqs + "   jmp.tokens:" + Analysis.varTkns + "   shift/tkns:" + Analysis.varShs + "   stack deepness:" + Analysis.varDeep + "   reduces:" + Analysis.varRds + " ]");
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
      var stcmidx = state.common ? state.common.replacedIndex : 0;

      var tuple: [number, number, number] = [spidx, state.reduceActions.index, stcmidx];
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
          Analysis.varDeep.add(sh.stepIntoRecursive.length + 1);
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
  mainRuleBoxFinished: GrammarParsingLeafStateCommon;
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
          var i;
          for (i = 0; this.unresolvedRecursiveBoxes.length && i < 100; i++) {
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
              console.log("Phase " + phase + " " + this.rule.rule + "/" + i + ". Additional cyclic dependencies updated.  Affected distinct : " + childrenAffctd.length + "    With dependencies : " + unresolvedRecursiveBoxesNow.length + "    In next round : " + this.unresolvedRecursiveBoxes.length);
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
        this.allShiftsByToken[tokenId] = tshs = [];
      }
      tshs[shift.generationSecondaryIndex] = shift;
    }
  }

  private generateShifts(phase: number) {

    var shifts = new GrammarParsingLeafStateTransitions();

    var es: [string, RTShift[]][] = Object.entries(this.allShiftsByToken);

    var shi = 0;
    es.forEach(([key, shs0]) => {
      var tokenId = Number(key);
      var shs = shifts.map[tokenId];
      if (!shs) {
        shifts.map[tokenId] = shs = [];
      }
      var shsv0 = Object.values(shs0);
      shsv0.forEach(sh0 => {
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

    var byTokenId: NumMapLike<RTShift[]>;
    if (child.mainRuleBox) {
      byTokenId = child.mainRuleBox.allShiftsByToken;
    } else {
      byTokenId = child.mainRuleBoxFinished.serialStateMap.map;
    }

    var es: [string, RTShift[]][] = Object.entries(byTokenId);
    es.forEach(([key, childShifts]) => {
      var tokenId = Number(key);

      var childShiftsv = Object.values(childShifts);
      var childShift = childShiftsv[0];

      var newImportShift = new RTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex);
      newImportShift.generationSecondaryIndex = this.cntGenerationSecondaryIndex++;

      var newStackItem = new RTStackShiftItem(rr, childShift.toStateIndex);
      newImportShift.stepIntoRecursive =
        [newStackItem].concat(childShift.stepIntoRecursive);

      this.newShift(recursiveShift.shiftIndex, tokenId, newImportShift);
    });
  }
}

