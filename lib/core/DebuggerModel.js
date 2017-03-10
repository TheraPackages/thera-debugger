
DebuggerModel = function() {

  this._runtime = null;
  this._debugger = null;
}

DebuggerModel.prototype = {

  dispose: function() {
    if (this._runtime) {
      this._runtime.remove();
      this._runtime = null;
    }
  },

  startRuntimeInChrome: function(runtimeUrl, viewContainer) {

    if (this._runtime) {
      this._runtime.remove();
      this._runtime = null;
    }

    this._runtime = document.createElement('webview');
    var webview = this._runtime;
    webview.src = runtimeUrl;
    webview.nodeintegration = true;
    webview.disablewebsecurity = true;
    this.hiddenContainer.classList.add('thera-debugger-container-hidden');

    webview.addEventListener('console-message', (params) => {

    });
    webview.addEventListener('ipc-message', (stdEvent) => {
      // this.hostBridge.dispatchReceivedIpcEvent(stdEvent);
    });

    viewContainer.appendChild(webview);
  },

  _startRuntimeInProcess: function(runtimeUrl) {

  },

  startDebuggerService: function() {
    this.openDevTools();
  },

  reload: function() {
    if (this._runtime) {
      this._runtime.reload();
    }
  },

  openDevTools: function() {
    if (this._runtime && !this._runtime.isDevToolsOpened()) {
      this._runtime.openDevTools();
    }
  },

}

module.exports = DebuggerModel;
