
/**
 * Converter chrome protocol format to IPC format.
 */
WebInspector.DataConverter = function() {
  // Map chrome url to local
  this.urlMapping = {};
}

WebInspector.DataConverter.LogLevel = {
  Log: "log",
  Debug: "debug",
  Info: "notice",
  Warning: "warn",
  Error: "error",
  RevokedError: "error"
}

WebInspector.DataConverter.prototype = {

  initialize: function(urlMapping) {
    this.urlMapping = urlMapping || {};
  },

  /**
   *  WebInspector.ConsoleMessage.MessageLevel = {
   *    Log: "log",
   *    Info: "info",
   *    Warning: "warning",
   *    Error: "error",
   *    Debug: "debug",
   *    RevokedError: "revokedError"
   *  };
   *
   * @param {WebInspector.ConsoleMessage} data
   */
  console: function(data) {
    if (!data) {
      return null;
    }
    var log = {
      level: data.level,
      messageText: data.messageText,
      source: data.source,
      type: data.type,
      timestamp: data.timestamp
    };
    // Log level defined by chrome-devtool: log, debug, info, warning, error
    // Map them to thera console definition: notice, debug, warn, error
    if (log.level === WebInspector.ConsoleMessage.MessageLevel.Log) {
      log.level = WebInspector.DataConverter.LogLevel.Log;
    } else if (log.level === WebInspector.ConsoleMessage.MessageLevel.Debug) {
      log.level = WebInspector.DataConverter.LogLevel.Debug
    } else if (log.level === WebInspector.ConsoleMessage.MessageLevel.Info) {
      log.level = WebInspector.DataConverter.LogLevel.Info;
    } else if (log.level === WebInspector.ConsoleMessage.MessageLevel.Warning) {
      log.level = WebInspector.DataConverter.LogLevel.Warning;
    } else if (log.level === WebInspector.ConsoleMessage.MessageLevel.Error) {
      log.level = WebInspector.DataConverter.LogLevel.Error;
    } else if (log.level === WebInspector.ConsoleMessage.MessageLevel.RevokedError) {
      log.level = WebInspector.DataConverter.LogLevel.RevokedError;
    }

    // Redefine log level defined in weex js-framework.
    var messageText = data.messageText || "";
    if (messageText.startsWith("jsLog")) {
      if (messageText.endsWith("__ERROR")) {
        log.level = WebInspector.DataConverter.LogLevel.Error;
      } else if (messageText.endsWith("__WARN")) {
        log.level = WebInspector.DataConverter.LogLevel.Warning;
      } else if (messageText.endsWith("__INFO")) {
        log.level = WebInspector.DataConverter.LogLevel.Info;
      } else if (messageText.endsWith("__LOG")) {
        log.level = WebInspector.DataConverter.LogLevel.Log;
      } else if (messageText.endsWith("__DEBUG")) {
        log.level = WebInspector.DataConverter.LogLevel.Debug;
      }
    }
    return log;
  },

   /**
    * @param {WebInspector.DOMNode} root
    */
  dom: function(root) {
    if (!root) return null;
    var dom = null;
    // DOM Removed
    if (root.node && root.parent) {
      dom = this._convertDomTree(root.node);
      dom.parent = root.parent ? root.parent.id : -1;
    } else {
      // DOM Inserted / Document Updated
      dom = this._convertDomTree(root);
    }
    return dom;
  },

  /**
   * Construct dom recursively.
   * @param {WebInspector.DOMNode} root
   * @return {id, nodeName, nodeType, parent, previousSibling, nextSibling, children}
   */
  _convertDomTree: function(root) {
    if (!root) {
      return null;
    }
    var node = {
      id: root.id,
      nodeName: root.nodeName(),
      // localName: root.localName(),
      nodeType: root.nodeType(),
      parent: root.parentNode ? root.parentNode.id : -1,
      previousSibling: root.previousSibling ? root.previousSibling.id : -1,
      nextSibling: root.nextSibling ? root.nextSibling.id : -1
    };

    var children = root.children();
    if (children && children.length > 0) {
      node.children = []; // node children
      for (var i=0; i<children.length; ++i) {
        var child = this._convertDomTree(children[i]);
        node.children.push(child);
      }
    }
    return node;
  },

  /**
   * @param {Map<string, string>} styleMap
   */
  css: function(styleMap) {
    if (!styleMap) {
      return null;
    }
    retMap = {};
    for (var name of styleMap.keys()) {
      retMap[name] = styleMap.get(name);
    }
    return retMap;
  },

  /**
   * @param {WebInspector.UISourceCode} uiSourceCode
   */
  uiSourceCode: function(uiSourceCode) {
    if (!uiSourceCode) {
      return null;
    }
    var ret = {
      name: uiSourceCode.name(),
      sourceURL: uiSourceCode.url(),
      origin: uiSourceCode.origin(),
      parentURL: uiSourceCode.parentURL()
    }
    return ret;
  },

  /**
   * @param {WebInspector.Script} script
   */
  script: function(script) {
    if (!script) {
      return null;
    }
    var ret = {
      sourceURL: script.sourceURL,
      scriptId: script.scriptId,
      sourceMapURL: script.sourceMapURL,
      lineOffset: script.lineOffset,
      endLine: script.endLine,
      endColumn: script.endColumn
    };
    return ret;
  },

  /**
   * @param {Map<key, Object>}
   * {breakpoint:  WebInspector.BreakpointManager.Breakpoint, uiLocation: WebInspector.UILocation}
   */
  breakpoint: function(chromeBrk) {
    if (!chromeBrk || !chromeBrk.breakpoint || !chromeBrk.uiLocation) {
      return null;
    }
    var breakpoint = chromeBrk.breakpoint;
    var uiLocation = chromeBrk.uiLocation;
    var retBrk = {
      enabled: breakpoint.enabled(),
      projectId: breakpoint.projectId(),
      path: breakpoint.path(),
      lineNumber: uiLocation.lineNumber,           // Real location at UI
      columnNumber: uiLocation.columnNumber,       // Real location at UI
      rawLineNumber: breakpoint.lineNumber(),      // Raw location
      rawColumnNumber: breakpoint.columnNumber(),  // Raw location
      id: breakpoint.path() + ":" + uiLocation.lineNumber + ":" + uiLocation.columnNumber
    };
    return retBrk;
  },

  /**
   * @param {WebInspector.DebuggerPausedDetails}
   * {Threads, Watch, Call Stack, Scope, Breakpoints}
   */
  pausedDetails: function(details) {
    if (!details) {
      return null;
    }
    var callFrames = details.callFrames;  // {!Array.<!DebuggerAgent.CallFrame>} callFrames
    var reason = details.reason;          // string
    var auxData = details.auxData;        // {!Object|undefined}
    var breakpointIds = details.breakpointIds;      // {!Array.<string>}
    var asyncStackTrace = details.asyncStackTrace;  // {!RuntimeAgent.StackTrace=}
    // WebInspector.DebuggerModel.CallFrame
    var mappedFrames = details.callFrames.map((callFrame) => {
      return this.callFrame(callFrame);
    });

    var ret = {
      callFrames: mappedFrames,
      reason: reason,
      breakpointIds: breakpointIds
    };
    return ret;
  },

  /**
   * @param {WebInspector.DebuggerModel.CallFrame}
   * {Threads, Watch, Call Stack, Scope, Breakpoints}
   */
  callFrame: function(callFrame) {
    if (!callFrame) {
      return null;
    }
    var id = callFrame.id;                // {"ordinal":0,"injectedScriptId":2}
    var location = callFrame.location();  // todo MaptoUILocation
    // Array[WebInspector.DebuggerModel.Scope]
    var mappedScopeChain = callFrame.scopeChain().map(scope => {
      var object = scope.object();        // WebInspector.RemoteObject
      var mappedObject = this.remoteObject(object);
      return {
        name: scope.name(),   // Scope name: functionName
        type: scope.type(),   // Allowed values: global, local, with, closure, catch, block, script, eval, module.
        object: mappedObject
      };
    });

    var ret = {
      functionName: (callFrame.functionName || "(anonymous function)"),
      id: callFrame.id,       // {"ordinal":0,"injectedScriptId":2}
      scopeChain: mappedScopeChain,
      location: {
        path: callFrame.script.sourceURL,
        scriptId: location.scriptId,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber
      },
      this: this.remoteObject(callFrame.thisObject())
    };
    return ret;
  },

  remoteObject: function(object) {
    if (!object) {
      return null;
    }
    var ret = {
      description: object.description,  // String representation of the object.
      type: object.type,                // Object type. Allowed values: object, function, undefined, string, number, boolean, symbol.
      subtype: object.subtype,          // Object subtype hint. Specified for object type values only. Allowed values: array, null, node, regexp, date, map, set, iterator, generator, error, proxy, promise, typedarray.
      objectId: object.objectId,        // Unique object identifier (for non-primitive values).
      value: object.value,              // Primitive or null object.
      hasChildren: object.hasChildren
    };
    return ret;
  },

  exceptionDetails: function(exception) {
    if (!exception) {
      return null;
    }
    var ret = {
      exceptionId: exception.exceptionId,
      text: exception.text,
      lineNumber: exception.lineNumber,
      columnNumber: exception.columnNumber,
      scriptId: exception.scriptId,
      url: exception.url,
      stackTrace: null, // todo
      exception: null,  // todo
      executionContextId: null  // todo
    }
    return ret;
  },

  __proto__: WebInspector.Object.prototype
}
