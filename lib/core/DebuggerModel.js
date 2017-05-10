'use babel'

const {Emitter} = require('atom')
import { DebugCommand, DebugEvent } from '../common/ModelConsts'
var NetUtils = require('../common/NetUtils');
var CUtils = require('../common/CommonUtils');

DebuggerModel = function(viewContainer, inspectorModel, deviceModel) {

  this._viewContainer = viewContainer;
  this._inspectorModel = inspectorModel;
  this._deviceModel = deviceModel;

  this.device = null;       // Target device for debug.
  this._runtimeUrl = "";    // Runtime url
  this._runtime = null;     // Runtime environment
  this._debugger = null;    // Debugger process
  this._modelListener = this._stubModelListener;  // Subscribe async debugger message.
  this.unresolvedBreakpoints = []   // Unresolved breakpoints.
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
    // Make sure this device exists and we should remember it.
    this.device = device;
    this._innerStopDebug();
    this._inspectorModel.startInspectorService(this.getTargetDevice());  // This is a default action
  },

  /**
   * SessionId may be changed when something happens. This method
   * make sure that we get the newest info about this target device.
   */
  getTargetDevice: function() {
    return this.device ? this._deviceModel.findDeviceById(this.device.deviceId) : null;
  },

  /**
   * Start command emitted from the 'Debug' button.
   * step1. Stop the current debugger before start a new one.
   * step2. Start a runtime for the target followed by a debugger process.
   */
  startDebug: function() {
    var targetDevice = this.getTargetDevice();
    if (!targetDevice) {
      console.error('You must specify an active device before starting debug.');
      return;
    }
    if (this.isStartingDebug) {
      console.warn('A startDebug command is running. Discard !!!');
      return;
    }
    this.isStartingDebug = true;  // Mark we are running in starting phase.

    this._innerStopDebug();
    // This is weex-inspector time sequence required, wait some time to ensure the stop command has done before starting.
    setTimeout(start.bind(this), 666);
    function start() {
      this.startRuntimeInChrome(this.getTargetDevice());
      this._inspectorModel.stopInspector();
      this.isStartingDebug = false;
    }
  },

  /**
   * Stop command emitted from 'StopDebug' button or changing target device.
   * step1. Tell the target device to quit debug mode.
   * step2. Kill the debugger and runtime process if we have.
   * step3. Restart the inspector process to collect running information.
   */
  stopDebug: function() {
    console.log("Debugger action stopDebug");
    this.debuggerStopped('CommandStop');
    this._innerStopDebug();
    this._inspectorModel.startInspectorService(this.getTargetDevice());  // This is a default action
  },

  /**
   * Purely stop debugger.
   */
  _innerStopDebug: function() {
    this._deviceModel.stopDebug(this.getTargetDevice());
    this._killDebugger();
    this._killRuntime();
  },

  setPauseOnExceptions: function() {
    console.log('Debugger action setPauseOnExceptions');
    this.sendDebuggerIpcEvent(DebugCommand.SetPauseOnExceptions, null);
  },

  syncAllBreakpoints: function(breakpoints) {
    console.log('Debugger action syncAllBreakpoints:', breakpoints);
    this.unresolvedBreakpoints = breakpoints || []
  },

  _trySyncUnresolvedBreakpoints: function(sourceCode) {
    if (sourceCode && this.unresolvedBreakpoints.length > 0) {
      var unresolve = []
      var self = this;
      this.unresolvedBreakpoints.forEach((payload) => {
        if (sourceCode.sourceURL.endsWith(payload.path)) {
          setTimeout(() => {
            self.setBreakpoint(sourceCode.sourceURL, payload.line, true);
          }, 300);
        } else {
          unresolve.push(payload);
        }
      });
      this.unresolvedBreakpoints = unresolve;
    }
    // console.log("Debugger _trySyncUnresolvedBreakpoints:", this.unresolvedBreakpoints, sourceCode);
  },

  setBreakpoint: function(file, lineNumber, enabled=true) {
    console.log('Debugger action setBreakpoint:', file + ':' + lineNumber);
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
    console.log('Debugger action removeBreakpoint:', file + ':' + lineNumber);
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
    console.log("Debugger action getProperties:", "id=" + id + " objectId=" + objectId);
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
    var host = ThePkgCfgs.server.host, port = ThePkgCfgs.server.port;
    var runtimeUrl = `http://${host}:${port}/debugger.html?sessionId=${device.debuggerSessionId}`;
    console.log("Debugger runtimeUrl: " + runtimeUrl);

    // Setup runtime environment properties.
    this._runtimeUrl = runtimeUrl;
    this._runtime = document.createElement('webview');
    var runtime = this._runtime;
    runtime.src = runtimeUrl;
    runtime.nodeintegration = true;
    runtime.disablewebsecurity = true;
    runtime.classList.add('.thera-debugger-webview-hidden');
    runtime.style.height = "0px";

    // Subscribe runtime message.
    var self = this;
    runtime.addEventListener('crashed', (stdEvent) => {
      console.error("Runtime has crashed.", stdEvent)
      self.debuggerStopped('Runtime crashed');
    });
    runtime.addEventListener('destroyed', (stdEvent) => {
      console.error("Runtime has been destroyed.", stdEvent);
    });
    runtime.addEventListener('did-stop-loading', (stdEvent) => {
      console.log('Runtime did-stop-loading', stdEvent);
      // Continue to start debugger process.
      self.startDebuggerService();
    });
    runtime.addEventListener('did-fail-load', (stdEvent) => {
      console.error('Runtime did-fail-load', stdEvent);
      self.debuggerStopped('Runtime did-fail-load');
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
    var self = this;
    debugProc.addEventListener('destroyed', (stdEvent) => {
      console.error("Debugger process has been destroyed.", stdEvent);
    });
    debugProc.addEventListener('crashed', (stdEvent) => {
      console.error("Debugger process has crashed.", stdEvent)
      self.debuggerStopped('devtool crashed');
    });
    debugProc.addEventListener('did-fail-load', (stdEvent) => {
      console.error('Debugger process did-fail-load', stdEvent);
      self.debuggerStopped('devtool did-fail-load');
    });
    debugProc.addEventListener('did-start-loading', (stdEvent) => { //1
      console.log('Debugger process did-start-loading', stdEvent);
      self.debuggerStarted();
    });
    debugProc.addEventListener('load-commit', (stdEvent) => {       //2
      // console.log('Debugger process load-commit', stdEvent);
    });
    debugProc.addEventListener('dom-ready', (stdEvent) => {         //3
      // console.log('Debugger process dom-ready', stdEvent);
    });
    debugProc.addEventListener('did-finish-load', (stdEvent) => {   //4
      // console.log('Debugger process did-finish-load', stdEvent);
    });
    debugProc.addEventListener('did-stop-loading', (stdEvent) => {  //5
      console.log('Debugger process did-stop-loading', stdEvent);
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

  debuggerStarted: function() {
    this._debuggerHandler(DebugEvent.DebuggerStarted, null);
  },

  debuggerStopped: function(reason) {
    this._debuggerHandler(DebugEvent.DebuggerStopped, reason);
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
        this._modelListener(eventName, arguments[1]);
        this._trySyncUnresolvedBreakpoints(arguments[1]);
        break;
      case DebugEvent.ParsedScriptSource:
        this._modelListener(eventName, arguments[1]);
        break;
      case DebugEvent.DebuggerStarted:
      case DebugEvent.DebuggerStopped:
        this._modelListener(eventName);
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
