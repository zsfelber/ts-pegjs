exports.use = function (config, options) {
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
};

