'use babel';

var NetUtils = require('../common/NetUtils');
import { CompositeDisposable } from 'atom';

InspectorModel = function(viewContainer, deviceModel) {

  this._viewContainer = viewContainer;
  this._deviceModel = deviceModel;
  this._inspector = null;
  this._subscriptions = new CompositeDisposable();
  // Subscribe atom events
  this._subscriptions.add(atom.commands.add('atom-workspace', {
    'layer:selected': (event) => this._layerSelected(event.detail),
    'layer:hovering': (event) => this._layerHovering(event.detail),
    'layer:unfocused': (event) => this._layerUnfocused(event.detail)
  }));
  // Subscribe inspector message from custom preview websocket channel in weex-run package.
  this._subscriptions.add(atom.commands.add('atom-workspace', {
    'thera-debugger:inspector:recv': (event) => this.dispatchPreviewChannelEvent(event.detail)
  }));
}

InspectorModel.Channels = {
  INSPECT: "thera_inspector",
  COMMAND: "thera_command"
}

InspectorModel.prototype = {

  dispose: function() {

    this.stopInspector();
    this._subscriptions.dispose();
  },

  stopInspector: function() {
    if (this._inspector) {
      this._inspector.remove();
      this._inspector = null;
    };
  },

  startInspectorService: function(targetDevice) {

    this.stopInspector();

    // Make sure we get the newest info about this target device.
    targetDevice = targetDevice ? this._deviceModel.findDeviceById(targetDevice.deviceId) : null;
    if (!targetDevice) {
      return;
    }
    // Assemble inspector url.
    var inspectorPage = PkgCfgs.project.root + '/devtools_ex/inspector.html';
    var host = NetUtils.ip(), port = PkgCfgs.server.port;
    var wsInspectorUrl = `ws=${host}:${port}/debugProxy/inspector/${targetDevice.inspectorSessionId}`;
    var wsDebuggerUrl = `dws=${host}:${port}/debugProxy/debugger/${targetDevice.debuggerSessionId}`;
    var inspectorUrl = `${inspectorPage}?${wsInspectorUrl}&${wsDebuggerUrl}`;

    // Setup inspector environment properties.
    var inspectorProc = this._inspector = document.createElement('webview');
    inspectorProc.src = inspectorUrl;
    inspectorProc.nodeintegration = true;
    inspectorProc.disablewebsecurity = true;
    inspectorProc.classList.add('thera-debugger-webview-hidden');


    inspectorProc.addEventListener('destroyed', (stdEvent) => {
      console.error("Inspector process has been destroyed.", stdEvent);
    });
    inspectorProc.addEventListener('crashed', (stdEvent) => {
      console.error("Inspector process has crashed.", stdEvent)
    });
    inspectorProc.addEventListener('did-fail-load', (stdEvent) => {
      console.error('Inspector process did-fail-load', stdEvent);
    });
    inspectorProc.addEventListener('did-start-loading', (stdEvent) => { //1
      console.log('Inspector process did-start-loading', stdEvent);
    });
    inspectorProc.addEventListener('load-commit', (stdEvent) => {       //2
      // console.log('Inspector process load-commit', stdEvent);
    });
    inspectorProc.addEventListener('dom-ready', (stdEvent) => {         //3
      inspectorProc.domReady = true;
      console.log('Inspector process dom-ready', stdEvent);
    });
    inspectorProc.addEventListener('did-finish-load', (stdEvent) => {   //4
      console.log('Inspector process did-finish-load', stdEvent);
    });
    inspectorProc.addEventListener('did-stop-loading', (stdEvent) => {  //5
      console.log('Inspector process did-stop-loading', stdEvent);
    });

    // Log emitted from inspector.html
    inspectorProc.addEventListener('console-message', (params) => {
      if (params.level >= 2) {
        var log = params.message || "";
        if (log.startsWith("Incompatible embedder:") || log.indexOf('Not implemented') > -1 ||
            log.startsWith("Uncaught TypeError:")) {
          // Ignored
        } else {
          console.error("Inspector process: ", params);
        }
      } else {
        // console.log(params);
      }
    });

    // IPC custom message
    inspectorProc.addEventListener('ipc-message', (stdEvent) => {
      this.dispatchIpcChannelEvent(stdEvent);
    });
    this._viewContainer.appendChild(inspectorProc);
  },

  reload: function() {
    if (this._inspector) {
      this._inspector.reload();
    }
  },

  openDevTools: function() {
    if (this._inspector && !this._inspector.isDevToolsOpened()) {
      this._inspector.openDevTools();
    }
  },

  /**
   * Message from devtool process's IPC channel.
   */
  dispatchIpcChannelEvent: function(stdEvent) {
    if (!stdEvent)
      return;

    if (stdEvent.channel === InspectorModel.Channels.INSPECT) {
      var action = stdEvent.args[0];
      var domain = typeof action === 'string' ? action.split('.')[0] : '';
      // Devtool ipc channel accounts for all domains except for DOM and CSS.
      if (domain !== 'DOM' && domain !== 'CSS') {
        this._inspectorHandler.apply(this, stdEvent.args);
      }
    } else {
      console.log("Unknow ipc channel: " + stdEvent.channel, stdEvent);
    }
  },

  /**
   * Message from cutom preview websocket channel in weex-run package.
   * data.params contains events
   * data.result contains requst result
   */
  dispatchPreviewChannelEvent: function(data) {
    if (data) {
      var action = data.method;
      var domain = typeof action === 'string' ? action.split('.')[0] : '';
      // Preview channel only accounts for DOM and CSS domain. Other domains are provided by devtool ipc channel.
      if (domain === 'DOM' || domain === 'CSS') {
        this._inspectorHandler(data.method, data.params || data.result);
      }
    }
  },

  _inspectorHandler: function(action, data) {

    var workspaceTarget = atom.views.getView(atom.workspace);
    switch (action) {
      case "Console.MessageAdded":
        atom.commands.dispatch(workspaceTarget, 'console:log', [data.messageText, data.level]);
        break;
      case "DOM.DocumentUpdated":
        atom.commands.dispatch(workspaceTarget, 'layer:updated', data.root);
        break;
      case "DOM.NodeInserted":
        atom.commands.dispatch(workspaceTarget, 'layer:inserted', data);
        break;
      case "DOM.NodeRemoved":
        atom.commands.dispatch(workspaceTarget, 'layer:removed', data);
        break;
      case "DOM.getBoxModel":
        atom.commands.dispatch(workspaceTarget, 'layer:box', data)
        break;
      case "CSS.getComputedStyleForNode":
        atom.commands.dispatch(workspaceTarget, 'layer:property', data.computedStyle || data);
        break;
        case "DOM.highlightNode":
        case "DOM.hideHighlight":
          // ignored
          break;
      default:
        console.log("Unknow inspector message: " + action, data);
    }
  },

  /**
   * All IPC invokes should follow chrome-debugging-protocol
   * @param {Domain.Method} command
   */
  sendIpcEvent: function(command, data) {
    if (this._inspector) {
      this._inspector.send(InspectorModel.Channels.COMMAND, command, data);
    }
  },

  _layerSelected: function(data) {
    // To devtool inspector.
    // this.sendIpcEvent("DOM.getBoxModel", data.id);
    // this.sendIpcEvent("CSS.getMatchedStylesForNode", data.id);
    // this.sendIpcEvent("CSS.getComputedStyleForNode", data.id);
    // this.sendIpcEvent("DOM.highlightNode", data.id);

    // console.log(data);
    var payload = {
      method: "CSS.getComputedStyleForNode",
      params: {
        nodeId: data.id
      }
    }
    this.sendToPreviewChannel(payload);
  },

  _layerHovering: function(data) {
    // console.log(data);
    var payload = {
      method: "DOM.highlightNode",
      params: {
        nodeId: data.id
      }
    };
    this.sendToPreviewChannel(payload);
  },

  _layerUnfocused: function(data) {
    // console.log(data);
    var payload = {
      method: "DOM.hideHighlight",
      params: {}
    };
    this.sendToPreviewChannel(payload);
  },

  sendToPreviewChannel: function(payload) {
    atom.commands.dispatch(atom.views.getView(atom.workspace), "thera-debugger:inspector:command", payload);
  },

}

module.exports = InspectorModel
