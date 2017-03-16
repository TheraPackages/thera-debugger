'use babel';

import TheraDebuggerView from './thera-debugger-view';
import { CompositeDisposable } from 'atom';
require('./base/imports.js');
var DeviceModel = require('./core/DeviceModel');
var InspectorModel = require('./core/InspectorModel');
var DebuggerModel = require('./core/DebuggerModel');
var WeexRuntime = require('./peer_worker/weex/WeexRuntime');
import DebuggerServiceProxy from './core/DebuggerServiceProxy';
var child_process = require('child_process');
var NetUtils = require('./common/NetUtils');
var TestEntry = require('./test_dir/TestEntry')
ThePkgCfgs = require('./package-configs');
$ = require('jquery')

export default {

  theraDebuggerView: null,
  viewPanel: null,
  subscriptions: null,
  deviceManager: null,
  hostBridge: null,
  _weexRuntime: null,
  _debugServerProcess: null,
  _debuggerServiceProxy: null,

  activate(state) {
    this.theraDebuggerView = new TheraDebuggerView(state.theraDebuggerViewState);
    this.viewPanel = atom.workspace.addFooterPanel({
      item: this.theraDebuggerView.getElement(),
      visible: true
    });
    $('.thera-debugger').parent().css('padding', 0);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'thera-debugger:toggle': () => this.toggle(),
      // Any package can dispatch this event to start debugger server. If server has started, command will be ignored.
      'thera-debugger:start-weex-server': (event) => this._doStartWeexDebugServer(),
      // weex-run package has established a new preview channel to privew server.
      'weex-run:ws-connected': (event) => this._onEstablishedPreviewChannel(),
      // weex-run package: App client has run into debug mode.
      'thera-debugger:reload': (event) => this._onReloadCommand(event.detail),
      // console-panel package has changed to another target
      'thera-debugger:debugger:main-device': (event) => this._doChangeTargetDevice(event.detail),
      // main-menu stop all server
      'thera-live-server:stop': (event) => this._doShutDownServer()
    }));

    this.deviceModel = new DeviceModel();
    this.inspectorModel = new InspectorModel(this.theraDebuggerView.getHiddenContainer());
    this.debuggerModel = new DebuggerModel(this.theraDebuggerView.getHiddenContainer(), this.inspectorModel, this.deviceModel);
    this.initTestEntryUI();
  },

  deactivate() {
    this.viewPanel.destroy();
    this.subscriptions.dispose();
    this.theraDebuggerView.destroy();
    this.disposePackage();
  },

  serialize() {
    return {
      theraDebuggerViewState: this.theraDebuggerView.serialize()
    };
  },

  disposePackage() {

    this.deviceModel.dispose();
    this.deviceModel = null;

    this.inspectorModel.dispose();
    this.inspectorModel = null;

    this.debuggerModel.dispose();
    this.debuggerModel = null;

    if (this._weexRuntime) {
      this._weexRuntime.terminate();
      this._weexRuntime = null;
    }
    this._killDebugServer();
  },

  initTestEntryUI() {

    var parent = this.theraDebuggerView.getElement();
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
        item.onmouseover = function(){this.style.cursor="pointer";};
        item.onmouseout = function(){this.style.cursor="default";};
        parent.appendChild(item);
      }
    }

    var panel = newRowPanel();

    addElement(panel, "启动服务器", "#00ff00", () => {
      this._killDebugServer();
      this._doStartWeexDebugServer();
    });

    addElement(panel, "连接服务器", "#00ff00", () => {
      var deviceListUrl = `ws://${ThePkgCfgs.server.ip}:${ThePkgCfgs.server.port}/debugProxy/list`;
      this.deviceModel.connect(deviceListUrl);
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
        this._doChangeTargetDevice(selectedOption.tag);
      }
    });

    addElement(panel, "Devtools", "#7bb8f4", () => {
      this.inspectorModel.openDevTools();
    });

    addElement(panel, "Reload", "#7bb8f4", () => {
      this.inspectorModel.reload();
    });

    addElement(panel, "StartDebug", '#5eff57', () => {
      var selectedOption = select.options[select.selectedIndex]
      if (selectedOption) {
        this.debuggerModel.startDebug(selectedOption.tag);
      }
    });

    addElement(panel, "Devtool", "#ffff00", () => {
      this.debuggerModel.openRuntimeDevtool();
    });

    addElement(panel, "Reload", "#ffff00", () => {
      this.debuggerModel.reloadRuntime();
    });

    addElement(panel, "Devtool", "#ffaf00", () => {
      this.debuggerModel.openDebuggerDevtool();
    });

    addElement(panel, "Reload", "#ffaf00", () => {
      this.debuggerModel.reloadDebugger();
    });

    // Test
    addElement(panel, "TEST", "#ff00ff", () => {
      new TestEntry().run();
    });

    panel = newRowPanel();

    addElement(panel, 'setPauseOnExceptions', '#74adea', () => {
      this._debuggerServiceProxy.setPauseOnExceptions();
    });

    addElement(panel, "resume", "#74adea", () => {
      this._debuggerServiceProxy.resume();
    });

    addElement(panel, "stepOver", "#74adea", () => {
      this._debuggerServiceProxy.stepOver();
    });

    addElement(panel, "stepInto", "#74adea", () => {
      this._debuggerServiceProxy.stepInto();
    });

    addElement(panel, "stepOut", "#74adea", () => {
      this._debuggerServiceProxy.stepOut();
    });

    addElement(panel, "evalCallFrame", "#74adea", () => {
      this._debuggerServiceProxy.evaluateOnSelectedCallFrame("floatVar\n\n", "watch-group");
    });

    addElement(panel, "runtimeEval", "#74adea", () => {
      this._debuggerServiceProxy.runtimeEvaluate("notExist\n\n", "console-group");
    });

    addElement(panel, "getProperties", "#74adea", () => {
      var promise = this._debuggerServiceProxy.getProperties("{\"ordinal\":1,\"injectedScriptId\":2}");
      promise.then(function(result) {
        console.log(result);
      }).catch(function(error) {
        console.error(error);
      });
    });

    addElement(panel, "selectFrame", "#74adea", () => {
      this._debuggerServiceProxy.selectCallFrame("{\"ordinal\":1,\"injectedScriptId\":2}");
    })
  },

  /**
   * Provide debugger service
   */
  provideDebugService() {
    console.log('Provide debugger service.');
    if (!this._debuggerServiceProxy || this._debuggerServiceProxy.isDestroyed()) {
      this._debuggerServiceProxy = new DebuggerServiceProxy(this.debuggerModel, this.inspectorModel);
    }
    return this._debuggerServiceProxy;
  },

  /**
   * Broadcast payload of serverAddress to any subscribers that debug server has started.
   */
  _notifyDebuggerServerAddress(hostPort) {
    atom.commands.dispatch(atom.views.getView(atom.workspace),
            "thera-debugger:debugger:connection",
            { serverAddress: `ws://${hostPort}/debugProxy/native` } );
  },

  /**
   * Tell preview server the active device has changed.
   */
  _notifyDebuggerMainDevice(device) {
    atom.commands.dispatch(atom.views.getView(atom.workspace),
            "thera-debugger:debugger:connection",
            { device: device} );
  },

  /**
   * Thera has established a connection to the preview server.
   */
  _onEstablishedPreviewChannel() {
    this._doStartWeexDebugServer();
  },

  /** Kill debug server message */
  _doShutDownServer() {
    this._killDebugServer();
  },

  /**
   * If debug-server has started, this start command will be discarded.
   * @_killDebugServer need to be invoked if you want a restart.
   * Before starting, we will scan the local ports to find an available one.
   * The initial port number is configed in @{ThePkgCfgs.server.port}.
   */
  _doStartWeexDebugServer() {

    var This = this;
    // Check if the debug-server is alive.
    if (this._debugServerProcess) {
      var hostPort = `${ThePkgCfgs.server.ip}:${ThePkgCfgs.server.port}`;
      var checkTarget = `http://${hostPort}/`;
      NetUtils.curl(checkTarget, function(err, response) {
        if (err) {
          This._killDebugServer();
          findAnUsablePortThenStartServer();
        } else {
          console.log("debug-server is alive, needn\'t restart.");
          This._notifyDebuggerServerAddress(hostPort);
        }
      });
    } else {
      // Debug server process is absent, start a new one.
      findAnUsablePortThenStartServer();
    }

    function findAnUsablePortThenStartServer() {

      NetUtils.isPortInuse(ThePkgCfgs.server.port, checkCallback);
      function checkCallback(inUse) {
        if (inUse) {
          console.log(`Port ${ThePkgCfgs.server.port} is in use. Try next...`);
          NetUtils.isPortInuse(++ThePkgCfgs.server.port, checkCallback);
        } else {
          doStartServer(ThePkgCfgs.server.port);
        }
      }
    }

    function doStartServer(workPort) {
      // child_process.fork(modulePath[, args][, options])
      This._debugServerProcess = child_process.fork(
        __dirname + "/vendors/WeexDebugServer.js",
        [workPort, ],
        {
          silent: true
        }
      );
      This._debugServerProcess.stdout.on('data', (message) => {
        //console.log('DebugServerProcess stdout: ', message.toString());
      });
      This._debugServerProcess.stderr.on('data', (message) => {
        //console.error('DebugServerProcess stderr: ', message.toString());
      });

      var hostPort = `${ThePkgCfgs.server.ip}:${ThePkgCfgs.server.port}`
      console.log(`Thera debug-server has started on {PORT:${workPort}, PID:${This._debugServerProcess.pid}}`);

      // After server has started, we need to make a connection to it for the
      // purpose of observing device list changing event.
      This._establishDeviceListChannel(hostPort);
    }
  },

  /**
   * Kill forked debug-server process
   */
  _killDebugServer() {
    if (this._debugServerProcess && this._debugServerProcess.pid) {
      child_process.execSync(`kill -9 ${this._debugServerProcess.pid}`);
      this._debugServerProcess = null;
    }
  },

  /**
   * Connect debugger server to observe device list update.
   */
  _establishDeviceListChannel(hostPort) {

    var This = this;
    function doConnection() {
      console.log('Connect debug-server to listen device list update.');
      var deviceListUrl = `ws://${hostPort}/debugProxy/list`;
      This.deviceModel.connect(deviceListUrl);
      // Notify app to connect "ws://host:port/debugProxy/native"
      This._notifyDebuggerServerAddress(hostPort);
    }

    var failCounter = 0;
    var interval = 500;
    function checkIfStarted() {
      if (++failCounter > 20) {
        console.error(`I have checked ${failCounter} times whether the debugger server had started. The server may started failed.`);
        return;
      }
      NetUtils.curl(`http://${hostPort}`, function(err, response) {
        if (err) {
          setTimeout(checkIfStarted, interval);
        } else {
          console.log(`Do connection after ${failCounter * interval} milliseconds.`);
          doConnection();
        }
      });
    }
    setTimeout(checkIfStarted, interval);
  },

  /**
   * Command from console-panel package.
   * Change targeting device to another.
   */
  _doChangeTargetDevice(device) {
    if (device) {
      var targetDevice = this.deviceModel.findDeviceById(device.deviceId);
      if (targetDevice) {
        this.debuggerModel.changeTargetDevice(device);
        this._notifyDebuggerMainDevice(targetDevice);
        return;
      }
    }
    console.error('Change target device received invalid object: ' + device);
  },

  /**
   * Reload inspector or debugger model or both.
   */
  _onReloadCommand(data) {
    console.log('onReload command data: ', data);
    if (data && data.params) {
      var params = data.params;
      if (params.inspector) {
        this.inspectorModel.reload();
      }
      if (params.debugger) {
        this.debuggerModel.reload();
      }
    }
  },

  /** @Deprecate */
  _onStartRuntimeInProcess(device) {
    if (this._weexRuntime) {
      this._weexRuntime.terminate();
      this._weexRuntime = null;
    }
    var host = ThePkgCfgs.server.ip, port = ThePkgCfgs.server.port;
    var wsRuntimeUrl = `ws://${host}:${port}/debugProxy/debugger/${device.debuggerSessionId}`;
    this._weexRuntime = new WeexRuntime(wsRuntimeUrl);
    this._weexRuntime.start();
  },

  toggle() {
    return (
      this.viewPanel.isVisible() ?
      this.viewPanel.hide() :
      this.viewPanel.show()
    );
  },
};
