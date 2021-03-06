import { removeArrayItemMore } from './hyperg';
import {
  Analysis,
  CompressParseTable,
  distinct,
  GenerateParseTableStackMainGen,
  groupBy2Indexed,
  HyperG,
  HyperGEnvType,
  NumMapLike,
  ParseTableGenerator,
  PLogicNode,
  PNode,
  PRef,
  PRule,
  PRuleRef,
  PValueNode,
  Reduce,
  Shift,
  ShiftRecursive,
  ShiftReduceKind,
  Shifts,
  StateNodeCommon,
  StateNodeWithPrefix,
  UNIQUE_OBJECT_ID,
} from '.';


function slen(arr: any[]) {
  return arr ? arr.length : undefined;
}

function sobj(obj: any) {
  return obj ? 1 : 0;
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

  readonly choiceTokenMap: PValueNode[][] = [];

  openerTrans: GenerateParseTableStackMainGen;

  packed = false;

  packedIndex: number;

  constructor(rule: PRule, g?: ParseTableGenerator) {
    this.rule = rule;

    this.allStates = [];
    this.myCommons = [];
    this.choiceTokenMap = Analysis.choiceTokenMap;

    if (g) {
      this.startingState = g.startingStateNode.generateState(this);
      g.allLeafStateNodes.forEach(s => s.generateState(this));
    }

  }

  resetOptimization(log = true) {

    this.openerTrans = null;
    this.packed = false;

    this.allStates.forEach(s => {
      if (s) {
        s.common = null;
        s.reduceActions = null;
        s.serializedTuple = null;
      }
    });
    this.myCommons.forEach(s => {
      if (s) {
        s.packedIndex = undefined;
        s.serializedTuple = null;
        s.reduceActions = null;
        s.replace(null);
      }
    });

  }

  fillStackOpenerTransitions(phase: number, log = true) {
    if (!this.openerTrans) {
      this.openerTrans = new GenerateParseTableStackMainGen(null, this);
    }

    this.openerTrans.generate(phase);
  }

  pack(allowReindexTransitions: boolean, log = true, info = "") {
    var result: boolean;
    if (!this.packed) {
      var comp = new CompressParseTable(this, allowReindexTransitions, log, info);
      result = comp.pack();

      this.packed = true;
    }
    return result;
  }

  static deserialize(rule: PRule, buf: number[]) {
    var result = Analysis.parseTable(rule);
    var pos = result.deser(buf, 0);
    if (pos !== buf.length) throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
    return result;
  }

  leafStateCommon(index: number) {
    if (!index) return null;
    var ls = this.myCommons[index];
    if (!ls) {
      this.myCommons[index] = ls = new GrammarParsingLeafStateCommon();
      ls.index = index;
    }
    return ls;
  }

  leafState(index: number) {
    if (!index) return null;
    var ls = this.allStates[index];
    if (!ls) {
      this.allStates[index] = ls = new GrammarParsingLeafState();
      ls.index = index;
    }
    return ls;
  }

  ser(mode: HyperGEnvType): number[] {
    var b: Analysis.SerOutputWithIndex;
    if (b = Analysis.serializedParseTables[this.packedIndex]) {
      return b.output;
    }

    var serStates: number[] = [];
    var myc: GrammarParsingLeafStateCommon[];
    var als: GrammarParsingLeafState[];

    switch (mode) {
      case HyperGEnvType.ANALYZING:
        myc = distinct(this.myCommons, (a, b) => (a.replacedIndex - b.replacedIndex));
        als = distinct(this.allStates, (a, b) => (a.replacedIndex - b.replacedIndex));
        break;
      default:
        myc = Object.values(this.myCommons);
        als = Object.values(this.allStates);
        break;
    }

    for (var i = 0; i < myc.length;) {
      let s = myc[i++];
      if (s.replacedIndex !== undefined && s.replacedIndex !== i) {
        throw new Error("s.replacedIndex replacedIndex !== i   " + s.replacedIndex + " !== " + i);
      }
      if (s) {
        serStates.push(s.packedIndex);
      } else {
        serStates.push(0);
      }
    }

    for (var i = 0; i < als.length;) {
      let s = als[i++];
      if (s.replacedIndex !== undefined && s.replacedIndex !== i) {
        throw new Error("s.replacedIndex replacedIndex !== i   " + s.replacedIndex + " !== " + i);
      }
      if (s) {
        serStates.push(s.packedIndex);
      } else {
        serStates.push(0);
      }
    }

    var result = [this.rule.nodeIdx, myc.length, als.length].concat(serStates);
    return result;
  }

  deser(buf: number[], pos: number): number {
    var [ridx, cmlen, stlen] = buf;
    if (ridx !== this.rule.nodeIdx) {
      throw new Error("Data error , invalid rule : " + this.rule + "/" + this.rule.nodeIdx + " vs  ridx:" + ridx);
    }
    pos = 3;

    for (var i = 1; i <= cmlen; i++) {
      var packedIdx = buf[pos++];
      Analysis.leafStateCommon(this, i, packedIdx);
    }
    for (var i = 1; i <= stlen; i++) {
      var packedIdx = buf[pos++];
      Analysis.leafState(this, i, packedIdx);
    }
    this.startingState = this.allStates[1];
    if (!this.startingState) {
      throw new Error(this.rule.rule + "  !this.startingState");
    }

    return pos;
  }

  diagnosticEqualityCheck(table: ParseTable) {

    if (this.rule !== table.rule) {
      return debuggerTrap(false);
    } else if (slen(this.allStates) !== slen(table.allStates)) {
      return debuggerTrap(false);
    } else if (slen(this.myCommons) !== slen(table.myCommons)) {
      return debuggerTrap(false);
    } else if (!this.startingState.diagnosticEqualityCheck(table.startingState)) {
      return debuggerTrap(false);
    } else {
      for (var i = 0; i < this.allStates.length; i++) {
        let a = this.allStates[i];
        let b = table.allStates[i];
        if (sobj(a) !== sobj(b)) {
          return debuggerTrap(false);
        }
        if (a) {
          var c = a.diagnosticEqualityCheck(b);
          if (!c) {
            return debuggerTrap(false);
          }
        }
      }
      for (var i = 0; i < this.myCommons.length; i++) {
        let a = this.myCommons[i];
        let b = table.myCommons[i];
        if (sobj(a) !== sobj(b)) {
          return debuggerTrap(false);
        }
        if (a) {
          var c = a.diagnosticEqualityCheck(b);
          if (!c) {
            return debuggerTrap(false);
          }
        }
      }
    }
    return debuggerTrap(true);
  }

  toString() {
    return "ParseTable/" + this.rule.rule + "/" + (this.allStates.length) + " states";
  }
}



export class RTShift {

  shiftIndex: number;

  stepIntoRecursive: RTStackShiftItem;

  constructor(shiftIndex: number, stepIntoRecursive?: RTStackShiftItem) {
    this.shiftIndex = shiftIndex;
    this.stepIntoRecursive = stepIntoRecursive;
  }

  get toStateIndex() {
    return this.stepIntoRecursive.toStateIndex;
  }

  diagnosticEqualityCheck(table: RTShift) {
    if (this.shiftIndex !== table.shiftIndex) {
      return debuggerTrap(false);
    } else if (this.stepIntoRecursive !== table.stepIntoRecursive) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}

export class gRTShift extends RTShift {

  tokenId: number;

  constructor(shiftIndex: number, tokenId: number, stepIntoRecursive?: RTStackShiftItem) {
    super(shiftIndex, stepIntoRecursive);
    this[UNIQUE_OBJECT_ID];
    this.tokenId = tokenId;
  }
}


export class RTStackShiftItem {

  enter: PRuleRef;

  index: number;
  childIndex: number;

  toStateIndex: number;

  _child: RTStackShiftItem;

  depth = 1;

  constructor(enter: PRuleRef, toStateIndex: number, child?: RTStackShiftItem) {
    this.enter = enter;
    this.toStateIndex = toStateIndex;
    this._child = child;
    if (child) {
      this.depth = child.depth + 1;
    }
  }

  get child() {
    if (!this._child && this.childIndex) {
      this._child = Analysis.stackShiftNodes[this.childIndex];
      this.depth = this._child.depth + 1;
    }
    return this._child;
  }

  lazy(parseTable?: ParseTable, enter?: PRuleRef) {
    if (!this.enter) {
      this.enter = enter;
    }
    if (!this.child.enter) {
      this.child.enter = parseTable.allStates[this.toStateIndex].startingPoint as PRuleRef;
    }
  }

  get tuple() {
    if (this.child) {
      return [this.toStateIndex, this.child.index];
    } else {
      return [this.toStateIndex, 0];
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

  constructor(copy?: GrammarParsingLeafStateTransitions) {
    if (copy) {
      this.index = copy.index;
      this.map = Object.assign({}, copy.map);
    }
  }

  clear() {
    this.map = {};
  }

  slotsByNonUniqueShiftIndex(): NumMapLike<RTShift[]> {
    var slots = groupBy2Indexed(this.map, (a) => {
      return a.shiftIndex;
    })
    return slots;
  }

  fixedClone(): GrammarParsingLeafStateTransitions {
    throw new Error("Default shifts not fixable");
  }

  ser(buf: number[]): void {

    var ord: number[][] = [];
    var es: [string, RTShift[]][] = Object.entries(this.map);
    es.forEach(([key, shifts]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        var buf = [shift.shiftIndex, tokenId, 
          shift.stepIntoRecursive ? shift.stepIntoRecursive.index : 0];
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
      buf.push(numbers[1]);
      buf.push(numbers[2]);
      idx++;
    });

  }

  deser(index: number, buf: number[], pos: number): number {

    this.index = index;

    var ordlen = buf[pos++];

    var idx = 0;
    for (var i = 0; i < ordlen; i++, idx++) {
      var tki = buf[pos++];

      var shs = this.map[tki];
      if (!shs) {
        this.map[tki] = shs = [];
      }

      var shift = new RTShift(idx);

      var rsti = buf[pos++];
      shift.stepIntoRecursive = Analysis.stackShiftNodes[rsti];
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

export class gGrammarParsingLeafStateTransitions extends GrammarParsingLeafStateTransitions {

  map: NumMapLike<gRTShift[]> = {};

  add(shift: gRTShift) {
    var tshs = this.map[shift.tokenId];
    if (!tshs) {
      this.map[shift.tokenId] = tshs = [];
    }
    tshs.push(shift);
  }

  replace(shift: gRTShift) {
    var tshs = this.map[shift.tokenId];
    if (!tshs) {
      throw new Error("Replace very nothing");
    }
    var rs = removeArrayItemMore(tshs, shift, (a, b) => {
      return a.shiftIndex - b.shiftIndex;
    });
    if (rs !== 1) {
      throw new Error("Replace cnt not 1 : " + rs);
    }
    tshs.push(shift);
  }

  clone(fixIds = false) {
    var fixIdCnt = 0;
    var slots: gRTShift[][] = this.slotsByNonUniqueShiftIndex() as gRTShift[][];
    var result = new gGrammarParsingLeafStateTransitions();
    Object.values(slots).forEach(slot => {
      slot.forEach(shift => {
        const shidx = fixIds ? fixIdCnt++ : shift.shiftIndex;
        var dupWithFixedId = new gRTShift(shidx, shift.tokenId, shift.stepIntoRecursive);
        result.add(dupWithFixedId)
      });
    });
    return result;
  }

  fixedClone() {
    return this.clone(true);
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
    } else if (this.reducedNodes) {
      for (var i = 0; i < this.reducedNodes.length; i++) {
        var a = this.reducedNodes[i];
        var b = table.reducedNodes[i];
        if (slen(a) !== slen(b)) {
          return debuggerTrap(false);
        } else if (a) {
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
  packedIndex: number;
  replacedIndex: number;

  startStateNode: StateNodeCommon;

  // tokenId -> traversion state
  private _transitions: GrammarParsingLeafStateTransitions;
  reduceActions: GrammarParsingLeafStateReduces;
  recursiveShifts: GrammarParsingLeafStateTransitions;
  serialStateMap: GrammarParsingLeafStateTransitions;
  serializedTuple: [number, number];

  constructor() {
    this.reduceActions = null;
  }

  get transitions(): GrammarParsingLeafStateTransitions {
    if (!this._transitions) {

      if (this.serialStateMap) {

        this._transitions = new GrammarParsingLeafStateTransitions();
        this.recursiveShifts = new GrammarParsingLeafStateTransitions();
        if (!this.reduceActions) {
          this.reduceActions = new GrammarParsingLeafStateReduces();
        }

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

        var chkUniqShi = {};
        const pushToMap = (s: Shifts, tokenId: number, map: GrammarParsingLeafStateTransitions, chkUniqShi?: any) => {
          if (chkUniqShi) {
            if (chkUniqShi[s.item.stateNode.index]) {
              throw new Error("state index not unique : " + s.item.stateNode.index);
            }
            chkUniqShi[s.item.stateNode.index] = 1;
          }
          var ts = map.map[tokenId];
          if (!ts) {
            map.map[tokenId] = ts = [];
          }

          var stk = Analysis.createStackShiftNode(s.item.stateNode.index, null);
          var shift = new RTShift(shiftIndex, stk);
          ts.push(shift)
        };

        var shiftIndex = 0;
        this.startStateNode.shiftsAndReduces.forEach(nextTerm => {

          switch (nextTerm.kind) {
            case ShiftReduceKind.SHIFT:

              var s = nextTerm as Shift;
              pushToMap(s, s.item.node.tokenId, this._transitions)
              pushToMap(s, s.item.node.tokenId, this.serialStateMap, chkUniqShi)
              shiftIndex++;
              break;

            // these are the rule-ref recursive states
            // these have unknown jumping-in tokens, so 
            // we should handle more complex states in runtime 
            case ShiftReduceKind.SHIFT_RECURSIVE:

              var sr = nextTerm as ShiftRecursive;
              pushToMap(sr, 0, this.recursiveShifts)
              pushToMap(sr, 0, this.serialStateMap, chkUniqShi)
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
    if (newSerialStateMap && !this.reduceActions) {
      throw new Error("Invalid state...");
    }
    this._transitions = null;
    this.recursiveShifts = null;
    this.serialStateMap = newSerialStateMap;
  }

  ser(): [number, number] {
    var smx = this.serialStateMap ? this.serialStateMap.index : 0
    var rdx = this.reduceActions ? this.reduceActions.index : 0
    var tuple: [number, number] = [smx, rdx];
    return tuple;
  }

  deser(packedIndex: number, buf: number[], pos: number): number {

    this.packedIndex = packedIndex;

    var [trind, rdind] = [buf[pos++], buf[pos++]];

    this.serialStateMap = Analysis.leafStateTransitionTables[trind];
    if (!this.serialStateMap) this.serialStateMap = new GrammarParsingLeafStateTransitions();
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    if (!this.reduceActions) this.reduceActions = new GrammarParsingLeafStateReduces();
    // TODO separate _transitions and recursiveShifts

    return pos;
  }

  diagnosticEqualityCheck(table: GrammarParsingLeafStateCommon) {
    this.transitions;
    table.transitions;
    if (this.packedIndex !== table.packedIndex) {
      return debuggerTrap(false);
    } else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
      return debuggerTrap(false);
    } else if (!this.serialStateMap.diagnosticEqualityCheck(table.serialStateMap)) {
      return debuggerTrap(false);
    } else if (!this.recursiveShifts.diagnosticEqualityCheck(table.recursiveShifts)) {
      return debuggerTrap(false);
    } else if (!this.transitions.diagnosticEqualityCheck(table.transitions)) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }
}





export class GrammarParsingLeafState {

  index: number;
  packedIndex: number;
  replacedIndex: number;

  startingPoint: PRef | PValueNode;
  startStateNode: StateNodeWithPrefix;

  commonIndex: number;
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

  lazyCommon(parseTable: ParseTable) {
    if (!this.common) {
      if (this.commonIndex) {
        this.common = parseTable.leafStateCommon(this.commonIndex);
      } else if (this.startStateNode) {
        if (this.startStateNode.common) {
          this.common = parseTable.leafStateCommon(this.startStateNode.common.index);
          if (!this.common.startStateNode) {
            this.common.startStateNode = this.startStateNode.common;
          }
        }
      } else {
        console.warn("Uninitilized GrammarParsingLeafState");
      }
    }
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
      } else {
        console.warn("Uninitilized GrammarParsingLeafState");
      }
    }

    this.lazyCommon(parseTable);

    if (this.common) {
      // lazy
      this.common.transitions;
    }
  }

  ser(): [number, number, number] {
    var spidx = this.startingPoint ? this.startingPoint.nodeIdx : 0;
    var rdx = this.reduceActions ? this.reduceActions.index : 0
    var stcmidx = this.commonIndex ? this.commonIndex
      : (this.common ? this.common.replacedIndex : 0);

    var tuple: [number, number, number] = [spidx, rdx, stcmidx];
    return tuple;
  }

  deser(packedIndex: number, buf: number[], pos: number): number {

    var [spx, rdind, cmni] = [buf[pos++], buf[pos++], buf[pos++]];

    this.packedIndex = packedIndex;

    this.startingPoint = spx ? HyperG.nodeTable[spx] as PNode : null;
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    this.commonIndex = cmni;
    if (!this.reduceActions) this.reduceActions = new GrammarParsingLeafStateReduces();

    return pos;
  }

  diagnosticEqualityCheck(table: GrammarParsingLeafState) {
    if (this.packedIndex !== table.packedIndex) {
      return debuggerTrap(false);
    } else if (this.commonIndex !== table.commonIndex) {
      return debuggerTrap(false);
    } else if (this.startingPoint !== table.startingPoint) {
      return debuggerTrap(false);
    } else if (!this.reduceActions.diagnosticEqualityCheck(table.reduceActions)) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
  }


}


