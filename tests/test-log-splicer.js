
var splicer = require("geckgrok/splicer");

var PRE_LINES = [
"++DOCSHELL 0x7f7197668000 == 1",
"++DOMWINDOW == 1 (0x7f719766ac68) [serial = 1] [outer = (nil)]",
"!!DOMWINDOW (0x7f719766ac68) [serial = 1] DOCSHELL == 0x7f71976680f8",
"PresArena 0x7f719506a178 owns PresArena::State 0x7f719444d8d0",
"PresShell 0x7f719506a000 owns PresArena 0x7f719506a178",
"PresArena::State 0x7f719444d8d0 allocated 0x7f7194452000 with size 4103",
"!!DOCSHELL (0x7f7197668000) PRESSHELL == 0x7f719506a000",
"PresArena::State 0x7f719444d8d0 allocated 0x7f7194014000 with size 4103",
"PresArena::State 0x7f719444d8d0 allocated 0x7f7194030000 with size 4103",
];
var LOG_LINES = [
"VP 0x7f71944528c0 InitFrameType display=block result=block",
"VP 0x7f71944528c0 InitConstraints parent=(nil) cb=-1,-1 as=6000,UC b=(nil) p=(nil)",
" VP 0x7f71944528c0 InitOffsets cbw=-1 b=(nil) p=(nil)",
" VP 0x7f71944528c0 InitOffsets= m=0,0,0,0 p=0,0,0,0 p+b=0,0,0,0",
"VP 0x7f71944528c0 InitConstraints= cw=(0 <= 6000 <= UC) ch=(0 <= UC <= UC) co=0,0,0,0",
"VP 0x7f71944528c0 Reflow a=6000,UC c=6000,6000 dirty v-resize cnt=4",
" scroll 0x7f7194014268 InitFrameType display=block result=block",
" scroll 0x7f7194014268 InitConstraints parent=0x7fffd89a42c0 cb=-1,-1 as=6000,UC b=(nil) p=(nil)",
"  scroll 0x7f7194014268 InitOffsets cbw=6000 b=(nil) p=(nil)",
"  scroll 0x7f7194014268 InitOffsets= m=0,0,0,0 p=0,0,0,0 p+b=0,0,0,0",
" scroll 0x7f7194014268 InitConstraints= cw=(0 <= 6000 <= UC) ch=(0 <= UC <= UC) co=0,0,0,0",
" scroll 0x7f7194014268 Reflow a=6000,UC c=6000,6000 dirty v-resize cnt=8",
"  ScrollbarFrame(scrollbar)(-1) 0x7f7194030020 GetPrefSize",
];
var POST_LINES = [
"!!DOMWINDOW (0x7f719766ac68) [serial = 1] DOCSHELL == (nil)",
"--DOCSHELL 0x7f7197668000 == 3",
"--DOMWINDOW == 11 (0x7f719766ac68) [serial = 1] [outer = (nil)] [url = resource://gre-resources/hiddenWindow.html]",
];

var LINES = [].concat(PRE_LINES).concat(LOG_LINES).concat(POST_LINES);

var file = require("file");


function FakeLineReader(aLines) {
  this.lines = aLines;
  this.iLine = 0;
}
FakeLineReader.prototype = {
  readLine: function() {
    if (this.iLine >= this.lines.length)
      return null;
    return this.lines[this.iLine++];
  }
};

var WRITTEN_FILES = [];

function FakeWriter() {
  this.lines = [];
}
FakeWriter.prototype = {
  write: function(aStr) {
    this.lines.push(aStr.substring(0, aStr.length-1));;
  },
  close: function() {
  },
};

function makeFileWriter(aDirPath, aFilename) {
  console.log("fake writer request", aDirPath, aFilename);
  var fw = new FakeWriter();
  WRITTEN_FILES.push(fw);
  return fw;
}

exports.testFrameDebugSplicer = function(test) {
  var lr = new FakeLineReader(LINES);
  var mlp = new splicer.MozillaLogParser();
  mlp.context.makeFileWriter = makeFileWriter;
  mlp.chew(lr);

  test.assertEqual(WRITTEN_FILES.length, 1, "should have written one file");
  test.assertEqual(WRITTEN_FILES[0].lines.toString(), LOG_LINES.toString(),
                   "should have written the one set of lines...");
};
