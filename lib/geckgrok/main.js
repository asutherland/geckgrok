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
 * Main logic for gecko reflow parsing logic; will refactor things out as they
 *  get unwieldy.
 **/


exports.main = function geckgrok_main(options, callbacks) {
  var args = options.cmdline;
  // so, let's not rewrite getopt.  I'm sure one exists, but let's just be
  //  very very very ugly for now.
  if (args === undefined) {
    console.error("You need to use the hacked up harness driver!");
    return callbacks.quit("FAIL");
  }

  if (args.length == 0) {
    console.error("Specify a command.");
    return callbacks.quit("FAIL");
  }

  if (args[0] == "splice") {
    var splicer = require("geckgrok/splicer");

    console.log("starting geckgrok process");
    splicer.spliceFile("/tmp/framedebug");
    console.log("geckgrok all done");
    return callbacks.quit("OK");
  }

  // example use:
  //  ponder FILENAME display box
  if (args[0] == "summarize") {
    if (args.length != 4) {
      console.error("syntax: summarize <file> <kind> <value>");
      console.error("example: summarize serial-12-0 id IDVALUE");
      return callbacks.quit("FAIL");
    }

    var ponderer = require("geckgrok/ponderer");
    var summar = new ponderer.SummarizePonderer(args[2], args[3]);
    ponderer.ponderFile(args[1], summar);
    return callbacks.quit("OK");
  }

  return callbacks.quit("FAIL");
};
