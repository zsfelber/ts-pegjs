"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.use = void 0;
function use(config, options) {
    config.passes.generate = [
        require("./passes/parseGrammar"),
        require("./passes/inferRuleTypes"),
        require("./passes/generateTesterTools"),
        require("./passes/generateTs")
    ];
    if (!options.tspegjs) {
        options.tspegjs = {};
    }
    if (options.tspegjs.customHeader === undefined) {
        options.tspegjs.customHeader = null;
    }
}
exports.use = use;
;
//# sourceMappingURL=tspegjs.js.map