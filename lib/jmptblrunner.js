"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JmpTblRunner = void 0;
var JmpTblRunner = /** @class */ (function () {
    function JmpTblRunner() {
    }
    JmpTblRunner.prototype.init = function () {
        this._numRules = this.numRules;
    };
    JmpTblRunner.prototype.run = function (parseTable) {
        var jumper = new ParseTblJumper(this, parseTable);
        jumper.run();
    };
    return JmpTblRunner;
}());
exports.JmpTblRunner = JmpTblRunner;
var ParseTblJumper = /** @class */ (function () {
    function ParseTblJumper(runner, parseTable) {
        this.runner = runner;
        this.parseTable = parseTable;
        this.currentState = parseTable.startingState;
    }
    ParseTblJumper.prototype.run = function () {
        while (process())
            ;
    };
    ParseTblJumper.prototype.process = function () {
        var token = this.runner.next();
        if (token) {
            this.currentState = this.currentState.transitions[token.tokenId];
        }
        else {
            this.currentState = null;
        }
    };
    return ParseTblJumper;
}());
//# sourceMappingURL=jmptblrunner.js.map