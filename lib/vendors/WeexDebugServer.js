
var weex_devtool = require('weex-devtool');
var api = weex_devtool.api;

argv = process.argv;  // [AppBin, entryJs, args]
var port = argv[2];

// sign: startServerAndLaunchDevtool(entry, root, port, cb)
api.startServerAndLaunchDevtool(null, null, port, function() {
  console.log("Weex debugger server started.");
});
