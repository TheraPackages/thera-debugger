'use babel';

import { CompositeDisposable } from 'atom';
var child_process = require('child_process')
var childProcess = child_process;

module.exports = TestEntry = function () {

  this._subscriptions = new CompositeDisposable();
  this._subscriptions.add(atom.commands.add('atom-workspace', {
    'thera-debugger:inspector:command': (event) => this.inspectorSend(event.detail),
    'thera-debugger:debugger:connection': (event) => this.debuggerSend(event.detail)
  }));
}
TestEntry.prototype = {

  testPreviewServer: function() {
    this.connPreviewServer();
    this.commandId = 1;
  },

  connPreviewServer: function() {

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
    this.websocket.onmessage = this.handlePreviewServerMessage.bind(this);
  },

  handlePreviewServerMessage: function(message) {

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

  testAndroidEmulator: function() {
    var _this = this
    this.listAndroidEmulators().then((emulators) => {
      console.log(emulators);
      return _this.startAndroidEmulator(emulators[1])
    }).catch((error) => {
      console.log(error);
    }).then((res) => {
      console.log(arguments)

    }).catch((error) => {
      console.error(arguments)
    });
  },

  /**
   * @return {Promise}
   */
   listAndroidEmulators: function() {
    return new Promise((resolve, reject) => {
      childProcess.exec('command -v emulator && command -v adb', (error, stdout, stderr) => {
        if (error) {
          console.error("Android dev environment hasn't installed.", error, stdout, stderr)
          reject(error)
        } else {
          doGet()
        }
      });
      function doGet() {
        childProcess.exec('emulator -list-avds', (error, stdout, stderr) => {
          if (error) {
            console.error(error, stdout, stderr)
            reject(error)
          } else {
            var emulators = (stdout || '').trim().split('\n') // Emulator name list
            resolve(emulators)
          }
        })
      }
    });
  },

  /**
   * @param {string} emulatorName
   * @return {Promise}
   */
  startAndroidEmulator: function(emulatorName) {
    return new Promise(function(resolve, reject) {
      if (!emulatorName) {
        reject('Android emulator name should not be empty')
      } else {
        childProcess.exec(`emulator -avd ${emulatorName}`, (error, stdout, stderr) => {
          if (error) {
            console.error('Start emulator error', error)
            reject(`Android emulator ${emulatorName} cannot be started`)
          } else {
            console.log('Android emulator has shutdown.')
          }
        })
        resolve('Start android emulator. ' + emulatorName)
      }
    });
    function installApp() {

    }
    function launchApp() {

    }
  }
}
