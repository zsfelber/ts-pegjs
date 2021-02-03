exports.use = function (config, options) {
    config.passes.generate = [
      require("./passes/parseGrammar"),
      require("./passes/inferRuleTypes"),
      require("./passes/generateTs"),
      require("./passes/generateParseTable"),
    ];
    if (!options.tspegjs) {
      options.tspegjs = {};
    }
    if (options.tspegjs.customHeader === undefined) {
        options.tspegjs.customHeader = null;
    }
};

