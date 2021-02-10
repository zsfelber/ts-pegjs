"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packrat = void 0;
//
// This is the entry point ..
//
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!                                                               !!
//   !!     NOTE     HERE is the main entry point                     !!
//   !!                                                               !!
//   !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   !!
//   ..   r  o  c  e  s  s  o  r     object
//   !!
//
var Packrat = /** @class */ (function () {
    function Packrat(owner) {
        this.peg$resultsCache = {};
        this.owner = owner;
        this.numRules = owner.numRules;
    }
    Packrat.prototype.readCacheEntry = function (rule) {
        var p = this.owner;
        var key = p.cacheKey(rule);
        var cached = this.peg$resultsCache[key];
        if (!cached) {
            this.peg$resultsCache[key] = cached = {};
        }
        return cached;
    };
    return Packrat;
}());
exports.Packrat = Packrat;
//# sourceMappingURL=packrat.js.map