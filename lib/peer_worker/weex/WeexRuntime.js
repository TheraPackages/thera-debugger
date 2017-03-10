/**
 * Weex 运行时实例
 */
var WeexApp = require('./app/WeexApp.js');

function WeexRuntime(wsRuntimeUrl) {
  this._wsRuntimeUrl = wsRuntimeUrl;
  this.app = null;
}

WeexRuntime.prototype = {

  /**
   * Bridge app to runtime process.
   */
  start: function() {

    this.app = new WeexApp(this._wsRuntimeUrl);
    this.app.start();
  },

  terminate: function() {
    if (this.app) {
      this.app.terminate();
      this.app = null;
    }
  },

  // __proto__: WeexRuntime.prototype
}

module.exports = WeexRuntime;
