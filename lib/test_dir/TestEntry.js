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

  initTestPanel(packageThis) {

    var parent = packageThis.theraDebuggerView.getElement();
    function newRowPanel() {
      var row = document.createElement('div');
      parent.appendChild(row);
      return row;
    }

    // 增加调试元素
    function addElement(parent, name, color, clickCallback) {
      if (name) {
        var item = document.createElement('span');
        item.innerHTML = name;
        item.style.margin = "8px";
        item.style.color = color || "#00ff00";
        item.onclick = clickCallback;
        item.onmouseover = function() { this.style.cursor="pointer"; };
        item.onmouseout = function() { this.style.cursor="default"; };
        parent.appendChild(item);
      }
    }

    var panel = newRowPanel();

    addElement(panel, "启动服务器", "#00ff00", () => {
      packageThis._killDebugServer();
      packageThis._doStartWeexDebugServer();
    });

    addElement(panel, "连接服务器", "#00ff00", () => {
      var deviceListUrl = `ws://${ThePkgCfgs.server.ip}:${ThePkgCfgs.server.port}/debugProxy/list`;
      packageThis.deviceModel.connect(deviceListUrl);
    });

    addElement(panel, "Devices:", "#ff0000");

    // 当前设备列表
    var select = document.createElement("select");
    function updateDeviceList(event) {
      while (select.length > 0) select.remove(0);
      deviceList = event.detail || [];
      deviceList.forEach((item) => {
        var option = document.createElement('option')
        option.text = item.model;
        option.tag = item;
        select.add(option);
      });
    }
    atom.commands.add('atom-workspace', {
      "console.targets": updateDeviceList,
    });
    panel.appendChild(select);

    panel = newRowPanel();

    // Inspector
    addElement(panel, "Inspector", "#7bb8f4", () => {
      var selectedOption = select.options[select.selectedIndex]
      if (selectedOption) {
        packageThis._doChangeTargetDevice(selectedOption.tag);
      }
    });

    addElement(panel, "Devtools", "#7bb8f4", () => {
      packageThis.inspectorModel.openDevTools();
    });

    addElement(panel, "Reload", "#7bb8f4", () => {
      packageThis.inspectorModel.reload();
    });

    addElement(panel, "StartDebug", '#5eff57', () => {
      packageThis.debuggerModel.startDebug();
    });

    addElement(panel, "Devtool", "#ffff00", () => {
      packageThis.debuggerModel.openRuntimeDevtool();
    });

    addElement(panel, "Reload", "#ffff00", () => {
      packageThis.debuggerModel.reloadRuntime();
    });

    addElement(panel, "Devtool", "#ffaf00", () => {
      packageThis.debuggerModel.openDebuggerDevtool();
    });

    addElement(panel, "Reload", "#ffaf00", () => {
      packageThis.debuggerModel.reloadDebugger();
    });

    // Test
    addElement(panel, "Preview", "#ff00ff", () => {
      this.testPreviewServer();
    });
    addElement(panel, "Emulator", "#ff00ff", () => {
      this.testAndroidEmulator();
    });

    panel = newRowPanel();

    addElement(panel, 'setPauseOnExceptions', '#74adea', () => {
      packageThis._debuggerServiceProxy.setPauseOnExceptions();
    });

    addElement(panel, "resume", "#74adea", () => {
      packageThis._debuggerServiceProxy.resume();
    });

    addElement(panel, "stepOver", "#74adea", () => {
      packageThis._debuggerServiceProxy.stepOver();
    });

    addElement(panel, "stepInto", "#74adea", () => {
      packageThis._debuggerServiceProxy.stepInto();
    });

    addElement(panel, "stepOut", "#74adea", () => {
      packageThis._debuggerServiceProxy.stepOut();
    });

    addElement(panel, "evalCallFrame", "#74adea", () => {
      packageThis._debuggerServiceProxy.evaluateOnSelectedCallFrame("floatVar\n\n", "watch-group");
    });

    addElement(panel, "runtimeEval", "#74adea", () => {
      packageThis._debuggerServiceProxy.runtimeEvaluate("notExist\n\n", "console-group");
    });

    addElement(panel, "getProperties", "#74adea", () => {
      var promise = packageThis._debuggerServiceProxy.getProperties("{\"ordinal\":1,\"injectedScriptId\":2}");
      promise.then(function(result) {
        console.log(result);
      }).catch(function(error) {
        console.error(error);
      });
    });

    addElement(panel, "selectFrame", "#74adea", () => {
      packageThis._debuggerServiceProxy.selectCallFrame("{\"ordinal\":1,\"injectedScriptId\":2}");
    })
  },

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
