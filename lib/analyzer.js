"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearTraversion = exports.TraversionCache = exports.TraversionItemActionKind = exports.TraversionPurpose = exports.TraversionControl = exports.TraversionItemKind = exports.GrammarParsingLeafState = exports.GrammarParsingLeafStateReduces = exports.GrammarParsingLeafStateTransitions = exports.RTShift = exports.ParseTable = exports.ParseTableGenerator = exports.ShiftReduceKind = exports.Reduce = exports.ShiftRecursive = exports.Shift = exports.Shifts = exports.ShiftReduce = exports.JumpIntoSubroutineLeafStateNode = exports.TraversedLeafStateNode = exports.LeafStateNode = exports.Traversing = exports.Analysis = exports.LEV_CNT_BRANCH_NODES = exports.LEV_CNT_LN_RULE = exports.CNT_HUB_LEVELS = exports.START_STATE = exports.FAIL_STATE = void 0;
var _1 = require(".");
var parsers_1 = require("./parsers");
var index_1 = require("./index");
exports.FAIL_STATE = 0;
exports.START_STATE = 1;
exports.CNT_HUB_LEVELS = 5;
exports.LEV_CNT_LN_RULE = 500;
exports.LEV_CNT_BRANCH_NODES = 500;
var Analysis;
(function (Analysis) {
    Analysis.ERRORS = 0;
    Analysis.deferredRules = [];
    Analysis.localDeferredRules = [];
    Analysis.leafStates = [];
    Analysis.leafStateTransitionTables = [];
    Analysis.leafStateReduceTables = [];
    Analysis.totalStates = 0;
    Analysis.uniformMaxStateId = 0xe000;
    Analysis.serializedTransitions = {};
    Analysis.serializedReduces = {};
    Analysis.serializedTuples = {};
    function leafState(index) {
        var ls = Analysis.leafStates[index];
        if (!ls) {
            Analysis.leafStates[index] = ls = new GrammarParsingLeafState();
            ls.index = index;
        }
        return ls;
    }
    Analysis.leafState = leafState;
    function writeAllSerializedTables(buf) {
        var strans = Object.values(Analysis.serializedTransitions);
        var sreds = Object.values(Analysis.serializedReduces);
        strans.sort(function (a, b) {
            return a.index - b.index;
        });
        sreds.sort(function (a, b) {
            return a.index - b.index;
        });
        buf.push(strans.length);
        buf.push(sreds.length);
        strans.forEach(function (s) {
            s.alreadySerialized.forEach(function (num) { return buf.push(num); });
        });
        sreds.forEach(function (s) {
            s.alreadySerialized.forEach(function (num) { return buf.push(num); });
        });
    }
    Analysis.writeAllSerializedTables = writeAllSerializedTables;
    function readAllSerializedTables(buf) {
        var pos = 0;
        var _a = [buf[pos++], buf[pos++]], stransln = _a[0], sredsln = _a[1];
        for (var i = 0; i < stransln; i++) {
            var trans = new GrammarParsingLeafStateTransitions();
            trans.index = i;
            // TODO Not working now just testing Gener~.pack()
            pos = trans.deser(0, buf, pos);
            Analysis.leafStateTransitionTables.push(trans);
        }
        for (var i = 0; i < sredsln; i++) {
            var red = new GrammarParsingLeafStateReduces();
            red.index = i;
            pos = red.deser(buf, pos);
            Analysis.leafStateReduceTables.push(red);
        }
        if (pos !== buf.length) {
            throw new Error("pos !== buf.length  " + pos + " !== " + buf.length);
        }
        return pos;
    }
    Analysis.readAllSerializedTables = readAllSerializedTables;
})(Analysis = exports.Analysis || (exports.Analysis = {}));
var Traversing;
(function (Traversing) {
    var maxdepth = 0;
    function start(_inTraversion, _item) {
        Traversing.inTraversion = _inTraversion;
        Traversing.recursionCacheStack = { depth: 0, indent: "", upwardBranchCnt: 1, item: _item };
        Traversing.recursionCacheStack.top = Traversing.recursionCacheStack;
        Traversing.item = Traversing.recursionCacheStack.item;
        maxdepth = 0;
        Traversing.active = true;
    }
    Traversing.start = start;
    function finish() {
        Traversing.active = false;
    }
    Traversing.finish = finish;
    function push(child) {
        var oldRecursionCacheStack = Traversing.recursionCacheStack;
        Traversing.recursionCacheStack = { depth: oldRecursionCacheStack.depth + 1, indent: oldRecursionCacheStack.indent + "  ", upwardBranchCnt: oldRecursionCacheStack.upwardBranchCnt, parent: oldRecursionCacheStack, top: oldRecursionCacheStack.top, item: child };
        if (Traversing.recursionCacheStack.depth > maxdepth) {
            maxdepth = Traversing.recursionCacheStack.depth;
            /*if (!(maxdepth%10)) {
              console.log("Traversal depth:"+recursionCacheStack.depth);
            }*/
        }
        Traversing.item = Traversing.recursionCacheStack.item;
        Object.setPrototypeOf(Traversing.recursionCacheStack, oldRecursionCacheStack);
    }
    Traversing.push = push;
    function pop() {
        Traversing.recursionCacheStack = Traversing.recursionCacheStack.parent;
        Traversing.item = Traversing.recursionCacheStack.item;
    }
    Traversing.pop = pop;
})(Traversing = exports.Traversing || (exports.Traversing = {}));
function hex3(c) {
    if (c < 16)
        return '00' + c.toString(16).toUpperCase();
    else if (c < 256)
        return '0' + c.toString(16).toUpperCase();
    else if (c < 4096)
        return '' + c.toString(16).toUpperCase();
    else
        return "???";
}
function hex2(c) {
    if (c < 16)
        return '0' + c.toString(16).toUpperCase();
    else if (c < 256)
        return '' + c.toString(16).toUpperCase();
    else
        return "??";
}
var StateNode = /** @class */ (function () {
    function StateNode() {
        // of state transitions starting from here
        // includes Regular SHIFTs
        // includes Epsilon REDUCEs
        // includes SHIFT_RECURSIVEs
        this.shiftsAndReduces = [];
        // Regular REDUCEs 
        // of state transitions arriving to here
        this.regularReduces = [];
    }
    StateNode.prototype.toString = function () {
        return "SH#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftsAndReduces.length + "s/r");
    };
    return StateNode;
}());
var RootStateNode = /** @class */ (function (_super) {
    __extends(RootStateNode, _super);
    function RootStateNode(rule) {
        var _this = _super.call(this) || this;
        _this.rule = rule;
        return _this;
    }
    Object.defineProperty(RootStateNode.prototype, "isRule", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RootStateNode.prototype, "traverser", {
        get: function () {
            return this.rule;
        },
        enumerable: false,
        configurable: true
    });
    RootStateNode.prototype.generateTransitions = function (parser, rootTraversion) {
        if (parser.cntStates !== 1)
            throw new Error("?? staring state not the first : " + parser.cntStates);
        rootTraversion.traverse(this, TraversionPurpose.FIND_NEXT_TOKENS);
        this.index = 1;
        parser.cntStates = 2;
    };
    RootStateNode.prototype.generateState = function () {
        var result = new GrammarParsingLeafState(this, null);
        return result;
    };
    RootStateNode.prototype.toString = function () {
        return "start#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftsAndReduces.length);
    };
    return RootStateNode;
}(StateNode));
var LeafStateNode = /** @class */ (function (_super) {
    __extends(LeafStateNode, _super);
    function LeafStateNode(ref) {
        var _this = _super.call(this) || this;
        _this.ref = ref;
        return _this;
    }
    Object.defineProperty(LeafStateNode.prototype, "traverser", {
        get: function () {
            return this.ref;
        },
        enumerable: false,
        configurable: true
    });
    LeafStateNode.prototype.generateTransitions = function (parser, rootTraversion) {
        var ts = this.ref.traverserStep;
        if (!ts || ts.parent !== rootTraversion)
            throw new Error("bad traversion params " + this + "  traverserStep:" + ts);
        rootTraversion.traverse(this, TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [TraversionPurpose.FIND_NEXT_TOKENS], ts.toPosition);
        this.index = parser.cntStates;
        parser.cntStates++;
    };
    LeafStateNode.prototype.generateState = function () {
        var state = Analysis.leafState(this.index);
        if (!state.startStateNode) {
            state.startStateNode = this;
            state.startingPoint = this.ref.node;
            state.index = this.index;
        }
        return state;
    };
    return LeafStateNode;
}(StateNode));
exports.LeafStateNode = LeafStateNode;
var TraversedLeafStateNode = /** @class */ (function (_super) {
    __extends(TraversedLeafStateNode, _super);
    function TraversedLeafStateNode(ref) {
        return _super.call(this, ref) || this;
    }
    Object.defineProperty(TraversedLeafStateNode.prototype, "isRule", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    return TraversedLeafStateNode;
}(LeafStateNode));
exports.TraversedLeafStateNode = TraversedLeafStateNode;
var JumpIntoSubroutineLeafStateNode = /** @class */ (function (_super) {
    __extends(JumpIntoSubroutineLeafStateNode, _super);
    function JumpIntoSubroutineLeafStateNode(ref) {
        return _super.call(this, ref) || this;
    }
    Object.defineProperty(JumpIntoSubroutineLeafStateNode.prototype, "isRule", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    return JumpIntoSubroutineLeafStateNode;
}(LeafStateNode));
exports.JumpIntoSubroutineLeafStateNode = JumpIntoSubroutineLeafStateNode;
var ShiftReduce = /** @class */ (function () {
    function ShiftReduce() {
    }
    return ShiftReduce;
}());
exports.ShiftReduce = ShiftReduce;
var Shifts = /** @class */ (function (_super) {
    __extends(Shifts, _super);
    function Shifts() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Shifts;
}(ShiftReduce));
exports.Shifts = Shifts;
var Shift = /** @class */ (function (_super) {
    __extends(Shift, _super);
    function Shift() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = ShiftReduceKind.SHIFT;
        return _this;
    }
    return Shift;
}(Shifts));
exports.Shift = Shift;
var ShiftRecursive = /** @class */ (function (_super) {
    __extends(ShiftRecursive, _super);
    function ShiftRecursive() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = ShiftReduceKind.SHIFT_RECURSIVE;
        return _this;
    }
    return ShiftRecursive;
}(Shifts));
exports.ShiftRecursive = ShiftRecursive;
var Reduce = /** @class */ (function (_super) {
    __extends(Reduce, _super);
    function Reduce() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = ShiftReduceKind.REDUCE;
        return _this;
    }
    return Reduce;
}(ShiftReduce));
exports.Reduce = Reduce;
var ShiftReduceKind;
(function (ShiftReduceKind) {
    ShiftReduceKind[ShiftReduceKind["SHIFT"] = 0] = "SHIFT";
    ShiftReduceKind[ShiftReduceKind["REDUCE"] = 1] = "REDUCE";
    ShiftReduceKind[ShiftReduceKind["SHIFT_RECURSIVE"] = 2] = "SHIFT_RECURSIVE";
    ShiftReduceKind[ShiftReduceKind["REDUCE_RECURSIVE"] = 3] = "REDUCE_RECURSIVE";
})(ShiftReduceKind = exports.ShiftReduceKind || (exports.ShiftReduceKind = {}));
//
//   TODO   
// I was thinking
// There are parallel cases  (multiple shifts, maybe  choice2, choice3 will be the winner)
//  GLL  needed
//  MAybe Using Breadth-first traversal
//
//
// 
// ======================================================================================
//
// The Parse Table generator. 
// The logic basically consist of SHIFT and REDUCE actions. The flow
// of the 2 kind of actions are driven by incoming token stream,  
// possibly 1 SHIFT step and N REDUCE steps for each incoming token. 
//
// There are three steps of producing it:
// 1. Generating a parse graph first. 
// 2. Then, creating a linear traversion stream. 
// 3. Then traversing operations in 2 different modes (purposes). 
// 4. Finally we can produce the jumping tables itself with all necessary 
// information. 
//
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
//
//
// 1. About parsing graph:
// It should be a finite graph which may be circular. Logically, its
// leaf nodes are the terminal refs, intermediate nodes are the rule nodes
// and nonterminal refs.
// Its circle points are 2 kind of, 1st the LOOP nodes, pointing to itself,
// and 2nd the recursive JUMP nodes. We can handle both kinds of circularity  
// in a straight way.
// The leaf nodes are the parse states and belong to SHIFT actions. To  
// infinitely included sub sections, the graph also contains special recursive
// jumping states in points  of the grammar ( as a special kind of SHIFT action ).
// The root node means the starting and the final state.
//
// For the leaf (state) nodes, these are true:
//    - these and the starting/finishing action are the linear parsing states as each 
//      one leaf state is the starting point of and as well the result of a SHIFT action,
//    - each SHIFT produces a leaf state, so
//        1+1 starting+finishing state
//        + leaf nodes      <=>    parsing state      in 1 : 1  relationship
// For the intermediate (logic) nodes, these are true:
//    - maybe a rule entry, choice, sequence, optional, zero or more cycle, 
//      one or more cycle
//    - produces REDUCE actions, during bacwards direction of traversion
//
// 2. The traversion handler makes a simple linear stream of TraversionControl (may be
//    called Action) items which generated  by  the Reference or Logic Nodes (which are 
//    the graph nodes), subsequentially, by an initial recursive process. The object
//    executes the travesing over and over again, in a simple linear cycle in possibly
//    different modes (called  Purposes). The TraversionControls are responsible to 
//    take actions in traversed nodes (differently for different Purposes), so 
//    traversion handler is purpose-, action-  (of course topology-of-tree-nodes) 
//    driven and in a somewhat very straight manner, linear.
//
// 3. SHIFTs and REDUCEs are produced by traversion. 2 modes (purposes) the traversion
//    is called
//    - FIND_NEXT_TOKENS : collects the controlling (so the possible Next) tokens. 
//      Simply, these are the SHIFT actions. 
//      This process may be 1)the Starting state jumps generation or 2)in the generation of 
//      intermediate states, it starts after the initial reduction detections
//      (following the starting point token). It also detects implicit (empty branch) 
//      REDUCE actions.
//    - BACKSTEP_TO_SEQUENCE_THEN..FIND_NEXT_TOKENS
//      The initial reduction detections, followed by regular collecting of next shift,
//      just mentioned . 
//      This way of call the traversion  detects the regular(explicit) REDUCE actions.  
//      There are implicit (empty branch) REDUCE actions as well which detected during 
//      the FIND_NEXT_TOKENS phase.
//      When it reaches the Sequence upwards, turns downwards and continues in regular
//      FIND_NEXT_TOKENS mode.
//
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
//
//
// For the REDUCE actions, these are true:
//
//    - REDUCE actions coming in upward direction of the traversion
//    - The regular ones collected in the beginning of each SHIFT but belongs to 
//      the previous      Leaf State (so at runtime it is called immediately 
//      when the Leaf State reached, not during the next SHIFT)
//    - The implicit empty branch REDUCE actions collected before the SHIFT that
//      belongs to, these are called  at beginning the next SHIFT
//    - when a TOP node REDUCE action presents, it is the final state
// 
// ======================================================================================
// 
var ParseTableGenerator = /** @class */ (function () {
    function ParseTableGenerator(rule) {
        //console.log("Read rules tree...")
        var _this = this;
        this.nodeTravIds = 0;
        this.newRuleReferences = [];
        // the state nodes 
        this.allLeafStateNodes = [];
        this.entryPoints = {};
        this.jumperStates = [];
        // 1 based index
        this.cntStates = 1;
        this.rule = rule;
        var mainEntryPoint = new _1.EntryPointTraverser(this, null, rule);
        this.entryPoints[rule.rule] = mainEntryPoint;
        // loads all
        var cntrules = 0;
        while (this.newRuleReferences.length) {
            cntrules += this.newRuleReferences.length;
            var newRefs = this.newRuleReferences;
            this.newRuleReferences = [];
            newRefs.forEach(function (ruleRef) { return ruleRef.lazyLinkRule(); });
        }
        //console.log("Loaded "+cntrules+" rules.");
        this.startingStateNode = new RootStateNode(mainEntryPoint);
        //console.log("Generating traversion...")
        this.theTraversion = new LinearTraversion(this, mainEntryPoint);
        //console.log("Generating starting transitions...")
        this.startingStateNode.generateTransitions(this, this.theTraversion);
        // This simple loop generates all possible state transitions at once:
        // NOTE
        // each state handles the jumped-through REDUCE actions as well
        // so simply these always must be made sequentially
        //console.log("Generating states...")
        this.allLeafStateNodes.forEach(function (state) {
            state.generateTransitions(_this, _this.theTraversion);
        });
        //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
        //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
        console.log("Parse table for   starting rule:" + rule.rule + "  entry points(nonterminals):" + Object.keys(this.entryPoints).length + "  all nodes:" + mainEntryPoint.allNodes.length + "  all rule refs:" + cntrules + "  L1 rule refs:" + mainEntryPoint.allRuleReferences.length + "  L1 terminal refs:" + mainEntryPoint.allTerminalReferences.length + "  tokens:" + Analysis.maxTokenId + "   states:" + (1 + this.allLeafStateNodes.length));
    }
    ParseTableGenerator.createForRule = function (rule) {
        var parseTable = _1.Factory.parseTables[rule.rule];
        if (!parseTable) {
            parseTable = new ParseTableGenerator(rule);
            _1.Factory.parseTables[rule.rule] = parseTable;
        }
        return parseTable;
    };
    ParseTableGenerator.prototype.getEntryPoint = function (node) {
        var rule;
        rule = this.entryPoints[node.rule];
        if (!rule) {
            rule = new _1.EntryPointTraverser(this, null, node);
            this.entryPoints[node.rule] = rule;
        }
        return rule;
    };
    ParseTableGenerator.prototype.generateParseTable = function () {
        var start = this.startingStateNode.generateState();
        var all = this.allLeafStateNodes.map(function (s) { return s.generateState(); });
        var result = new ParseTable(this.rule, start, all);
        return result;
    };
    return ParseTableGenerator;
}());
exports.ParseTableGenerator = ParseTableGenerator;
var IncVariator = /** @class */ (function () {
    function IncVariator() {
        this.K = 0;
        this.n = 0;
        this.Ex = 0;
        this.Ex2 = 0;
    }
    IncVariator.prototype.add = function (x) {
        if (this.n === 0)
            this.K = x;
        this.n++;
        this.Ex += x - this.K;
        this.Ex2 += (x - this.K) * (x - this.K);
    };
    Object.defineProperty(IncVariator.prototype, "mean", {
        get: function () {
            return this.K + this.Ex / this.n;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "variance", {
        get: function () {
            return (this.Ex2 - (this.Ex * this.Ex) / this.n) / (this.n - 1);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IncVariator.prototype, "sqrtVariance", {
        get: function () {
            return Math.sqrt(this.variance);
        },
        enumerable: false,
        configurable: true
    });
    return IncVariator;
}());
var varShs = new IncVariator();
var varShReqs = new IncVariator();
var varTkns = new IncVariator();
var varRds = new IncVariator();
var ParseTable = /** @class */ (function () {
    function ParseTable(rule, startingState, allStates) {
        this.rule = rule;
        this.startingState = startingState;
        this.allStates = allStates;
    }
    ParseTable.prototype.pack = function () {
        if (this.allStates.length > Analysis.uniformMaxStateId) {
            throw new Error("State id overflow. Grammar too big. uniformMaxStateId:" + Analysis.uniformMaxStateId + "  Too many states:" + this.allStates.length);
        }
        // !
        Analysis.leafStates = [];
        // indexes
        // 1 based
        // 0 means empty
        var transidx = 1;
        var redidx = 1;
        prstate(this.startingState);
        this.allStates.forEach(function (state) {
            prstate(state);
        });
        var t = Object.keys(Analysis.serializedTransitions).length;
        var r = Object.keys(Analysis.serializedReduces).length;
        var tp = Object.keys(Analysis.serializedTuples).length;
        var sts = 1 + this.allStates.length;
        Analysis.totalStates += sts;
        console.log(this.rule.rule + "   states:" + (sts) + "     Total: [ totalStates:" + Analysis.totalStates + "   distinct transitions:" + (t) + "     distinct reduces:" + (r) + "      distinct states:" + (tp) + "   jmp.tokens:" + varTkns.mean.toFixed(1) + "+-" + varTkns.sqrtVariance.toFixed(1) + "   shift/tkns:" + varShs.mean.toFixed(1) + "+-" + varShs.sqrtVariance.toFixed(1) + "   rec.shift:" + varShReqs.mean.toFixed(1) + "+-" + varShReqs.sqrtVariance.toFixed(1) + "  reduces:" + varRds.mean.toFixed(1) + "+-" + varRds.sqrtVariance.toFixed(1) + " ]");
        function prstate(state) {
            // lazy
            state.transitions;
            var tots = [0, 0, 0, 0];
            tra(state.serialStateMap, tots);
            var nonreq = tots[0], nonreqtot = tots[1], req = tots[2], reqtot = tots[3];
            if (nonreq) {
                varTkns.add(nonreq);
                varShs.add(nonreqtot / nonreq);
            }
            if (req) {
                if (req !== 1) {
                    throw new Error("req !== 1  " + req + " !== " + 1);
                }
            }
            varShReqs.add(reqtot);
            var rs1 = red(state.reduceActions);
            var rs2 = red(state.epsilonReduceActions);
            varRds.add(rs1);
            varRds.add(rs2);
            var spidx = state.startingPoint ? state.startingPoint.nodeIdx : 0;
            var tuple = [spidx, state.serialStateMap.index, state.reduceActions.index, state.epsilonReduceActions.index];
            var tkey = index_1.CodeTblToHex(tuple).join("");
            var tuple0 = Analysis.serializedTuples[tkey];
            if (tuple0) {
                state.serializedTuple = tuple0;
            }
            else {
                state.serializedTuple = tuple;
                Analysis.serializedTuples[tkey] = tuple;
            }
        }
        function tra(trans, maplen) {
            var shiftses = Object.entries(trans.map);
            if (shiftses.length) {
                var nonreq = 0;
                var nonreqtot = 0;
                var req = 0;
                var reqtot = 0;
                shiftses.forEach(function (_a) {
                    var key = _a[0], shs = _a[1];
                    var tki = Number(key);
                    if (tki) {
                        nonreq++;
                        nonreqtot += shs.length;
                    }
                    else {
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
                var encoded = index_1.CodeTblToHex(buf).join("");
                var trans0 = Analysis.serializedTransitions[encoded];
                if (trans0) {
                    trans.index = trans0.index;
                }
                else {
                    trans.index = transidx++;
                    Analysis.serializedTransitions[encoded] = trans;
                }
            }
            else {
                trans.index = 0;
            }
            return shiftses.length;
        }
        function red(rr) {
            var rlen = rr.reducedNodes.length;
            if (rlen) {
                var buf = [];
                rr.alreadySerialized = null;
                rr.ser(buf);
                rr.alreadySerialized = buf;
                var encred = index_1.CodeTblToHex(buf).join("");
                var rr0 = Analysis.serializedReduces[encred];
                if (rr0) {
                    rr.index = rr0.index;
                }
                else {
                    rr.index = redidx++;
                    Analysis.serializedReduces[encred] = rr;
                }
            }
            else {
                rr.index = 0;
            }
            return rlen;
        }
    };
    ParseTable.deserialize = function (rule, buf) {
        var result = new ParseTable(rule, null, []);
        var pos = result.deser(buf);
        if (pos !== buf.length)
            throw new Error("ptable:" + rule + " pos:" + pos + " !== " + buf.length);
        return result;
    };
    ParseTable.prototype.ser = function () {
        this.pack();
        var serStates = [];
        this.startingState.ser(serStates);
        this.allStates.forEach(function (s) {
            s.ser(serStates);
        });
        var result = [this.rule.nodeIdx, this.allStates.length].concat(serStates);
        return result;
    };
    ParseTable.prototype.deser = function (buf) {
        var ridx = buf[0], stlen = buf[1];
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
    };
    ParseTable.prototype.toString = function () {
        return "ParseTable/" + this.rule.rule + "/" + (1 + this.allStates.length) + " states";
    };
    return ParseTable;
}());
exports.ParseTable = ParseTable;
var RTShift = /** @class */ (function () {
    function RTShift(shiftIndex, toState) {
        this.shiftIndex = shiftIndex;
        this.toState = toState;
    }
    return RTShift;
}());
exports.RTShift = RTShift;
var GrammarParsingLeafStateTransitions = /** @class */ (function () {
    function GrammarParsingLeafStateTransitions() {
        this.map = {};
    }
    GrammarParsingLeafStateTransitions.prototype.delta = function (stateId) {
        return stateId - this.startingStateMinus1;
    };
    GrammarParsingLeafStateTransitions.prototype.ser = function (buf) {
        var _this = this;
        var ord = [];
        var es = Object.entries(this.map);
        es.forEach(function (_a) {
            var key = _a[0], shifts = _a[1];
            var tokenId = Number(key);
            shifts.forEach(function (shift) {
                var dti = _this.delta(shift.toState.index);
                ord.push([shift.shiftIndex, dti, tokenId]);
            });
        });
        ord.sort(function (a, b) {
            var r0 = a[0] - b[0];
            if (r0)
                return r0;
            throw new Error();
            //var r1 = a[1] - b[1];
            //if (r1) return r1;
            //var r2 = a[2] - b[2];
            //return r2;
        });
        //buf.push(es.length);
        buf.push(ord.length);
        var idx = 0;
        ord.forEach(function (_a) {
            var shi = _a[0], dti = _a[1], tki = _a[2];
            if (shi !== idx) {
                throw new Error("shi !== idx   " + shi + " !== " + idx);
            }
            buf.push(dti);
            buf.push(tki);
            idx++;
        });
    };
    GrammarParsingLeafStateTransitions.prototype.deser = function (startingStateMinus1, buf, pos) {
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
            var shift = new RTShift(idx, state);
            shs.push(shift);
        }
        return pos;
    };
    return GrammarParsingLeafStateTransitions;
}());
exports.GrammarParsingLeafStateTransitions = GrammarParsingLeafStateTransitions;
var GrammarParsingLeafStateReduces = /** @class */ (function () {
    function GrammarParsingLeafStateReduces() {
        this.reducedNodes = [];
    }
    GrammarParsingLeafStateReduces.prototype.ser = function (buf) {
        buf.push(this.reducedNodes.length);
        this.reducedNodes.forEach(function (r) {
            buf.push(r.nodeIdx);
        });
    };
    GrammarParsingLeafStateReduces.prototype.deser = function (buf, pos) {
        var rlen = buf[pos++];
        for (var i = 0; i < rlen; i++) {
            var node = parsers_1.SerDeser.nodeTable[buf[pos++]];
            this.reducedNodes.push(node);
        }
        return pos;
    };
    return GrammarParsingLeafStateReduces;
}());
exports.GrammarParsingLeafStateReduces = GrammarParsingLeafStateReduces;
var GrammarParsingLeafState = /** @class */ (function () {
    function GrammarParsingLeafState(startStateNode, startingPoint) {
        if (startStateNode) {
            this.index = startStateNode.index;
        }
        this.startStateNode = startStateNode;
        this.startingPoint = startingPoint;
        this.epsilonReduceActions = new GrammarParsingLeafStateReduces();
        this.reduceActions = new GrammarParsingLeafStateReduces();
    }
    Object.defineProperty(GrammarParsingLeafState.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (!this._transitions) {
                this._transitions = new GrammarParsingLeafStateTransitions();
                this.recursiveShifts = new GrammarParsingLeafStateTransitions();
                this.serialStateMap = new GrammarParsingLeafStateTransitions();
                this._transitions.startingStateMinus1 = this.index - 1;
                this.recursiveShifts.startingStateMinus1 = this.index - 1;
                this.serialStateMap.startingStateMinus1 = this.index - 1;
                this.startStateNode.regularReduces.forEach(function (nextTerm) {
                    switch (nextTerm.kind) {
                        case ShiftReduceKind.REDUCE:
                        case ShiftReduceKind.REDUCE_RECURSIVE:
                            var r = nextTerm;
                            if (r.isEpsilonReduce)
                                throw new Error();
                            else
                                _this.reduceActions.reducedNodes.push(r.item.node);
                            break;
                        default:
                            throw new Error("111  " + nextTerm);
                    }
                });
                var pushToMap_1 = function (s, tokenId, map) {
                    var ts = map.map[tokenId];
                    if (!ts) {
                        map.map[tokenId] = ts = [];
                    }
                    var shift = new RTShift(shiftIndex, s.item.stateNode.generateState());
                    ts.push(shift);
                };
                var shiftIndex = 0;
                this.startStateNode.shiftsAndReduces.forEach(function (nextTerm) {
                    switch (nextTerm.kind) {
                        case ShiftReduceKind.SHIFT:
                            var s = nextTerm;
                            pushToMap_1(s, s.item.node.value, _this._transitions);
                            pushToMap_1(s, s.item.node.value, _this.serialStateMap);
                            shiftIndex++;
                            break;
                        // these are the rule-ref recursive states
                        // these have unknown jumping-in tokens, so 
                        // we should handle more complex states in runtime 
                        case ShiftReduceKind.SHIFT_RECURSIVE:
                            var sr = nextTerm;
                            pushToMap_1(sr, 0, _this.recursiveShifts);
                            pushToMap_1(sr, 0, _this.serialStateMap);
                            shiftIndex++;
                            break;
                        case ShiftReduceKind.REDUCE:
                        case ShiftReduceKind.REDUCE_RECURSIVE:
                            var r = nextTerm;
                            if (r.isEpsilonReduce)
                                _this.epsilonReduceActions.reducedNodes.push(r.item.node);
                            else
                                throw new Error("222  " + nextTerm);
                            break;
                        default:
                            throw new Error("222b  " + nextTerm);
                    }
                });
            }
            return this._transitions;
        },
        enumerable: false,
        configurable: true
    });
    GrammarParsingLeafState.prototype.ser = function (buf) {
        [].push.apply(buf, this.serializedTuple);
    };
    GrammarParsingLeafState.prototype.deser = function (index, buf, pos) {
        var _a = [buf[pos++], buf[pos++], buf[pos++], buf[pos++]], spx = _a[0], trind = _a[1], rdind = _a[2], emprdind = _a[3];
        this.index = index;
        this.startingPoint = spx ? parsers_1.SerDeser.nodeTable[spx] : null;
        this.serialStateMap = Analysis.leafStateTransitionTables[trind];
        this.reduceActions = Analysis.leafStateReduceTables[rdind];
        this.epsilonReduceActions = Analysis.leafStateReduceTables[emprdind];
        // TODO separate _transitions and recursiveShifts
        return pos;
    };
    return GrammarParsingLeafState;
}());
exports.GrammarParsingLeafState = GrammarParsingLeafState;
var TraversionItemKind;
(function (TraversionItemKind) {
    TraversionItemKind[TraversionItemKind["RULE"] = 0] = "RULE";
    TraversionItemKind[TraversionItemKind["DEFERRED_RULE"] = 1] = "DEFERRED_RULE";
    TraversionItemKind[TraversionItemKind["REPEAT"] = 2] = "REPEAT";
    TraversionItemKind[TraversionItemKind["OPTIONAL"] = 3] = "OPTIONAL";
    TraversionItemKind[TraversionItemKind["TERMINAL"] = 4] = "TERMINAL";
    TraversionItemKind[TraversionItemKind["NODE_START"] = 5] = "NODE_START";
    TraversionItemKind[TraversionItemKind["NODE_END"] = 6] = "NODE_END";
    TraversionItemKind[TraversionItemKind["CHILD_SEPARATOR"] = 7] = "CHILD_SEPARATOR";
    TraversionItemKind[TraversionItemKind["NEGATE"] = 8] = "NEGATE";
})(TraversionItemKind = exports.TraversionItemKind || (exports.TraversionItemKind = {}));
var TraversionControl = /** @class */ (function () {
    function TraversionControl(parent, kind, itm) {
        this.parent = parent;
        this.kind = kind;
        this._set_itm(itm);
        this.fromPosition = this.toPosition = parent.length;
    }
    TraversionControl.prototype._set_itm = function (itm) {
        this.item = itm;
        switch (this.kind) {
            case TraversionItemKind.RULE:
            case TraversionItemKind.DEFERRED_RULE:
                this.rule = itm;
                break;
            case TraversionItemKind.TERMINAL:
                this.terminal = itm;
                break;
            case TraversionItemKind.REPEAT:
            case TraversionItemKind.OPTIONAL:
            case TraversionItemKind.NODE_START:
            case TraversionItemKind.NODE_END:
            case TraversionItemKind.CHILD_SEPARATOR:
            case TraversionItemKind.NEGATE:
                break;
            default:
                throw new Error("Bad kind:" + this + ":" + TraversionItemKind[this.kind]);
        }
    };
    TraversionControl.prototype.toString = function () {
        return "TrvCtrl." + TraversionItemKind[this.kind] + "/" + this.fromPosition + (this.fromPosition !== this.toPosition ? ".." + this.toPosition : "") + "/" + this.item;
    };
    return TraversionControl;
}());
exports.TraversionControl = TraversionControl;
var TraversionPurpose;
(function (TraversionPurpose) {
    TraversionPurpose[TraversionPurpose["FIND_NEXT_TOKENS"] = 0] = "FIND_NEXT_TOKENS";
    TraversionPurpose[TraversionPurpose["BACKSTEP_TO_SEQUENCE_THEN"] = 1] = "BACKSTEP_TO_SEQUENCE_THEN";
})(TraversionPurpose = exports.TraversionPurpose || (exports.TraversionPurpose = {}));
var TraversionItemActionKind;
(function (TraversionItemActionKind) {
    TraversionItemActionKind[TraversionItemActionKind["OMIT_SUBTREE"] = 0] = "OMIT_SUBTREE";
    TraversionItemActionKind[TraversionItemActionKind["STEP_PURPOSE"] = 1] = "STEP_PURPOSE";
    TraversionItemActionKind[TraversionItemActionKind["RESET_POSITION"] = 2] = "RESET_POSITION";
    TraversionItemActionKind[TraversionItemActionKind["STOP"] = 3] = "STOP";
    TraversionItemActionKind[TraversionItemActionKind["CONTINUE"] = 4] = "CONTINUE"; /*default*/
})(TraversionItemActionKind = exports.TraversionItemActionKind || (exports.TraversionItemActionKind = {}));
var TraversionCache = /** @class */ (function () {
    function TraversionCache(intoState) {
        this.isNegative = false;
        this.nodeLocals = [];
        this.intoState = intoState;
    }
    TraversionCache.prototype.nodeLocal = function (node) {
        var r = this.nodeLocals[node.nodeTravId];
        if (!r) {
            this.nodeLocals[node.nodeTravId] = r = [];
        }
        return r;
    };
    TraversionCache.prototype.negate = function () {
        var t = this;
        t.isNegative = !this.isNegative;
    };
    return TraversionCache;
}());
exports.TraversionCache = TraversionCache;
var LinearTraversion = /** @class */ (function () {
    function LinearTraversion(parser, rule) {
        this.parser = parser;
        this.rule = rule;
        this.traversionControls = [];
        Traversing.start(this, rule);
        this.createRecursively();
        Traversing.finish();
    }
    Object.defineProperty(LinearTraversion.prototype, "length", {
        get: function () {
            return this.traversionControls.length;
        },
        enumerable: false,
        configurable: true
    });
    LinearTraversion.prototype.createRecursively = function () {
        var _this = this;
        var item = Traversing.item;
        // each one located beneath start rule and its copied CopiedRuleTraverser s,
        // is traversable,
        // the rest which created for linked rules, and/or in parser.getReferencedRule, 
        // is not traversable
        if (!item.top.parent && item.top !== this.parser.startingStateNode.rule) {
            throw new Error("This how : " + item + "  in:" + this);
        }
        if (item.traversionGeneratorEnter(this)) {
            //if (recursionCacheStack.indent.length<30) {
            //   console.log("createRecursively"+newRecursionStack.indent+item);
            //}
            this.pushDefaultPrefixControllerItems(item);
            item.pushPrefixControllerItem(this);
            var i = 0;
            var previousChild = null;
            Traversing.recursionCacheStack.upwardBranchCnt *= item.children.length;
            item.children.forEach(function (child) {
                //console.log("iterate "+i+"."+newRecursionStack.indent+child);
                var separator;
                if (i > 0) {
                    separator = new TraversionControl(_this, TraversionItemKind.CHILD_SEPARATOR, item);
                    separator.child = child;
                    separator.previousChild = previousChild;
                    _this.pushControl(separator);
                }
                Traversing.push(child);
                _this.createRecursively();
                Traversing.pop();
                if (separator) {
                    separator.toPosition = _this.length;
                }
                previousChild = child;
                i++;
            });
            item.pushPostfixControllerItem(this);
            this.pushDefaultPostfixControllerItems(item);
            item.traversionGeneratorExited(this);
        }
    };
    LinearTraversion.prototype.pushDefaultPrefixControllerItems = function (item) {
        var startnode = new TraversionControl(this, TraversionItemKind.NODE_START, item);
        this.pushControl(startnode);
    };
    LinearTraversion.prototype.pushDefaultPostfixControllerItems = function (item) {
        var endnode = new TraversionControl(this, TraversionItemKind.NODE_END, item);
        this.pushControl(endnode);
    };
    LinearTraversion.prototype.pushControl = function (item) {
        this.traversionControls.push(item);
    };
    LinearTraversion.prototype.traverse = function (intoState, initialPurpose, purposeThen, startPosition) {
        if (startPosition === void 0) { startPosition = 0; }
        var t = this;
        t.purpose = initialPurpose;
        t.purposeThen = purposeThen ? purposeThen : [];
        var cache = new TraversionCache(intoState);
        if (startPosition >= this.traversionControls.length) {
            this.stopped = true;
        }
        else {
            this.stopped = false;
        }
        for (this.position = startPosition; !this.stopped;) {
            this.positionBeforeStep = this.position;
            var item = this.traversionControls[this.position];
            if (item) {
                item.item.traversionActions(this, item, cache);
                this.defaultActions(item, cache, intoState);
                if (this.position >= this.traversionControls.length) {
                    this.stopped = true;
                }
            }
            else {
                throw new Error("Missing item at position : " + this);
            }
        }
        return cache;
    };
    LinearTraversion.prototype.defaultActions = function (step, cache, intoState) {
        switch (step.kind) {
            case TraversionItemKind.CHILD_SEPARATOR:
                switch (this.purpose) {
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        this.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
                        break;
                }
                break;
            case TraversionItemKind.NEGATE:
                cache.negate();
                break;
            case TraversionItemKind.NODE_START:
                switch (this.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftsAndReduces.length;
                        break;
                }
                break;
            case TraversionItemKind.NODE_END:
                switch (this.purpose) {
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        if (intoState.shiftsAndReduces.length) {
                            throw new Error("Already in next state/" + this + ":" + step);
                        }
                        // REDUCE action (default or user function)
                        // node succeeded, previous terminal was in a sub-/main-end state
                        // :
                        // triggers to the user-defined action if any exists  
                        // or default runtime action otherwise  generated here
                        // 
                        // conditions:
                        // - at beginning of any state traversion
                        // excluded:
                        // - reduction checking omitted after first terminal 
                        //   ( this is the expected behavior since we are
                        //     analyzing one from-token to-tokens state transition
                        //     table which is holding all reduction cases in the front
                        //     of that  and  contains all token jumps after that )
                        // 
                        // NOTE still generating this one for the previous state !
                        //
                        if (step.item.isReducable) {
                            intoState.regularReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: false });
                        }
                        break;
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        // Epsilon REDUCE action (default or user function)
                        // A whole branch was empty and it is accepted as a 
                        // a valid empty node success (which should be of an
                        // optionalBranch==true node) ...
                        // 
                        // This case demands a behavior  which is exactly like
                        // that of BACKSTEP_TO_SEQUENCE_THEN ...
                        //
                        if (cache.nodeLocal(step.item).shiftReducesAtStart === intoState.shiftsAndReduces.length) {
                            intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: true });
                            cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftsAndReduces.length;
                        }
                        break;
                }
                break;
        }
        this.execute(TraversionItemActionKind.CONTINUE, null);
    };
    LinearTraversion.prototype.execute = function (action, step) {
        switch (action) {
            case TraversionItemActionKind.OMIT_SUBTREE:
                if (step.kind !== TraversionItemKind.CHILD_SEPARATOR) {
                    throw new Error("Unknown here:" + step + " in " + this);
                }
                this.position = step.toPosition;
                break;
            case TraversionItemActionKind.RESET_POSITION:
                this.position = step.fromPosition;
                break;
            case TraversionItemActionKind.STEP_PURPOSE:
                this.purpose = this.purposeThen.shift();
                break;
            case TraversionItemActionKind.CONTINUE:
                this.position = this.positionBeforeStep + 1;
                break;
            case TraversionItemActionKind.STOP:
                this.stopped = true;
                break;
        }
    };
    LinearTraversion.prototype.toString = function () {
        return "Traversing " + this.rule + "/" + (this.position === undefined ? "gen.time/" + this.traversionControls.length : TraversionPurpose[this.purpose] + "/" + this.position);
    };
    return LinearTraversion;
}());
exports.LinearTraversion = LinearTraversion;
//# sourceMappingURL=analyzer.js.map