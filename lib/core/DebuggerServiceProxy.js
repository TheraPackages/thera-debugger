'use babel'
'use strict'

import { DebugService } from 'thera-debug-common-types'
import { UIDataAdapter } from './UIDataAdapter'

class DebuggerServiceProxy extends DebugService {

  /**
   * Actual debugger action will be delegated to debuggerModel.
   */
  constructor (debuggerModel, inspectorModel) {
    super()
    this.name = 'thera-debugger-js'
    this.debuggerModel = debuggerModel;
    this.inspectorModel = inspectorModel;
    this.promiseTasks = {}, this.promiseId = 0;
    this.uiDataAdapter = new UIDataAdapter("DebuggerServiceProxy", this.promiseTasks, this.asyncAdapterCallback.bind(this));
    this.debuggerModel.onDebuggerEvent(this.debuggerEventHandler.bind(this));  // Add debugger event listener.
  }

  getPromiseId() {
    return ++this.promiseId;
  }

  // @file actual file of the breakpoint
  // @line actual line the breakpoint resolves into
  setBreakpoint (file, line, enabled) {
    var remoteFile = this.uiDataAdapter.mapUrl2Remote(file);
    this.debuggerModel.setBreakpoint(remoteFile, this.uiDataAdapter.offsetLineNumber(line), enabled);
  }

  removeBreakpoint (file, line) {
    var remoteFile = this.uiDataAdapter.mapUrl2Remote(file);
    this.debuggerModel.removeBreakpoint(remoteFile, this.uiDataAdapter.offsetLineNumber(line));
  }

  setPauseOnExceptions () {
    this.debuggerModel.setPauseOnExceptions();
  }

  // debug control
  startDebug (entranceURL) {
    this.debuggerModel.startDebug();
  }

  stopDebug () {
    this.debuggerModel.stopDebug();
  }

  stepOver () {
    this.debuggerModel.stepOver();
  }

  stepInto () {
    this.debuggerModel.stepInto();
  }

  stepOut () {
    this.debuggerModel.stepOut();
  }

  pause () {
    super.pause();
  }

  resume () {
    this.debuggerModel.resume();
  }

  selectCallFrame (callFrameId) {
    this.debuggerModel.selectCallFrame(callFrameId);
  }

  /**
   * @param {string} objectId
   * @return {Promise}
   */
  getProperties (objectId) {
    var id = this.getPromiseId();
    this.debuggerModel.getProperties(id, objectId);
    return this._storePromise(id);
  }

  /**
   * @param {string} expression
   * @param {string} objectGroup
   * @return {Promise}
   */
  evaluateOnSelectedCallFrame(expression, objectGroup) {
    var id = this.getPromiseId();
    this.debuggerModel.evaluateOnSelectedCallFrame(id, expression, objectGroup);
    return this._storePromise(id);
  }

  /**
   * @param {string} expression
   * @param {string} objectGroup
   * @return {Promise}
   */
  runtimeEvaluate(expression, objectGroup) {
    var id = this.getPromiseId();
    this.debuggerModel.runtimeEvaluate(id, expression, objectGroup);
    return this._storePromise(id);
  }

  _storePromise(id) {
    return new Promise(execute.bind(this));
    function execute(resolve, reject) {
      this.promiseTasks[id] = {
        resolve: resolve,
        reject: reject
      }
    }
  }

  destroy () {
    this.debuggerModel = null;
  }

  isDestroyed() {
    return !this.debuggerModel;
  }

  /** Array<Payload> */
  asyncAdapterCallback(payloads) {
    // console.log('Async task finished:', payload);
    this._superNotify(payloads);
  }

  debuggerEventHandler(eventName) {
    // Convert payload to standard ui Class object before notity.
    var payloads = this.uiDataAdapter.parse.apply(this.uiDataAdapter, Array.prototype.slice.call(arguments));
    this._superNotify(payloads);
  }

  _superNotify(payloads) {
    if (payloads instanceof Array) {
      payloads.forEach((payload) => {
        super.notify(payload);
      });
    } else if (payloads) {
      console.warn('Convert payload returns illegle payloads: ', payloads, arguments);
    }
  }
}

module.exports = DebuggerServiceProxy;
