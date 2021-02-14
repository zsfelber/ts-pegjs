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
exports.SemanticNotTraverser = exports.SemanticAndTraverser = exports.EntryPointTraverser = exports.CopiedRuleTraverser = exports.RuleTraverser = exports.TerminalRefTraverser = exports.RuleRefTraverser = exports.RefTraverser = exports.OneOrMoreTraverser = exports.ZeroOrMoreTraverser = exports.OrMoreTraverser = exports.OptionalTraverser = exports.EmptyTraverser = exports.SingleTraverser = exports.SingleCollectionTraverser = exports.SequenceTraverser = exports.ChoiceTraverser = exports.RuleElementTraverser = exports.Factory = void 0;
var _1 = require(".");
var analyzer_1 = require("./analyzer");
var analyzer_tra_1 = require("./analyzer-tra");
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
                throw new Error("Not expecting it here please fix it");
            /*if (!parent) {
              return new EntryPointTraverser(parser, null, node as PRule);
            } else if (parent instanceof RuleRefTraverser) {
              return new CopiedRuleTraverser(parser, parent, node as PRule);
            } else {
              throw new Error("bad parent:" + parent);
            }*/
        }
    }
    Factory.createTraverser = createTraverser;
})(Factory = exports.Factory || (exports.Factory = {}));
var RuleElementTraverser = /** @class */ (function () {
    function RuleElementTraverser(parser, parent, node) {
        var _this = this;
        this.allNodes = [];
        this.allRuleReferences = [];
        this.allTerminalReferences = [];
        this.children = [];
        this.parser = parser;
        this.parent = parent;
        this.nodeTravId = parser.nodeTravIds++;
        this.node = node;
        this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;
        this.topRule.allNodes.push(this);
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
    Object.defineProperty(RuleElementTraverser.prototype, "importPoint", {
        get: function () {
            return this.parent.importPoint;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RuleElementTraverser.prototype, "topRule", {
        get: function () {
            return this.parent.topRule;
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
    RuleElementTraverser.prototype.traversionGeneratorEnter = function (inTraversion) {
        return true;
    };
    RuleElementTraverser.prototype.traversionGeneratorExited = function (inTraversion) {
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
            case analyzer_tra_1.TraversionItemKind.CHILD_SEPARATOR:
                switch (inTraversion.purpose) {
                    case analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS:
                        break;
                    case analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        break;
                }
                break;
            default:
        }
    };
    return ChoiceTraverser;
}(RuleElementTraverser));
exports.ChoiceTraverser = ChoiceTraverser;
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
            case analyzer_tra_1.TraversionItemKind.CHILD_SEPARATOR:
            case analyzer_tra_1.TraversionItemKind.NODE_END:
                switch (inTraversion.purpose) {
                    case analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS:
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
                            if (step.previousChild.optionalBranch) {
                                if (step.kind === analyzer_tra_1.TraversionItemKind.NODE_END) {
                                    // FINISH
                                    // change purpose
                                    inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.CHANGE_PURPOSE, step, analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS]);
                                }
                            }
                            else {
                                inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.STOP, step);
                            }
                        }
                        else {
                            // it is the 2..n th branch of sequence, their first items  may not be
                            // the following  unless the 1..(n-1)th (previous) branch was optional
                            //
                            // if so then traversing the next branch / moving upwards  regurarly
                            //
                            if (step.kind === analyzer_tra_1.TraversionItemKind.NODE_END) {
                                // skip ok
                            }
                            else if (!step.previousChild.optionalBranch) {
                                inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.OMIT_SUBTREE, step);
                            }
                        }
                        break;
                    case analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        if (step.kind === analyzer_tra_1.TraversionItemKind.NODE_END) {
                            // continue upwards section of traversal
                        }
                        else {
                            traverseLocals.steppingFromInsideThisSequence = true;
                            if (step.child.common) {
                                cache.intoState.common = step.child.common;
                                // Found a cached result, it has already done (And we stop) :
                                inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.STOP, step);
                            }
                            else {
                                // Creating the common section from this node the first time now:
                                step.child.common = new _1.LeafStateNodeCommon(this.parser);
                                cache.intoState.common = step.child.common;
                                inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.STEP_PURPOSE, step);
                            }
                        }
                        break;
                }
                break;
            default:
        }
    };
    return SequenceTraverser;
}(RuleElementTraverser));
exports.SequenceTraverser = SequenceTraverser;
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
exports.SingleCollectionTraverser = SingleCollectionTraverser;
var SingleTraverser = /** @class */ (function (_super) {
    __extends(SingleTraverser, _super);
    function SingleTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SingleTraverser;
}(SingleCollectionTraverser));
exports.SingleTraverser = SingleTraverser;
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
exports.EmptyTraverser = EmptyTraverser;
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
exports.OptionalTraverser = OptionalTraverser;
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
        this.crrTrItem = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.REPEAT, this);
    };
    OrMoreTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
        this.crrTrItem.toPosition = inTraversion.length;
        inTraversion.pushControl(this.crrTrItem);
        this.crrTrItem = null;
    };
    OrMoreTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        var traverseLocals = cache.nodeLocal(this);
        switch (step.kind) {
            case analyzer_tra_1.TraversionItemKind.REPEAT:
                switch (inTraversion.purpose) {
                    case analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS:
                        if (traverseLocals.steppingFromInsideThisSequence) {
                            // FINISH
                            // change purpose
                            inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.CHANGE_PURPOSE, step, analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN, [analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS]);
                        }
                        break;
                    case analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        if (this.common) {
                            cache.intoState.common = this.common;
                            // Found a cached result, it has already done (And we stop) :
                            inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.STOP, step);
                        }
                        else {
                            traverseLocals.steppingFromInsideThisSequence = true;
                            // Creating the common section from this node the first time now:
                            this.common = new _1.LeafStateNodeCommon(this.parser);
                            cache.intoState.common = this.common;
                            inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.RESET_POSITION, step);
                            inTraversion.execute(analyzer_tra_1.TraversionItemActionKind.STEP_PURPOSE, step);
                        }
                        break;
                }
                break;
            default:
        }
    };
    return OrMoreTraverser;
}(SingleCollectionTraverser));
exports.OrMoreTraverser = OrMoreTraverser;
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
exports.ZeroOrMoreTraverser = ZeroOrMoreTraverser;
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
exports.OneOrMoreTraverser = OneOrMoreTraverser;
var RefTraverser = /** @class */ (function (_super) {
    __extends(RefTraverser, _super);
    function RefTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return RefTraverser;
}(EmptyTraverser));
exports.RefTraverser = RefTraverser;
var RuleRefTraverser = /** @class */ (function (_super) {
    __extends(RuleRefTraverser, _super);
    function RuleRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.ruleRef = true;
        _this.topRule.allRuleReferences.push(_this);
        _this.parser.newRuleReferences.push(_this);
        _this.targetRule = _1.HyperG.ruleTable[_this.node.ruleIndex];
        return _this;
    }
    Object.defineProperty(RuleRefTraverser.prototype, "isReducable", {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    RuleRefTraverser.prototype.lazyBuildMonoRefTree = function () {
        var deferred = _1.Analysis.deferredRules.indexOf(this.targetRule.rule) !== -1;
        if (!deferred && this.targetRule.refs <= 1) {
            this.lazyLinkRule();
        }
    };
    RuleRefTraverser.prototype.lazyLinkRule = function () {
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
        this.targetRule = _1.HyperG.ruleTable[this.node.ruleIndex];
        if (!this.targetRule) {
            console.error("no this.targetRule  " + this.node);
            dirty = 1;
        }
        return dirty;
    };
    RuleRefTraverser.prototype.traversionGeneratorEnter = function (inTraversion) {
        var recursiveRule = _1.Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        var deferred = _1.Analysis.deferredRules.indexOf(this.targetRule.rule) !== -1;
        if (deferred) {
            //console.log("Deferred node : "+this+" in "+inTraversion);
            //
            // NOTE  manually declared defer mode 
            //
            this.isDeferred = true;
        }
        else if (recursiveRule) {
            _1.Analysis.localDeferredRules.push(this.targetRule.rule);
            //console.log("Auto defer recursive rule : " + this + " in " + inTraversion);
            //
            // NOTE  auto-defer mode here
            //       when a rule is infinitely included !!!
            //
            // It is simple right now, though an important condition have
            // to pass later: a deferred automaton should adjust parsing position
            this.isDeferred = true;
        }
        if (this.traverserStep)
            throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);
        if (!this.isDeferred) {
            if (this.targetRule.refs > 1) {
                _1.Analysis.deferredRules.push(this.targetRule.rule);
                this.isDeferred = true;
                delete _1.Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
            }
            else {
                // NOTE
                // IT IS CUT off now  !!!
                //console.log("rule#" + this.targetRule.nodeIdx +"->"+ recursionCacheStack.indent+" "+this);
                //
                // NOTE  auto-defer mode also
                //       when a rule is too large
                //
                //       Though, recommended defining these manually in ellegant hotspots
                //       which not autodetectable but this safeguard is definitely required:
                if (false) {
                    this.lazyLinkRule();
                    var cntNodesL1 = this.linkedRuleEntry.hubSize(1);
                    var cntNodesLN = this.linkedRuleEntry.hubSize(analyzer_1.CNT_HUB_LEVELS);
                    var estCntNodes = _1.Traversing.recursionCacheStack.parent.upwardBranchCnt *
                        cntNodesL1;
                    if (cntNodesLN >= analyzer_1.LEV_CNT_LN_RULE && estCntNodes >= _1.LEV_CNT_BRANCH_NODES) {
                        /*console.warn("Auto defer rule hub : " + this + " in " + inTraversion + "  its size L1:" + cntNodesL1+"   LN("+MAX_CNT_HUB_LEVELS+"):" + cntNodesLN+"  est.tot:"+estCntNodes);
                        if (!Analysis["consideredManualDefer"]) {
                          Analysis["consideredManualDefer"] = true;
                          console.warn(
                            "  Consider configuring deferred rules manually for your code esthetics.\n"+
                            "  This rule reference is made deferred automatically due to its large extent.\n"+
                            "  Analyzer could not simply generate everything to beneath one root, because\n"+
                            "  it will reach a prematurely rapid growth effect at some point in analyzing\n"+
                            "  time and output table size due to its exponential nature.\n");
                        }*/
                        _1.Analysis.deferredRules.push(this.targetRule.rule);
                        this.isDeferred = true;
                        delete _1.Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
                        //} else if (estCntNodes>=20) {
                        //  console.log("Copied rule branch : " + ruledup+" cntNodes:"+estCntNodes);
                    }
                }
            }
        }
        if (this.isDeferred) {
            this.traverserStep = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.DEFERRED_RULE, this);
            inTraversion.pushControl(this.traverserStep);
            this.stateNode = new _1.JumpIntoSubroutineLeafStateNode(this);
            this.parser.allLeafStateNodes.push(this.stateNode);
            if (this.children.length) {
                throw new Error("children ?? There are " + this.children.length + ". " + this);
            }
            return false;
        }
        else {
            _1.Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;
            var ruledup = new CopiedRuleTraverser(this.parser, this, this.targetRule);
            this.ownRuleEntry = ruledup;
            this.child = this.ownRuleEntry;
            this.children.push(this.ownRuleEntry);
            this.traverserStep = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.RULE, this);
            inTraversion.pushControl(this.traverserStep);
            return true;
        }
    };
    RuleRefTraverser.prototype.traversionGeneratorExited = function (inTraversion) {
        if (this.ownRuleEntry) {
            var ruledup = this.ownRuleEntry;
            var tr = this.topRule;
            [].push.apply(tr.allNodes, ruledup.allNodes);
            [].push.apply(tr.allRuleReferences, ruledup.allRuleReferences);
            [].push.apply(tr.allTerminalReferences, ruledup.allTerminalReferences);
        }
    };
    RuleRefTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case analyzer_tra_1.TraversionItemKind.DEFERRED_RULE:
                switch (inTraversion.purpose) {
                    case analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS:
                        cache.intoState.common.shiftsAndReduces.push({ kind: _1.ShiftReduceKind.SHIFT_RECURSIVE, item: this });
                        break;
                    case analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        break;
                }
                break;
            default:
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
    Object.defineProperty(RuleRefTraverser.prototype, "shortLabel", {
        get: function () {
            return this.node.rule + (this.stateNode ? "#" + this.stateNode.index : "");
        },
        enumerable: false,
        configurable: true
    });
    return RuleRefTraverser;
}(RefTraverser));
exports.RuleRefTraverser = RuleRefTraverser;
var TerminalRefTraverser = /** @class */ (function (_super) {
    __extends(TerminalRefTraverser, _super);
    function TerminalRefTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        _this.topRule.allTerminalReferences.push(_this);
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
        this.traverserStep = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.TERMINAL, this);
        inTraversion.pushControl(this.traverserStep);
        this.stateNode = new _1.TraversedLeafStateNode(this);
        this.parser.allLeafStateNodes.push(this.stateNode);
    };
    TerminalRefTraverser.prototype.traversionActions = function (inTraversion, step, cache) {
        switch (step.kind) {
            case analyzer_tra_1.TraversionItemKind.TERMINAL:
                switch (inTraversion.purpose) {
                    case analyzer_tra_1.TraversionPurpose.FIND_NEXT_TOKENS:
                        cache.intoState.common.shiftsAndReduces.push({ kind: _1.ShiftReduceKind.SHIFT, item: this });
                        break;
                    case analyzer_tra_1.TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
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
exports.TerminalRefTraverser = TerminalRefTraverser;
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
var CopiedRuleTraverser = /** @class */ (function (_super) {
    __extends(CopiedRuleTraverser, _super);
    function CopiedRuleTraverser(parser, parent, node) {
        var _this = _super.call(this, parser, parent, node) || this;
        if (!parent)
            throw new Error();
        return _this;
    }
    Object.defineProperty(CopiedRuleTraverser.prototype, "topRule", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(CopiedRuleTraverser.prototype, "importPoint", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    return CopiedRuleTraverser;
}(RuleTraverser));
exports.CopiedRuleTraverser = CopiedRuleTraverser;
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
    Object.defineProperty(EntryPointTraverser.prototype, "topRule", {
        get: function () {
            return this;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EntryPointTraverser.prototype, "importPoint", {
        get: function () {
            return null;
        },
        enumerable: false,
        configurable: true
    });
    // 1+1 level deep graph size
    EntryPointTraverser.prototype.hubSize = function (maxLev) {
        var _this = this;
        var result = this.allNodes.length;
        if (maxLev > 0)
            this.allRuleReferences.forEach(function (rr) {
                rr.lazyLinkRule();
                if (rr.linkedRuleEntry !== _this) {
                    var deferred = _1.Analysis.deferredRules.indexOf(rr.targetRule.rule) !== -1;
                    if (!deferred) {
                        result += rr.linkedRuleEntry.hubSize(maxLev - 1);
                    }
                }
            });
        return result;
    };
    EntryPointTraverser.prototype.traversionGeneratorEnter = function (inTraversion) {
        var ruleOriginal = _1.Traversing.recursionCacheStack["rule_ref#" + this.node.nodeIdx];
        if (!ruleOriginal) {
            _1.Traversing.recursionCacheStack["rule_ref#" + this.node.nodeIdx] = this.node;
        }
        return true;
    };
    Object.defineProperty(EntryPointTraverser.prototype, "shortLabel", {
        get: function () {
            return this.node.rule + "#1";
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
        var action = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.NEGATE, this);
        inTraversion.pushControl(action);
    };
    PredicateNotTraverser.prototype.pushPostfixControllerItem = function (inTraversion) {
        var action = new analyzer_tra_1.TraversionControl(inTraversion, analyzer_tra_1.TraversionItemKind.NEGATE, this);
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
exports.SemanticAndTraverser = SemanticAndTraverser;
var SemanticNotTraverser = /** @class */ (function (_super) {
    __extends(SemanticNotTraverser, _super);
    function SemanticNotTraverser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return SemanticNotTraverser;
}(SemanticTraverser));
exports.SemanticNotTraverser = SemanticNotTraverser;
//# sourceMappingURL=analyzer-nodes.js.map