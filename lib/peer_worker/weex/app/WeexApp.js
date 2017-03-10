/**
 * Weex运行时App端逻辑
 */
var BasePeer = require('../BasePeer.js');
var WeexWorker = require('../worker/WeexWorker.js');
var WebsocketClient = require('../lib/WebsocketClient.js');

/**
 * @constructor Running on Atom to talk with weex debugger server via Websocket.
 * @extends {BasePeer}
 */
function WeexApp(wsRuntimeUrl) {
  BasePeer.call(this);
  this._wsRuntimeUrl = wsRuntimeUrl;
  this._socket = null;
  this._worker = null;
}

WeexApp.Store = {
  DebuggerFlag: "DebuggerFlag"
}

WeexApp.Protocol = {
  Reload: "WxDebug.reload",
  Enable: "WxDebug.enable"
}

WeexApp.prototype = {

  /**
   * @override Create a websocket connection to debugger server.
   */
  start: function() {
    this._resetAppEnv();
    // this._startWorkerProcess();
    this._startAppConnection();
  },

  /**
   * @override
   */
  terminate: function() {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  },

  _resetAppEnv: function() {
    this.terminate();
  },

  /**
   * @override
   */
  onPeerMessage: function(message) {
    console.log('WeexApp peer message:', message);
    var domain = message.method.split('.')[0];
    var method = message.method.split('.')[1];
    if (domain === "WxRuntime") {
      if (method === "clearLog") {
        // console.clear();
      } else if (method === "dom") {
        console.log("dom");
      }
    } else {
      this.send2Peer(message);  // 直接转发给DebugServer
    }
  },

  /**
   * Start connection to debugger server.
   */
  _startAppConnection: function() {
    this._socket = new WebsocketClient(this._wsRuntimeUrl);
    this._socket.on("socketOpened", this._handleSocketOpened.bind(this));
    this._socket.on("WxDebug.refresh", this._handleRefresh.bind(this));
    this._socket.on("WxDebug.initJSRuntime", this._handleInitJSRuntime.bind(this));
    this._socket.on("*", this._handleRestMessage.bind(this));
    console.log("Start runtime websocket:", this._wsRuntimeUrl);
  },

  _handleSocketOpened: function() {
    // reload page or eanble WxDebug
    this._socket.send({method:  WeexApp.Protocol.Enable});
    // this._socket.send({method:  WeexApp.Protocol.Reload});
  },

  _handleRefresh: function(message) {
    // TODO 重新创建 Runtime
  },

  _handleInitJSRuntime: function(message) {
    console.log();
    this._destroyJSRuntime();
    this._initJSRuntime(message);
    this.send2Peer(message);
  },

  /**
   * Post message to worker process.
   */
  _handleRestMessage: function(message) {
    this.send2Peer(message);
  },

  _destroyJSRuntime: function() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  },

  /**
   * Create a worker process to digest message.
   */
  _initJSRuntime: function(message) {
    this._worker = new WeexWorker(this);
    this.bindPeer(this._worker);
    this._worker.start();
  },

  __proto__: BasePeer.prototype
}

module.exports = WeexApp;
