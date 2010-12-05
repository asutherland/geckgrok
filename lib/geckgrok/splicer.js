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

var file = require("file");
var filehelpers = require("geckgrok/filehelpers");

// capture: dom window ptr, serial number, outer ptr
var DW_PLUS_REGEX = /^\+\+DOMWINDOW == \d+ \(([^\)]+)\) \[serial = (\d+)\] \[outer = ([^\]]+)\]$/;
// capture: dom window ptr, serial, docshell ptr (note: sliced a bit)
var DW_BANG_REGEX = /^\!\!DOMWINDOW \(([^\)]+)\) \[serial = (\d+)\] DOCSHELL == (.+)$/;
// capture: dom window ptr, serial, outer ptr, url
var DW_MINUS_REGEX = /^\-\-DOMWINDOW == \d+ \(([^\)]+)\) \[serial = (\d+)\] \[outer = ([^\]]+)\] \[url = ([^\]]+)\]$/;

// capture: docshell ptr
var DS_PLUS_REGEX = /^\+\+DOCSHELL ([^ ]+) == \d+$/;
// capture: docshell ptr, presshell ptr
var DS_BANG_REGEX = /^\!\!DOCSHELL \(([^\)]+)\) PRESSHELL == (.+)$/;
// capture: docshell ptr
var DS_MINUS_REGEX = /^\-\-DOCSHELL ([^ ]+) == \d+$/;

// PresArena owning a state comes immediately before the PresShell claims
//  ownership.
// capture: PresArena ptr, PresArena::State ptr
var PA_REGEX = /^PresArena ([^ ]+) owns PresArena::State (.+)$/;
// capture: PresShell ptr, PresArena ptr
var PS_REGEX = /^PresShell ([^ ]+) owns PresArena (.+)$/;
// capture: PresArena::State ptr, block pointer start, block size (apparently
//  with some kind of alignment ugliness added on... yuck.)
var PAS_REGEX = /PresArena::State ([^ ]+) allocated ([^ ]+) with size (\d+)$/;

function ptrParse(s) {
  if (s == "(nil)")
    return null;
  else
    return parseInt(s, 16);
}

function nopFunc() {
}

var LogHandlerFirstWordMap = {
  /**
   * Track DOM window creation.  Outer windows are always created before inner
   *  DOM windows.
   * Outer DOM windows only ever have one inner DOM window at a time and our
   *  log processing is always chronological, so we only track an outer DOM
   *  window's one current inner DOM window, although we leave the inner windows
   *  around and allow them to hold onto their reference to their outer window.
   */
  "++DOMWINDOW": function(ctx, line) {
    var match = DW_PLUS_REGEX.exec(line);
    var ptr = ptrParse(match[1]),
        serial = parseInt(match[2], 10),
        outerPtrPlus = ptrParse(match[3]);
    var domWindow = ctx.domWindowMap[ptr] = {
      ptr: ptr,
      serial: serial,
      outer: null,
      inner: null,
      // outer DOM windows have docShells. (maybe only ever one? don't know)
      docShells: [],
      // We assign the pres shells to the inner DOM window since it gets a URL
      //  associated.  (We could probably be faster about assigning the URL,
      //  of course...)
      presShells: [],
      url: null,
    };
console.log("found dom window", serial, ptr, "outer", outerPtrPlus);
    var domWindows = ctx.domWindows;
    domWindows.push(domWindow);
    if (outerPtrPlus) {
      var outer, candOuter;
      // we need to do the 1k offset bounding to find the outer window but
      //  the situation is reversed here (outer is the root ptr, but the report
      //  on the dom window is offset)
      for (var i = 0; i < domWindows.length; i++) {
        candOuter = domWindows[i];
        if (outerPtrPlus < candOuter.ptr &&
            (outerPtrPlus + 1024 > candOuter.ptr)) {
          outer = candOuter;
          break;
        }
      }
      if (outer) {
console.log("linked to outer", outer.serial);
        domWindow.outer = outer;
        outer.inner = domWindow;
      }
    }
  },
  /**
   * Tells us a dom window's docshell.  Because the docshell has some offset,
   *  we need to walk the list of docshells and find the one within 1k.
   * Only 'outer' DOM windows have docshells and we are told about them roughly
   *  instantly after the creation of the outer DOM window so all other code
   *  should be able to assume outer DOM windows have doc shells.
   */
  "!!DOMWINDOW": function(ctx, line) {
    var match = DW_BANG_REGEX.exec(line);
    var ptr = ptrParse(match[1]),
        docShellPtrPlus = ptrParse(match[3]);
    var domWindow = ctx.domWindowMap[ptr];

console.log("trying to link", ptr, docShellPtrPlus);

    // ignore the nulling out...
    if (!docShellPtrPlus)
      return;

    var docShells = ctx.docShells;
    for (var i = 0; i < docShells.length; i++) {
      var docShell = docShells[i];
      if (docShellPtrPlus > docShell.ptr &&
          (docShellPtrPlus < docShell.ptr + 1024)) {
console.log("  linked!");
        domWindow.docShells.push(docShell);
        docShell.domWindow = domWindow;
        return;
      }
    }
  },
  /**
   * Tells us a DOM window is going away; we save out the logs for the pres
   *  shell(s) associated with the window.  The prize here is the URL which
   *  allows us to create pretty output paths.
   */
  "--DOMWINDOW": function(ctx, line) {
    var match = DW_MINUS_REGEX.exec(line);
    var ptr = ptrParse(match[1]),
        outer = ptrParse(match[3]),
        url = match[4];
    var domWindow = ctx.domWindowMap[ptr];

    domWindow.url = url;
    closeOutDomWindow(ctx, domWindow);
  },
  /**
   * Tells us new docshells exist.
   */
  "++DOCSHELL": function(ctx, line) {
    var match = DS_PLUS_REGEX.exec(line);
    var ptr = ptrParse(match[1]);
    var docShell = {
      ptr: ptr,
      domWindow: null,
    };
    ctx.docShellMap[ptr] = docShell;
    ctx.docShells.push(docShell);
  },
  /**
   * Tells us the PresShell that belongs to a DocShell.  (Requires Patch)
   * We get told this after the PA/PS/PAS events and so should already have a
   *  presShell around.
   *
   */
  "!!DOCSHELL": function(ctx, line) {
    var match = DS_BANG_REGEX.exec(line);
    var ptr = ptrParse(match[1]),
        presPtr = ptrParse(match[2]);
    // presPtr could be null if this is cleanup death.
    if (presPtr) {
      var presShell = ctx.presShellMap[presPtr];
      var docShell = ctx.docShellMap[ptr];
      // add the pres shell to the inner DOM window (see previous docs)
      docShell.domWindow.inner.presShells.push(presShell);
    }
  },
  /**
   * Tells us a docshell is dead.
   */
  "--DOCSHELL": function(ctx, line) {
    var match = DS_MINUS_REGEX.exec(line);
    var ptr = ptrParse(match[1]);
    var docShell = ctx.docShellMap[ptr];
    delete ctx.docShellMap[ptr];
    ctx.docShells.splice(ctx.docShells.indexOf(docShell), 1);
  },
  /**
   * Links PresArena to its owned PresArena::State
   */
  "PresArena": function(ctx, line) {
    var match = PA_REGEX.exec(line);
    var paPtr = ptrParse(match[1]),
        pasPtr = ptrParse(match[2]);
    ctx.presArenaToPresArenaStatePtr[paPtr] = pasPtr;
  },
  /**
   * Links PresShell to its owned PresArena
   */
  "PresShell": function(ctx, line) {
    var match = PS_REGEX.exec(line);
    var psPtr = ptrParse(match[1]),
        paPtr = ptrParse(match[2]);
    var presShell = {
      ptr: psPtr,
      lines: [],
    };
    ctx.presShellMap[psPtr] = presShell;
    var pasPtr = ctx.presArenaToPresArenaStatePtr[paPtr];
    ctx.presArenaStateToPresShell[pasPtr] = presShell;
  },
  /**
   * We allocate both 4k and 1k blocks, so maintain our granularity at 1k and
   *  just enter them 4 times for 4k blocks.
   */
  "PresArena::State": function(ctx, line) {
    var match = PAS_REGEX.exec(line);
    var pasPtr = ptrParse(match[1]),
        blockPtr = ptrParse(match[2]),
        size = parseInt(match[3], 10) - 7; // weird alignment weirdness
    var presShell = ctx.presArenaStateToPresShell[pasPtr];
    for (var off=0; off < size; off += 1024) {
      ctx.arenaPageMap[blockPtr + off] = presShell;
    }
  },

  // Indications you are giving us stuff we don't want:
  "WARNING:": function(ctx, line) {
    throw new Error("Only redirect stdout; we don't want stderr.");
  },
  JavaScript: function(ctx, line) {
    throw new Error("Only redirect stdout; we don't want stderr.");
  },

  // gibberish we find in the log a lot...
  "Xinerama": nopFunc,
  "LoadPlugin()": nopFunc,
};

function reflowDebugChewer(ctx, line) {
  var idxOx;
  var idxBrace = line.indexOf("[");
  // text things include the text, don't think they escape things...
  if (idxBrace >= 0) {
    var nextBrace;
    while ((nextBrace = line.indexOf("]", idxBrace + 1)) > -1)
      idxBrace = nextBrace;
    idxOx = line.indexOf("0x", idxBrace + 1);
  }
  else {
    idxOx = line.indexOf("0x");
  }
  var ptr = parseInt(line.substring(idxOx, line.indexOf(" ", idxOx + 3)), 16);
  // we use 1k page sizes, so
  ptr = ptr - (ptr & 0x3ff);
  var presShell = ctx.arenaPageMap[ptr];
  if (presShell === undefined)
    throw new Error("No such page for: " + line + " (" + ptr + ")");
  presShell.lines.push(line);
}

function closeOutDomWindow(ctx, aDomWindow) {
  var presShells = aDomWindow.presShells;
  for (var iPresShell = 0; iPresShell < presShells.length; iPresShell++) {
    var presShell = presShells[iPresShell];
    var normUrl = aDomWindow.url.replace(/[\/:]+/g, "_");
    var dirPath = file.join("/tmp", "framedumps", normUrl);
    var filename = "serial-" + aDomWindow.serial + "-" + iPresShell;
    var lines = presShell.lines;
    var ts = ctx.makeFileWriter(dirPath, filename);
    for (var iLine = 0; iLine < lines.length; iLine++) {
      ts.write(lines[iLine] + "\n");
    }
    ts.close();
  }
}

function makeFileWriter(aDirPath, aFilename) {
  file.mkpath(aDirPath);
  var filePath = file.join(aDirPath, aFilename);
  var fs = file.open(filePath, "w");
  return fs;
}

function MozillaLogParser(aDefaultChewer) {
  this.context = {
    domWindowMap: {},
    domWindows: [],
    docShellMap: {},
    docShells: [],
    // press shell ptr to press shell
    presShellMap: {},
    presArenaToPresArenaStatePtr: {},
    // Map PresArena::States to the presshell that owns them
    presArenaStateToPresShell: {},
    // Map arena pages to the presshell that owns them
    arenaPageMap: {},
    makeFileWriter: makeFileWriter,
  };
  this.defaultChewer = aDefaultChewer || reflowDebugChewer;
}
MozillaLogParser.prototype = {
  chew: function(aLogReader) {
    var line;
    var context = this.context;
    var defaultChewer = this.defaultChewer;
    while ((line = aLogReader.readLine()) != null) {
      var idxSpace = line.indexOf(" ");
      if (idxSpace == -1)
        continue;
      var firstWord = line.substring(0, idxSpace);
      if (firstWord in LogHandlerFirstWordMap) {
        LogHandlerFirstWordMap[firstWord].call(null, context, line);
      }
      else {
        defaultChewer.call(null, context, line);
      }
    }
  }
};
exports.MozillaLogParser = MozillaLogParser;

exports.spliceFile = function(aFilePath) {
  var fs = file.open(aFilePath, "r");
  var lr = new filehelpers.LineReader(fs);
  var logParser = new MozillaLogParser();
  logParser.chew(lr);
  lr.close();
};
