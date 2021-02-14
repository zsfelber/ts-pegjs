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
exports.ParseTableGenerator = exports.ShiftReduceKind = exports.Reduce = exports.ShiftRecursive = exports.Shift = exports.Shifts = exports.ShiftReduce = exports.JumpIntoSubroutineLeafStateNode = exports.TraversedLeafStateNode = exports.LeafStateNodeWithPrefix = exports.StateNodeWithPrefix = exports.LeafStateNodeCommon = exports.StateNodeCommon = exports.Traversing = exports.Analysis = exports.LEV_CNT_BRANCH_NODES = exports.LEV_CNT_LN_RULE = exports.CNT_HUB_LEVELS = exports.START_STATE = exports.FAIL_STATE = void 0;
var _1 = require(".");
var analyzer_rt_1 = require("./analyzer-rt");
var analyzer_tra_1 = require("./analyzer-tra");
exports.FAIL_STATE = 0;
exports.START_STATE = 1;
//export const CNT_HUB_LEVELS = 5;
//export const LEV_CNT_LN_RULE = 500;
//export const LEV_CNT_BRANCH_NODES = 500;
// NOTE case cut off currently
exports.CNT_HUB_LEVELS = 1;
exports.LEV_CNT_LN_RULE = 50000;
exports.LEV_CNT_BRANCH_NODES = 50000;
var Analysis;
(function (Analysis) {
    var Backup = /** @class */ (function () {
        function Backup() {
            this.ERRORS = 0;
            this.deferredRules = [];
            this.localDeferredRules = [];
            this.leafStates = [];
            this.leafStateTransitionTables = [];
            this.leafStateReduceTables = [];
            this.totalStates = 0;
            this.serializedTransitions = {};
            this.serializedReduces = {};
            this.serializedTuples = {};
            this.stack = [];
            this.serializedStateCommonsCnt = 0;
        }
        Backup.prototype.load = function () {
            this.ERRORS = Analysis.ERRORS;
            this.deferredRules = Analysis.deferredRules;
            this.localDeferredRules = Analysis.localDeferredRules;
            this.leafStates = Analysis.leafStates;
            this.leafStateTransitionTables = Analysis.leafStateTransitionTables;
            this.leafStateReduceTables = Analysis.leafStateReduceTables;
            this.maxTokenId = Analysis.maxTokenId;
            this.totalStates = Analysis.totalStates;
            this.serializedTransitions = Analysis.serializedTransitions;
            this.serializedReduces = Analysis.serializedReduces;
            this.serializedTuples = Analysis.serializedTuples;
            this.stack = Analysis.stack;
            this.serializedStateCommonsCnt = Analysis.serializedStateCommonsCnt;
        };
        Backup.prototype.save = function () {
            Analysis.ERRORS = this.ERRORS;
            Analysis.deferredRules = this.deferredRules;
            Analysis.localDeferredRules = this.localDeferredRules;
            Analysis.leafStates = this.leafStates;
            Analysis.leafStateTransitionTables = this.leafStateTransitionTables;
            Analysis.leafStateReduceTables = this.leafStateReduceTables;
            Analysis.maxTokenId = this.maxTokenId;
            Analysis.totalStates = this.totalStates;
            Analysis.serializedTransitions = this.serializedTransitions;
            Analysis.serializedReduces = this.serializedReduces;
            Analysis.serializedTuples = this.serializedTuples;
            Analysis.stack = this.stack;
            Analysis.serializedStateCommonsCnt = this.serializedStateCommonsCnt;
        };
        return Backup;
    }());
    Analysis.ERRORS = 0;
    Analysis.deferredRules = [];
    Analysis.localDeferredRules = [];
    Analysis.leafStates = [];
    Analysis.leafStateCommons = [];
    Analysis.leafStateTransitionTables = [];
    Analysis.leafStateReduceTables = [];
    Analysis.totalStates = 0;
    Analysis.uniformMaxStateId = 0xe000;
    Analysis.serializedStateCommons = {};
    Analysis.serializedTransitions = {};
    Analysis.serializedReduces = {};
    Analysis.serializedTuples = {};
    Analysis.stack = [];
    Analysis.serializedStateCommonsCnt = 1;
    function backup() {
        var backup = new Backup();
        backup.load();
        return backup;
    }
    Analysis.backup = backup;
    function empty() {
        var emptyBackup = new Backup();
        return emptyBackup;
    }
    Analysis.empty = empty;
    function leafStateCommon(index) {
        var ls = Analysis.leafStateCommons[index];
        if (!ls) {
            Analysis.leafStateCommons[index] = ls = new analyzer_rt_1.GrammarParsingLeafStateCommon();
            ls.index = index;
        }
        return ls;
    }
    Analysis.leafStateCommon = leafStateCommon;
    function leafState(index) {
        var ls = Analysis.leafStates[index];
        if (!ls) {
            Analysis.leafStates[index] = ls = new analyzer_rt_1.GrammarParsingLeafState();
            ls.index = index;
        }
        return ls;
    }
    Analysis.leafState = leafState;
    function writeAllSerializedTables(buf) {
        var strans = Object.values(Analysis.serializedTransitions);
        var sreds = Object.values(Analysis.serializedReduces);
        var scmn = Object.values(Analysis.serializedStateCommons);
        strans.sort(function (a, b) {
            return a.index - b.index;
        });
        sreds.sort(function (a, b) {
            return a.index - b.index;
        });
        scmn.sort(function (a, b) {
            return a.index - b.index;
        });
        buf.push(strans.length);
        buf.push(sreds.length);
        buf.push(scmn.length);
        var i = 1;
        strans.forEach(function (s) {
            s.alreadySerialized.forEach(function (num) { return buf.push(num); });
            if (s.index !== i) {
                throw new Error("s.index !== i   " + s.index + " !== " + i);
            }
            i++;
        });
        var i = 1;
        sreds.forEach(function (s) {
            s.alreadySerialized.forEach(function (num) { return buf.push(num); });
            if (s.index !== i) {
                throw new Error("s.index !== i   " + s.index + " !== " + i);
            }
            i++;
        });
        var i = 1;
        scmn.forEach(function (s) {
            s.serializedTuple.forEach(function (num) { return buf.push(num); });
            if (s.index !== i) {
                throw new Error("s.index !== i   " + s.index + " !== " + i);
            }
            i++;
        });
    }
    Analysis.writeAllSerializedTables = writeAllSerializedTables;
    function readAllSerializedTables(buf) {
        var pos = 0;
        var _a = [buf[pos++], buf[pos++], buf[pos++]], stransln = _a[0], sredsln = _a[1], scmnln = _a[2];
        Analysis.leafStateTransitionTables.push(null);
        Analysis.leafStateReduceTables.push(null);
        Analysis.leafStateCommons.push(null);
        for (var i = 1; i <= stransln; i++) {
            var trans = new analyzer_rt_1.GrammarParsingLeafStateTransitions();
            pos = trans.deser(i, buf, pos);
            Analysis.leafStateTransitionTables.push(trans);
        }
        for (var i = 1; i <= sredsln; i++) {
            var red = new analyzer_rt_1.GrammarParsingLeafStateReduces();
            pos = red.deser(i, buf, pos);
            Analysis.leafStateReduceTables.push(red);
        }
        for (var i = 1; i <= scmnln; i++) {
            var cmn = new analyzer_rt_1.GrammarParsingLeafStateCommon();
            pos = cmn.deser(i, buf, pos);
            Analysis.leafStateCommons.push(cmn);
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
/*class StateNode {

}*/
var StateNodeCommon = /** @class */ (function () {
    function StateNodeCommon(parseTable) {
        // of state transitions starting from here
        // includes
        // Regular SHIFTs
        // SHIFT_RECURSIVEs
        // Regular REDUCEs 
        // Epsilon REDUCEs
        this.shiftsAndReduces = [];
        this.index = Analysis.serializedStateCommonsCnt++;
        parseTable.allLeafStateCommons[this.index] = this;
    }
    StateNodeCommon.prototype.toString = function () {
        return "C#" + this.index + "->" + ("->" + this.shiftsAndReduces.length + "s/r");
    };
    return StateNodeCommon;
}());
exports.StateNodeCommon = StateNodeCommon;
var RootStateNodeCommon = /** @class */ (function (_super) {
    __extends(RootStateNodeCommon, _super);
    function RootStateNodeCommon() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RootStateNodeCommon.prototype.generateState = function () {
        var result = new analyzer_rt_1.GrammarParsingLeafStateCommon(this);
        return result;
    };
    RootStateNodeCommon.prototype.toString = function () {
        return "start C#" + this.index + ("->" + this.shiftsAndReduces.length);
    };
    return RootStateNodeCommon;
}(StateNodeCommon));
var LeafStateNodeCommon = /** @class */ (function (_super) {
    __extends(LeafStateNodeCommon, _super);
    function LeafStateNodeCommon() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LeafStateNodeCommon.prototype.generateState = function () {
        var state = Analysis.leafStateCommon(this.index);
        if (!state.startStateNode) {
            state.startStateNode = this;
            state.index = this.index;
        }
        return state;
    };
    return LeafStateNodeCommon;
}(StateNodeCommon));
exports.LeafStateNodeCommon = LeafStateNodeCommon;
var StateNodeWithPrefix = /** @class */ (function () {
    function StateNodeWithPrefix() {
        this.reduces = [];
    }
    return StateNodeWithPrefix;
}());
exports.StateNodeWithPrefix = StateNodeWithPrefix;
var RootStateNodeWithPrefix = /** @class */ (function (_super) {
    __extends(RootStateNodeWithPrefix, _super);
    function RootStateNodeWithPrefix(rule) {
        var _this = _super.call(this) || this;
        _this.rule = rule;
        _this.common = new RootStateNodeCommon(rule.parser);
        return _this;
    }
    Object.defineProperty(RootStateNodeWithPrefix.prototype, "traverser", {
        get: function () {
            return this.rule;
        },
        enumerable: false,
        configurable: true
    });
    RootStateNodeWithPrefix.prototype.generateTransitions = function (parser, rootTraversion) {
        if (parser.cntStates !== 1)
            throw new Error("?? staring state not the first : " + parser.cntStates);
        rootTraversion.traverse(this, analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS);
        this.index = 1;
        parser.cntStates = 2;
    };
    RootStateNodeWithPrefix.prototype.generateState = function () {
        var result = new analyzer_rt_1.GrammarParsingLeafState(this, null);
        return result;
    };
    RootStateNodeWithPrefix.prototype.toString = function () {
        return "start C#" + this.index + "->" + this.traverser + ("->C#" + this.common.index);
    };
    return RootStateNodeWithPrefix;
}(StateNodeWithPrefix));
var LeafStateNodeWithPrefix = /** @class */ (function (_super) {
    __extends(LeafStateNodeWithPrefix, _super);
    function LeafStateNodeWithPrefix(ref) {
        var _this = _super.call(this) || this;
        _this.ref = ref;
        return _this;
    }
    Object.defineProperty(LeafStateNodeWithPrefix.prototype, "traverser", {
        get: function () {
            return this.ref;
        },
        enumerable: false,
        configurable: true
    });
    LeafStateNodeWithPrefix.prototype.generateTransitions = function (parser, rootTraversion) {
        var ts = this.ref.traverserStep;
        if (!ts || ts.parent !== rootTraversion)
            throw new Error("bad traversion params " + this + "  traverserStep:" + ts);
        rootTraversion.traverse(this, analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS], ts.toPosition);
        this.index = parser.cntStates;
        parser.cntStates++;
    };
    LeafStateNodeWithPrefix.prototype.generateState = function () {
        var state = Analysis.leafState(this.index);
        if (!state.startStateNode) {
            state.startStateNode = this;
            state.startingPoint = this.ref.node;
            state.index = this.index;
        }
        return state;
    };
    LeafStateNodeWithPrefix.prototype.toString = function () {
        return "LeafSN#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->C#" + this.common.index);
    };
    return LeafStateNodeWithPrefix;
}(StateNodeWithPrefix));
exports.LeafStateNodeWithPrefix = LeafStateNodeWithPrefix;
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
}(LeafStateNodeWithPrefix));
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
}(LeafStateNodeWithPrefix));
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
        this.allLeafStateCommons = [];
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
            newRefs.forEach(function (ruleRef) { return ruleRef.lazyBuildMonoRefTree(); });
        }
        //console.log("Loaded "+cntrules+" rules.");
        this.startingStateNode = new RootStateNodeWithPrefix(mainEntryPoint);
        //console.log("Generating traversion...")
        this.theTraversion = new analyzer_tra_1.LinearTraversion(this, mainEntryPoint);
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
        var result = new analyzer_rt_1.ParseTable(this.rule, start, all);
        return result;
    };
    return ParseTableGenerator;
}());
exports.ParseTableGenerator = ParseTableGenerator;
//# sourceMappingURL=analyzer.js.map