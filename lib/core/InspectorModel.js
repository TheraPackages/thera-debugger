'use babel';

import { CompositeDisposable } from 'atom';

InspectorModel = function() {

  this._webview = null;
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

    if (this._webview) {
      this._webview.remove();
      this._webview = null;
    }
    this._subscriptions.dispose();
  },

  startInspectorService: function(inspectorUrl, viewContainer) {

    if (this._webview) {
      this._webview.remove();
      this._webview = null;
    }

    this._webview = document.createElement('webview');
    var webview = this._webview;
    webview.src = inspectorUrl;
    webview.nodeintegration = true;
    webview.disablewebsecurity = true;
    webview.classList.add('thera-debugger-webview-hidden');

    // Log emitted from inspector.html
    webview.addEventListener('console-message', (params) => {
      if (params.level >= 2 && (params.message || "").indexOf("Uncaught") > -1) {
        console.error("Inspector process: ", params);
      } else {
        console.log(params);        
      }
    });

    // IPC custom message
    webview.addEventListener('ipc-message', (stdEvent) => {
      this.dispatchIpcChannelEvent(stdEvent);
    });

    viewContainer.appendChild(webview);
  },

  reload: function() {
    if (this._webview) {
      this._webview.reload();
    }
  },

  openDevTools: function() {
    if (this._webview && !this._webview.isDevToolsOpened()) {
      this._webview.openDevTools();
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
    if (this._webview) {
      this._webview.send(InspectorModel.Channels.COMMAND, command, data);
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
