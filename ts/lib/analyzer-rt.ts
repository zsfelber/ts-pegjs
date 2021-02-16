import { PRule, Analysis, CodeTblToHex, PLogicNode, NumMapLike, HyperG, PRef, Shifts, ShiftReduceKind, Shift, ShiftRecursive, Reduce, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser, ParseTableGenerator, EntryPointTraverser, StateNodeCommon } from '.';
import { StateNodeWithPrefix } from './analyzer';
import { PNodeKind, PRuleRef, PValueNode } from './parsers';
import { distinct, UNIQUE_OBJECT_ID } from './index';


function slen(arr: any[]) {
  return arr ? arr.length : undefined;
}

function smlen(arr: any) {
  return arr ? Object.keys(arr).length : undefined;
}

function debuggerTrap<T>(value: T): T {
  return value;
}

export class ParseTable {

  readonly rule: PRule;
  startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];
  readonly myCommons: GrammarParsingLeafStateCommon[];

  openerTrans: GenerateParseTableStackMainGen;

  packed = false;



  constructor(rule: PRule, g?: ParseTableGenerator) {
    this.rule = rule;

    this.allStates = [];
    this.myCommons = [];

    if (g) {
      this.startingState = g.startingStateNode.generateState(this);
      g.allLeafStateNodes.forEach(s => s.generateState(this));
    }

  }

  fillStackOpenerTransitions(phase: number, log = true) {
    if (!this.openerTrans) {
      this.openerTrans = new GenerateParseTableStackMainGen(null, this);
    }

    this.openerTrans.generate(phase);
  }

  pack(log = true) {
    var result: boolean;
    if (!this.packed) {
      var comp = new CompressParseTable(this, log);
      result = comp.pack();

      this.packed = true;
    }
    return result;
  }

  packAgain(log = true) {
    if (this.packed) {
      this.allStates.forEach(s => {
        s.serializedTuple = null;
      });
      this.myCommons.forEach(s => {
        s.serializedTuple = null;
      });
      this.packed = false;
    }
    this.pack(log);
  }

  static deserialize(rule: PRule, buf: number[]) {
    var result = Analysis.parseTable(rule);
    var pos = result.deser(buf);
    if (pos !== buf.length) throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
    return result;
  }

  leafState(index: number) {
    if (!index) return null;
    var ls = this.allStates[index - 1];
    if (!ls) {
      this.allStates[index - 1] = ls = new GrammarParsingLeafState();
      ls.index = index;
    }
    return ls;
  }

  ser(): number[] {

    this.pack();

    var serStates: number[] = [];

    this.allStates.forEach(s => {
      s.ser(serStates);
    });

    var result = [this.rule.nodeIdx, this.allStates.length].concat(serStates);
    return result;
  }

  deser(buf: number[]): number {
    var [ridx, stlen] = buf;
    if (ridx !== this.rule.nodeIdx) {
      throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
    }

    var pos = 2;
    var st0 = this.leafState(1);
    pos = st0.deser(1, buf, pos);
    this.startingState = st0;

    for (var i = 2; i <= stlen; i++) {
      var st = this.leafState(i);
      pos = st.deser(i, buf, pos);
    }

    return pos;
  }

  diagnosticEqualityCheck(table: ParseTable) {

    if (this.rule !== table.rule) {
      return debuggerTrap(false);
    } else if (slen(this.allStates) !== slen(table.allStates)) {
      return debuggerTrap(false);
    } else if (!this.startingState.diagnosticEqualityCheck(table.startingState)) {
      return debuggerTrap(false);
    } else {
      for (var i = 0; i < this.allStates.length; i++) {
        var a = this.allStates[i];
        var b = table.allStates[i];
        var c = a.diagnosticEqualityCheck(b);
        if (!c) {
          return debuggerTrap(false);
        }
      }
    }
    return debuggerTrap(true);
  }

  toString() {
    return "ParseTable/" + this.rule.rule + "/" + (this.allStates.length) + " states";
  }
}




class CompressParseTable {

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
      changed = this.prstate(state) || changed;
    });

    const sts = this.parseTable.allStates.length;
    Analysis.totalStates += sts;

    if (this.log) {
      console.log("Total: [ total states:" + Analysis.totalStates + "  distinct:" + (this.lfidx) + "    total states/common:" + Analysis.varShReqs.n + "   distinct:" + (this.cmnidx) + "    distinct transitions:" + (this.transidx) + "    distinct reduces:" + (this.redidx) + "   jmp.tokens:" + Analysis.varTkns.mean.toFixed(1) + "+-" + Analysis.varTkns.sqrtVariance.toFixed(1) + "   shift/tkns:" + Analysis.varShs.mean.toFixed(1) + "+-" + Analysis.varShs.sqrtVariance.toFixed(1) + "   rec.shift:" + Analysis.varShReqs.mean.toFixed(1) + "+-" + Analysis.varShReqs.sqrtVariance.toFixed(1) + "  reduces:" + Analysis.varRds.mean.toFixed(1) + "+-" + Analysis.varRds.sqrtVariance.toFixed(1) + " ]");
    }

    return changed;
  }

  prstate(state: GrammarParsingLeafState): boolean {
    if (state && !state.serializedTuple) {
      // lazy
      state.lazy(this.parseTable);

      var tots: [number, number, number, number] = [0, 0, 0, 0];

      var changed = this.prscmn(state.common);

      var rs1: [number] = [0];
      changed = this.red(state.reduceActions, rs1) || changed;
      Analysis.varRds.add(rs1[0]);

      var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
      var stcmidx = state.common ? state.common.index : 0;

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
        state.index = state0.index;
        state.serializedTuple = tuple;
        return true;
      } else {
        state.index = this.cmnidx++;
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
type ShiftTuple = [number, [number, RTShift][]];

class GenerateParseTableStackMainGen {

  readonly parent: GenerateParseTableStackBox;
  readonly top: GenerateParseTableStackMainGen;
  readonly indent: string = "";
  readonly stack: { [index: string]: GenerateParseTableStackMainGen };

  readonly parseTable: ParseTable;
  readonly rr: PRuleRef;
  readonly rule: PRule|PRuleRef;

  shifts: GrammarParsingLeafStateTransitions;

  unresolvedRecursiveBoxes: UnresolvedTuple[] = [];

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

  addAsUnresolved(stack: { [index: string]: GenerateParseTableStackMainGen }) {
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
    console.log(this.indent + phase + ">" + (this.rr ? this.rr : this.parseTable.rule+"#0")+" item:"+this.stack[this.rule.rule]);

    var top = !this.rr;

    switch (phase) {
      case 0:
        this.parseTable.allStates.forEach(s => {
          s.lazy(this.parseTable);
        });

        var was1st = 0, wasNon1st = 0;

        // Trivial items first :
        this.shifts = this.parseTable.startingState.common.transitions;

        this.parseTable.myCommons.forEach(c => {
          if (c === this.parseTable.startingState.common) {
            was1st = 1;
          } else {
            wasNon1st = 1;
          }

          if (!c.filledWithRecursive) {

            if (this.stack[this.rule.rule] !== this) {
              throw new Error("this.stack[this.parseTable.rule.rule:'"+this.rule.rule+"'] !== this   "+this.stack[this.parseTable.rule.rule]+" !== "+this);
            }
 
            var forNode = new GenerateParseTableStackBox(this, this.parseTable, c, this.stack);
            this.children.push(forNode);
            if (c === this.parseTable.startingState.common) {
              this.shifts = forNode.shifts;
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

        if (top) {
          if (this.unresolvedRecursiveBoxes.length) {
            var unresolvedRecursiveItems = this.unresolvedRecursiveBoxes;
            this.unresolvedRecursiveBoxes = [];
  
            console.log("ROUND " + phase + ". Postifx adding unresolved rule refs : " + unresolvedRecursiveItems.length);
            var childrenAffctd: GenerateParseTableStackBox[] = [];
            unresolvedRecursiveItems.forEach(tuple => {
              tuple[0].postfixInsertUnresolvedRule(tuple[1], tuple[2], tuple[3]);
              childrenAffctd.push(tuple[0]);
            });
  
            childrenAffctd = distinct(childrenAffctd);
            console.log("Affected distinct : " + childrenAffctd.length + "  generating shifts again...");
            childrenAffctd.forEach(chbox => {
              chbox.generateShiftsAgain(phase);
            });
            if (this.unresolvedRecursiveBoxes.length) {
              if (phase===10) {
                console.log("Stopped. Last phase reached. Still existing unresolved rule refs : " + unresolvedRecursiveItems.length);
              }
            } else if (!unresolvedRecursiveItems.length) {
              console.log("Finished. Not producing more stack shifts.");
            }
  
          } 
        }
        break;
    }

    // Since it is processed,
    // there should not present any "recursive shift" action any more
    if (this.shifts.map[0]) {
      throw new Error("this.shifts.map[0]  len:" + Object.keys(this.shifts.map).length);
    }
    console.log(this.indent + phase + "<" + (this.rr ? this.rr : this.parseTable.rule));
  }

}

class GenerateParseTableStackBox {

  top: GenerateParseTableStackMainGen;

  parent: GenerateParseTableStackMainGen;

  parseTable: ParseTable;

  common: GrammarParsingLeafStateCommon;

  stack: { [index: string]: GenerateParseTableStackMainGen };

  shifts: GrammarParsingLeafStateTransitions;

  allShifts: { [index: string]: ShiftTuple; }

  children: [GenerateParseTableStackMainGen, RTShift, PRuleRef][] = [];

  recursiveShifts: RTShift[];

  constructor(parent: GenerateParseTableStackMainGen, parseTable: ParseTable, common: GrammarParsingLeafStateCommon, stack: { [index: string]: GenerateParseTableStackMainGen }) {
    this.parent = parent;
    this.top = parent.top;
    this.parseTable = parseTable;
    this.common = common;
    this.stack = stack;

    this.shifts = new GrammarParsingLeafStateTransitions();

    this.allShifts = {};
  }

  generate(phase: number) {

    switch (phase) {
      case 0:

        this.recursiveShifts = this.common.recursiveShifts.map[0];

        if (this.recursiveShifts) {
          this.recursiveShifts.forEach(rshift => {
            this.insertStackOpenShifts(phase, rshift);
          });
        }
        break;

      case 1:
        const esths: [string, RTShift[]][] = Object.entries(this.common.transitions.map);
        esths.forEach(([key, shifts]) => {
          var tokenId = Number(key);
          shifts.forEach(shift => {
            this.newShift(shift.shiftIndex, [[tokenId, shift]]);
          });
        });
        this.children.forEach(child => {
          child[0].generate(phase);
        });

        // Trivial shifts only but no recursion everywhere after ROUND 1
        this.generateShifts(phase);
        break;

      case 2:
      case 3:
      case 4:
        this.children.forEach(child => {
          child[0].generate(phase);
        });
        this.children.forEach(child => {
          this.appendChild(child[0], child[1], child[2]);
        });

        // maybe re-generated but duplicates are excluded
        this.generateShifts(phase);

        break;
    }
  }


  generateShiftsAgain(phase: number) {

    var tokens = Object.keys(this.shifts.map).join(",");

    this.generateShifts(phase);

    var tokens2 = Object.keys(this.shifts.map).join(",");

    if (tokens !== tokens2) {
      this.addAsUnresolved({});
    }
  }

  addAsUnresolved(stack: { [index: string]: GenerateParseTableStackMainGen }) {
    // it is a starting node, which has dependencies required to update
    if (this.common === this.parent.parseTable.startingState.common) {
      this.parent.addAsUnresolved(stack);
    }
  }

  private newShift(expectedShiftIndex: number, theShifts: [number, RTShift][]) {

    var buf = [];
    theShifts.forEach(([tokenId, shift]) => {
      if (shift.shiftIndex !== expectedShiftIndex) {
        throw new Error("shift.shiftIndex !== expectedShiftIndex   "+shift.shiftIndex+" !== "+expectedShiftIndex);
      }
      buf.push(tokenId);
      buf.push(shift.toStateIndex);
      shift.serStackItms(buf);
    });
    var key = CodeTblToHex(buf).join("");

    var olditm = this.allShifts[key];
    if (olditm) {
      if (olditm[0] !== expectedShiftIndex) {
        throw new Error("Shift action already produced under another shiftIndex !   new shiftIndex:" + expectedShiftIndex + "  old shiftIndex:" + olditm[0]);
      }
      //throw new Error("Shift action already produced !   shiftIndex:"+oldShift.shiftIndex+"  old shiftIndex:"+olditm[0]);
    } else {
      this.allShifts[key] = [expectedShiftIndex, theShifts];
    }
  }

  private generateShifts(phase: number) {

    // doing it in-place to avoid updates over and over
    this.shifts.clear();

    var shiftvals = Object.values(this.allShifts);
    var shifstlen = shiftvals.length;
    shiftvals = distinct(shiftvals, (a, b) => {
      return a[0] - b[0];
    });
    if (shifstlen !== shiftvals.length) {
      throw new Error("shifstlen !== asvals.length   " + shifstlen + " !== " + shiftvals.length);
    }

    var shis = 0;
    shiftvals.forEach(([shi, tkshs]) => {
      tkshs.forEach(tksh => {
        var tokenId = tksh[0];
        var shift = tksh[1];
        if (shift.shiftIndex !== shi) {
          throw new Error("shift.shiftIndex !== shi   " + shift.shiftIndex + " !== " + shi);
        }
        shift.shiftIndex = shis;
        var shs = this.shifts.map[tokenId];
        if (!shs) {
          this.shifts.map[tokenId] = shs = [];
        }
        shs.push(shift);
        shis++;
      })
    });

    this.common.replace(this.shifts);

  }

  insertStackOpenShifts(phase: number, recursiveShift: RTShift) {
    if (!recursiveShift.toStateIndex) {
      throw new Error("recursiveShift.toStateIndex   " + recursiveShift.toStateIndex);
    }

    var state = this.parseTable.allStates[recursiveShift.toStateIndex - 1];
    if (state.startingPoint.kind !== PNodeKind.RULE_REF) {
      throw new Error("state.startingPoint.kind !== PNodeKind.RULE_REF   " + state.startingPoint.kind + " !== " + PNodeKind.RULE_REF);
    }
    if (recursiveShift.toStateIndex !== state.index) {
      throw new Error("recursiveShift.toStateIndex !== state.index   " + recursiveShift.toStateIndex + " !== " + state.index);
    }

    switch (phase) {
      case 0:

        var rr = state.startingPoint as PRuleRef;
        var ruleMain = this.stack[rr.rule];
        if (ruleMain) {

          ruleMain.dependants.push([this, recursiveShift, rr]);

          this.top.unresolvedRecursiveBoxes.push([this, ruleMain, recursiveShift, rr]);

        } else {

          var importedTable: ParseTable = Analysis.parseTables[rr.rule];
          if (rr.rule !== importedTable.rule.rule) {
            throw new Error("rr.rule !== importedTable.rule.rule   " + rr.rule + " !== " + importedTable.rule.rule);
          }

          ruleMain = new GenerateParseTableStackMainGen(this, importedTable, rr);
          ruleMain.dependants.push([this, recursiveShift, rr]);

          this.children.push([ruleMain, recursiveShift, rr]);

          // phase 0:
          ruleMain.generate(phase);
        }
        break;

      default:
        throw new Error("unexpected phase : " + phase);
    }
  }

  postfixInsertUnresolvedRule(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef) {
    this.appendChild(child, recursiveShift, rr);
  }

  private appendChild(child: GenerateParseTableStackMainGen, recursiveShift: RTShift, rr: PRuleRef) {

    const es: [string, RTShift[]][] = Object.entries(child.shifts.map);

    var impshifts: [number, RTShift][] = [];

    es.forEach(([key, shifts]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        var newImportedShift = new RTShift(recursiveShift.shiftIndex, recursiveShift.toStateIndex);
        var newStackItem = new RTStackShiftItem(rr, shift.toStateIndex);
        newImportedShift.stepIntoRecursive.push(newStackItem);
        [].push(newImportedShift.stepIntoRecursive, shift.stepIntoRecursive);
        impshifts.push([tokenId, newImportedShift]);
      });
    });
    if (impshifts.length) {
      this.newShift(recursiveShift.shiftIndex, impshifts);
    }
  }
}



export class RTShift {

  shiftIndex: number;

  readonly toStateIndex: number;

  readonly stepIntoRecursive: RTStackShiftItem[] = [];

  constructor(shiftIndex: number, toStateIndex: number) {
    this.shiftIndex = shiftIndex;
    this.toStateIndex = toStateIndex;
  }

  serStackItms(buf: number[]): void {
    buf.push(this.stepIntoRecursive.length);
    [].push.apply(buf, this.stepIntoRecursive.map(item => item.toStateIndex));
  }

  deserStackItms(buf: number[], pos: number): number {
    var itmlen = buf[pos++];
    var stp: RTStackShiftItem;
    for (var i = 0; i < itmlen; i++) {
      var tost = buf[pos++];
      stp = new RTStackShiftItem(null, tost);
      this.stepIntoRecursive.push(stp);
    }
    return pos;
  }

  diagnosticEqualityCheck(table: RTShift) {
    if (this.shiftIndex !== table.shiftIndex) {
      return debuggerTrap(false);
    } else if (this.toStateIndex !== table.toStateIndex) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}

export class RTStackShiftItem {

  parent: RTStackShiftItem;

  enter: PRuleRef;

  toStateIndex: number;

  constructor(enter: PRuleRef, toStateIndex: number, parent?: RTStackShiftItem) {
    this.enter = enter;
    this.toStateIndex = toStateIndex;
    this.parent = parent;
  }

  lazyRule(parseTable?: ParseTable, shift0?: RTShift) {
    if (parseTable) {
      this.enter = parseTable.allStates[shift0.toStateIndex - 1].startingPoint as PRuleRef;
    } else {
      parseTable = Analysis.parseTables[this.parent.enter.rule];
      this.enter = parseTable.allStates[this.parent.toStateIndex - 1].startingPoint as PRuleRef;
    }
  }
}


export class RTReduce {

  readonly shiftIndex: number;

  readonly node: PLogicNode;

  constructor(shiftIndex: number, node: PLogicNode) {
    this.shiftIndex = shiftIndex;
    this.node = node;
  }

  diagnosticEqualityCheck(table: RTReduce) {
    if (this.shiftIndex !== table.shiftIndex) {
      return debuggerTrap(false);
    } else if (this.node !== table.node) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}

export class GrammarParsingLeafStateTransitions {

  index: number;

  map: NumMapLike<RTShift[]> = {};

  alreadySerialized: number[];

  constructor(copy?: GrammarParsingLeafStateTransitions) {
    if (copy) {
      this.index = copy.index;
      this.map = Object.assign({}, copy.map);
      this.alreadySerialized = [].concat(copy.alreadySerialized);
    }
  }

  clear() {
    this.map = {};
    this.alreadySerialized = undefined;
  }

  ser(buf: number[]): void {

    var ord: number[][] = [];
    var es = Object.entries(this.map);
    es.forEach(([key, shifts]: [string, RTShift[]]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        var buf = [shift.shiftIndex, shift.toStateIndex, tokenId];
        shift.serStackItms(buf);
        ord.push(buf);
      });
    });
    ord.sort((a, b) => {
      var r0 = a[0] - b[0];
      if (r0) return r0;
      throw new Error();
      //var r1 = a[1] - b[1];
      //if (r1) return r1;
      //var r2 = a[2] - b[2];
      //return r2;
    });

    //buf.push(es.length);
    buf.push(ord.length);

    var idx = 0;

    ord.forEach(numbers => {
      var shi = numbers[0];
      if (shi !== idx) {
        throw new Error("shi !== idx   " + shi + " !== " + idx);
      }
      // 0 - not
      for (var i = 1; i < numbers.length; i++) {
        buf.push(numbers[i]);
      }
      idx++;
    });

  }

  deser(index: number, buf: number[], pos: number): number {

    this.index = index;

    var ordlen = buf[pos++];

    var idx = 0;
    for (var i = 0; i < ordlen; i++, idx++) {
      var sti = buf[pos++];
      var tki = buf[pos++];

      var shs = this.map[tki];
      if (!shs) {
        this.map[tki] = shs = [];
      }

      var shift = new RTShift(idx, sti);
      pos = shift.deserStackItms(buf, pos);
      shs.push(shift);
    }
    return pos;
  }


  diagnosticEqualityCheck(table: GrammarParsingLeafStateTransitions) {
    if (this.index !== table.index) {
      return debuggerTrap(false);
    } else {
      const keys1 = Object.keys(this.map);
      const keys2 = Object.keys(table.map);
      if (keys1.length !== keys2.length) {
        return debuggerTrap(false);
      }
      keys1.sort();
      keys2.sort();
      for (var i = 0; i < keys1.length; i++) {
        var k1 = keys1[i];
        var k2 = keys2[i];
        if (k1 !== k2) {
          return debuggerTrap(false);
        }
        var shs1 = this.map[Number(k1)];
        var shs2 = table.map[Number(k1)];
        if (slen(shs1) !== slen(shs2)) {
          return debuggerTrap(false);
        }
        for (var j = 0; j < shs1.length; j++) {
          var a = shs1[j];
          var b = shs2[j];
          var c = a.diagnosticEqualityCheck(b);
          if (!c) {
            return debuggerTrap(false);
          }
        }
      }
    }
    return debuggerTrap(true);
  }
}

export class GrammarParsingLeafStateReduces {

  index: number;

  readonly reducedNodes: RTReduce[][] = [];

  alreadySerialized: number[];

  ser(buf: number[]): void {
    var buf2 = [];
    var tot = 0;
    this.reducedNodes.forEach(rs => {
      rs.forEach(r => {
        buf2.push(r.shiftIndex);
        buf2.push(r.node.nodeIdx);
        tot++;
      });
    });
    buf.push(tot);
    [].push.apply(buf, buf2);
  }

  deser(index: number, buf: number[], pos: number): number {

    this.index = index;

    var tot = buf[pos++];
    for (var i = 0; i < tot; i++) {
      var shi = buf[pos++];
      var nidx = buf[pos++];
      var node = HyperG.nodeTable[nidx];
      var rs = this.reducedNodes[shi];
      if (!rs) {
        this.reducedNodes[shi] = rs = [];
      }
      rs.push(new RTReduce(shi, node));
    }
    return pos;
  }

  diagnosticEqualityCheck(table: GrammarParsingLeafStateReduces) {
    if (this.index !== table.index) {
      return debuggerTrap(false);
    } else if (slen(this.reducedNodes) !== slen(table.reducedNodes)) {
      return debuggerTrap(false);
    } else {
      for (var i = 0; i < this.reducedNodes.length; i++) {
        var a = this.reducedNodes[i];
        var b = table.reducedNodes[i];
        if (slen(a) !== slen(b)) {
          return debuggerTrap(false);
        } else {
          for (var j = 0; j < a.length; j++) {
            var c = a[j].diagnosticEqualityCheck(b[j]);
            if (!c) {
              return debuggerTrap(false);
            }
          }
        }
      }
    }
    return debuggerTrap(true);
  }
}

export class GrammarParsingLeafStateCommon {

  index: number;

  startStateNode: StateNodeCommon;

  // tokenId -> traversion state
  private _transitions: GrammarParsingLeafStateTransitions;
  reduceActions: GrammarParsingLeafStateReduces;
  recursiveShifts: GrammarParsingLeafStateTransitions;
  serialStateMap: GrammarParsingLeafStateTransitions;
  serializedTuple: [number, number];

  filledWithRecursive = false;

  constructor(startStateNode?: StateNodeCommon) {
    if (startStateNode) {
      this.index = startStateNode.index;
    }
    this.startStateNode = startStateNode;
    this.reduceActions = null;
  }

  get transitions(): GrammarParsingLeafStateTransitions {
    if (!this._transitions) {

      if (this.serialStateMap) {

        this._transitions = new GrammarParsingLeafStateTransitions();
        this.recursiveShifts = new GrammarParsingLeafStateTransitions();
        this.reduceActions = new GrammarParsingLeafStateReduces();

        var shiftses: [string, RTShift[]][] = Object.entries(this.serialStateMap.map);

        shiftses.forEach(([key, shs]) => {
          var tki = Number(key);
          if (tki) {
            // nonreq
            this._transitions.map[tki] = shs;
          } else {
            // req
            this.recursiveShifts.map[tki] = shs;
          }
        });


      } else {

        this._transitions = new GrammarParsingLeafStateTransitions();
        this.recursiveShifts = new GrammarParsingLeafStateTransitions();
        this.serialStateMap = new GrammarParsingLeafStateTransitions();
        this.reduceActions = new GrammarParsingLeafStateReduces();

        const pushToMap = (s: Shifts, tokenId: number, map: GrammarParsingLeafStateTransitions) => {
          var ts = map.map[tokenId];
          if (!ts) {
            map.map[tokenId] = ts = [];
          }
          var shift = new RTShift(shiftIndex, s.item.stateNode.index);
          ts.push(shift)
        };

        var shiftIndex = 0;
        this.startStateNode.shiftsAndReduces.forEach(nextTerm => {

          switch (nextTerm.kind) {
            case ShiftReduceKind.SHIFT:

              var s = nextTerm as Shift;
              pushToMap(s, s.item.node.value, this._transitions)
              pushToMap(s, s.item.node.value, this.serialStateMap)
              shiftIndex++;
              break;

            // these are the rule-ref recursive states
            // these have unknown jumping-in tokens, so 
            // we should handle more complex states in runtime 
            case ShiftReduceKind.SHIFT_RECURSIVE:

              var sr = nextTerm as ShiftRecursive;
              pushToMap(sr, 0, this.recursiveShifts)
              pushToMap(sr, 0, this.serialStateMap)
              shiftIndex++;

              break;

            case ShiftReduceKind.REDUCE:
            case ShiftReduceKind.REDUCE_RECURSIVE:
              var r = nextTerm as Reduce;
              var rs = this.reduceActions.reducedNodes[shiftIndex];
              if (!rs) {
                this.reduceActions.reducedNodes[shiftIndex] = rs = [];
              }

              rs.push(new RTReduce(shiftIndex, r.item.node));

              break;
            default:
              throw new Error("222b  " + nextTerm);
          }
        });
      }
    }
    return this._transitions;
  }

  replace(newSerialStateMap: GrammarParsingLeafStateTransitions) {
    this._transitions = null;
    this.recursiveShifts = null;
    this.serialStateMap = newSerialStateMap;
  }

  ser(buf: number[]): void {
    [].push.apply(buf, this.serializedTuple);
  }

  deser(index: number, buf: number[], pos: number): number {

    this.index = index;

    var [trind, rdind] = [buf[pos++], buf[pos++]];

    this.serialStateMap = Analysis.leafStateTransitionTables[trind];
    if (!this.serialStateMap) this.serialStateMap = new GrammarParsingLeafStateTransitions();
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    if (!this.reduceActions) this.reduceActions = new GrammarParsingLeafStateReduces();
    // TODO separate _transitions and recursiveShifts

    return pos;
  }

  diagnosticEqualityCheck(table: GrammarParsingLeafStateCommon) {
    if (this.index !== table.index) {
      return debuggerTrap(false);
    } else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
      return debuggerTrap(false);
    } else if (!this.serialStateMap.diagnosticEqualityCheck(table.serialStateMap)) {
      return debuggerTrap(false);
    } else if (!this.recursiveShifts.diagnosticEqualityCheck(table.recursiveShifts)) {
      return debuggerTrap(false);
    } else if (!this._transitions.diagnosticEqualityCheck(table._transitions)) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}

export class GrammarParsingLeafState {

  index: number;
  packedIndex: number;

  startingPoint: PRef|PValueNode;
  startStateNode: StateNodeWithPrefix;

  common: GrammarParsingLeafStateCommon;
  reduceActions: GrammarParsingLeafStateReduces;
  serializedTuple: [number, number, number];

  constructor(startStateNode?: StateNodeWithPrefix, startingPoint?: PRef) {
    if (startStateNode) {
      this.index = startStateNode.index;
    }
    this.startStateNode = startStateNode;
    this.startingPoint = startingPoint;
    this.reduceActions = null;
  }

  lazy(parseTable: ParseTable) {

    if (!this.reduceActions) {

      this.reduceActions = new GrammarParsingLeafStateReduces();

      if (this.startStateNode) {
        var shiftIndex = 0;
        this.startStateNode.reduces.forEach(nextTerm => {

          switch (nextTerm.kind) {

            case ShiftReduceKind.REDUCE:
            case ShiftReduceKind.REDUCE_RECURSIVE:
              var r = nextTerm as Reduce;
              var rs = this.reduceActions.reducedNodes[shiftIndex];
              if (!rs) {
                this.reduceActions.reducedNodes[shiftIndex] = rs = [];
              }

              rs.push(new RTReduce(shiftIndex, r.item.node));

              break;
            default:
              throw new Error("223b  " + nextTerm);
          }
        });
        if (this.startStateNode.common) {
          this.common = Analysis.leafStateCommon(parseTable, this.startStateNode.common.index);
          if (!this.common.startStateNode) {
            this.common.startStateNode = this.startStateNode.common;
          }
          // lazy
          this.common.transitions;
        }
      } else {
        throw new Error("Uninitilized GrammarParsingLeafState");
      }
    }
  }

  ser(buf: number[]): void {
    [].push.apply(buf, this.serializedTuple);
  }

  deser(index: number, buf: number[], pos: number): number {

    var [spx, rdind, cmni] = [buf[pos++], buf[pos++], buf[pos++]];

    this.index = index;

    this.startingPoint = spx ? HyperG.nodeTable[spx] as PRef : null;
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    this.common = Analysis.leafStateCommons[cmni];
    if (!this.reduceActions) this.reduceActions = new GrammarParsingLeafStateReduces();

    return pos;
  }

  diagnosticEqualityCheck(table: GrammarParsingLeafState) {
    if (this.index !== table.index) {
      return debuggerTrap(false);
    } else if (this.startingPoint !== table.startingPoint) {
      return debuggerTrap(false);
    } else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }


}


