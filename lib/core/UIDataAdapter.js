'use babel'
'use strict'

var NetUtils = require('../common/NetUtils');
import { DebugEvent } from '../common/ModelConsts'
import { Breakpoint, CallFrame, Payload, Scope } from 'thera-debug-common-types'
var ResolveBreakpointPayload = Payload.ResolveBreakpointPayload;
var RemoveBreakpointPayload = Payload.RemoveBreakpointPayload;
var CallStackPayload = Payload.CallStackPayload;
var CallFramePayload = Payload.CallFramePayload;
var RemoteObject = Scope.RemoteObject;

class UIDataAdapter {

  constructor (name, promiseTasks, asyncCallback) {
    this.name = name || "UIDataAdapter";
    // Key:   remoteURL
    // Value: sourceURL!!, lineOffset, endLine, endColumn, scriptId, sourceMapURL, localURL, isRemote, content
    this.urlMapping = {};
    this.promiseTasks = promiseTasks;
    this.asyncCallback = asyncCallback;
  }

  parse(eventName, args) {
    switch(eventName) {
      case DebugEvent.BreakpointAdded:
        return this.breakpointAdded(arguments[1]);
      case DebugEvent.BreakpointRemoved:
        return this.breakpointRemoved(arguments[1]);
      case DebugEvent.DebuggerPaused:
        return this.debuggerPaused(arguments[1]);
      case DebugEvent.CallFrameSelected:
        return this.callFrameSelected(arguments[1]);
      case DebugEvent.DebuggerResumed:
        return this.debuggerResumed(arguments[1]);
      case DebugEvent.GetProperties:
        return this.getProperties(arguments[1], arguments[2]);
      case DebugEvent.EvaluateOnSelectedCallFrame:
        return this.evaluateOnSelectedCallFrame(arguments[1], arguments[2]);
      case DebugEvent.Evaluate:
        return this.evaluate(arguments[1], arguments[2]);
      case DebugEvent.UISourceCodeAdded:
        return this.uiSourceCodeAdded(arguments[1]);
      case DebugEvent.ParsedScriptSource:
        return this.parsedScriptSource(arguments[1]);
      default:
        return null;
    }
  }

  reset() {
    this.urlMapping = {};
  }

  /** Offest lineNumber from UI to model */
  offsetLineNumber(lineNumber) {
    return lineNumber - 1;
  }

  /** Offest lineNumber from model to UI */
  restoreLineNumber(lineNumber) {
    if (typeof lineNumber === 'string') {
      return parseInt(lineNumber) + 1 + '';
    } else {
      return lineNumber + 1;
    }
  }

  mapUrl2Local(remoteURL) {
    var script = this.urlMapping[remoteURL];
    return (script && script.localURL) || remoteURL;
  }

  mapUrl2Remote(localURL) {
    for (remoteURL in this.urlMapping) {
      if (remoteURL.endsWith(localURL)) {
        return remoteURL;
      }
    }
    return localURL;
  }

  breakpointAdded(breakpoint) {
    var ret = [];
    if (breakpoint) {
      var wrapBrk = new Breakpoint(
        breakpoint.id,
        this.mapUrl2Local(breakpoint.path),
        this.restoreLineNumber(breakpoint.lineNumber),
        breakpoint.enabled
      );
      var payload = new ResolveBreakpointPayload(wrapBrk);
      ret.push(payload);
    }
    console.log('breakpointAdded', arguments, ret);
    return ret;
  }

  breakpointRemoved(breakpoint) {
    var ret = [];
    if (breakpoint) {
      var payload = new RemoveBreakpointPayload(
        this.mapUrl2Local(breakpoint.path),
        this.restoreLineNumber(breakpoint.lineNumber)
      );
      ret.push(payload);
    }
    console.log('breakpointRemoved', arguments, ret);
    return ret;
  }

  debuggerPaused(details) {
    console.log(arguments);
    var ret = [];
    if (details) {
      var hitBreakpoints = details.breakpointIds.map((id) => {
        var segs = id.split(':');
        var columnNumber = segs[segs.length - 1];
        var lineNumber = segs[segs.length - 2];
        var path = id.substr(0, id.length - (":"+lineNumber+":"+columnNumber).length);
        var localUrl = this.mapUrl2Local(path);
        return new Breakpoint(id, localUrl, this.restoreLineNumber(lineNumber), parseInt(columnNumber));
      });
      var callFrames = details.callFrames.map((frame) => {
        return new CallFrame(frame.id, frame.functionName, frame.location, frame.location.path);
      });

      var payload = new CallStackPayload(
        callFrames,
        details.reason,
        hitBreakpoints,
        callFrames[0].id
      );

      ret.push(payload);
    }
    return ret;
  }

  // constructor (id, functionName, scopeChain, location)
  callFrameSelected(callFrame) {
    console.log(arguments);
    var ret = [];
    if (callFrame) {
      var location = callFrame.location;
      location.lineNumber = this.restoreLineNumber(location.lineNumber);
      location.path = this.mapUrl2Local(location.path);
      var payload = new CallFramePayload(
        callFrame.id,
        callFrame.functionName,
        callFrame.scopeChain,
        location
      );
      ret.push(payload);
    }
    return ret;
  }

  /** Ignored */
  debuggerResumed() {
    return [];
  }

  /**
   * id, objectId, result, error
   */
  getProperties(getId, result) {
    console.log(arguments);
    var promise = this.promiseTasks[getId];
    if (promise) {
      delete this.promiseTasks[getId];
      if (result && !result.error) {
        // Array[RemoteObject]
        var propArray = result.result.map((item) => {
          var vObj = item.value || item.get;
          // type, className, value, objectId, hasChildren
          var remoteObject = new RemoteObject(
            vObj.type,
            vObj.className,
            vObj.value,
            vObj.objectId,
            vObj.objectId && vObj.type !== 'symbol'
          );
          return {
            name: item.name,
            value: remoteObject
          };
        });
        promise.resolve(propArray);
      } else {
        promise.reject(result ? result.error : 'Result null.');
      }
    } else {
      console.error('Promise task not exist!', getId, result);
    }
  }

  evaluateOnSelectedCallFrame(evalId, object) {
    console.log(arguments);
  }

  evaluate(evalId, object) {
    console.log(arguments);
  }

  /** Before: sourceURL!!, name, origin, parentURL */
  uiSourceCodeAdded(sourceCode) {
    var sourceURL = sourceCode.sourceURL;
    if (/(http:\/\/localhost:\d+\/((source)|(lib))\/)/g.test(sourceURL)) {
      // Reserved here.
      // console.log(sourceCode);
    }
  }

  /**
   * origin: sourceURL!!, lineOffset, endLine, endColumn, scriptId, sourceMapURL
   * more:   localURL, isRemote, content
   */
  parsedScriptSource(script) {
    var sourceURL = script.sourceURL;
    var sourceExp = /(http:\/\/localhost:\d+\/((source)|(lib))\/)/g;
    if (sourceExp.test(sourceURL)) {
      this.urlMapping[sourceURL] = script;
      var localURL = sourceURL.substr(sourceURL.match(sourceExp)[0].length);
      script.localURL = localURL;
      script.isRemote = (localURL || '').startsWith('/');

      NetUtils.curl(sourceURL, curlHandler.bind(this));
      function curlHandler(err, response) {
        if (err) {
          console.error('Request script source error: ' + sourceURL);
        } else {
          script.content = response;
        }
        this.asyncCallback(script);
      }
    }
  }
}

module.exports.UIDataAdapter = UIDataAdapter;