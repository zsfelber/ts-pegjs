import {
  EntryPointTraverser,
  ParseTableGenerator,
  RuleElementTraverser,
  ShiftReduceKind,
  StateNodeWithPrefix,
  StrMapLike,
} from '.';

export enum TraversionItemKind {
  NODE_START, NODE_END, CHILD_SEPARATOR, NEGATE
}




interface TraversionMakerCache {

  depth: number;
  indent: string;
  upwardBranchCnt: number;
  parent?: TraversionMakerCache;
  top?: TraversionMakerCache;
  item?: RuleElementTraverser;
}

export namespace Traversing {

  export var active: boolean;

  export var inTraversion: LinearTraversion;

  export var recursionCacheStack: TraversionMakerCache;

  export var item: RuleElementTraverser;

  var maxdepth = 0;

  export function start(_inTraversion: LinearTraversion, _item: RuleElementTraverser) {
    inTraversion = _inTraversion;
    recursionCacheStack = { depth: 0, indent: "", upwardBranchCnt: 1, item: _item };
    recursionCacheStack.top = recursionCacheStack;
    item = recursionCacheStack.item;
    maxdepth = 0;
    active = true;
  }
  export function finish() {
    active = false;
  }

  export function push(child: RuleElementTraverser) {
    var oldRecursionCacheStack = recursionCacheStack;
    recursionCacheStack = { depth: oldRecursionCacheStack.depth + 1, indent: oldRecursionCacheStack.indent + "  ", upwardBranchCnt: oldRecursionCacheStack.upwardBranchCnt, parent: oldRecursionCacheStack, top: oldRecursionCacheStack.top, item: child };
    if (recursionCacheStack.depth > maxdepth) {
      maxdepth = recursionCacheStack.depth;
      /*if (!(maxdepth%10)) {
        console.log("Traversal depth:"+recursionCacheStack.depth);
      }*/
    }
    item = recursionCacheStack.item;
    Object.setPrototypeOf(recursionCacheStack, oldRecursionCacheStack);
  }
  export function pop() {
    recursionCacheStack = recursionCacheStack.parent;
    item = recursionCacheStack.item;
  }
}



export class TraversionControl {
  readonly parent: LinearTraversion;

  kind: TraversionItemKind;
  item: RuleElementTraverser;

  child: RuleElementTraverser;
  previousChild: RuleElementTraverser;
  start: TraversionControl;
  end: TraversionControl;

  fromPosition: number;
  toPosition: number;

  constructor(parent: LinearTraversion, kind: TraversionItemKind, itm: RuleElementTraverser) {
    this.parent = parent;
    this.kind = kind;
    this.item = itm;
    this.fromPosition = this.toPosition = parent.length;
  }

  toString() {
    return "TrvCtrl." + TraversionItemKind[this.kind] + "/" + this.fromPosition + (this.fromPosition !== this.toPosition ? ".." + this.toPosition : "") + "/" + this.item;
  }
}

export enum TraversionPurpose {
  FIND_NEXT_TOKENS, BACKSTEP_TO_SEQUENCE_THEN
}

export enum TraversionItemActionKind {
  OMIT_SUBTREE, STEP_PURPOSE, CHANGE_PURPOSE, RESET_POSITION,
  STOP, CONTINUE/*default*/
}

export class TraversionCache {

  readonly isNegative = false;

  readonly intoState: StateNodeWithPrefix;

  constructor(intoState: StateNodeWithPrefix) {
    this.intoState = intoState;
  }

  private nodeLocals: any[] = [];

  nodeLocal(node: RuleElementTraverser) {
    var r = this.nodeLocals[node.nodeTravId];
    if (!r) {
      this.nodeLocals[node.nodeTravId] = r = [];
    }
    return r;
  }

  negate() {
    var t = this as any;
    t.isNegative = !this.isNegative;
  }
}



export class LinearTraversion {

  readonly parser: ParseTableGenerator;
  readonly rule: EntryPointTraverser;

  readonly traversionControls: TraversionControl[];

  readonly purpose: TraversionPurpose;
  readonly purposeThen: TraversionPurpose[];
  private position: number;
  private positionBeforeStep: number;
  private stopped: boolean;
  private steparranged: boolean;

  get length() {
    return this.traversionControls.length;
  }

  constructor(parser: ParseTableGenerator, rule: EntryPointTraverser) {
    this.parser = parser;
    this.rule = rule;
    this.traversionControls = [];


    Traversing.start(this, rule);
    this.createRecursively();
    Traversing.finish();
  }

  private createRecursively() {

    const item = Traversing.item;

    // each one located beneath start rule and its copied CopiedRuleTraverser s,
    // is traversable,
    // the rest which created for linked rules, and/or in parser.getReferencedRule,
    // is not traversable
    if (!item.top.parent && item.top !== this.parser.startingStateNode.rule) {
      throw new Error("This how : " + item + "  in:" + this);
    }

    var startnode = new TraversionControl(this, TraversionItemKind.NODE_START, item);
    startnode.start = startnode;
    this.pushControl(startnode);

    if (item.traversionGeneratorEnter(this)) {

      //if (recursionCacheStack.indent.length<30) {
      //   console.log("createRecursively"+newRecursionStack.indent+item);
      //}

      var i = 0;
      var previousChild = null;

      Traversing.recursionCacheStack.upwardBranchCnt *= item.children.length;

      var seps = [];
      item.children.forEach(child => {
        //console.log("iterate "+i+"."+newRecursionStack.indent+child);

        var separator: TraversionControl;
        if (i > 0) {
          separator = new TraversionControl(this, TraversionItemKind.CHILD_SEPARATOR, item);
          separator.child = child;
          separator.start = startnode;
          separator.previousChild = previousChild;
          this.pushControl(separator);
          seps.push(separator);
        }

        Traversing.push(child);
        this.createRecursively();
        Traversing.pop();

        if (separator) {
          separator.toPosition = this.length;
        }
        previousChild = child;
        i++;
      });

      var endnode = new TraversionControl(this, TraversionItemKind.NODE_END, item);
      endnode.previousChild = previousChild;
      this.pushControl(endnode);

      endnode.fromPosition = startnode.fromPosition;
      startnode.toPosition = endnode.toPosition;
      endnode.start = startnode;
      endnode.end = endnode;
      startnode.end = endnode;
      seps.forEach(sep => { sep.end = endnode });

      item.traversionGeneratorExited(this);
    }

  }

  pushControl(item: TraversionControl) {
    this.traversionControls.push(item);
  }

  traverse(intoState: StateNodeWithPrefix, initialPurpose: TraversionPurpose, purposeThen?: TraversionPurpose[], startPosition = 0): TraversionCache {
    var t = this as any;
    t.purpose = initialPurpose;
    t.purposeThen = purposeThen ? purposeThen : [];
    var cache = new TraversionCache(intoState);

    if (startPosition >= this.traversionControls.length) {
      this.stopped = true;
    } else {
      this.stopped = false;
    }
    for (this.position = startPosition; !this.stopped;) {
      this.positionBeforeStep = this.position;
      this.steparranged = false;
      var item = this.traversionControls[this.position];

      if (item) {

        item.item.traversionActions(this, item, cache);

        this.defaultActions(item, cache, intoState);

        if (this.position >= this.traversionControls.length) {
          this.stopped = true;
        }
      } else {
        throw new Error("Missing item at position : " + this);
      }
    }
    return cache;
  }

  defaultActions(step: TraversionControl, cache: TraversionCache, intoState: StateNodeWithPrefix) {
    switch (step.kind) {
      case TraversionItemKind.CHILD_SEPARATOR:
        switch (this.purpose) {
          case TraversionPurpose.BACKSTEP_TO_SEQUENCE_THEN:
            this.steparranged = true;
            this.execute(TraversionItemActionKind.OMIT_SUBTREE, step.end);
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
                intoState.common.shiftsAndReduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item });
              } else {
                intoState.reduces.push({ kind: ShiftReduceKind.REDUCE, item: step.item });
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
    if (!this.steparranged) {
      this.execute(TraversionItemActionKind.CONTINUE, null);
    }
  }

  execute(action: TraversionItemActionKind, step: TraversionControl, ...etc) {
    switch (action) {
      case TraversionItemActionKind.OMIT_SUBTREE:
        if (step.kind !== TraversionItemKind.CHILD_SEPARATOR &&
            step.kind !== TraversionItemKind.NODE_START &&
            step.kind !== TraversionItemKind.NODE_END
            ) {
          throw new Error("Unknown here:" + step + " in " + this);
        }
        this.position = step.toPosition;
        this.steparranged = true;
        break;
      case TraversionItemActionKind.RESET_POSITION:
        this.position = step.fromPosition;
        this.steparranged = true;
        break;
      case TraversionItemActionKind.STEP_PURPOSE:
        (this as any).purpose = this.purposeThen.shift();
        break;
      case TraversionItemActionKind.CHANGE_PURPOSE:
        (this as any).purpose = etc[0];
        (this as any).purposeThen = etc[1];
        break;
      case TraversionItemActionKind.CONTINUE:
        this.position = this.positionBeforeStep + 1;
        this.steparranged = true;
        break;
      case TraversionItemActionKind.STOP:
        this.stopped = true;
        this.steparranged = true;
        break;
    }
  }
  toString() {
    return "Traversing " + this.rule + "/" + (this.position === undefined ? "gen.time/" + this.traversionControls.length : TraversionPurpose[this.purpose] + "/" + this.position);
  }
}
