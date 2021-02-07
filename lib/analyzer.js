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
exports.EntryPointTraverser = exports.GrammarParsingLeafState = exports.ParseTable = exports.ParseTableGenerator = exports.FINAL_STATE = exports.START_STATE = exports.FAIL_STATE = exports.Analysis = void 0;
var _1 = require(".");
var Analysis;
(function (Analysis) {
    Analysis.ERRORS = 0;
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
                return new EntryPointTraverser(parser, parent, node);
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
        this.shiftesAndReduces = [];
    }
    StateNode.prototype.toString = function () {
        return "SH#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftesAndReduces.length + "s/r");
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
    RootStateNode.prototype.generateTransitions = function (parser, previous, rootTraversion) {
        if (parser.cntStates !== 1)
            throw new Error("?? staring state not the first : " + parser.cntStates);
        rootTraversion.traverse(this, previous, TraversionPurpose.FIND_NEXT_TOKENS);
        this.index = 1;
        parser.cntStates = 2;
    };
    RootStateNode.prototype.generateState = function () {
        var result = new GrammarParsingLeafState(this, null);
        return result;
    };
    RootStateNode.prototype.toString = function () {
        return "start#" + this.index + "->" + this.traverser + (this.isRule ? "<rule>" : "") + ("->" + this.shiftesAndReduces.length);
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
    LeafStateNode.prototype.generateTransitions = function (parser, previous, rootTraversion) {
        var ts = this.ref.traverserStep;
        if (!ts || ts.parent !== rootTraversion)
            throw new Error("bad traversion params " + this + "  traverserStep:" + ts);
        rootTraversion.traverse(this, previous, TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [TraversionPurpose.FIND_NEXT_TOKENS], ts.toPosition);
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
// ================================================================
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
//    - these and the starting action are the linear parsing states as each 
//      one is the starting point of and as well the result of a SHIFT action,
//    - each SHIFT produces a leaf state, so
//        1 starting state
//        + leaf nodes      <=>    parsing state      in 1 : 1  relationship
// For the intermediate (logic) nodes, these are true:
//    - maybe a rule entry, choice, sequence, optional, zero or more cycle, 
//      one or more cycle
//    - produces REDUCE actions, during bacwards direction of traversion
//
// 2. The traversion handler is a simple linear stream of TraversionControl (may be
//    called Action) items which generated  by  the Reference or Logic Nodes (which are 
//    the graph nodes), subsequentially, by initial traversion. The object executes
//    the travesing over and over again, in possible diffrent modes (called Purposes),
//    so in a purpose- and action- driven  way.
//
// 3. SHIFTs and REDUCEs are produced by traversion. 2 modes (purposes) of traversion is
//    - FIND_NEXT_TOKENS : collects the controlling (so the possible Next) tokens. 
//      Simply, these are the SHIFT actions. 
//      This process may be 1)the Starting state jumps generation or 2)in the generation of 
//      intermediate states, it starts after the initial reduction detections
//      (following the starting point token). It also detects implicit (empty branch) 
//      REDUCE actions.
//    - BACKSTEP_TO_SEQUENCE_THEN..FIND_NEXT_TOKENS
//      The initial reduction detections. This way of call the traversion 
//      detects the regular(explicit) REDUCE actions.  There are implicit (empty branch)
//      REDUCE actions as well which detected during the FIND_NEXT_TOKENS phase
//
//  - - - - - - - - -
//
//
// For the REDUCE actions, these are true:
//
//    - REDUCE actions coming in upward direction of the traversion
//    - The regular ones collected in the beginning of each SHIFT but belongs to 
//      the previous      Leaf State (so at runtime it is called immediately 
//      After the Leaf State reached)
//    - The implicit empty branch REDUCE actions collected before the SHIFT that
//      belongs to
//    - when a TOP node REDUCE action presents, it is the final state
// 
// ================================================================
var ParseTableGenerator = /** @class */ (function () {
    function ParseTableGenerator(rule) {
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
        this.theTraversion = new LinearTraversion(mainEntryPoint);
        this.startingStateNode.generateTransitions(this, null, this.theTraversion);
        // This simple loop generates all possible state transitions at once:
        // NOTE
        // each state handles the jumped-through REDUCE actions as well
        // so simply these always must be made sequentially
        this.allLeafStateNodes.forEach(function (state) {
            state.generateTransitions(_this, state, _this.theTraversion);
        });
        //var result = new ParseTable(rule, step0, Factory.allTerminals, Factory.maxTokenId);
        //, startingState : GrammarAnalysisState, allTerminals: TerminalRefTraverser[], maxTokenId: number
        console.log("Parse table for   starting rule:" + rule.rule + "  nonterminals:" + Object.getOwnPropertyNames(this.entryPoints).length + "  tokens:" + this.maxTokenId + "   nonterminal nodes:" + this.allRuleReferences.length + "   state nodes:" + this.allLeafStateNodes.length + "  states:" + this.allLeafStateNodes.length + "  all nodes:" + Object.getOwnPropertyNames(this.allNodes).length);
    }
    ParseTableGenerator.createForRule = function (rule) {
        var parseTable = Factory.parseTables[rule.rule];
        if (!parseTable) {
            parseTable = new ParseTableGenerator(rule);
            Factory.parseTables[rule.rule] = parseTable;
        }
        return parseTable;
    };
    ParseTableGenerator.prototype.getReferencedRule = function (node) {
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
        this.allStates.forEach(function (s) {
            var ind = s.ser(_this.maxTokenId, serStates);
            if (ind > maxIdx)
                maxIdx = maxIdx;
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
        //result.jumpToRule = g.jumpToRule;
        //result.jumpToRuleTokenId = g.jumpToRuleTokenId;
        //result.actionNodeId = g.actionNodeId;
    }
    Object.defineProperty(GrammarParsingLeafState.prototype, "transitions", {
        get: function () {
            var _this = this;
            if (!this._transitions) {
                this._transitions = {};
                this.startState.shiftesAndReduces.forEach(function (nextTerm) {
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
                                _this.reduceActions.push(r.item.node);
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
        buf.push(this.startingPoint.nodeIdx);
        if (this.startingPoint.nodeIdx > maxIdx)
            maxIdx = this.startingPoint.nodeIdx;
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
    function TraversionCache(intoState, previous) {
        this.isNegative = false;
        this.nodeLocals = [];
        this.intoState = intoState;
        this.previous = previous;
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
var LinearTraversion = /** @class */ (function () {
    function LinearTraversion(rule) {
        this.rule = rule;
        this.traversionControls = [];
        var recursionCacheStack = {};
        recursionCacheStack["rule_ref#" + rule.node.nodeIdx] = {
            itemGeneratedForStarterNode: true, linkedRuleEntry: rule,
            collectedFromIndex: 0
        };
        this.createRecursively(null, rule, recursionCacheStack);
    }
    Object.defineProperty(LinearTraversion.prototype, "length", {
        get: function () {
            return this.traversionControls.length;
        },
        enumerable: false,
        configurable: true
    });
    LinearTraversion.prototype.createRecursively = function (parent, item, recursionCacheStack) {
        var _this = this;
        var newRecursionStack = {};
        Object.setPrototypeOf(newRecursionStack, recursionCacheStack);
        if (!parent || parent.traversionGeneratorEntered(this, item, newRecursionStack)) {
            this.pushDefaultPrefixControllerItems(item);
            item.pushPrefixControllerItem(this);
            var first = 1;
            var previousChild = null;
            item.children.forEach(function (child) {
                var separator;
                if (first) {
                    first = 0;
                }
                else {
                    separator = new TraversionControl(_this, TraversionItemKind.CHILD_SEPARATOR, item);
                    separator.child = child;
                    separator.previousChild = previousChild;
                    _this.pushControl(separator);
                }
                _this.createRecursively(item, child, newRecursionStack);
                if (separator) {
                    separator.toPosition = _this.length;
                }
                previousChild = child;
            });
            item.pushPostfixControllerItem(this);
            this.pushDefaultPostfixControllerItems(item);
            if (parent)
                parent.traversionGeneratorExited(this, item, newRecursionStack);
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
    LinearTraversion.prototype.traverse = function (intoState, previous, initialPurpose, purposeThen, startPosition) {
        if (startPosition === void 0) { startPosition = 0; }
        var t = this;
        t.purpose = initialPurpose;
        t.purposeThen = purposeThen ? purposeThen : [];
        var cache = new TraversionCache(intoState, previous);
        if (startPosition >= this.traversionControls.length) {
            this.stopped = true;
        }
        for (this.position = startPosition; !this.stopped;) {
            this.positionBeforeStep = this.position;
            var item = this.traversionControls[this.position];
            if (item) {
                item.item.traversionActions(this, item, cache);
                this.defaultActions(item, cache, intoState, previous);
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
    LinearTraversion.prototype.defaultActions = function (step, cache, intoState, previous) {
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
                        cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftesAndReduces.length;
                        break;
                }
                break;
            case TraversionItemKind.NODE_END:
                switch (this.purpose) {
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        if (intoState.shiftesAndReduces.length) {
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
                            previous.shiftesAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: false });
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
                        if (cache.nodeLocal(step.item).shiftReducesAtStart === intoState.shiftesAndReduces.length) {
                            intoState.shiftesAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item, isEpsilonReduce: true });
                            cache.nodeLocal(step.item).shiftReducesAtStart = intoState.shiftesAndReduces.length;
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
        this.parent = parent;
        this.parser = parser;
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
    RuleElementTraverser.prototype.traversionGeneratorEntered = function (inTraversion, childPending, recursionCacheStack) {
        return true;
    };
    RuleElementTraverser.prototype.traversionGeneratorExited = function (inTraversion, childPending, recursionCacheStack) {
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
    return RuleElementTraverser;
}());
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
            this.linkedRuleEntry = this.parser.getReferencedRule(this.targetRule);
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
    RuleRefTraverser.prototype.traversionGeneratorEntered = function (inTraversion, childPending, recursionCacheStack) {
        this.recursiveRuleOriginal = recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        if (this.recursiveRuleOriginal) {
            this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RECURSIVE_RULE, this);
            inTraversion.pushControl(this.traverserStep);
            return false;
        }
        else {
            recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;
            this.duplicatedRuleEntry = new EntryPointTraverser(this.parser, this, this.targetRule);
            this.child = this.duplicatedRuleEntry;
            this.children.push(this.duplicatedRuleEntry);
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
                        if (r.shiftReducesBeforeRecursion) {
                            // NOTE it means subsequent recursions' case theoretically
                            // ...              
                        }
                        else {
                            r.collectedToIndex = cache.intoState.shiftesAndReduces.length;
                            r.shiftReducesBeforeRecursion =
                                cache.intoState.shiftesAndReduces.slice(r.collectedFromIndex, r.collectedToIndex);
                        }
                        if (this.stateNode) {
                            throw new Error("There's a stateNode already : " + this + " stateNode:" + this.stateNode);
                        }
                        this.stateNode = new JumpIntoSubroutineLeafStateNode(this);
                        this.parser.allLeafStateNodes.push(this.stateNode);
                        // for transitions jumping to a recursive section,
                        // generating a state which mapped to a sub - Starting- Rule- ParseTable :
                        r.shiftReducesBeforeRecursion.forEach(function (infiniteItem) {
                            switch (infiniteItem.kind) {
                                case ShiftReduceKind.SHIFT:
                                    var normJump = infiniteItem;
                                    cache.intoState.shiftesAndReduces.push({
                                        kind: ShiftReduceKind.SHIFT_RECURSIVE,
                                        item: normJump.item, intoRule: _this.stateNode
                                    });
                                    break;
                                case ShiftReduceKind.REDUCE:
                                    var normReduce = infiniteItem;
                                    cache.intoState.shiftesAndReduces.push({
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
                        this.collectedFromIndex = cache.intoState.shiftesAndReduces.length;
                        break;
                    case TraversionItemKind.NODE_START:
                    case TraversionItemKind.NODE_END:
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
    return RuleRefTraverser;
}(RefTraverser));
var TerminalRefTraverser = /** @class */ (function (_super) {
    __extends(TerminalRefTraverser, _super);
    function TerminalRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        parser.allTerminalReferences.push(_this);
        _this.stateNode = new TraversedLeafStateNode(_this);
        parser.allLeafStateNodes.push(_this.stateNode);
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
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
        inTraversion.pushControl(this.traverserStep);
    };
    TerminalRefTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
        this.traverserStep = null;
    };
    TerminalRefTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case TraversionItemKind.TERMINAL:
                switch (inTraversion.purpose) {
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        cache.intoState.shiftesAndReduces.push({ kind: ShiftReduceKind.SHIFT, item: this });
                        break;
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        break;
                }
                break;
            default:
        }
    };
    return TerminalRefTraverser;
}(RefTraverser));
var EntryPointTraverser = /** @class */ (function (_super) {
    __extends(EntryPointTraverser, _super);
    function EntryPointTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.index = node.index;
        _this.optionalBranch = _this.child.optionalBranch;
        return _this;
    }
    Object.defineProperty(EntryPointTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    EntryPointTraverser.prototype.findRuleNodeParent = function (rule, incl) {
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
    return EntryPointTraverser;
}(SingleTraverser));
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
            console.error("No parser.node.action or .action.fun   " + this.node);
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