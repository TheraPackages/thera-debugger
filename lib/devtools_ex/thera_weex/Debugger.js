
var WebsocketClient = require('./WebsocketClient.js');

WebInspector.WeexDebugger = function() {

  var dws = this._getUrlParam(location.search, "dws");
  if (!dws) {
    console.log("Debugger need location.search contain dws param !!!!");
    return;
  }
  this.wsUrl = 'ws://' + dws;
  this.host = dws.substr(0, dws.indexOf("/"));
  this._socket = new WebsocketClient(this.wsUrl);
  this._socket.on("socketOpened", this._handleSocketOpened.bind(this));
  this._socket.on("WxDebug.refresh", this._handleRefresh.bind(this));
  this._socket.on("WxDebug.initJSRuntime", this._handleInitJSRuntime.bind(this));
  this._socket.on("*", this._handleRestMessage.bind(this));

  this._worker = null;
}

WebInspector.WeexDebugger.Store = {
  DebuggerFlag: "DebuggerFlag"
}

WebInspector.WeexDebugger.Protocol = {
  Reload: "WxDebug.reload",
  Enable: "WxDebug.enable"
}

WebInspector.WeexDebugger.prototype = {

  _getUrlParam: function(search, name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    var r = search.substr(1).match(reg);
    return r ? r[2] : null;
  },

  _handleSocketOpened: function() {
    // reload page or eanble WxDebug
    var debuggerFlag = sessionStorage.getItem(WebInspector.WeexDebugger.Store.DebuggerFlag);
    console.log("Debugger socket opened. debuggerFlag=" + debuggerFlag);
    if (debuggerFlag) {
      this._socket.send({method: WebInspector.WeexDebugger.Protocol.Reload});
    } else {
      this._socket.send({method:  WebInspector.WeexDebugger.Protocol.Enable});
      sessionStorage.setItem(WebInspector.WeexDebugger.Store.DebuggerFlag, true);
    }
  },

  _handleRefresh: function() {
    console.log("Debugger refresh");
    location.reload();
  },

  /**
   * 处理透传消息
   */
  _handleRestMessage: function(message) {
    // console.log(message);
    if (this._worker) {
      this._worker.postMessage(message);
    }
  },

  /**
   * App请求重新初始化 js-framework
   */
  _handleInitJSRuntime: function(message) {
    this._destroyJSRuntime();
    this._initJSRuntime(message);
  },

  _destroyJSRuntime: function() {
    if (this._worker) {
      this._worker.terminate();
      this._worker.onmessage = null;
      this._worker = null;
    }
  },

  _initJSRuntime: function(message) {
    // console.log(message);
    // 使用服务器的Runtime.js
    this._worker = new Worker(`http://${this.host}/lib/Runtime.js`);
    this._worker.onmessage = this._handleWorkerMessage.bind(this);
    this._worker.postMessage(message);  // 将初始化js-framework的消息发送给Worker
  },

  _handleWorkerMessage: function(message) {
    message = message.data;
    var domain = message.method.split('.')[0];
    var method = message.method.split('.')[1];
    if (domain === "WxRuntime") {
      if (method === "clearLog") {
        console.clear();
      } else if (method === "dom") {
        console.log("dom");
      }
    } else {
      this._socket.send(message);    // 直接转发给DebugServer
    }
  },

  __proto__: WebInspector.Object.prototype
}

new WebInspector.WeexDebugger();
