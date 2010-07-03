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

var filehelpers = require("geckgrok/filehelpers");

// this varies with display density, but this is reality for most LCD monitors
//  which means good enough for now.
var UNITS_PER_PIX = 60;

function minPrefMaxSizerQuery(ctx, thing, rest, cmd) {

}
function minPrefMaxSizerDone(ctx, thing, rest, cmd) {

}

var ReflowCommandMap = {
  "Reflow": function(ctx, thing, rest) {

  },
  "InitFrameType": function(ctx, thing, rest) {

  },
  "InitConstraints": function(ctx, thing, rest) {

  },
  "InitConstraints=": function(ctx, thing, rest) {

  },
  "InitOffsets": function(ctx, thing, rest) {

  },
  "InitOffsets=": function(ctx, thing, rest) {

  },
  "Layout": function(ctx, thing, rest) {

  },
  "Layout=": function(ctx, thing, rest) {

  },
  "GetPrefSize": minPrefMaxSizerQuery,
  "GetPrefSize=": minPrefMaxSizerDone,
  "GetMinSize": minPrefMaxSizerQuery,
  "GetMinSize=": minPrefMaxSizerDone,
  "GetMaxSize": minPrefMaxSizerQuery,
  "GetMaxSize=": minPrefMaxSizerDone,
};

function Ponderer() {
  this.context = {
    thingMap: {},
  };
}
Ponderer.prototype = {
  chew: function(aLineReader) {
    var line;
    var context = this.context;
    var thingMap = context.thingMap;
    while ((line = aLogReader.readLine()) != null) {
      var depth = 0;
      while (line[depth] == " ")
        depth++;
      var idxSOx = line.indexOf(" 0x", depth);
      var thingName = line.substring(depth, idxSOx);
      var spAfterPtr = line.indexOf(" ", idxSOx+4);
      var ptr = parseInt(line.substring(idxSOx+1, spAfterPtr), 16);
      var spAfterCmdName = line.indexOf(" ", spAfterPtr+1);
      var eqAfterCmdName = line.indexOf("=", spAFterPtr+1);
      if (eqAfterCmdName > -1 && eqAfterCmdName < spAfterCmdName)
        spAfterCmdName = eqAfterCmdName + 1;
      var cmdName = line.substring(spAfterPtr+1, spAfterCmdName);
      var remainder = line.substring(spAfterCmdName+1);

      var thing;
      if (ptr in thingMap) {
        thing = thingMap[ptr];
      }
      else {
        thing = thingMap[ptr] = {
          ptr: ptr,
          name: thingName,
        };
      }
    }
  }
};
exports.Ponderer = Ponderer;
