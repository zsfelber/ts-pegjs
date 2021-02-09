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
exports.EntryPointTraverser = exports.ReferencedRuleTraverser = exports.RuleTraverser = exports.RuleElementTraverser = exports.GrammarParsingLeafState = exports.ParseTable = exports.ParseTableGenerator = exports.FINAL_STATE = exports.START_STATE = exports.FAIL_STATE = exports.Analysis = void 0;
var _1 = require(".");
var Analysis;
(function (Analysis) {
    Analysis.ERRORS = 0;
    Analysis.bigStartRules = [];
})(Analysis = exports.Analysis || (exports.Analysis = {}));
exports.FAIL_STATE = 0;
exports.START_STATE = 1;
exports.FINAL_STATE = 255;
var Factory;
(function (Factory) {
    Factory.parseTables = {};
    function createTraverser(parser, parent, node) {
        switch (node.kind) {
            case _1.PNodeKind.CHOICE:
                return new ChoiceTraverser(parser, parent, node);
            case _1.PNodeKind.SEQUENCE:
            case _1.PNodeKind.SINGLE:
                return new SequenceTraverser(parser, parent, node);
            case _1.PNodeKind.OPTIONAL:
                return new OptionalTraverser(parser, parent, node);
            case _1.PNodeKind.SEMANTIC_AND:
                return new SemanticAndTraverser(parser, parent, node);
            case _1.PNodeKind.SEMANTIC_NOT:
                return new SemanticNotTraverser(parser, parent, node);
            case _1.PNodeKind.PREDICATE_AND:
                return new SemanticAndTraverser(parser, parent, node);
            case _1.PNodeKind.PREDICATE_NOT:
                return new SemanticNotTraverser(parser, parent, node);
            case _1.PNodeKind.ZERO_OR_MORE:
                return new ZeroOrMoreTraverser(parser, parent, node);
            case _1.PNodeKind.ONE_OR_MORE:
                return new OneOrMoreTraverser(parser, parent, node);
            case _1.PNodeKind.RULE_REF:
                return new RuleRefTraverser(parser, parent, node);
            case _1.PNodeKind.TERMINAL_REF:
                return new TerminalRefTraverser(parser, parent, node);
            case _1.PNodeKind.RULE:
                if (!parent) {
                    return new EntryPointTraverser(parser, null, node);
                }
                else if (parent instanceof RuleRefTraverser) {
                    return new ReferencedRuleTraverser(parser, parent, node);
                }
                else {
                    throw new Error("bad parent:" + parent);
                }
        }
    }
    Factory.createTraverser = createTraverser;
})(Factory || (Factory = {}));
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
        this.shiftsAndReduces = [];
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
        var result = new GrammarParsingLeafState(this, this.ref.node);
        return result;
    };
    return LeafStateNode;
}(StateNode));
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
var ShiftReduce = /** @class */ (function () {
    function ShiftReduce() {
    }
    return ShiftReduce;
}());
var Shift = /** @class */ (function (_super) {
    __extends(Shift, _super);
    function Shift() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = ShiftReduceKind.SHIFT;
        return _this;
    }
    return Shift;
}(ShiftReduce));
var Reduce = /** @class */ (function (_super) {
    __extends(Reduce, _super);
    function Reduce() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.kind = ShiftReduceKind.REDUCE;
        return _this;
    }
    return Reduce;
}(ShiftReduce));
var ShiftReduceKind;
(function (ShiftReduceKind) {
    ShiftReduceKind[ShiftReduceKind["SHIFT"] = 0] = "SHIFT";
    ShiftReduceKind[ShiftReduceKind["REDUCE"] = 1] = "REDUCE";
    ShiftReduceKind[ShiftReduceKind["SHIFT_RECURSIVE"] = 2] = "SHIFT_RECURSIVE";
    ShiftReduceKind[ShiftReduceKind["REDUCE_RECURSIVE"] = 3] = "REDUCE_RECURSIVE";
})(ShiftReduceKind || (ShiftReduceKind = {}));
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
        this.startRuleDependencies = [];
        this.maxTokenId = 0;
        this.allRuleReferences = [];
        this.allTerminalReferences = [];
        // the state nodes 
        this.allLeafStateNodes = [];
        this.entryPoints = {};
        this.allNodes = {};
        this.jumperStates = [];
        // 1 based index
        this.cntStates = 1;
        this.rule = rule;
        var mainEntryPoint = new EntryPointTraverser(this, null, rule);
        this.entryPoints[rule.rule] = mainEntryPoint;
        // loads all :)
        while (this.allRuleReferences.some(function (ruleRef) { return ruleRef.lazyCouldGenerateNew(); }))
            ;
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
        console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.entryPoints).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   states:" + this.allLeafStateNodes.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);
    }
    ParseTableGenerator.createForRule = function (rule) {
        var parseTable = Factory.parseTables[rule.rule];
        if (!parseTable) {
            parseTable = new ParseTableGenerator(rule);
            Factory.parseTables[rule.rule] = parseTable;
        }
        return parseTable;
    };
    ParseTableGenerator.prototype.getEntryPoint = function (node) {
        var rule;
        rule = this.entryPoints[node.rule];
        if (!rule) {
            rule = new EntryPointTraverser(this, null, node);
            this.entryPoints[node.rule] = rule;
        }
        return rule;
    };
    ParseTableGenerator.prototype.generateParseTable = function () {
        var start = this.startingStateNode.generateState();
        var all = this.allLeafStateNodes.map(function (s) { return s.generateState(); });
        var result = new ParseTable(this.maxTokenId, this.rule, start, all);
        return result;
    };
    return ParseTableGenerator;
}());
exports.ParseTableGenerator = ParseTableGenerator;
var ParseTable = /** @class */ (function () {
    function ParseTable(maxTokenId, rule, startingState, allStates) {
        this.maxTokenId = maxTokenId;
        this.rule = rule;
        this.startingState = startingState;
        this.allStates = allStates;
    }
    ParseTable.deserialize = function (code) {
        //SerDeser.ruleTable
    };
    ParseTable.prototype.ser = function () {
        var _this = this;
        var serStates = [];
        var maxIdx = 0;
        var ind = this.startingState.ser(this.maxTokenId, serStates);
        if (ind > maxIdx)
            maxIdx = ind;
        this.allStates.forEach(function (s) {
            var ind = s.ser(_this.maxTokenId, serStates);
            if (ind > maxIdx)
                maxIdx = ind;
        });
        if (this.allStates.length > maxIdx)
            maxIdx = this.allStates.length;
        var result = [this.allStates.length, this.maxTokenId, maxIdx].concat(serStates);
        return result;
    };
    return ParseTable;
}());
exports.ParseTable = ParseTable;
var GrammarParsingLeafState = /** @class */ (function () {
    function GrammarParsingLeafState(startState, startingPoint) {
        this.isRule = startState.isRule;
        this.index = startState.index;
        this.startState = startState;
        this.startingPoint = startingPoint;
        this.epsilonReduceActions = [];
        this.reduceActions = [];
    }
    Object.defineProperty(GrammarParsingLeafState.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (!this._transitions) {
                this._transitions = {};
                this.startState.regularReduces.forEach(function (nextTerm) {
                    switch (nextTerm.kind) {
                        case ShiftReduceKind.REDUCE:
                        case ShiftReduceKind.REDUCE_RECURSIVE:
                            var r = nextTerm;
                            if (r.isEpsilonReduce)
                                throw new Error();
                            else
                                _this.reduceActions.push(r.item.node);
                            break;
                        default:
                            throw new Error("111  " + nextTerm);
                    }
                });
                this.startState.shiftsAndReduces.forEach(function (nextTerm) {
                    switch (nextTerm.kind) {
                        case ShiftReduceKind.SHIFT:
                        case ShiftReduceKind.SHIFT_RECURSIVE:
                            var s = nextTerm;
                            if (!_this._transitions[s.item.node.value]) {
                                //nextTerm.
                                _this._transitions[s.item.node.value] = s.item.stateNode.generateState();
                            }
                            break;
                        case ShiftReduceKind.REDUCE:
                        case ShiftReduceKind.REDUCE_RECURSIVE:
                            var r = nextTerm;
                            if (r.isEpsilonReduce)
                                _this.epsilonReduceActions.push(r.item.node);
                            else
                                throw new Error("222  " + nextTerm);
                            break;
                    }
                });
            }
            return this._transitions;
        },
        enumerable: false,
        configurable: true
    });
    GrammarParsingLeafState.prototype.ser = function (maxTknId, buf) {
        var toTknIds = [];
        toTknIds[maxTknId] = 0;
        toTknIds.fill(0, 0, maxTknId);
        var es = Object.entries(this.transitions);
        es.forEach(function (_a) {
            var key = _a[0], trans = _a[1];
            var tokenId = Number(key);
            toTknIds[tokenId] = trans.index;
        });
        var maxIdx = 0;
        var reduce = [];
        this.reduceActions.forEach(function (r) {
            reduce.push(r.nodeIdx);
            if (r.nodeIdx > maxIdx)
                maxIdx = r.nodeIdx;
        });
        var ereduce = [];
        this.epsilonReduceActions.forEach(function (r) {
            ereduce.push(r.nodeIdx);
            if (r.nodeIdx > maxIdx)
                maxIdx = r.nodeIdx;
        });
        buf.push(this.isRule ? 1 : 0);
        if (this.startingPoint) {
            buf.push(this.startingPoint.nodeIdx);
            if (this.startingPoint.nodeIdx > maxIdx)
                maxIdx = this.startingPoint.nodeIdx;
        }
        else {
            buf.push(0);
        }
        buf.push(reduce.length);
        buf.push(ereduce.length);
        buf.push.apply(buf, toTknIds);
        buf.push.apply(buf, reduce);
        buf.push.apply(buf, ereduce);
        return maxIdx;
    };
    return GrammarParsingLeafState;
}());
exports.GrammarParsingLeafState = GrammarParsingLeafState;
var TraversionItemKind;
(function (TraversionItemKind) {
    TraversionItemKind[TraversionItemKind["RULE"] = 0] = "RULE";
    TraversionItemKind[TraversionItemKind["RECURSIVE_RULE"] = 1] = "RECURSIVE_RULE";
    TraversionItemKind[TraversionItemKind["REPEAT"] = 2] = "REPEAT";
    TraversionItemKind[TraversionItemKind["OPTIONAL"] = 3] = "OPTIONAL";
    TraversionItemKind[TraversionItemKind["TERMINAL"] = 4] = "TERMINAL";
    TraversionItemKind[TraversionItemKind["NODE_START"] = 5] = "NODE_START";
    TraversionItemKind[TraversionItemKind["NODE_END"] = 6] = "NODE_END";
    TraversionItemKind[TraversionItemKind["CHILD_SEPARATOR"] = 7] = "CHILD_SEPARATOR";
    TraversionItemKind[TraversionItemKind["NEGATE"] = 8] = "NEGATE";
})(TraversionItemKind || (TraversionItemKind = {}));
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
            case TraversionItemKind.RECURSIVE_RULE:
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
var TraversionPurpose;
(function (TraversionPurpose) {
    TraversionPurpose[TraversionPurpose["FIND_NEXT_TOKENS"] = 0] = "FIND_NEXT_TOKENS";
    TraversionPurpose[TraversionPurpose["BACKSTEP_TO_SEQUENCE_THEN"] = 1] = "BACKSTEP_TO_SEQUENCE_THEN";
})(TraversionPurpose || (TraversionPurpose = {}));
var TraversionItemActionKind;
(function (TraversionItemActionKind) {
    TraversionItemActionKind[TraversionItemActionKind["OMIT_SUBTREE"] = 0] = "OMIT_SUBTREE";
    TraversionItemActionKind[TraversionItemActionKind["STEP_PURPOSE"] = 1] = "STEP_PURPOSE";
    TraversionItemActionKind[TraversionItemActionKind["RESET_POSITION"] = 2] = "RESET_POSITION";
    TraversionItemActionKind[TraversionItemActionKind["STOP"] = 3] = "STOP";
    TraversionItemActionKind[TraversionItemActionKind["CONTINUE"] = 4] = "CONTINUE"; /*default*/
})(TraversionItemActionKind || (TraversionItemActionKind = {}));
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
;
var InsertedRecursiveRuleDef = /** @class */ (function () {
    function InsertedRecursiveRuleDef(params) {
        this.collectedFromIndex = 0;
        Object.assign(this, params);
    }
    InsertedRecursiveRuleDef.prototype.toString = function () {
        return "ruledef " + (this.entryNode ? "entry " : "") + (this.bigRuleLink ? "big " : "") + this.linkedRuleEntry.node.rule +
            " " + this.collectedFromIndex + (this.collectedToIndex !== this.collectedFromIndex ? ".." + this.collectedToIndex : "") + (this.shiftReducesOfFirstState ? "=" + this.shiftReducesOfFirstState.length : "");
    };
    return InsertedRecursiveRuleDef;
}());
;
var LinearTraversion = /** @class */ (function () {
    function LinearTraversion(parser, rule) {
        this.parser = parser;
        this.rule = rule;
        this.traversionControls = [];
        var recursionCacheStack = { indent: "" };
        this.createRecursively(rule, recursionCacheStack);
    }
    Object.defineProperty(LinearTraversion.prototype, "length", {
        get: function () {
            return this.traversionControls.length;
        },
        enumerable: false,
        configurable: true
    });
    LinearTraversion.prototype.createRecursively = function (item, recursionCacheStack) {
        var _this = this;
        var newRecursionStack = { indent: recursionCacheStack.indent + "  " };
        Object.setPrototypeOf(newRecursionStack, recursionCacheStack);
        // only which located beneath start rule and copied EntryPointTraversers ,
        // are traversable,
        // the rest which created for linked rules, and/or in parser.getReferencedRule, is not
        if (!item.top.parent && item.top !== this.parser.startingStateNode.rule) {
            throw new Error("This how : " + item + "  in:" + this);
        }
        if (item.traversionGeneratorEnter(this, newRecursionStack)) {
            //if (recursionCacheStack.indent.length<30) {
            //   console.log("createRecursively"+newRecursionStack.indent+item);
            //}
            this.pushDefaultPrefixControllerItems(item);
            item.pushPrefixControllerItem(this);
            var i = 0;
            var previousChild = null;
            item.children.forEach(function (child) {
                //console.log("iterate "+i+"."+newRecursionStack.indent+child);
                var separator;
                if (i > 0) {
                    separator = new TraversionControl(_this, TraversionItemKind.CHILD_SEPARATOR, item);
                    separator.child = child;
                    separator.previousChild = previousChild;
                    _this.pushControl(separator);
                }
                _this.createRecursively(child, newRecursionStack);
                if (separator) {
                    separator.toPosition = _this.length;
                }
                previousChild = child;
                i++;
            });
            item.pushPostfixControllerItem(this);
            this.pushDefaultPostfixControllerItems(item);
            item.traversionGeneratorExited(this, newRecursionStack);
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
        return "Traversing" + this.rule + "/" + TraversionPurpose[this.purpose] + "/" + this.position;
    };
    return LinearTraversion;
}());
var RuleElementTraverser = /** @class */ (function () {
    function RuleElementTraverser(parser, parent, node) {
        var _this = this;
        this.children = [];
        this.parser = parser;
        this.parent = parent;
        this.nodeTravId = parser.nodeTravIds++;
        this.node = node;
        this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
        this.parser.allNodes[this.nodeTravId] = this;
        this.node.children.forEach(function (n) {
            _this.children.push(Factory.createTraverser(parser, _this, n));
        });
        if (this.checkConstructFailed()) {
            //  throw new Error("Ast construction failed.");
        }
        this.optionalBranch = this.node.optionalNode;
    }
    Object.defineProperty(RuleElementTraverser.prototype, "isReducable", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RuleElementTraverser.prototype, "top", {
        get: function () {
            return this.parent.top;
        },
        enumerable: false,
        configurable: true
    });
    RuleElementTraverser.prototype.checkConstructFailed = function () {
    };
    RuleElementTraverser.prototype.findParent = function (node, incl) {
        if (incl === void 0) { incl = false; }
        if (node === this.node && incl) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findParent(node, true);
        }
        else {
            return null;
        }
    };
    RuleElementTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    RuleElementTraverser.prototype.traversionGeneratorEnter = function (inTraversion, recursionCacheStack) {
        return true;
    };
    RuleElementTraverser.prototype.traversionGeneratorExited = function (inTraversion, recursionCacheStack) {
    };
    RuleElementTraverser.prototype.pushPrefixControllerItem = function (inTraversion) {
    };
    RuleElementTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
    };
    RuleElementTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
    };
    RuleElementTraverser.prototype.toString = function () {
        return "T~" + this.node + (this.optionalBranch ? "<opt>" : "");
    };
    Object.defineProperty(RuleElementTraverser.prototype, "shortLabel", {
        get: function () {
            return "";
        },
        enumerable: false,
        configurable: true
    });
    return RuleElementTraverser;
}());
exports.RuleElementTraverser = RuleElementTraverser;
var ChoiceTraverser = /** @class */ (function (_super) {
    __extends(ChoiceTraverser, _super);
    function ChoiceTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.optionalBranch = _this.children.some(function (itm) { return itm.optionalBranch; });
        return _this;
    }
    Object.defineProperty(ChoiceTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    ChoiceTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case TraversionItemKind.CHILD_SEPARATOR:
                switch (inTraversion.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        break;
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        break;
                }
                break;
            default:
        }
    };
    return ChoiceTraverser;
}(RuleElementTraverser));
var SequenceTraverser = /** @class */ (function (_super) {
    __extends(SequenceTraverser, _super);
    function SequenceTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.optionalBranch = !_this.children.some(function (itm) { return !itm.optionalBranch; });
        return _this;
    }
    SequenceTraverser.prototype.checkConstructFailed = function () {
        if (!this.children.length) {
            console.error("!parser.children.length (empty sequence)  " + this.node);
            return 1;
        }
    };
    Object.defineProperty(SequenceTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    SequenceTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        var traverseLocals = cache.nodeLocal(this);
        switch (step.kind) {
            case TraversionItemKind.CHILD_SEPARATOR:
                switch (inTraversion.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        if (traverseLocals.steppingFromInsideThisSequence) {
                            // Rule = A B C? D
                            // looking for the next possible tokens inside a sequence, started from
                            // A B or C  which, in previous rounds, 
                            // raised BACKSTEP_TO_SEQUENCE_THEN > FIND_NEXT_TOKENS,  
                            // which triggered traversion to next branch B C or D 
                            // and we are after that
                            // now, if the mandatory item of the sequence WAS n't coming,
                            // makes the whole parse Invalid   if prev was optional, continuing 
                            // regurarly and traversing the next (C or D) or moving upwards
                            if (!step.previousChild.optionalBranch) {
                                inTraversion.execute(TraversionItemActionKind.STOP, step);
                            }
                        }
                        else {
                            // it is the 2..n th branch of sequence, their first items  may not be
                            // the following  unless the 1..(n-1)th (previous) branch was optional
                            //
                            // if so then traversing the next branch / moving upwards  regurarly
                            //
                            if (!step.previousChild.optionalBranch) {
                                inTraversion.execute(TraversionItemActionKind.OMIT_SUBTREE, step);
                            }
                        }
                        break;
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        traverseLocals.steppingFromInsideThisSequence = true;
                        inTraversion.execute(TraversionItemActionKind.STEP_PURPOSE, step);
                        break;
                }
                break;
            default:
        }
    };
    return SequenceTraverser;
}(RuleElementTraverser));
var SingleCollectionTraverser = /** @class */ (function (_super) {
    __extends(SingleCollectionTraverser, _super);
    function SingleCollectionTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.child = _this.children[0];
        return _this;
    }
    SingleCollectionTraverser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 1) {
            console.error("this.children.length:" + this.children.length + " !== 1  " + this.node);
            return 1;
        }
    };
    return SingleCollectionTraverser;
}(RuleElementTraverser));
var SingleTraverser = /** @class */ (function (_super) {
    __extends(SingleTraverser, _super);
    function SingleTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SingleTraverser;
}(SingleCollectionTraverser));
var EmptyTraverser = /** @class */ (function (_super) {
    __extends(EmptyTraverser, _super);
    function EmptyTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyTraverser.prototype.checkConstructFailed = function () {
        if (this.children.length !== 0) {
            console.error("this.children.length !== 0  " + this.node);
            return 1;
        }
    };
    Object.defineProperty(EmptyTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    return EmptyTraverser;
}(RuleElementTraverser));
var OptionalTraverser = /** @class */ (function (_super) {
    __extends(OptionalTraverser, _super);
    function OptionalTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(OptionalTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(OptionalTraverser.prototype, "shortLabel", {
        get: function () {
            return "?";
        },
        enumerable: false,
        configurable: true
    });
    return OptionalTraverser;
}(SingleTraverser));
var OrMoreTraverser = /** @class */ (function (_super) {
    __extends(OrMoreTraverser, _super);
    function OrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(OrMoreTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    OrMoreTraverser.prototype.pushPrefixControllerItem = function (inTraversion) {
        this.crrTrItem = new TraversionControl(inTraversion, TraversionItemKind.REPEAT, this);
    };
    OrMoreTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
        this.crrTrItem.toPosition = inTraversion.length;
        inTraversion.pushControl(this.crrTrItem);
        this.crrTrItem = null;
    };
    OrMoreTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case TraversionItemKind.REPEAT:
                switch (inTraversion.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        break;
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        inTraversion.execute(TraversionItemActionKind.RESET_POSITION, step);
                        inTraversion.execute(TraversionItemActionKind.STEP_PURPOSE, step);
                        break;
                }
                break;
            default:
        }
    };
    return OrMoreTraverser;
}(SingleCollectionTraverser));
// node.optionalNode == true 
var ZeroOrMoreTraverser = /** @class */ (function (_super) {
    __extends(ZeroOrMoreTraverser, _super);
    function ZeroOrMoreTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(ZeroOrMoreTraverser.prototype, "shortLabel", {
        get: function () {
            return "*";
        },
        enumerable: false,
        configurable: true
    });
    return ZeroOrMoreTraverser;
}(OrMoreTraverser));
// node.optionalNode == false 
var OneOrMoreTraverser = /** @class */ (function (_super) {
    __extends(OneOrMoreTraverser, _super);
    function OneOrMoreTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.optionalBranch = _this.child.optionalBranch;
        return _this;
    }
    Object.defineProperty(OneOrMoreTraverser.prototype, "shortLabel", {
        get: function () {
            return "+";
        },
        enumerable: false,
        configurable: true
    });
    return OneOrMoreTraverser;
}(OrMoreTraverser));
var RefTraverser = /** @class */ (function (_super) {
    __extends(RefTraverser, _super);
    function RefTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return RefTraverser;
}(EmptyTraverser));
var RuleRefTraverser = /** @class */ (function (_super) {
    __extends(RuleRefTraverser, _super);
    function RuleRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.ruleRef = true;
        _this.parser.allRuleReferences.push(_this);
        _this.targetRule = Analysis.ruleTable[_this.node.ruleIndex];
        return _this;
    }
    Object.defineProperty(RuleRefTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    RuleRefTraverser.prototype.lazyCouldGenerateNew = function () {
        if (this.linkedRuleEntry) {
            return false;
        }
        else {
            this.linkedRuleEntry = this.parser.getEntryPoint(this.targetRule);
            this.optionalBranch = this.linkedRuleEntry.optionalBranch;
            return true;
        }
    };
    RuleRefTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
        if (!this.targetRule) {
            console.error("no this.targetRule  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    RuleRefTraverser.prototype.traversionGeneratorEnter = function (inTraversion, recursionCacheStack) {
        this.recursiveRuleOriginal = recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        if (!this.recursiveRuleOriginal) {
            var big = Analysis.bigStartRules.indexOf(this.targetRule.rule) !== -1;
            if (big) {
                var parseTable0 = Factory.parseTables[this.targetRule.rule];
                if (!parseTable0)
                    throw new Error("Bigs first : " + this.targetRule.rule + "  " + this);
                var bigDef = new InsertedRecursiveRuleDef({
                    bigRuleLink: true, linkedRuleEntry: this.linkedRuleEntry,
                    shiftReducesOfFirstState: parseTable0.startingStateNode.shiftsAndReduces
                });
                this.recursiveRuleOriginal = bigDef;
            }
        }
        if (this.recursiveRuleOriginal) {
            //console.log("peek rule_ref#" + this.targetRule.nodeIdx + recursionCacheStack.indent+" "+this.recursiveRuleOriginal);
            this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RECURSIVE_RULE, this);
            inTraversion.pushControl(this.traverserStep);
            return false;
        }
        else {
            recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;
            //console.log("rule#" + this.targetRule.nodeIdx +"->"+ recursionCacheStack.indent+" "+this);
            this.ownRuleEntry = new ReferencedRuleTraverser(this.parser, this, this.targetRule);
            this.child = this.ownRuleEntry;
            this.children.push(this.ownRuleEntry);
            this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RULE, this);
            inTraversion.pushControl(this.traverserStep);
            return true;
        }
    };
    RuleRefTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        var _this = this;
        var r = this.recursiveRuleOriginal;
        switch (inTraversion.purpose) {
            case TraversionPurpose.FIND_NEXT_TOKENS:
                switch (step.kind) {
                    case TraversionItemKind.RECURSIVE_RULE:
                        if (!r)
                            throw new Error("no original one of RECURSIVE_RULE : " + this);
                        if (r.shiftReducesOfFirstState) {
                            // big rule table
                            if (r.ruleRef)
                                console.log("ruleRef again! " + r);
                        }
                        else if (r.shiftReducesBeforeRecursion) {
                            // NOTE it means subsequent recursions' case theoretically
                            // ...
                        }
                        else {
                            r.collectedToIndex = cache.intoState.shiftsAndReduces.length;
                            r.shiftReducesOfFirstState = r.shiftReducesBeforeRecursion =
                                cache.intoState.shiftsAndReduces.slice(r.collectedFromIndex, r.collectedToIndex);
                        }
                        if (this.stateNode) {
                            throw new Error("There's a stateNode already : " + this + " stateNode:" + this.stateNode);
                        }
                        this.stateNode = new JumpIntoSubroutineLeafStateNode(this);
                        this.parser.allLeafStateNodes.push(this.stateNode);
                        // for transitions jumping to a recursive section,
                        // generating a state which mapped to a sub - Starting- Rule- ParseTable :
                        r.shiftReducesOfFirstState.forEach(function (infiniteItem) {
                            switch (infiniteItem.kind) {
                                case ShiftReduceKind.SHIFT:
                                    var normJump = infiniteItem;
                                    cache.intoState.shiftsAndReduces.push({
                                        kind: ShiftReduceKind.SHIFT_RECURSIVE,
                                        item: normJump.item, intoRule: _this.stateNode
                                    });
                                    break;
                                case ShiftReduceKind.REDUCE:
                                    var normReduce = infiniteItem;
                                    cache.intoState.shiftsAndReduces.push({
                                        kind: ShiftReduceKind.REDUCE_RECURSIVE,
                                        item: normReduce.item, isEpsilonReduce: normReduce.isEpsilonReduce
                                    });
                                    break;
                                default:
                                    // NOTE simply omit subsequent recursions, it could never produce
                                    // next tokens here
                                    break;
                            }
                        });
                        // maybe this start rule has not existed, should be generated now :
                        this.parser.startRuleDependencies[this.node.rule] = this.node;
                        break;
                    case TraversionItemKind.RULE:
                        if (r)
                            throw new Error("State error, it should be recursive or non-recursive :" + this + "  original???:" + r);
                        this.collectedFromIndex = cache.intoState.shiftsAndReduces.length;
                        break;
                    case TraversionItemKind.NODE_START:
                    case TraversionItemKind.NODE_END:
                    case TraversionItemKind.CHILD_SEPARATOR:
                        break;
                    default:
                        throw new Error("Bad item : " + step);
                }
                break;
        }
    };
    RuleRefTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (incl && rule === this.node.rule) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    RuleRefTraverser.prototype.toString = function () {
        return _super.prototype.toString.call(this) + " " + this.collectedFromIndex + ((this.collectedToIndex !== this.collectedFromIndex) ? ".." + this.collectedToIndex : "") +
            +(this.shiftReducesOfFirstState ? "=" + this.shiftReducesOfFirstState.length : "");
    };
    Object.defineProperty(RuleRefTraverser.prototype, "shortLabel", {
        get: function () {
            return this.node.rule + (this.stateNode ? "#" + this.stateNode.index : "");
        },
        enumerable: false,
        configurable: true
    });
    return RuleRefTraverser;
}(RefTraverser));
var TerminalRefTraverser = /** @class */ (function (_super) {
    __extends(TerminalRefTraverser, _super);
    function TerminalRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        parser.allTerminalReferences.push(_this);
        if (_this.node && _this.node.value > parser.maxTokenId)
            parser.maxTokenId = _this.node.value;
        return _this;
    }
    Object.defineProperty(TerminalRefTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    TerminalRefTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.terminal) {
            console.error("no this.node.terminal  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    TerminalRefTraverser.prototype.pushPrefixControllerItem = function (inTraversion) {
        this.stateNode = new TraversedLeafStateNode(this);
        this.parser.allLeafStateNodes.push(this.stateNode);
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
        inTraversion.pushControl(this.traverserStep);
    };
    TerminalRefTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case TraversionItemKind.TERMINAL:
                switch (inTraversion.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT, item: this });
                        break;
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        break;
                }
                break;
            default:
        }
    };
    Object.defineProperty(TerminalRefTraverser.prototype, "shortLabel", {
        get: function () {
            return this.node.terminal + "#" + this.stateNode.index;
        },
        enumerable: false,
        configurable: true
    });
    return TerminalRefTraverser;
}(RefTraverser));
var RuleTraverser = /** @class */ (function (_super) {
    __extends(RuleTraverser, _super);
    function RuleTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.index = node.index;
        _this.optionalBranch = _this.child.optionalBranch;
        return _this;
    }
    Object.defineProperty(RuleTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    RuleTraverser.prototype.findRuleNodeParent = function (rule, incl) {
        if (incl === void 0) { incl = false; }
        if (incl && rule === this.node.rule) {
            return this;
        }
        else if (this.parent) {
            return this.parent.findRuleNodeParent(rule, true);
        }
        else {
            return null;
        }
    };
    return RuleTraverser;
}(SingleTraverser));
exports.RuleTraverser = RuleTraverser;
var ReferencedRuleTraverser = /** @class */ (function (_super) {
    __extends(ReferencedRuleTraverser, _super);
    function ReferencedRuleTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        if (!parent)
            throw new Error();
        return _this;
    }
    return ReferencedRuleTraverser;
}(RuleTraverser));
exports.ReferencedRuleTraverser = ReferencedRuleTraverser;
var EntryPointTraverser = /** @class */ (function (_super) {
    __extends(EntryPointTraverser, _super);
    function EntryPointTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        if (parent)
            throw new Error();
        return _this;
    }
    Object.defineProperty(EntryPointTraverser.prototype, "top", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    EntryPointTraverser.prototype.traversionGeneratorEnter = function (inTraversion, recursionCacheStack) {
        var ruleOriginal = recursionCacheStack["rule_ref#" + this.node.nodeIdx];
        if (!ruleOriginal) {
            this.ruleEntryDef = new InsertedRecursiveRuleDef({
                entryNode: true,
                linkedRuleEntry: this
            });
            recursionCacheStack["rule_ref#" + this.node.nodeIdx] = this.ruleEntryDef;
        }
        return true;
    };
    EntryPointTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        var r = this.ruleEntryDef;
        switch (inTraversion.purpose) {
            case TraversionPurpose.FIND_NEXT_TOKENS:
                switch (step.kind) {
                    case TraversionItemKind.NODE_START:
                        if (r) {
                            r.collectedFromIndex = cache.intoState.shiftsAndReduces.length;
                        }
                        break;
                    case TraversionItemKind.NODE_END:
                    case TraversionItemKind.CHILD_SEPARATOR:
                        break;
                    default:
                        throw new Error("Bad item : " + step);
                }
                break;
        }
    };
    Object.defineProperty(EntryPointTraverser.prototype, "shortLabel", {
        get: function () {
            return this.node.rule + (this.ruleEntryDef ? "#1" : "");
        },
        enumerable: false,
        configurable: true
    });
    return EntryPointTraverser;
}(RuleTraverser));
exports.EntryPointTraverser = EntryPointTraverser;
var PredicateTraverser = /** @class */ (function (_super) {
    __extends(PredicateTraverser, _super);
    function PredicateTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(PredicateTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    return PredicateTraverser;
}(SingleTraverser));
var PredicateAndTraverser = /** @class */ (function (_super) {
    __extends(PredicateAndTraverser, _super);
    function PredicateAndTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.optionalBranch = _this.child.optionalBranch;
        return _this;
    }
    return PredicateAndTraverser;
}(PredicateTraverser));
var PredicateNotTraverser = /** @class */ (function (_super) {
    __extends(PredicateNotTraverser, _super);
    function PredicateNotTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        // NOTE it is good , somewhat thoughtfully tricky
        _this.optionalBranch = !_this.child.optionalBranch;
        return _this;
    }
    PredicateNotTraverser.prototype.pushPrefixControllerItem = function (inTraversion) {
        var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
        inTraversion.pushControl(action);
    };
    PredicateNotTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
        var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
        inTraversion.pushControl(action);
    };
    return PredicateNotTraverser;
}(PredicateTraverser));
var SemanticTraverser = /** @class */ (function (_super) {
    __extends(SemanticTraverser, _super);
    function SemanticTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.optionalBranch = false;
        return _this;
    }
    Object.defineProperty(SemanticTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    SemanticTraverser.prototype.checkConstructFailed = function () {
        var dirty = _super.prototype.checkConstructFailed.call(this);
        if (!this.node.action || !this.node.action.fun) {
            // TODO frequently..
            //console.error("No parser.node.action or .action.fun   " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    return SemanticTraverser;
}(EmptyTraverser));
var SemanticAndTraverser = /** @class */ (function (_super) {
    __extends(SemanticAndTraverser, _super);
    function SemanticAndTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SemanticAndTraverser;
}(SemanticTraverser));
var SemanticNotTraverser = /** @class */ (function (_super) {
    __extends(SemanticNotTraverser, _super);
    function SemanticNotTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SemanticNotTraverser;
}(SemanticTraverser));
//# sourceMappingURL=analyzer.js.map