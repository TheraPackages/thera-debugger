'use babel'
'use strict'

var NetUtils = require('../common/NetUtils');
import { DebugEvent } from '../common/ModelConsts'
import { Breakpoint, CallFrame, Payload, Scope } from 'thera-debug-common-types'
var ResolveBreakpointPayload = Payload.ResolveBreakpointPayload;
var RemoveBreakpointPayload = Payload.RemoveBreakpointPayload;
var CallStackPayload = Payload.CallStackPayload;
var CallFramePayload = Payload.CallFramePayload;
var SourceCodePayload = Payload.SourceCodePayload;
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
    console.log(remoteURL, script, this.urlMapping);
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
      if (!this.urlMapping[breakpoint.path]) {
        console.warn('Discard breakpointAdded event, Source file hasnot added: ' + breakpoint.path, breakpoint);
        return;
      }
      var wrapBrk = new Breakpoint(
        breakpoint.id,
        this.mapUrl2Local(breakpoint.path),
        this.restoreLineNumber(breakpoint.lineNumber),
        breakpoint.enabled
      );
      var payload = new ResolveBreakpointPayload(wrapBrk);
      ret.push(payload);
    }
    console.log('breakpointAdded', ret);
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
    console.log('breakpointRemoved', ret);
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
        promise.reject(result ? result.error : 'Get property results null.');
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
    var sourceExp = /(http:\/\/localhost:\d+\/((source)|(lib))\/)/g;
    if (sourceExp.test(sourceURL)) {
      var localURL = sourceURL.substr(sourceURL.match(sourceExp)[0].length);
      var isRemote = !((localURL || '').startsWith('/'));

      var source = {
        name: sourceCode.name,
        origin: sourceCode.origin,
        parentURL: sourceCode.parentURL,
        sourceURL: sourceCode.sourceURL,
        localURL: localURL,
        isRemote: isRemote
      };
      this.urlMapping[sourceURL] = source;
      console.log(this.urlMapping);
      // Get file content.
      NetUtils.curl(sourceURL, curlHandler.bind(this));
      function curlHandler(err, response) {
        if (err) {
          console.error('Request script source error: ' + sourceURL);
        } else {
          source.content = response;
          makePayload.apply(this, [source]);
        }
      }

      function makePayload(source) {
        var payload = new SourceCodePayload(
          source.sourceURL,
          source.localURL,
          source.isRemote,
          source.content
        );
        this.asyncCallback([payload]);
      }
    }
  }

  /**
   * After:
   * origin: sourceURL!!, lineOffset, endLine, endColumn, scriptId, sourceMapURL
   * more:   content
   */
  parsedScriptSource(script) {
    var sourceURL = script.sourceURL;
    var sourceExp = /(http:\/\/localhost:\d+\/((source)|(lib))\/)/g;
    if (sourceExp.test(sourceURL)) {
      var source = this.urlMapping[sourceURL];
      if (!source) {
        console.error('uiSourceCodeAdded not appear for ' + sourceURL);
        this.urlMapping[sourceURL] = source = {};
      }
      source.lineOffset = script.lineOffset;
      source.endLine = script.endLine;
      source.endColumn = script.endColumn;
      source.scriptId = script.scriptId;
      source.sourceMapURL = script.sourceMapURL;
    }
  }
}

module.exports.UIDataAdapter = UIDataAdapter;
