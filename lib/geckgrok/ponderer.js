/*****************************BEGIN LICENSE BLOCK *****************************
* Version: MPL 1.1/GPL 2.0/LGPL 2.1
*
* The contents of this file are subject to the Mozilla Public License Version
* 1.1 (the "License"); you may not use this file except in compliance with the
* License. You may obtain a copy of the License at http://www.mozilla.org/MPL/
*
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for
* the specific language governing rights and limitations under the License.
*
* The Original Code is Gecko Grokker
*
* The Initial Developer of the Original Code is the Mozilla Foundation.
* Portions created by the Initial Developer are Copyright (C) 2010 the Initial
* Developer. All Rights Reserved.
*
* Contributor(s):
*  Andrew Sutherland <asutherland@asutherland.org> (Original Author)
*
* Alternatively, the contents of this file may be used under the terms of either
* the GNU General Public License Version 2 or later (the "GPL"), or the GNU
* Lesser General Public License Version 2.1 or later (the "LGPL"), in which case
* the provisions of the GPL or the LGPL are applicable instead of those above.
* If you wish to allow use of your version of this file only under the terms of
* either the GPL or the LGPL, and not to allow others to use your version of
* this file under the terms of the MPL, indicate your decision by deleting the
* provisions above and replace them with the notice and other provisions
* required by the GPL or the LGPL. If you do not delete the provisions above, a
* recipient may use your version of this file under the terms of any one of the
* MPL, the GPL or the LGPL.
*
****************************** END LICENSE BLOCK ******************************/

/**
 * Ponders the gecko reflow information once properly spliced.
 *
 **/
var file = require("file");
var filehelpers = require("geckgrok/filehelpers");

// this varies with display density, but this is reality for most LCD monitors
//  which means good enough for now.
var UNITS_PER_PIX = 60;

function normPix(str) {
  if (str == "UC")
    return str;
  return parseInt(str) / UNITS_PER_PIX;
}

function minPrefMaxSizerQuery(ctx, depth, thing, stacky, rest, cmd) {
  stacky.initOnly = false;
}
var SIZE_GETTER_CMD_TO_OUTPUT_VAR = {
  "GetPrefSize=": "prefSize",
  "GetMinSize=": "minSize",
  "GetMaxSize=": "maxSize",
};
function minPrefMaxSizerDone(ctx, depth, thing, stacky, rest, cmd) {
  stacky.initOnly = false;
  var dims = rest.split(",");
  stacky.conclusions[SIZE_GETTER_CMD_TO_OUTPUT_VAR[cmd]] =
    [normPix(dims[0]), normPix(dims[1])];
}

var WIDTH_GETTER_CMD_TO_OUTPUT_VAR = {
  "GetMinWidth=": "minWidth",
  "GetPrefWidth=": "prefWidth",
};
function widthGetterDone(ctx, depth, thing, stacky, rest, cmd) {
  stacky.conclusions[WIDTH_GETTER_CMD_TO_OUTPUT_VAR[cmd]] = normPix(rest);
}


var RE_BOXREFLOW_ENTER =
  /^a=([^,]+),([^ ]+) last=([^,]+),([^ ]+) (.*)$/;
var RE_REFLOW_ENTER =
  /^a=([^,]+),([^ ]+) c=([^,]+),([^ ]+) (.*)cnt=(\d+) $/;
var RE_REFLOW_EXIT =
  /^d=([^,]+),([^ ]+)(?: status=(0x\d+))?(?: o=\(([^,]),([^\)]+)\) ([^ ]+) x ([^ ]+) sto=\(([^,]),([^\)]+)\) ([^ ]+) x ([^ ]+))?$/;
var RE_REST_INIT_FRAME_TYPE =
  /^(?:out-of-flow )?(?:prev-in-flow )?(?:abspos )?(?:float )?display=([^ ]+) result=([^ ]+)(?: \+rep)?(?: \+repBlk)?(?: tag=([^ ]+))?(?: id=([^ ]+))?(?: class=(.*))?$/;

/**
 * Per-command processors.
 */
var ReflowCommandMap = {
  "BoxReflow": function (ctx, depth, thing, stacky, rest) {
    stacky.didReflow = true;
    var match = RE_BOXREFLOW_ENTER.exec(rest);
    stacky.inputs.boxAvail = [normPix(match[1]), normPix(match[2])];
    stacky.inputs.boxLast = [normPix(match[3]), normPix(match[4])];
  },
  /**
   * This covers reflow start and end because of a syntax inconsistency where
   *  enter uses "a=" and exit uses "r=".
   */
  "Reflow": function(ctx, depth, thing, stacky, rest) {
    stacky.initOnly = false;
    stacky.didReflow = true;
    var match;
    // entry
    if (rest[0] == "a") {
      match = RE_REFLOW_ENTER.exec(rest);
      stacky.inputs.available = [normPix(match[1]), normPix(match[2])];
      stacky.inputs.computed = [normPix(match[3]), normPix(match[4])];
      stacky.inputs.rest = match[5];
      return;
    }
    // (exit)
    match = RE_REFLOW_EXIT.exec(rest);
    stacky.conclusions.reflowDims = [normPix(match[1]), normPix(match[2])];
    if (match[4]) {
      stacky.conclusions.reOverflow = [normPix(match[4]), normPix(match[5]),
                                     normPix(match[6]), normPix(match[7])];
      stacky.conclusions.reStoredOverflow =
        [normPix(match[8]), normPix(match[9]),
        normPix(match[10]), normPix(match[11])];
    }
  },
  /**
   * rest takes the form of: display=* result=* [tag=*] [id=*] [class=*]
   */
  "InitFrameType": function(ctx, depth, thing, stacky, rest) {
    var match = RE_REST_INIT_FRAME_TYPE.exec(rest);
    if (!match)
      console.error("failure to match InitFrameType on", rest, "!");
//console.log("thing.ptr", thing.ptr, "stacky.thing.ptr", stacky.thing.ptr);
    thing.tag = match[3];
    thing.id = match[4];
    thing.classes = match[5] ? match[5].split(" ") : match[5];
  },
  "InitConstraints": function(ctx, depth, thing, stacky, rest) {

  },
  "InitConstraints=": function(ctx, depth, thing, stacky, rest) {

  },
  "InitOffsets": function(ctx, depth, thing, stacky, rest) {

  },
  "InitOffsets=": function(ctx, depth, thing, stacky, rest) {

  },
  "Layout": function(ctx, depth, thing, stacky, rest) {
  },
  "Layout=": function(ctx, depth, thing, stacky, rest) {
    stacky.initOnly = false;
    stacky.didLayout = true;
    var bits = rest.split(",");
    stacky.conclusions.layout = [normPix(bits[0]), normPix(bits[1]),
                                 normPix(bits[2]), normPix(bits[3])];
  },
  "GetPrefSize": minPrefMaxSizerQuery,
  "GetPrefSize=": minPrefMaxSizerDone,
  "GetPrefWidth": minPrefMaxSizerQuery,
  "GetPrefWidth=": widthGetterDone,
  "GetMinSize": minPrefMaxSizerQuery,
  "GetMinSize=": minPrefMaxSizerDone,
  "GetMinWidth": minPrefMaxSizerQuery,
  "GetMinWidth=": widthGetterDone,
  "GetMaxSize": minPrefMaxSizerQuery,
  "GetMaxSize=": minPrefMaxSizerDone,
};

/**
 * Stateful gecko reflow debug output parser.
 */
function ReflowParser(aPonderer) {
  this.context = {
    thingMap: {},
  };
  this.ponderer = aPonderer;
}
ReflowParser.prototype = {
  /**
   * Parse all of the available lines from the given line reader.  All lines are
   *  assumed to take the gecko reflow debug line syntax that roughly amounts to
   *  "(indentation) <thing name> <thing pointer> <command name> <remainder...>"
   *
   * We convert all units into pixels because the units used are confusing,
   *  althoug not quite as bad as Xbox points.
   *
   * We maintain two primary data structures during this process:
   * - The thingMap stores long-term information about each observed frame.  If
   *    we start culling frames when it's clear they have gone away (or their
   *    allocation has been reused), we would delete/create new things as
   *    appropriate.
   * - The calcStack maintains a stack with accumulated information about what
   *    we've seen so far in the current reflow stack.  The 'parent frame' is
   *    the focus here.  Specifically, each (parent) entry maintains a ptr-map
   *    to the accumulated state for its children so far on that pass.  This
   *    allows sequences of calls to children by their parents to accumulate
   *    in a sensible fashion.
   */
  chew: function(aLineReader) {
    var line;
    var context = this.context;
    var ponderer = this.ponderer;
    var thingMap = context.thingMap;
    var lastCalcRoot = null;
    var calcStack = context.calcStack = [], popped;
    var thingCount = 0;
    var iLine = 0;
    while ((line = aLineReader.readLine()) != null) {
      iLine++;
      var depth = 0;
      while (line[depth] == " ")
        depth++;
      var idxSOx = line.indexOf(" 0x", depth + 1);
      var thingName = line.substring(depth, idxSOx);
      var spAfterPtr = line.indexOf(" ", idxSOx+4);
      var ptr = parseInt(line.substring(idxSOx+1, spAfterPtr), 16);
      var spAfterCmdName = line.indexOf(" ", spAfterPtr+1);
      var eqAfterCmdName = line.indexOf("=", spAfterPtr+1);
      if (spAfterCmdName == -1)
        spAfterCmdName = line.length;
      if (eqAfterCmdName > -1 && eqAfterCmdName < spAfterCmdName)
        spAfterCmdName = eqAfterCmdName + 1;
      var cmdName = line.substring(spAfterPtr+1, spAfterCmdName);
      if (spAfterCmdName == eqAfterCmdName + 1)
        spAfterCmdName--;
      var remainder = line.substring(spAfterCmdName+1);

      // - thing lookup / creation
      var thing;
      if (ptr in thingMap) {
        thing = thingMap[ptr];
      }
      else {
        thing = thingMap[ptr] = {
          ptr: ptr,
          name: thingName,
          unique: ++thingCount,
        };
      }

      // - calc stack
      while (calcStack.length > depth) {
        popped = calcStack.pop();
        // do not generate a pop event for stacky's that are on the stack
        //  multiple times in a row because of nested self-calls
        if (calcStack.length && calcStack[calcStack.length - 1] === popped)
          continue;
        ponderer.calcStackPop(popped, calcStack.length);
      }
      if (depth == 0 && cmdName == "InitFrameType") {
        lastCalcRoot = null;
      }

      // try and pull stacky out of the parent / from the last root as appropriate
      var stacky, parentStacky;
      if (depth) {
        parentStacky = calcStack[calcStack.length-1];
        if (ptr in parentStacky.kidMap)
          stacky = parentStacky.kidMap[ptr];
        // collapse stacky frames that are for the same dude.
        else if (parentStacky.thing === thing)
          stacky = parentStacky;
        else
          stacky = null;
      }
      else if (lastCalcRoot && lastCalcRoot.thing === thing) {
        stacky = lastCalcRoot;
      }
      else {
        stacky = null;
      }
      if (!stacky) {
        stacky = {
          firstLine: iLine,
          thing: thing,
          why: [],
          inputs: {},
          kidMap: {},
          conclusions: {},
          parent: parentStacky,
          deferredChildren: null,
          initOnly: true, // assume initonly...
          didReflow: false,
          didLayout: false,
          lastCmd: null,
        };
        if (parentStacky)
          parentStacky.kidMap[ptr] = stacky;
        if (!depth)
          lastCalcRoot = stacky;
      }
      calcStack.push(stacky);
      if (parentStacky && (stacky != parentStacky)) {
        if (stacky.why.indexOf(parentStacky.lastCmd) == -1)
          stacky.why.push(parentStacky.lastCmd);
        stacky.lastCmd = cmdName;
      }

      if (!(cmdName in ReflowCommandMap))
        throw new Error("Unknown command: " + cmdName + " from line " + line);
      ReflowCommandMap[cmdName].call(ponderer, context, depth, thing, stacky,
                                     remainder, cmdName);
    }
    // close out the calc stack
    while (calcStack.length) {
      popped = calcStack.pop();
      if (calcStack.length && calcStack[calcStack.length - 1] === popped)
        continue;
      ponderer.calcStackPop(popped, calcStack.length);
    }
  },

  summarize: function() {

  }
};
exports.ReflowParser = ReflowParser;

var SPACES = "                                                               ";
function shallowObjDump(header, obj) {
  var s = "";
  var firstLineOutput = false;
  var spaces = SPACES.substring(0, header.length);
  for (var key in obj) {
    if (firstLineOutput) {
      s += spaces;
    }
    else {
      s += header;
      firstLineOutput = true;
    }
    s += key + ": " + obj[key].toString() + "\n";
  }
  return s;
}

/**
 * Summarize the reflow decisions for each encountered frame that matches some
 *  filter criterion.
 * The gist that we want is "bob got laid out with w,h N times" for each
 *  layout configuration bob took on.  Furthermore, for each layout
 *  configuration, we want to know the inputs that went into that conclusion.
 *  Specifically, we want to know what came down from its parent and what
 *  came out of the children.
 */
function SummarizePonderer(aCritKind, aCritValue) {
  this.critKind = aCritKind;
  if (aCritKind == "unique")
    aCritValue = parseInt(aCritValue);
  this.critValue = aCritValue;
}
SummarizePonderer.prototype = {
  ponder: function() {

  },

  _matches: function(thing) {
    if (this.critKind == "id") {
      return (thing.id == this.critValue);
    }
    else if (this.critKind == "tag") {
      return (thing.tag == this.critValue);
    }
    else if (this.critKind == "class") {
//console.log("checking for class", this.critValue, "in", thing.classes ? thing.classes.join("*") : "missing");
      return (thing.classes &&
              (thing.classes.indexOf(this.critValue) > -1));
    }
    else if (this.critKind == "unique") {
      return (thing.unique == this.critValue);
    }
    return false;
  },

  _tellAll: function(thing) {
    var s = "*** " + thing.name + " " + thing.unique +
      " tag:" + (thing.tag ? thing.tag : "") +
      " id:" + (thing.id ? thing.id : "") +
      " classes:" + (thing.classes ? thing.classes.join(" ") : "") +
      "\n";
    dump(s);
    thing._toldAll = true;
  },

  _displayStacky: function(stacky) {
    var thing = stacky.thing;

    if (!("_variants" in thing)) {
      thing._lastVid = null;
      thing._repeatCount = 1;
      thing._variants = [];
    }

    if (stacky.parent && !("_toldAll" in stacky.parent.thing))
      this._tellAll(stacky.parent.thing);
    if (!("_toldAll" in thing))
      this._tellAll(thing);

    var s = thing.name + " " + thing.unique + " variant ### " +
      " (parent " + stacky.parent.thing.unique + ") first line ???\n";
    s += "  why: " + stacky.why.toString() + "\n";
    s += shallowObjDump("  inputs: ", stacky.inputs);
    s += shallowObjDump("  output: ", stacky.conclusions);
    if (stacky.parent)
      s += shallowObjDump("  parent concluded: ", stacky.parent.conclusions);

    // clobber stacky's state now...
    stacky.inputs = {};
    stacky.conclusions = {};
    stacky.why = [];
    stacky.didReflow = stacky.didLayout = false;

    var vid = thing._variants.indexOf(s);
    // have we seen this layout variation before?
    if (vid > -1) {
      // yes.  now keep a repeat count before flushing...]
      vid += 1; // 1-based
      if (thing._lastVid === vid) {
        thing._repeatCount++;
      }
      else {
        if (thing._lastVid)
          dump("[#" + thing.unique + " v" + thing._lastVid + "*" +
               thing._repeatCount + "]\n");
        thing._lastVid = vid;
        thing._repeatCount = 1;
      }
    }
    else {
      thing._variants.push(s);
      dump(s.replace("###", thing._variants.length)
            .replace("???", stacky.firstLine));
    }

    /*
    if (s == thing._lastDisplayBlock) {
      thing._repeatCount++;
    }
    else {
      if (thing._lastDisplayBlock && thing._repeatCount)
        dump("[last layout for " + thing.id + " repeated " +
             thing._repeatCount + " times]\n");
      thing._lastDisplayBlock = s;
      thing._repeatCount = 0;

      if ()

      dump(s);
    }
*/
  },

  calcStackPop: function(stacky) {
    if (stacky.deferredChildren) {
      for (var i = 0; i < stacky.deferredChildren.length; i++) {
        var kidStacky = stacky.deferredChildren[i];
        // XXX we are using this to suppress stackies that manage to
        //  get on the deferred list a few times due to getting invoked
        //  at multiple levels when they should not.
        // However, it is possible for a stacky to get reused in a situation
        //  where we do want to hear about it again.  Really, this is something
        //  that generally could do with more thought.
        if (kidStacky.didReflow || kidStacky.didLayout)
          this._displayStacky(kidStacky);
      }
    }
    if (!stacky.didReflow && !stacky.didLayout)
      return;
    if (!this._matches(stacky.thing))
      return;
    // attempt to defer for the purposes of knowing what the parent concluded
    if (stacky.parent) {
      // try to get to defer until after the parent's parent...
      var ancestor = stacky.parent;
      if (ancestor.parent)
        ancestor = ancestor.parent;
      if (ancestor.deferredChildren === null)
        ancestor.deferredChildren = [stacky];
      else {
        if (ancestor.deferredChildren.indexOf(stacky) == -1)
          ancestor.deferredChildren.push(stacky);
      }
    }
    else
      this._displayStacky(stacky);
  },

  allDone: function() {

  },
};
exports.SummarizePonderer = SummarizePonderer;

exports.ponderFile = function(aFilePath, aPonderer) {
  var fs = file.open(aFilePath, "r");
  var lr = new filehelpers.LineReader(fs);
  var reflowParser = new ReflowParser(aPonderer);
  reflowParser.chew(lr);
  lr.close();

  aPonderer.allDone();
};
