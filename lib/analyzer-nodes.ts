import { StrMapLike, ParseTableGenerator, PNode, PNodeKind, PRuleRef, PTerminalRef, PValueNode, PRef, PRule, Analysis, LEV_CNT_BRANCH_NODES, LinearTraversion, TraversionControl, TraversionItemKind, TraversionCache, TraversionItemActionKind, TraversionPurpose, JumpIntoSubroutineLeafStateNode, LeafStateNode, ShiftReduceKind, Traversing, TraversedLeafStateNode } from ".";
import { CNT_HUB_LEVELS, LEV_CNT_LN_RULE } from './analyzer';


export namespace Factory {

  export var parseTables: StrMapLike<ParseTableGenerator> = {};

  export function createTraverser(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    switch (node.kind) {
      case PNodeKind.CHOICE:
        return new ChoiceTraverser(parser, parent, node);
      case PNodeKind.SEQUENCE:
      case PNodeKind.SINGLE:
        return new SequenceTraverser(parser, parent, node);
      case PNodeKind.OPTIONAL:
        return new OptionalTraverser(parser, parent, node);
      case PNodeKind.SEMANTIC_AND:
        return new SemanticAndTraverser(parser, parent, node);
      case PNodeKind.SEMANTIC_NOT:
        return new SemanticNotTraverser(parser, parent, node);
      case PNodeKind.PREDICATE_AND:
        return new SemanticAndTraverser(parser, parent, node);
      case PNodeKind.PREDICATE_NOT:
        return new SemanticNotTraverser(parser, parent, node);
      case PNodeKind.ZERO_OR_MORE:
        return new ZeroOrMoreTraverser(parser, parent, node);
      case PNodeKind.ONE_OR_MORE:
        return new OneOrMoreTraverser(parser, parent, node);
      case PNodeKind.RULE_REF:
        return new RuleRefTraverser(parser, parent, node as PRuleRef);
      case PNodeKind.TERMINAL_REF:
        return new TerminalRefTraverser(parser, parent, node as PTerminalRef);
      case PNodeKind.RULE:
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
}


export abstract class RuleElementTraverser {

  readonly allNodes: RuleElementTraverser[] = [];
  readonly allRuleReferences: RuleRefTraverser[] = [];
  readonly allTerminalReferences: TerminalRefTraverser[] = [];

  readonly nodeTravId: number;
  readonly constructionLevel: number;
  readonly parser: ParseTableGenerator;

  readonly parent: RuleElementTraverser;
  readonly node: PNode;
  readonly children: RuleElementTraverser[] = [];
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    this.parser = parser;
    this.parent = parent;
    this.nodeTravId = parser.nodeTravIds++;
    this.node = node;
    this.constructionLevel = parent ? parent.constructionLevel + 1 : 0;

    this.topRule.allNodes.push(this);

    this.node.children.forEach(n => {
      this.children.push(Factory.createTraverser(parser, this, n));
    });
    if (this.checkConstructFailed()) {
      //  throw new Error("Ast construction failed.");
    }
    this.optionalBranch = this.node.optionalNode;
  }

  get isReducable() {
    return false;
  }
  get top(): EntryPointTraverser {
    return this.parent.top;
  }
  get importPoint(): CopiedRuleTraverser {
    return this.parent.importPoint;
  }
  get topRule(): RuleTraverser {
    return this.parent.topRule;
  }

  checkConstructFailed(): any {
  }

  findParent(node: PValueNode, incl = false) {
    if (node === this.node && incl) {
      return this;
    } else if (this.parent) {
      return this.parent.findParent(node, true);
    } else {
      return null;
    }
  }

  findRuleNodeParent(rule: string, incl = false) {
    if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

  traversionGeneratorEnter(inTraversion: LinearTraversion) {
    return true;
  }
  traversionGeneratorExited(inTraversion: LinearTraversion) {
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
  }

  pushPostfixControllerItem(inTraversion: LinearTraversion) {
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
  }

  toString() {
    return "T~" + this.node + (this.optionalBranch ? "<opt>" : "");
  }

  get shortLabel() {
    return "";
  }

}


export class ChoiceTraverser extends RuleElementTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.children.some(itm => itm.optionalBranch);
  }

  get isReducable() {
    return true;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
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
  }

}


export class SequenceTraverser extends RuleElementTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = !this.children.some(itm => !itm.optionalBranch);
  }

  checkConstructFailed() {
    if (!this.children.length) {
      console.error("!parser.children.length (empty sequence)  " + this.node);
      return 1;
    }
  }

  get isReducable() {
    return true;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {

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

            } else {
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
  }

}


export abstract class SingleCollectionTraverser extends RuleElementTraverser {

  child: RuleElementTraverser;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.child = this.children[0];
  }

  checkConstructFailed() {
    if (this.children.length !== 1) {
      console.error("this.children.length:" + this.children.length + " !== 1  " + this.node);
      return 1;
    }
  }



}


export abstract class SingleTraverser extends SingleCollectionTraverser {


}



export class EmptyTraverser extends RuleElementTraverser {

  checkConstructFailed() {
    if (this.children.length !== 0) {
      console.error("this.children.length !== 0  " + this.node);
      return 1;
    }
  }

  get isReducable() {
    return true;
  }

}



export class OptionalTraverser extends SingleTraverser {

  get isReducable() {
    return true;
  }

  get shortLabel() {
    return "?";
  }
}

export class OrMoreTraverser extends SingleCollectionTraverser {

  get isReducable() {
    return true;
  }

  crrTrItem: TraversionControl;

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem = new TraversionControl(inTraversion, TraversionItemKind.REPEAT, this);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    this.crrTrItem.toPosition = inTraversion.length;
    inTraversion.pushControl(this.crrTrItem);
    this.crrTrItem = null;
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
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
  }
}


// node.optionalNode == true 

export class ZeroOrMoreTraverser extends OrMoreTraverser {


  get shortLabel() {
    return "*";
  }

}

// node.optionalNode == false 

export class OneOrMoreTraverser extends OrMoreTraverser {

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.child.optionalBranch;
  }

  get shortLabel() {
    return "+";
  }

}

export class RefTraverser extends EmptyTraverser {

  child: RuleElementTraverser;

  node: PRef;

  traverserStep: TraversionControl;

  stateNode: LeafStateNode;

}

export class RuleRefTraverser extends RefTraverser {

  node: PRuleRef;

  isDeferred: boolean;

  targetRule: PRule;
  linkedRuleEntry: EntryPointTraverser;
  ownRuleEntry: CopiedRuleTraverser;

  stateNode: JumpIntoSubroutineLeafStateNode;

  readonly ruleRef = true;

  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PRuleRef) {
    super(parser, parent, node);
    
    this.topRule.allRuleReferences.push(this);
    this.parser.newRuleReferences.push(this);

    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
  }

  get isReducable() {
    return true;
  }

  lazyLinkRule() {
    if (this.linkedRuleEntry) {
      return false;
    } else {
      this.linkedRuleEntry = this.parser.getEntryPoint(this.targetRule);
      (this as any).optionalBranch = this.linkedRuleEntry.optionalBranch;

      return true;
    }
  }

  checkConstructFailed() {

    var dirty = super.checkConstructFailed();
    this.targetRule = Analysis.ruleTable[this.node.ruleIndex];
    if (!this.targetRule) {
      console.error("no this.targetRule  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  traversionGeneratorEnter(inTraversion: LinearTraversion) {

    var recursiveRule = Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];

    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    var deferred = Analysis.deferredRules.indexOf(this.targetRule.rule) !== -1;

    if (deferred) {
      //console.log("Deferred node : "+this+" in "+inTraversion);
      //
      // NOTE  manually declared defer mode 
      //
      this.isDeferred = true;
    } else if (recursiveRule) {

      Analysis.localDeferredRules.push(this.targetRule.rule);

      //console.log("Auto defer recursive rule : " + this + " in " + inTraversion);
      //
      // NOTE  auto-defer mode here
      //       when a rule is infinitely included !!!
      //
      // It is simple right now, though an important condition have
      // to pass later: a deferred automaton should adjust parsing position
      this.isDeferred = true;

    }

    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);


    if (!this.isDeferred) {

      //console.log("rule#" + this.targetRule.nodeIdx +"->"+ recursionCacheStack.indent+" "+this);

      //
      // NOTE  auto-defer mode also
      //       when a rule is too large
      //
      //       Though, recommended defining these manually in ellegant hotspots
      //       which not autodetectable but this safeguard is definitely required:

      this.lazyLinkRule();
      var cntNodesL1 = this.linkedRuleEntry.hubSize(1);
      var cntNodesLN = this.linkedRuleEntry.hubSize(CNT_HUB_LEVELS);
      var estCntNodes = Traversing.recursionCacheStack.parent.upwardBranchCnt * 
          cntNodesL1;
      if (cntNodesLN>=LEV_CNT_LN_RULE && estCntNodes>=LEV_CNT_BRANCH_NODES) {
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

        Analysis.deferredRules.push(this.targetRule.rule);
        this.isDeferred = true;
        delete Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx];
      //} else if (estCntNodes>=20) {
      //  console.log("Copied rule branch : " + ruledup+" cntNodes:"+estCntNodes);
      }

    }

    if (this.isDeferred) {

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.DEFERRED_RULE, this);
      inTraversion.pushControl(this.traverserStep);

      this.stateNode = new JumpIntoSubroutineLeafStateNode(this);
      this.parser.allLeafStateNodes.push(this.stateNode);

      if (this.children.length) {
        throw new Error("children ?? There are "+this.children.length+". "+this);
      }

      return false;

    } else {

      Traversing.recursionCacheStack["rule_ref#" + this.targetRule.nodeIdx] = this;

      var ruledup = new CopiedRuleTraverser(this.parser, this, this.targetRule);

      this.ownRuleEntry = ruledup;
      this.child = this.ownRuleEntry;
      this.children.push(this.ownRuleEntry);

      this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.RULE, this);
      inTraversion.pushControl(this.traverserStep);

      return true;
    }
  }

  traversionGeneratorExited(inTraversion: LinearTraversion) {
    if (this.ownRuleEntry) {
      const ruledup = this.ownRuleEntry;
      const tr = this.topRule;
      [].push.apply(tr.allNodes, ruledup.allNodes);
      [].push.apply(tr.allRuleReferences, ruledup.allRuleReferences);
      [].push.apply(tr.allTerminalReferences, ruledup.allTerminalReferences);
    }
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
    switch (step.kind) {
      case TraversionItemKind.DEFERRED_RULE:
        switch (inTraversion.purpose) {
          case TraversionPurpose.FIND_NEXT_TOKENS:

            cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT_RECURSIVE, item: this });
            inTraversion.execute(TraversionItemActionKind.STOP, step);

            break;
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            break;
        }
        break;
      default:
    }
  }


  findRuleNodeParent(rule: string, incl = false) {
    if (incl && rule === this.node.rule) {
      return this;
    } else if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }

  get shortLabel() {
    return this.node.rule + (this.stateNode ? "#" + this.stateNode.index : "");
  }

}


export class TerminalRefTraverser extends RefTraverser {

  node: PTerminalRef;

  stateNode: TraversedLeafStateNode;


  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PTerminalRef) {
    super(parser, parent, node);
    this.topRule.allTerminalReferences.push(this);
  }

  get isReducable() {
    return true;
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.terminal) {
      console.error("no this.node.terminal  " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    if (this.traverserStep) throw new Error("There is a traverserStep already : " + this + "  traverserStep:" + this.traverserStep);

    this.traverserStep = new TraversionControl(inTraversion, TraversionItemKind.TERMINAL, this);
    inTraversion.pushControl(this.traverserStep);

    this.stateNode = new TraversedLeafStateNode(this);
    this.parser.allLeafStateNodes.push(this.stateNode);
  }

  traversionActions(inTraversion: LinearTraversion, step: TraversionControl, cache: TraversionCache) {
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
  }

  get shortLabel() {
    return this.node.terminal + "#" + this.stateNode.index;
  }

}


export class RuleTraverser extends SingleTraverser {

  node: PRule;
  index: number;

  readonly optionalBranch: boolean;

  readonly parent: RuleRefTraverser;


  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);

    this.index = node.index;
    this.optionalBranch = this.child.optionalBranch;
  }

  get isReducable() {
    return true;
  }

  findRuleNodeParent(rule: string, incl = false) {
    if (incl && rule === this.node.rule) {
      return this;
    } else if (this.parent) {
      return this.parent.findRuleNodeParent(rule, true);
    } else {
      return null;
    }
  }


}

export class CopiedRuleTraverser extends RuleTraverser {

  _ReferencedRuleTraverser;

  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);
    if (!parent) throw new Error();
  }

  get topRule(): RuleTraverser {
    return this;
  }
  get importPoint(): CopiedRuleTraverser {
    return this;
  }
}


export class EntryPointTraverser extends RuleTraverser {

  constructor(parser: ParseTableGenerator, parent: RuleRefTraverser, node: PRule) {
    super(parser, parent, node);
    if (parent) throw new Error();
  }

  get top(): EntryPointTraverser {
    return this;
  }
  get topRule(): RuleTraverser {
    return this;
  }
  get importPoint(): CopiedRuleTraverser {
    return null;
  }

  // 1+1 level deep graph size
  hubSize(maxLev: number) {

    var result = this.allNodes.length;

    if (maxLev>0) this.allRuleReferences.forEach(rr=>{
      rr.lazyLinkRule();
      if (rr.linkedRuleEntry!==this) {
        var deferred = Analysis.deferredRules.indexOf(rr.targetRule.rule) !== -1;
        if (!deferred) {
          result += rr.linkedRuleEntry.hubSize(maxLev - 1);
        }
      }
    });

    return result;
  }



  traversionGeneratorEnter(inTraversion: LinearTraversion) {
    var ruleOriginal = Traversing.recursionCacheStack["rule_ref#" + this.node.nodeIdx];

    if (!ruleOriginal) {

      Traversing.recursionCacheStack["rule_ref#" + this.node.nodeIdx] = this.node;

    }
    return true;
  }


  get shortLabel() {
    return this.node.rule + "#1";
  }

}

abstract class PredicateTraverser extends SingleTraverser {

  get isReducable() {
    return true;
  }

}


class PredicateAndTraverser extends PredicateTraverser {
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = this.child.optionalBranch;
  }
}


class PredicateNotTraverser extends PredicateTraverser {
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    // NOTE it is good , somewhat thoughtfully tricky
    this.optionalBranch = !this.child.optionalBranch;
  }

  pushPrefixControllerItem(inTraversion: LinearTraversion) {
    var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
    inTraversion.pushControl(action);
  }
  pushPostfixControllerItem(inTraversion: LinearTraversion) {
    var action = new TraversionControl(inTraversion, TraversionItemKind.NEGATE, this);
    inTraversion.pushControl(action);
  }

}


abstract class SemanticTraverser extends EmptyTraverser {
  node: PValueNode;
  readonly optionalBranch: boolean;

  constructor(parser: ParseTableGenerator, parent: RuleElementTraverser, node: PNode) {
    super(parser, parent, node);
    this.optionalBranch = false;
  }

  get isReducable() {
    return true;
  }

  checkConstructFailed() {
    var dirty = super.checkConstructFailed();
    if (!this.node.action || !this.node.action.fun) {
      // TODO frequently..
      //console.error("No parser.node.action or .action.fun   " + this.node);
      dirty = 1;
    }
    return dirty;
  }

  // TODO impl like this:
  // this too should stop the traversion :
  // cache.intoState.shiftsAndReduces.push({ kind: ShiftReduceKind.SHIFT_RECURSIVE, item: this });
  // inTraversion.execute(TraversionItemActionKind.STOP, step);


}


export class SemanticAndTraverser extends SemanticTraverser {

}


export class SemanticNotTraverser extends SemanticTraverser {

} 
