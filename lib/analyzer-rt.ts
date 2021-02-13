import { PRule, Analysis, CodeTblToHex, PLogicNode, NumMapLike, HyperG, PRef, Shifts, ShiftReduceKind, Shift, ShiftRecursive, Reduce, RuleElementTraverser, RuleRefTraverser, TerminalRefTraverser, ParseTableGenerator, EntryPointTraverser, Traversing, StateNodeCommon } from ".";
import { StateNodeWithPrefix } from './analyzer';

function slen(arr: any[]) {
  return arr ? arr.length : undefined;
}

function smlen(arr: any) {
  return arr ? Object.keys(arr).length : undefined;
}

function debuggerTrap<T>(value:T):T {
  return value;
}

export class ParseTable {

  readonly rule: PRule;
  startingState: GrammarParsingLeafState;
  // Map  Leaf parser nodeTravId -> 
  readonly allStates: GrammarParsingLeafState[];


  constructor(rule: PRule, startingState: GrammarParsingLeafState, allStates: GrammarParsingLeafState[]) {
    this.rule = rule;
    this.startingState = startingState;
    this.allStates = allStates;

  }

  pack() {

    if (this.allStates.length > Analysis.uniformMaxStateId) {
      throw new Error("State id overflow. Grammar too big. uniformMaxStateId:"+Analysis.uniformMaxStateId+"  Too many states:"+this.allStates.length);
    }

    // !
    Analysis.leafStates = [];

    // We need 2 serializedTuples
    if (!Analysis.stack[0]) {
      Analysis.stack[0] = Analysis.empty();
    }

    // indexes
    // 1 based
    // 0 means empty
    var transidx = 1;
    var redidx = 1;


    prstate(this.startingState);
    this.allStates.forEach(state=>{
      prstate(state);
    });

    var t = Object.keys(Analysis.serializedTransitions).length;
    var r = Object.keys(Analysis.serializedReduces).length;
    var tp = Object.keys(Analysis.serializedTuples).length;
    var tp2 = Object.keys(Analysis.stack[0].serializedTuples).length;

    const sts = 1+this.allStates.length;
    Analysis.totalStates += sts;
    console.log(this.rule.rule+"   states:"+(sts) +"     Total: [ totalStates:"+Analysis.totalStates+"   distinct transitions:"+(t)+"     distinct reduces:"+(r)+"      distinct states/leaf:"+(tp)+"   distinct states/common:"+(tp2)+"   jmp.tokens:"+varTkns.mean.toFixed(1)+"+-"+varTkns.sqrtVariance.toFixed(1)+"   shift/tkns:"+varShs.mean.toFixed(1)+"+-"+varShs.sqrtVariance.toFixed(1)+"   rec.shift:"+varShReqs.mean.toFixed(1)+"+-"+varShReqs.sqrtVariance.toFixed(1) +"  reduces:"+varRds.mean.toFixed(1)+"+-"+varRds.sqrtVariance.toFixed(1)+" ]");

    function prstate(state: GrammarParsingLeafState) {
      // lazy
      state.lazy();

      var tots:[number,number,number,number]=[0,0,0,0];

      prscmn(state.common);

      var rs1 = red(state.reduceActions);
      varRds.add(rs1);

      var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
  
      var tuple:[number,number,number] = [spidx, state.reduceActions.index, state.common.index];
      var tkey = CodeTblToHex(tuple).join("");

      var tuple0:[number,number,number] = Analysis.serializedTuples[tkey] as any;
      if (tuple0) {
        state.serializedTuple = tuple0;
      } else {
        state.serializedTuple = tuple;
        Analysis.serializedTuples[tkey] = tuple as any;
      }

    }

    function prscmn(state: GrammarParsingLeafStateCommon) {
      if (!state.serializedTuple) {
        // lazy
        state.transitions;

        var tots:[number,number,number,number]=[0,0,0,0];

        tra(state.serialStateMap, tots);
        var [nonreq,nonreqtot,req,reqtot]=tots;

        if (nonreq) {
          varTkns.add(nonreq);
          varShs.add(nonreqtot/nonreq);
        }
        if (req) {
          if (req !== 1) {
            throw new Error("req !== 1  "+req+" !== "+1);
          }
        }
        varShReqs.add(reqtot);

        var rs1 = red(state.reduceActions);
        varRds.add(rs1);
  
        var tuple:[number,number] = [state.serialStateMap.index, state.reduceActions.index];
        var tkey = CodeTblToHex(tuple).join("");

        var tuple0:[number,number] = Analysis.stack[0].serializedTuples[tkey] as any;
        if (tuple0) {
          state.serializedTuple = tuple0;
        } else {
          state.serializedTuple = tuple;
          Analysis.stack[0].serializedTuples[tkey] = tuple as any;
        }
      }
    }

    function tra(trans: GrammarParsingLeafStateTransitions, maplen:[number,number,number,number]) {
      var shiftses:[string,RTShift[]][] = Object.entries(trans.map);
      if (shiftses.length) {
        var nonreq = 0;
        var nonreqtot = 0;
        var req = 0;
        var reqtot = 0;
        shiftses.forEach(([key,shs])=>{
          var tki = Number(key);
          if (tki) {
            nonreq++;
            nonreqtot+=shs.length;
          } else {
            req++;
            reqtot+=shs.length;
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
        } else {
          trans.index = transidx++;
          Analysis.serializedTransitions[encoded] = trans;
        }
      } else {
        trans.index = 0;
      }
      return shiftses.length;
    }

    function red(rr: GrammarParsingLeafStateReduces) {
      var rlen = rr.reducedNodes.length;
      if (rlen) {
        var buf = [];
        rr.alreadySerialized = null;
        rr.ser(buf);
        rr.alreadySerialized = buf;
        var encred = CodeTblToHex(buf).join("");

        var rr0 = Analysis.serializedReduces[encred];
        if (rr0) {
          rr.index = rr0.index;
        } else {
          rr.index = redidx++;
          Analysis.serializedReduces[encred] = rr;
        }
      } else {
        rr.index = 0;
      }
      return rlen;
    }
  }

  static deserialize(rule: PRule, buf: number[]) {
    var result = new ParseTable(rule, null, []);
    var pos = result.deser(buf);
    if (pos !== buf.length) throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
    return result;
  }

  ser(): number[] {

    this.pack();
    
    var serStates: number[] = [];

    this.startingState.ser(serStates);

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
    var st0 = Analysis.leafState(1);
    pos = st0.deser(1, buf, pos);
    this.startingState = st0;

    stlen++;
    for (var i = 2; i <= stlen; i++) {
      var st = Analysis.leafState(i);
      pos = st.deser(i, buf, pos);
      this.allStates.push(st);
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
    return "ParseTable/"+this.rule.rule+"/"+(1+this.allStates.length)+" states";
  }
}

export class RTShift {

  readonly shiftIndex: number;

  readonly toState: GrammarParsingLeafState;

  constructor(shiftIndex: number, toState: GrammarParsingLeafState) {
    this.shiftIndex = shiftIndex;
    this.toState = toState;
  }

  diagnosticEqualityCheck(table: RTShift) {
    if (this.shiftIndex !== table.shiftIndex) {
      return debuggerTrap(false);
    } else if (this.toState !== table.toState) {
      return debuggerTrap(false);
    }
    return debuggerTrap(true);
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

  startingStateMinus1: number;

  map: NumMapLike<RTShift[]> = {};

  alreadySerialized: number[];

  delta(stateId: number): number {
    return stateId - this.startingStateMinus1;
  }

  ser(buf: number[]): void {

    var ord:[number,number,number][] = [];
    var es = Object.entries(this.map);
    es.forEach(([key, shifts]: [string, RTShift[]]) => {
      var tokenId = Number(key);
      shifts.forEach(shift => {
        var dti = this.delta(shift.toState.index);
        ord.push([shift.shiftIndex, dti, tokenId]);
      });
    });
    ord.sort((a,b)=>{
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

    ord.forEach(([shi, dti, tki]) => {
      if (shi !== idx) {
        throw new Error("shi !== idx   "+shi+" !== "+idx);
      }

      buf.push(dti);
      buf.push(tki);
      idx++;
    });

  }

  deser(startingStateMinus1: number, buf: number[], pos: number): number {
    var ordlen = buf[pos++];
 
    var idx = 0;
    for (var i = 0; i < ordlen; i++, idx++) {
      var dti = buf[pos++];
      var tki = buf[pos++];

      var shs = this.map[tki];
      if (!shs) {
        this.map[tki] = shs = [];
      }

      var sti = startingStateMinus1 + dti;
      var state = Analysis.leafState(sti);
      var shift = new RTShift(idx, state)
      shs.push(shift);
    }
    return pos;
  }


  diagnosticEqualityCheck(table: GrammarParsingLeafStateTransitions) {
    if (this.index !== table.index) {
      return debuggerTrap(false);
    } else if (this.startingStateMinus1 !== table.startingStateMinus1) {
        return debuggerTrap(false);
    } else {
      const keys1 = Object.keys(this.map);
      const keys2 = Object.keys(table.map);
      if (keys1.length!==keys2.length) {
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
    buf.push(this.reducedNodes.length);
    this.reducedNodes.forEach(rs => {
      rs.forEach(r=>{
        buf.push(r.shiftIndex);
        buf.push(r.node.nodeIdx);
        tot++;
      });
    });
    buf.push(tot);
    [].push.apply(buf, buf2);
  }

  deser(buf: number[], pos: number): number {
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
          for (var j=0; j<a.length; j++) {
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
  serializedTuple: [number,number];

  constructor(startStateNode?: StateNodeCommon) {
    if (startStateNode) {
      this.index = startStateNode.index;
    }
    this.startStateNode = startStateNode;
    this.reduceActions = new GrammarParsingLeafStateReduces();
  }

  get transitions(): GrammarParsingLeafStateTransitions {
    if (!this._transitions) {

      if (this.serialStateMap) {

        this._transitions = new GrammarParsingLeafStateTransitions();
        this.recursiveShifts = new GrammarParsingLeafStateTransitions();

        this._transitions.startingStateMinus1 = this.index - 1;
        this.recursiveShifts.startingStateMinus1 = this.index - 1;

        var shiftses:[string,RTShift[]][] = Object.entries(this.serialStateMap.map);

        shiftses.forEach(([key,shs])=>{
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
        this._transitions.startingStateMinus1 = this.index - 1;
        this.recursiveShifts.startingStateMinus1 = this.index - 1;
        this.serialStateMap.startingStateMinus1 = this.index - 1;
        

        const pushToMap = (s: Shifts, tokenId: number, map: GrammarParsingLeafStateTransitions)=>{
          var ts = map.map[tokenId];
          if (!ts) {
            map.map[tokenId] = ts = [];
          }
          var shift = new RTShift(shiftIndex, s.item.stateNode.generateState());
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
              this.reduceActions.reducedNodes.push(new RTReduce(shiftIndex, r.item.node));

              break;
            default:
              throw new Error("222b  " + nextTerm);
          }
        });
      }
    }
    return this._transitions;
  }

  ser(buf: number[]): void {
    [].push.apply(buf, this.serializedTuple);
  }

  deser(index: number, buf: number[], pos: number): number {

    var [trind, rdind] = [buf[pos++],buf[pos++]];

    this.index = index;

    this.serialStateMap = Analysis.leafStateTransitionTables[trind];
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
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

  startingPoint: PRef;
  startStateNode: StateNodeWithPrefix;

  common: GrammarParsingLeafStateCommon;
  reduceActions: GrammarParsingLeafStateReduces;
  serializedTuple: [number,number,number];

  constructor(startStateNode?: StateNodeWithPrefix, startingPoint?: PRef) {
    if (startStateNode) {
      this.index = startStateNode.index;
    }
    this.startStateNode = startStateNode;
    this.startingPoint = startingPoint;
    this.reduceActions = new GrammarParsingLeafStateReduces();
  }

  lazy() {

    var shiftIndex = 0;
    this.startStateNode.reduces.forEach(nextTerm => {

      switch (nextTerm.kind) {

        case ShiftReduceKind.REDUCE:
        case ShiftReduceKind.REDUCE_RECURSIVE:
          var r = nextTerm as Reduce;
          this.reduceActions.reducedNodes.push(new RTReduce(shiftIndex, r.item.node));

          break;
        default:
          throw new Error("223b  " + nextTerm);
      }
    });
  }

  ser(buf: number[]): void {
    [].push.apply(buf, this.serializedTuple);
  }

  deser(index: number, buf: number[], pos: number): number {

    var [spx, rdind, cmni] = [buf[pos++],buf[pos++],buf[pos++]];

    this.index = index;

    this.startingPoint = spx ? HyperG.nodeTable[spx] as PRef : null;
    this.reduceActions = Analysis.leafStateReduceTables[rdind];
    this.common = Analysis.leafStateCommons[cmni];

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





class IncVariator {
  
  K:number = 0;
  n:number = 0;
  Ex:number = 0;
  Ex2:number = 0;
  
  add(x: number) {
    if (this.n === 0) this.K = x;
    this.n ++;
    this.Ex += x - this.K;
    this.Ex2 += (x - this.K) * (x - this.K);
  }

  get mean() {
    return this.K + this.Ex / this.n;
  }

  get variance() {
    return (this.Ex2 - (this.Ex * this.Ex) / this.n) / (this.n - 1);
  }

  get sqrtVariance() {
    return Math.sqrt(this.variance);
  }

}

var varShs = new IncVariator();
var varShReqs = new IncVariator();
var varTkns = new IncVariator();
var varRds = new IncVariator();