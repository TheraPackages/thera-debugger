'use babel';

import { CompositeDisposable } from 'atom';
var child_process = require('child_process')

module.exports = TestEntry = function () {

  this._subscriptions = new CompositeDisposable();
  this._subscriptions.add(atom.commands.add('atom-workspace', {
    'thera-debugger:inspector:command': (event) => this.inspectorSend(event.detail),
    'thera-debugger:debugger:connection': (event) => this.debuggerSend(event.detail)
  }));
}
TestEntry.prototype = {

  run: function() {
    this.connDumpling();
    this.commandId = 1;
  },

  connDumpling: function() {

    var weFile = __dirname + "/watch.we";
    var watchUrl = `curl -H "Content-Type: application/json" -X POST -d '{"cmd":"run","file":"${weFile}","renderProtocol":"weex"}' http://localhost:7001/watchFiles`
    child_process.execSync(watchUrl);

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    var targetUrl = "ws://localhost:7001";
    this.websocket = new WebSocket(targetUrl);
    this.websocket.onopen = function() {
      console.log("websocket onopen");
    }
    this.websocket.onerror = function(err) {
      console.log("websocket onerror", err);
    }
    this.websocket.onclose = function (reason) {
      console.log("websocket onclose", reason);
    }
    this.websocket.onmessage = this.handleDumplingMessage.bind(this);
  },

  handleDumplingMessage: function(message) {

    var data = JSON.parse(message.data);
    console.log("onmessage", data);

    if (data && data.message === "inspector") {
      data = data.data;
      // data.params denotes events
      // data.result denotes requst result
      // this.dispatchMessage(data.method, data.params || data.result);
      atom.commands.dispatch(atom.views.getView(atom.workspace), "thera-debugger:inspector:recv", data);
    } else {
      // Panel Log
    }
  },

  inspectorSend: function(data) {
    var message = {
      message: "inspector",
      v: "1.0",
      data: {
        inspectCmd: payload
      }
    }
    this.transmit(data);
  },

  debuggerSend: function(payload) {
    var message = {
      message: "debugger",
      v: "1.0",
      data: {
        debugger: payload
      }
    }
    this.transmit(message);
  },

  transmit: function(message) {
    if (!(typeof message === 'string')) {
      message = JSON.stringify(message);
    }
    if (this.websocket) {
      this.websocket.send(message);
    }
  },
}
