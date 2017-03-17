'use babel'

const {Emitter} = require('atom')
import { DebugCommand, DebugEvent } from '../common/ModelConsts'
var NetUtils = require('../common/NetUtils');

DebuggerModel = function(viewContainer, inspectorModel, deviceModel) {

  this._viewContainer = viewContainer;
  this._inspectorModel = inspectorModel;
  this._deviceModel = deviceModel;

  this.device = null;       // Target device for debug.
  this._runtimeUrl = "";    // Runtime url
  this._runtime = null;     // Runtime environment
  this._debugger = null;    // Debugger process
  this._modelListener = this._stubModelListener;  // Subscribe async debugger message.
  this.breakpointBuf = []   // Store breakpoint in buffer if service unavailable.
}

DebuggerModel.Channels = {
  INSPECT: "thera_inspector",
  COMMAND: "thera_command"
}

DebuggerModel.prototype = {

  dispose: function() {
    this._innerStopDebug();
  },

  _killRuntime: function() {
    if (this._runtime) {
      this._runtime.remove();
      this._runtime = null;
    }
  },

  _killDebugger: function() {
    if (this._debugger) {
      this._debugger.remove();
      this._debugger = null;
    }
  },

  /**
   * Change command which changes target device emitted by switching process in console-panel package.
   * We only support debug one target at a time, so we handle this command as following:
   * step1. Stop the current debugger process if we have one.
   * step2. Restart the inspector process to collect running information.
   */
  changeTargetDevice(device) {
    console.log('Change target device: ', device);
    this.device = device;   // Remember the active target device.
    this._innerStopDebug();
    this._inspectorModel.startInspectorService(this.device);  // This is a default action
  },

  /**
   * Start command emitted from the 'Debug' button.
   * step1. Stop the current debugger before start a new one.
   * step2. Start a runtime for the target followed by a debugger process.
   */
  startDebug() {
    if (!this.device) {
      console.error('You must specify an active device before starting debug.');
      return;
    }
    this._innerStopDebug();
    this.startRuntimeInChrome(this.device);
    this._inspectorModel.stopInspector();
  },

  /**
   * Stop command emitted from 'StopDebug' button or changing target device.
   * step1. Tell the target device to quit debug mode.
   * step2. Kill the debugger and runtime process if we have.
   * step3. Restart the inspector process to collect running information.
   */
  stopDebug: function() {
    console.log("Debugger action stopDebug");
    this._innerStopDebug();
    this._inspectorModel.startInspectorService(this.device);  // This is a default action
  },

  /**
   * Purely stop debugger.
   */
  _innerStopDebug: function() {
    this._deviceModel.stopDebug(this.device ? this.device.deviceId : null);
    this._killDebugger();
    this._killRuntime();
  },

  setPauseOnExceptions: function() {
    console.log('Debugger action setPauseOnExceptions');
    this.sendDebuggerIpcEvent(DebugCommand.SetPauseOnExceptions, null);
  },

  setBreakpointEnabled: function(file, lineNumber, enabled) {
    console.log('Debugger action setBreakpointEnabled');
    var breakpoint = {
      url: file,
      lineNumber: lineNumber,
      columnNumber: 0,
      condition: undefined,
      enabled: enabled
    }
    this.sendDebuggerIpcEvent(DebugCommand.SetBreakpointEnabled, breakpoint);
  },

  setBreakpoint: function(file, lineNumber, enabled=true) {
    console.log('Debugger action setBreakpoint');
    var breakpoint = {
      url: file,
      lineNumber: lineNumber,
      columnNumber: 0,
      condition: undefined,
      enabled: enabled
    };
    this.sendDebuggerIpcEvent(DebugCommand.SetBreakpoint, breakpoint);
  },

  removeBreakpoint: function(file, lineNumber) {
    console.log('Debugger action removeBreakpoint');
    var breakpoint = {
      url: file,
      lineNumber: lineNumber,
      columnNumber: 0,
      condition: undefined
    }
    this.sendDebuggerIpcEvent(DebugCommand.RemoveBreakpoint, breakpoint);
  },

  resume: function() {
    console.log('Debugger action resume');
    this.sendDebuggerIpcEvent(DebugCommand.Resume, null);
  },

  stepOver: function() {
    console.log('Debugger action stepOver');
    this.sendDebuggerIpcEvent(DebugCommand.StepOver, null);
  },

  stepInto: function() {
    console.log('Debugger action stepInto');
    this.sendDebuggerIpcEvent(DebugCommand.StepInto, null);
  },

  stepOut: function() {
    console.log('Debugger action stepOut');
    this.sendDebuggerIpcEvent(DebugCommand.StepOut, null);
  },

  selectCallFrame: function(callFrameId) {
    console.log("Debugger action selectCallFrame");
    this.sendDebuggerIpcEvent(DebugCommand.SelectCallFrame, callFrameId);
  },

  /**
   * @param {Integer} id
   * @param {string} objectId
   */
  getProperties: function(id, objectId) {
    console.log("Debugger action getProperties", id, objectId);
    this.sendDebuggerIpcEvent(DebugCommand.GetProperties, id, objectId);
  },

  /**
   * @param {CallFrameId} callFrameId
   * @param {string} expression
   * @param {string} objectGroup
   * Call this in paused mode.
   */
  evaluateOnSelectedCallFrame: function(evalId, expression, objectGroup) {
    console.log("Debugger action evaluateOnCallFrame", arguments);
    var params = {
      callFrameId: 'SelectedFrame',
      expression: expression,
      objectGroup: objectGroup
    }
    this.sendDebuggerIpcEvent(DebugCommand.EvaluateOnSelectedCallFrame, evalId, params);
  },

  /**
   * @param {string} id
   * Call this in running mode.
   */
  runtimeEvaluate: function(evalId, expression, objectGroup) {
    console.log("Debugger action runtimeEvaluate")
    var params = {
      expression: expression,
      objectGroup: "console"
    }
    this.sendDebuggerIpcEvent(DebugCommand.Evaluate, evalId, params);
  },

  /**
   * All IPC invokes should follow chrome-debugging-protocol
   * @param {Domain.Method} command
   */
  sendDebuggerIpcEvent: function(command, data) {
    if (this._debugger) {
      this._debugger.send.apply(this._debugger,
        [DebuggerModel.Channels.COMMAND, command].concat(Array.prototype.slice.call(arguments, 1)))
    }
  },

  startRuntimeInChrome: function(device) {

    this._killRuntime();

    // Assemble runtime url.
    this.device = device;
    var host = ThePkgCfgs.server.host, port = ThePkgCfgs.server.port;
    var runtimeUrl = `http://${host}:${port}/debugger.html?sessionId=${device.debuggerSessionId}`;
    console.log("Debugger runtimeUrl: " + runtimeUrl);

    // Setup runtime environment properties.
    var This = this;
    this._runtimeUrl = runtimeUrl;
    this._runtime = document.createElement('webview');
    var runtime = this._runtime;
    runtime.src = runtimeUrl;
    runtime.nodeintegration = true;
    runtime.disablewebsecurity = true;
    runtime.classList.add('.thera-debugger-webview-hidden');

    // Subscribe runtime message.
    runtime.addEventListener('crashed', (stdEvent) => {
      console.error("Runtime has crashed.", stdEvent)
    });
    runtime.addEventListener('destroyed', (stdEvent) => {
      console.error("Runtime has been destroyed.", stdEvent);
    });
    runtime.addEventListener('did-finish-load', (stdEvent) => {
      console.log('Runtime did-finish-load', stdEvent);
      // Continue to start debugger process.
      This.startDebuggerService();
    });
    runtime.addEventListener('did-fail-load', (stdEvent) => {
      console.error('Runtime did-fail-load', stdEvent);
    });
    runtime.addEventListener('console-message', (params) => {
      // Log from Runtime page, not some specified template.
      if (params.level >= 2) {
        console.log("Runtime process: ", params);
      } else {
        // console.log('Runtime page log: ', params);
      }
    });
    runtime.addEventListener('ipc-message', (stdEvent) => {
      // Ignore
    });

    this._viewContainer.appendChild(runtime);
  },

  // Not implemented.
  _startRuntimeInProcess: function(runtimeUrl) {},

  /**
   * Find the target runtime to attch service.
   */
  startDebuggerService: function() {

    this._killDebugger();

    var This = this;
    var queryUrl = `http://localhost:${ThePkgCfgs.debugger.port}/json`;
    console.log('Curl ' + queryUrl);
    NetUtils.curl(queryUrl, function(err, response) {
      if (err) {
        console.error('Query page json error. url=' + queryUrl, err);
      } else {
        handlePageList(response);
      }
    });

    // Handle connection to Runtime.
    function handlePageList(pageList) {
      // console.log(pageList);
      pageList = JSON.parse(pageList);
      var targetPage = null;
      for (idx in pageList) {
        if (pageList[idx].url === This._runtimeUrl) {
          targetPage = pageList[idx];
        }
      }
      console.log('Debugger target: ', targetPage);
      if (targetPage) {
        // Format target url.
        var toolPage = ThePkgCfgs.project.root + '/devtools_ex/inspector.html';
        var webSocketDebuggerUrl = targetPage.webSocketDebuggerUrl.replace('://', '=');
        debuggerUrl = `${toolPage}?${webSocketDebuggerUrl}`;
        This.attachToRuntimeProcess(debuggerUrl);
      } else {
        console.error('Can not find a target runtime !!!!', pageList);
      }
    }
  },

  attachToRuntimeProcess: function(debuggerUrl) {
    console.log('Attach to target process: ' + debuggerUrl);
    this._debugger = document.createElement('webview');
    var debugProc = this._debugger;
    debugProc.src = debuggerUrl;
    debugProc.nodeintegration = true;
    debugProc.disablewebsecurity = true;
    debugProc.classList.add('thera-debugger-webview-hidden');

    // Subscribe message.
    debugProc.addEventListener('crashed', (stdEvent) => {
      console.error("Debugger process has crashed.", stdEvent)
    });
    debugProc.addEventListener('destroyed', (stdEvent) => {
      console.error("Debugger process has been destroyed.", stdEvent);
    });
    debugProc.addEventListener('did-finish-load', (stdEvent) => {
      console.log('Debugger process did-finish-load', stdEvent);
    });
    debugProc.addEventListener('did-fail-load', (stdEvent) => {
      console.error('Debugger process did-fail-load', stdEvent);
    });
    // Log emitted from inspector.html
    debugProc.addEventListener('console-message', (params) => {
      if (params.level >= 2 && (params.message || "").startsWith('Incompatible embedder')) {
        // console.log("Debugger process: ", params);
      } else if (params.level == 2) {
        console.error("Debugger process: ", params);
      } else if (params.length == 1) {
        console.warn("Debugger process: ", params);
      } else {
        console.log("Debugger process log: ", params);
      }
    });

    // IPC custom message
    debugProc.addEventListener('ipc-message', (stdEvent) => {
      this.dispatchIpcChannelEvent(stdEvent);
    });

    this._viewContainer.appendChild(debugProc);
  },

  dispatchIpcChannelEvent: function(stdEvent) {
    if (stdEvent.channel === DebuggerModel.Channels.INSPECT) {
      var action = stdEvent.args[0];
      var domain = typeof action === 'string' ? action.split('.')[0] : '';
      // Devtool ipc channel accounts for Debugger domain.
      if (domain === 'Debugger' || domain === "Runtime" || domain === "Workspace") {
        this._debuggerHandler.apply(this, stdEvent.args);
        return true;
      }
    }
    this._inspectorModel.dispatchIpcChannelEvent(stdEvent);
  },

  _debuggerHandler: function(eventName, data) {
    switch (eventName) {
      case DebugEvent.BreakpointAdded:
      case DebugEvent.BreakpointRemoved:
      case DebugEvent.DebuggerPaused:
      case DebugEvent.CallFrameSelected:
      case DebugEvent.DebuggerResumed:
        this._modelListener(eventName, arguments[1]);
        break;
      case DebugEvent.GetProperties:
        this._modelListener(eventName, arguments[1], arguments[2]);
        break;
      case DebugEvent.EvaluateOnSelectedCallFrame:
      case DebugEvent.Evaluate:
        this._modelListener(eventName, arguments[1], arguments[2]);  // id, object
        break;
      case DebugEvent.UISourceCodeAdded:
      case DebugEvent.ParsedScriptSource:
        this._modelListener(eventName, arguments[1]);
        break;
      default:
        console.log("Unknow debugger message: " + eventName, arguments[1]);
    }
  },

  /** Subscribe debugger events. */
  onDebuggerEvent: function(modelListener) {
    this._modelListener = modelListener || this._stubModelListener;
  },

  _stubModelListener: function(eventName, data) {
    console.log('Stub model listener:', eventName, data);
  },

  reloadRuntime: function() {
    if (this._runtime) {
      this._runtime.reload();
    }
  },

  reloadDebugger: function() {
    if (this._debugger) {
      this._debugger.reload();
    }
  },

  openRuntimeDevtool: function() {
    if (this._runtime && !this._runtime.isDevToolsOpened()) {
      this._runtime.openDevTools();
    }
  },

  openDebuggerDevtool: function() {
    if (this._debugger && !this._debugger.isDevToolsOpened()) {
      this._debugger.openDevTools();
    }
  },

}

module.exports = DebuggerModel;
