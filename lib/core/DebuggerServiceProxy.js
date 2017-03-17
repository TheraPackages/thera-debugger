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
    super.startDebug(entranceURL);
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

  getProperties (objectId) {

    var id = ++this.promiseId;
    this.debuggerModel.getProperties(id, objectId);

    return new Promise(doGet.bind(this));

    function doGet(resolve, reject) {
      this.promiseTasks[id] = {
        resolve: resolve,
        reject: reject
      }
    }
  }

  evaluateOnSelectedCallFrame(expression, objectGroup) {
    this.debuggerModel.evaluateOnSelectedCallFrame(1, expression, objectGroup);
  }

  runtimeEvaluate(expression, objectGroup) {
    this.debuggerModel.runtimeEvaluate(2, expression, objectGroup);
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
