/**
 * Weex运行时子进程端逻辑
 */
var child_process = require('child_process');
var BasePeer = require('../BasePeer.js');
var ip = require('ip');

/**
 * @constructor Running on Atom to talk with child process via IPC.
 * @extends {BasePeer}
 */
function WeexWorker(peer) {
  BasePeer.call(this);
  this.bindPeer(peer);
  this._process = null;
}

WeexWorker.prototype = {

 /**
  * @override Fork a new process to execute weex runtime.
  */
  start: function() {

    var modulePath = __dirname + "/weex-executor.js";
    // child_process.fork(modulePath[, args][, options])
    this._process = child_process.fork(
      modulePath,
      [`${ip()}:${PkgCfgs.server.port}`, ],
      {
        // execArgv: ['--debug-brk'],
        silent: true
      }
    );
    this._redirectOutputStream(this._process);
    this._process.on("message", this._handleWorkerMessage.bind(this));
    console.log('Weex runtime process pid =', this._process.pid);
  },

  /**
   * @override
   */
  terminate: function() {
    if (this._process) {
      this._process.kill();
    }
  },

  /**
   * @override
   */
  onPeerMessage: function(message) {
    // console.log('WeexWorker peer message:', message);
    this._process.send(message);
  },

  /**
   * Redirect child process stdio to parent process.
   */
  _redirectOutputStream: function(process) {
    if (process) {
      this._process.stdout.on('data', (message) => {
        console.log('WeexWorker stdout: ', message.toString());
      });
      this._process.stderr.on('data', (message) => {
        console.error('WeexWorker stderr: ', message.toString());
      });
    }
  },

  /**
   * Handle ipc message from child process.
   */
  _handleWorkerMessage: function(message) {
    console.log(message);
    this.send2Peer(message);
  },

  __proto__: BasePeer.prototype
}

module.exports = WeexWorker;
