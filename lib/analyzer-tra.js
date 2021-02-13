"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearTraversion = exports.TraversionCache = exports.TraversionItemActionKind = exports.TraversionPurpose = exports.TraversionControl = exports.TraversionItemKind = void 0;
var _1 = require(".");
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
    TraversionItemActionKind[TraversionItemActionKind["CHANGE_PURPOSE"] = 2] = "CHANGE_PURPOSE";
    TraversionItemActionKind[TraversionItemActionKind["RESET_POSITION"] = 3] = "RESET_POSITION";
    TraversionItemActionKind[TraversionItemActionKind["STOP"] = 4] = "STOP";
    TraversionItemActionKind[TraversionItemActionKind["CONTINUE"] = 5] = "CONTINUE"; /*default*/
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
        _1.Traversing.start(this, rule);
        this.createRecursively();
        _1.Traversing.finish();
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
        var item = _1.Traversing.item;
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
            var startnode = new TraversionControl(this, TraversionItemKind.NODE_START, item);
            this.pushControl(startnode);
            item.pushPrefixControllerItem(this);
            var i = 0;
            var previousChild = null;
            _1.Traversing.recursionCacheStack.upwardBranchCnt *= item.children.length;
            item.children.forEach(function (child) {
                //console.log("iterate "+i+"."+newRecursionStack.indent+child);
                var separator;
                if (i > 0) {
                    separator = new TraversionControl(_this, TraversionItemKind.CHILD_SEPARATOR, item);
                    separator.child = child;
                    separator.previousChild = previousChild;
                    _this.pushControl(separator);
                }
                _1.Traversing.push(child);
                _this.createRecursively();
                _1.Traversing.pop();
                if (separator) {
                    separator.toPosition = _this.length;
                }
                previousChild = child;
                i++;
            });
            item.pushPostfixControllerItem(this);
            var endnode = new TraversionControl(this, TraversionItemKind.NODE_END, item);
            endnode.previousChild = previousChild;
            this.pushControl(endnode);
            item.traversionGeneratorExited(this);
        }
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
                break;
            case TraversionItemKind.NODE_END:
                switch (this.purpose) {
                    case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
                        //if (intoState.shiftsAndReduces.length) {
                        //  throw new Error("Already in next state/" + this + ":" + step);
                        //}
                        //
                        /// TODO changed outdated rethought may be multiple
                        //
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
                            if (intoState.common) {
                                intoState.common.shiftsAndReduces.push({ kind: _1.ShiftReduceKind.REDUCE, item: step.item });
                            }
                            else {
                                intoState.reduces.push({ kind: _1.ShiftReduceKind.REDUCE, item: step.item });
                            }
                        }
                        break;
                    case TraversionPurpose.FIND_NEXT_TOKENS:
                        // Epsilon REDUCE action (default or user function)
                        // A whole branch was empty and it is accepted as a 
                        // a valid empty node success (which should be of an
                        // optionalBranch==true node) ...
                        // 
                        // We simply skip this case, doing nothing
                        //
                        break;
                }
                break;
        }
        this.execute(TraversionItemActionKind.CONTINUE, null);
    };
    LinearTraversion.prototype.execute = function (action, step) {
        var etc = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            etc[_i - 2] = arguments[_i];
        }
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
            case TraversionItemActionKind.CHANGE_PURPOSE:
                this.purpose = etc[0];
                this.purposeThen = etc[1];
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
//# sourceMappingURL=analyzer-tra.js.map