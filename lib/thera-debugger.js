'use babel';

import TheraDebuggerView from './thera-debugger-view';
import { CompositeDisposable } from 'atom';
require('./base/imports.js');
var DeviceModel = require('./core/DeviceModel');
var InspectorModel = require('./core/InspectorModel');
var DebuggerModel = require('./core/DebuggerModel');
var WeexRuntime = require('./peer_worker/weex/WeexRuntime');
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
      // weex-run package
      'thera-debugger:reload': (event) => this._onReloadCommand(event.detail),
      // console-panel package has changed to another target
      'thera-debugger:debugger:main-device': (event) => this._doChangeTargetDevice(event.detail)
    }));

    this.deviceModel = new DeviceModel();
    this.inspectorModel = new InspectorModel();
    this.debuggerModel = new DebuggerModel();
    // this.initTestEntryUI();
    // this._doStartWeexDebugServer();
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
    this._killWeexDebugServer();
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
      this._killWeexDebugServer();
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

    addElement(panel, "Inspector", "#7bb8f4", () => {
      var selectedOption = select.options[select.selectedIndex]
      if (selectedOption) {
        this._onStartInspectCommand(selectedOption.tag);
      }
    });

    addElement(panel, "Devtools", "#7bb8f4", () => {
      this.inspectorModel.openDevTools();
    });

    addElement(panel, "Reload", "#7bb8f4", () => {
      this.inspectorModel.reload();
    });

    panel = newRowPanel();

    addElement(panel, "Runtime", "#ffff00", () => {
      var selectedOption = select.options[select.selectedIndex]
      if (selectedOption) {
        this._onStartRuntimeCommand(selectedOption.tag);
      }
    });

    addElement(panel, "Debugger", "#ffff00", () => {
      var selectedOption = select.options[select.selectedIndex]
      if (selectedOption) {
        this._onStartDebuggerCommand(selectedOption.tag);
      }
    });

    addElement(panel, "Reload", "#ffff00", () => {
      this.debuggerModel.reload();
    });

    panel = newRowPanel();

    addElement(panel, "TEST", "#ff00ff", () => {
      this.testAny();
    });
  },

  _onEstablishedPreviewChannel() {
    this._doStartWeexDebugServer();
  },

  /**
   * Broadcast
   */
  _notifyDebuggerServerAddress(hostPort) {
    atom.commands.dispatch(atom.views.getView(atom.workspace),
            "thera-debugger:debugger:connection",
            { serverAddress: `ws://${hostPort}/debugProxy/native` } );
  },

  _notifyDebuggerMainDevice(device) {
    atom.commands.dispatch(atom.views.getView(atom.workspace),
            "thera-debugger:debugger:connection",
            { device: device} );
  },

  /**
   * If debug-server has started, this start command will be discarded.
   * @_killWeexDebugServer need to be invoked if you want a restart.
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
          This._killWeexDebugServer();
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

      // Notify app to connect "ws://30.7.75.126:8088/debugProxy/native"
      // Emit notification here !!
      This._establishDeviceListChannel(hostPort);
    }
  },

  /**
   * Kill forked debug-server process
   */
  _killWeexDebugServer() {
    if (this._debugServerProcess && this._debugServerProcess.pid) {
      child_process.execSync(`kill -9 ${this._debugServerProcess.pid}`);
      this._debugServerProcess = null;
    }
  },

  /**
   * Connect debugger server to listen device list update.
   */
  _establishDeviceListChannel(hostPort) {

    var This = this;
    function doConnection() {
      console.log('Connect debugg-server to listen device list update.');
      var deviceListUrl = `ws://${hostPort}/debugProxy/list`;
      This.deviceModel.connect(deviceListUrl);
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
   * Change targeting device to another.
   */
  _doChangeTargetDevice(device) {
    this._onStartInspectCommand(device);
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
      } else if (params.debugger) {
        this.debuggerModel.reload();
      }
    }
  },

  /**
   * 启动Inspector进程
   */
  _onStartInspectCommand(device) {
    if (device) {
      var targetDevice = this.deviceModel.findDeviceById(device.deviceId);

      if (targetDevice) {
        console.log("Inspector targetDevice: ", targetDevice);
        var inspectorPage = __dirname + '/devtools_ex/inspector.html';
        var host = ThePkgCfgs.server.ip, port = ThePkgCfgs.server.port;
        var wsInspectorUrl = `ws=${host}:${port}/debugProxy/inspector/${targetDevice.inspectorSessionId}`;
        var wsDebuggerUrl = `dws=${host}:${port}/debugProxy/debugger/${targetDevice.debuggerSessionId}`;
        var inspectorUrl = `${inspectorPage}?${wsInspectorUrl}&${wsDebuggerUrl}`;

        this.inspectorModel.startInspectorService(inspectorUrl, this.theraDebuggerView.getHiddenContainer());
        this._notifyDebuggerMainDevice(targetDevice);
      }
    }
  },

  /**
   * 启动Runtime进程
   */
  _onStartRuntimeCommand(device) {
    if (device) {
      var targetDevice = this.deviceModel.findDeviceById(device.deviceId);
      if (targetDevice) {
        // connect
        console.log("Runtime targetDevice: ", targetDevice);
        this._onStartRuntimeInChrome(targetDevice);
        // this._onStartRuntimeInProcess(targetDevice);
      }
    }
  },

  /**
   * 在Chrome中启动Runtime运行时
   */
  _onStartRuntimeInChrome(device) {

    var host = ThePkgCfgs.server.ip, port = ThePkgCfgs.server.port;
    var runtimeUrl = `http://${host}:${port}/debugger.html?sessionId=${device.debuggerSessionId}`;
    this.debuggerModel.startRuntimeInChrome(runtimeUrl, this.theraDebuggerView.getHiddenContainer());
  },

  /**
   * 在普通进程中启动Runtime运行时
   * @Deprecate
   */
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

  /**
   * 启动调试器进程
   */
  _onStartDebuggerCommand(device) {
    if (device) {
      var targetDevice = this.deviceModel.findDeviceById(device.deviceId);
      if (targetDevice) {
        console.log("Debugger");
        this.debuggerModel.startDebuggerService();
      }
    }
  },

  toggle() {
    return (
      this.viewPanel.isVisible() ?
      this.viewPanel.hide() :
      this.viewPanel.show()
    );
  },

  testAny() {
    new TestEntry().run();
  }
};
