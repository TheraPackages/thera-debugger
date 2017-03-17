
 /**
  * Bridge running on worker side.
  * ipcRenderer.sendToHost(channel[, arg1][, arg2][, ...])
  * ipcRenderer.on(channel, listener)
  */
WebInspector.WorkerBridge = function() {

  this._ipcRenderer = require('electron').ipcRenderer;

  // Console Domain
  WebInspector.targetManager.addModelListener(WebInspector.ConsoleModel, WebInspector.ConsoleModel.Events.MessageAdded, this._handleConsoleMessageAdded, this);
  // DOM Domain
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.DocumentUpdated, this._handleDocumentUpdated, this);
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.DOMMutated, this._handleDOMMutated, this);      // DOM树有变更时
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.NodeInserted, this._handleNodeInserted, this);  // 增加子节点
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.NodeRemoved, this._handleNodeRemoved, this);    // 删除子节点
  // Debugger Domain
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasEnabled, this._handleDebuggerWasEnabled, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasDisabled, this._handleDebuggerWasDisabled, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.BeforeDebuggerPaused, this._handleBeforeDebuggerPaused, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerPaused, this._handleDebuggerPaused, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerResumed, this._handleDebuggerResumed, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.ParsedScriptSource, this._handleParsedScriptSource, this); // ok
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.FailedToParseScriptSource, this._handleFailedToParseScriptSource, this); //ok
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.GlobalObjectCleared, this._handleGlobalObjectCleared, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.CallFrameSelected, this._handleCallFrameSelected, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.ConsoleCommandEvaluatedInSelectedCallFrame, this._handleConsoleCommandEvaluatedInSelectedCallFrame, this);
  // Source
  WebInspector.workspace.addEventListener(WebInspector.Workspace.Events.UISourceCodeAdded, this._handleUISourceCodeAdded, this);
  // Breakpoint
  WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAdded, this._handleBreakpointAdded, this);
  WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemoved, this._handleBreakpointRemoved, this);
  WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointsActiveStateChanged, this._handleBreakpointsActiveStateChanged, this);

  // Source url in Set.
  this.sourceUrlInChrome = {};
  this._dataConverter = new WebInspector.DataConverter();
  this._dataConverter.initialize(this.sourceUrlInChrome);

  this._hostCommandHandlers = {
    "CSS.getMatchedStylesForNode": this._cssGetMatchedStylesForNode.bind(this),
    "CSS.getComputedStyleForNode": this._cssGetComputedStyleForNode.bind(this),
    "DOM.getBoxModel": this._domGetBoxModel.bind(this),
    "DOM.highlightNode": this._highlightNode.bind(this),

    "Debugger.setPauseOnExceptions": this._setPauseOnExceptions.bind(this),
    "Debugger.setBreakpointByUrl": this._setBreakpointByURL.bind(this),
    "Debugger.setBreakpoint": this._setBreakpoint.bind(this),
    "Debugger.removeBreakpoint": this._removeBreakpoint.bind(this),
    "Debugger.resume": this._resume.bind(this),
    "Debugger.stepOver": this._stepOver.bind(this),
    "Debugger.stepInto": this._stepInto.bind(this),
    "Debugger.stepOut": this._stepOut.bind(this),
    "Debugger.selectCallFrame": this._selectCallFrame.bind(this),
    "Debugger.evaluateOnSelectedCallFrame": this._evaluateOnSelectedCallFrame.bind(this),
    "Runtime.getProperties": this._getProperties.bind(this),
    "Runtime.evaluate": this._evaluate.bind(this),

    "Debugger.setBreakpointEnabled": this._setBreakpointEnabled.bind(this)
  }
  this._ipcRenderer.on(WebInspector.WorkerBridge.Channels.ChannelRecv, this._handleHostCommand.bind(this));

  window.runOnWindowLoad(this._handleWindowLoad.bind(this));
  window.onunload = this._handleWindowUnload.bind(this);
}

WebInspector.WorkerBridge.Channels = {
  ChannelSend: "thera_inspector",   // Send message from worker to host.
  ChannelRecv: "thera_command"      // Recv message from host.
}

WebInspector.WorkerBridge.prototype = {

  _handleWindowLoad: function() {
    console.log('_handleWindowLoad');
    // Clear all breakpoint when started.
    // WebInspector.breakpointManager.removeAllBreakpoints();
  },

  _handleWindowUnload: function() {
    console.log('_handleWindowUnload');
  },

  getDOMModel: function() {
    var mainTarget = WebInspector.targetManager.mainTarget();
    return WebInspector.DOMModel.fromTarget(mainTarget);
  },

  getCSSModel: function() {
    var mainTarget = WebInspector.targetManager.mainTarget();
    return WebInspector.CSSModel.fromTarget(mainTarget);
  },

  /**
   * Weex runtime environment in webview contains two threads:
   *   1. Main thread named "Main" runs debugger.html at targets[0]
   *   2. WebWorker thread named "Runtime.js" runs weex.js template at targets[1]
   * We are working on weex.js, so the webworker target is definitely what we want.
   */
  getWorkerTarget: function() {
    var targets = WebInspector.targetManager.targets();
    for (idx in (targets || [])) {
      var target = targets[idx];
      if (target.name() === "Runtime.js") {
        return target;
      }
    }
  },

  getDebuggerModel: function() {
    return WebInspector.DebuggerModel.fromTarget(this.getWorkerTarget());
    //var mainTarget = WebInspector.targetManager.mainTarget();
    //return WebInspector.DebuggerModel.fromTarget(mainTarget);
  },

  getRuntimeAgent: function() {
    return this.getWorkerTarget().runtimeAgent();
  },

  /**
   * Handle commands from host side.
   * @param eventEmitter
   * @param {string} command
   * @param {Object} params
   */
  _handleHostCommand: function(eventEmitter, command, params) {
    // console.log(arguments);
    if (this._hostCommandHandlers[command]) {
      this._hostCommandHandlers[command].apply(this, Array.prototype.slice.call(arguments, 2));
    } else {
      console.log("Unknow host command: " + command, Array.prototype.slice.call(arguments, 2));
    }
  },

  /**
   * Send information from worker to host via ipcRenderer.
   */
  _invokeHostIpc: function(channel, action, params) {
    this._ipcRenderer.sendToHost.apply(this._ipcRenderer, Array.prototype.slice.call(arguments));
  },

  _handleConsoleMessageAdded: function(event) {
    var data = event.data;
    var log = this._dataConverter.console(data);
    this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Console.MessageAdded", log);
  },

  /** Whole document updated. */
  _handleDocumentUpdated: function(event) {
    var domModel = event.target;  /** @type {!WebInspector.DOMModel} */
    var document = event.data;    /** @type {?WebInspector.DOMDocument} */
    this._printDomTree(document);
    var doc = this._dataConverter.dom(document);
    this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "DOM.DocumentUpdated", doc);
  },

  /** Sub dom mutated, triggered after NodeInserted and NodeRemoved */
  _handleDOMMutated: function(event) {
    var domModel = event.target;
    var node = event.data;  // Node diff
    console.log('Dom tree mutated.');
    // this._printDomTree(node);
    // domModel.requestDocument(this._printDomTree.bind(this)); // Request the whole dom tree immediately
  },

  /** Sub dom inserted. */
  _handleNodeInserted: function(event) {
    var domModel = event.target;
    var node = event.data;  // Node diff
    console.log('Child node inserted.');
    this._printDomTree(node);
    var dom = this._dataConverter.dom(node);
    this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "DOM.NodeInserted", dom)
  },

  /** Sub dom removed. */
  _handleNodeRemoved: function(event) {
    var domModel = event.target;
    var node = event.data;  // Node diff, parentNode
    console.log('Child node removed.');
    this._printDomTree(node.node);
    var dom = this._dataConverter.dom(node);
    this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "DOM.NodeRemoved", dom);
  },

  /**
   * Print dom tree to console.
   */
  _printDomTree: function(root, depth) {

    return;

    if (!depth) depth = 0;
    var space = '';
    for (var i=0; i<depth; ++i) space += '  ';
    console.log(space, root.id, root.nodeName(), root.localName());
    var children = root.children();
    if (children && children.length > 0) {
      for (var i=0; i<children.length; ++i) {
        this._printDomTree(children[i], depth+1);
      }
    }
  },

  /**
   * @param {!DOMAgent.NodeId} nodeId
   */
  _domGetBoxModel: function(nodeId) {
    var domModel = this.getDOMModel();
    if (domModel && domModel.nodeForId(nodeId)) {
      domModel.nodeForId(nodeId).boxModel(
        /** @param DOMAgent.BoxModel */
        (boxModel) => {
          // console.log(boxModel);
          this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "DOM.getBoxModel", boxModel);
        }
      );
    }
  },

  /**
   * @param {!DOMAgent.NodeId} nodeId
   */
  _cssGetMatchedStylesForNode: function(nodeId) {
    var cssModel = this.getCSSModel();
    if (cssModel) {
      cssModel.matchedStylesPromise(nodeId).then(
        /** @param WebInspector.CSSMatchedStyles */
        function(cssMatchedStyles) {
          // Need to be converted but ignored.
          // console.log(cssMatchedStyles)
        }
      );
    }
  },

  /**
   * @param {!DOMAgent.NodeId} nodeId
   */
  _cssGetComputedStyleForNode: function(nodeId) {
    // var attributes = [];
    // var domModel = this.getDOMModel();
    // if (domModel && domModel.nodeForId(nodeId)) {
    //   attributes = domModel.nodeForId(nodeId).attributes();
    // }

    var cssModel = this.getCSSModel();
    if (cssModel) {
      cssModel.computedStylePromise(nodeId).then(
        /** @param Map<string, string> */
        (computedStyle) => {
          console.log(computedStyle);
          var styles = this._dataConverter.css(computedStyle);
          this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "CSS.getComputedStyleForNode", styles);
        }
      );
    }
  },

  _highlightNode: function(nodeId) {
    var domModel = this.getDOMModel();
    if (domModel && domModel.nodeForId(nodeId)) {

    }
  },

  /*
   *  parameters = {
   *    lineNumber: integer,
   *    url: string,            (optional)
   *    urlRegex: string,       (optional)
   *    columnNumber: integer,  (optional)
   *    condition: string       (optional)
   *  }
   *  return = {
   *    breakpointId: BreakpointId (stringUrl:line:col)
   *    locations: [Location]
   *  }
   */
  _setBreakpointByURL: function(breakpoint) {
    console.log('Action _setBreakpointByURL', breakpoint);
    var url = breakpoint.url;
    var lineNumber = breakpoint.lineNumber;
    var columnNumber = breakpoint.columnNumber;
    var condition = breakpoint.condition || '';
    var model = this.getDebuggerModel();
    model.setBreakpointByURL(url, lineNumber, columnNumber, condition, function(breakpointId, rawLocations) {
      console.log('setBreakpointByURL breakpointId=', breakpointId, ' rawLocations=', rawLocations);
    });
    // WebInspector.breakpointManager.setBreakpoint(url, lineNumber, columnNumber, condition, true);
  },

  /**
   * parameters = {
   *   location: Location,
   *   condition: string (optional)
   * }
   * return = {
   *   breakpointId: BreakpointId (stringUrl:line:col)
   *   actualLocation: Location
   * }
   * DebuggerModel.scripts, scriptForId(id)
   * Get sourceCode: this.getDebuggerModel().scriptsForSourceURL('http://localhost:8088/source/thera/main.js')[0]._source
   */
  _setBreakpoint: function(breakpoint) {
    console.log('Action _setBreakpoint', breakpoint);
    var chromeUrl = breakpoint.url;
    var uiSourceCode = this._uiSourceCodeForUrl(chromeUrl);
    if (!uiSourceCode) {
      console.error('Cannot find sourceCode for Url: ' + chromeUrl);
    } else {
      if (typeof(breakpoint.enabled) === 'undefined') {
        console.log('setBreakpoint has undefined enabled member, default to true.');
        breakpoint.enabled = true
      }
      if (breakpoint.enabled) {
        WebInspector.breakpointManager.setBreakpoint(uiSourceCode,
          breakpoint.lineNumber, breakpoint.columnNumber,
          breakpoint.condition || '', breakpoint.enabled);
      } else {
        this._setBreakpointEnabled(breakpoint);
      }
    }
  },

  /**
   * parameters = {
   *   breakpointId: BreakpointId (stringUrl:line:col)
   * }
   * return none;
   */
  _removeBreakpoint: function(breakpoint) {
    console.log('Action _removeBreakpoint', breakpoint);
    var chromeUrl = breakpoint.url;
    var uiSourceCode = this._uiSourceCodeForUrl(chromeUrl);
    var chromeBreakpoint = WebInspector.breakpointManager.findBreakpointOnLine(uiSourceCode, breakpoint.lineNumber);
    if (chromeBreakpoint) {
      chromeBreakpoint.remove(false);
      return true;
    }
    return false;
  },

  _setBreakpointEnabled(breakpoint) {
    console.log('Action setBreakpointEnabled', breakpoint);
    var chromeUrl = breakpoint.url;
    var uiSourceCodes = this._uiSourceCodeForUrl(chromeUrl);
    var chromeBreakpoint = WebInspector.breakpointManager.findBreakpointOnLine(uiSourceCodes, breakpoint.lineNumber);
    if (chromeBreakpoint) {
      chromeBreakpoint.setEnabled(breakpoint.enabled);
      return true;
    }
    return false;
  },

  _uiSourceCodeForUrl: function(url) {
    return WebInspector.workspace.uiSourceCodeForURL(url);
  },

  _findBreakpoint: function(uiSourceCode, lineNumber, columnNumber) {
    return WebInspector.breakpointManager.findBreakpoint(uiSourceCode, lineNumber, columnNumber);
  },

  /**
   * parameters = {
   *   state: string (none, uncaught, all)
   * }
   * return = none
   */
  _setPauseOnExceptions: function(params) {
    console.log('Action _setPauseOnExceptions', params);
    var model = this.getDebuggerModel();
    model.setPauseOnExceptions(params);
  },

  /**
   * parameters = none
   * return = none
   */
  _resume: function() {
    console.log('Action _resume');
    var model = this.getDebuggerModel();
    model.resume();
  },

  /**
   * parameters = none
   * return = none
   */
  _stepOver: function() {
    console.log('Action _stepOver');
    var model = this.getDebuggerModel();
    model.stepOver();
  },

  /**
   * parameters = none
   * return = none
   */
  _stepInto: function() {
    console.log('Action _stepInto')
    var model = this.getDebuggerModel();
    model.stepInto();
  },

  /**
   * parameters = none
   * return = none
   */
  _stepOut: function() {
    console.log('Action _stepOut');
    var model = this.getDebuggerModel();
    model.stepOut();
  },

  _selectCallFrame: function(callFrameId) {
    console.log('Action _selectCallFrame', callFrameId);
    var model = this.getDebuggerModel();
    var callFrames = model.callFrames || [];
    for (var i=0; i<callFrames.length; ++i) {
      if (callFrames[i].id === callFrameId) {
        model.setSelectedCallFrame(callFrames[i]);
        return;
      }
    }
    console.error('Cannot find target CallFrame for id=' + callFrameId);
  },

  /** Get objects in Scope tree */
  _getProperties: function(id, objectId) {
    console.log('Action _getProperties', id, objectId);
    var runtimeAgent = this.getRuntimeAgent();
    /** @{param} array[PropertyDescriptor] result */
    function propCallback(error, properties, internalProperties, exceptionDetails) {
      console.log(arguments);
      var result = {
        id: id,
        objectId: objectId,
        properties: properties,
        error: error
      };
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Runtime.GetProperties", id, result);
    }
    runtimeAgent.getProperties(objectId,  // objectId: {"ordinal":0,"injectedScriptId":2}
      false,                              // ownProperties
      false,                              // accessorPropertiesOnly
      false,                              // generatePreview
      propCallback.bind(this)             // callback
    );
  },

  /**
   * @param {string} evalId Evaluate command id.
   * @param {Object} params Evaluate command parameters.
   */
  _evaluateOnSelectedCallFrame: function(evalId, params) {
    console.log('Action _evaluateOnSelectedCallFrame', evalId, params);
    if (!params) {
      console.error('Eval param is null.');
      return;
    }
    var model = this.getDebuggerModel();
    if (!model.isPaused) {
      console.warn('evaluateOnSelectedCallFrame can only be done after paused.');
      return;
    }
    // {function(?WebInspector.RemoteObject, boolean, ?RuntimeAgent.RemoteObject=, ?RuntimeAgent.ExceptionDetails=)} callback
    function evalCallback(remoteObject, hasException, rRemoteObject, exceptionDetails) {
      var result = {
        id: evalId,
        remoteObject: this._dataConverter.remoteObject(remoteObject),
        hasException: hasException,
        exceptionDetails: this._dataConverter.exceptionDetails(exceptionDetails)
      };
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.EvaluateOnSelectedCallFrame", evalId, result);
      console.log(result, arguments);
    }
    model.evaluateOnSelectedCallFrame(
      params.expression,        // expression: "floatVar\n\n"
      params.objectGroup,       // objectGroup
      false,                    // includeCommandLineAPI
      true,                     // silent
      false,                    // returnByValue
      false,                    // generatePreview
      evalCallback.bind(this)   // callback
    );
  },

  /**
   * @param {string} evalId Evaluate command id.
   * @param {Object} params Evaluate command parameters.
   */
  _evaluate: function(evalId, params) {
    console.log("Action _evaluate", evalId, params);
    if (!params) {
      console.error('Eval param is null.');
      return;
    }
    var target = this.getWorkerTarget();
    // array[WebInspector.ExecutionContext]
    var execCtxs = target.runtimeModel.executionContexts();
    if (execCtxs.length === 0) {
      return;
    }
    // {function(?WebInspector.RemoteObject, boolean, ?RuntimeAgent.RemoteObject=, ?RuntimeAgent.ExceptionDetails=)}
    function evalCallback(remoteObject, hasException, rRemoteObject, exceptionDetails) {
      var result = {
        id: evalId,
        remoteObject: this._dataConverter.remoteObject(remoteObject),
        hasException: hasException,
        exceptionDetails: this._dataConverter.exceptionDetails(exceptionDetails)
      };
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Runtime.Evaluate", evalId, result);
      console.log(result, arguments);
    }
    execCtxs[0].evaluate(
      params.expression,        // expression: "floatVar\n\n"
      params.objectGroup,       // objectGroup
      false,                    // includeCommandLineAPI
      true,                     // doNotPauseOnExceptionsAndMuteConsole
      false,                    // returnByValue
      false,                    // generatePreview
      false,                    // userGesture
      evalCallback.bind(this)   // callback
    );
  },

  // Debugger model events
  _handleDebuggerWasEnabled: function() {
    console.log('_handleDebuggerWasEnabled', arguments);
  },

  _handleDebuggerWasDisabled: function() {
    console.log('_handleDebuggerWasDisabled', arguments);
  },

  _handleBeforeDebuggerPaused: function() {
    console.log('_handleBeforeDebuggerPaused', arguments);
  },

  _handleDebuggerPaused: function(event) {
    console.log('_handleDebuggerPaused', arguments);
    var data = event.data;
    var pausedDetails = this._dataConverter.pausedDetails(data);
    if (pausedDetails) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.DebuggerPaused", pausedDetails);
    } else {
      console.error('_handleDebuggerPaused received invalid event data: ', data);
    }
  },

  _handleDebuggerResumed: function() {
    console.log('_handleDebuggerResumed', arguments);
    this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.DebuggerResumed", null);
  },

  // Add all unresolved breakpoint here
  _handleUISourceCodeAdded: function(event) {
    // console.log('_handleUISourceCodeAdded', arguments);
    var data = event.data;
    var sourceCode = this._dataConverter.uiSourceCode(data);
    if (sourceCode) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Workspace.UISourceCodeAdded", sourceCode);
    }

    var sourceURL = data.url();
    var sourceExp = /(http:\/\/localhost:\d+\/((source)|(lib))\/)/g;  // exec/test/match
    if (sourceExp.test(sourceURL)) {
      var scriptSource = this.sourceUrlInChrome[sourceURL] || {};
      scriptSource.name = data.name();
      scriptSource.sourceURL = sourceURL;
      scriptSource.origin = data.origin();
      scriptSource.parentURL = data.parentURL();

      this.sourceUrlInChrome[sourceURL] = scriptSource;
      // console.log(sourceURL);
    } else {
      // console.log('Other sourceCode');
    }
  },

  // Debugger.Event: scriptParsed
  _handleParsedScriptSource: function(event) {

    var data = event.data;
    var script = this._dataConverter.script(data);
    if (script) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.ParsedScriptSource", script);
    }

    var sourceURL = event.data.sourceURL;
    var sourceExp = /(http:\/\/localhost:\d+\/((source)|(lib))\/)/g;  // exec/test/match
    if (sourceExp.test(sourceURL)) {
      var scriptSource = this.sourceUrlInChrome[sourceURL] || {};
      scriptSource.sourceURL = sourceURL;
      scriptSource.localURL = sourceURL.substr(sourceURL.match(sourceExp)[0].length); // parse
      scriptSource.scriptId = data.scriptId;
      scriptSource.sourceMapURL = data.sourceMapURL;
      scriptSource.lineOffset = data.lineOffset;
      scriptSource.endLine = data.endLine;
      scriptSource.endColumn = data.endColumn;

      this.sourceUrlInChrome[sourceURL] = scriptSource;
      // console.log('_handleParsedScriptSource source:', arguments, sourceURL, scriptSource);
    } else {
      // Other private source script.
      // console.log('_handleParsedScriptSource private:', arguments, sourceURL, 'id=', data.scriptId)
    }
  },

  // Debugger.Event: scriptFailedToParse
  _handleFailedToParseScriptSource: function(event) {
    console.log('_handleFailedToParseScriptSource', arguments);
  },

  _handleGlobalObjectCleared: function(event) {
    console.log('_handleGlobalObjectCleared', arguments);
  },

  _handleCallFrameSelected: function(event) {
    console.log('_handleCallFrameSelected', arguments);
    var data = event.data;
    var callFrame = this._dataConverter.callFrame(data);
    if (callFrame) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.CallFrameSelected", callFrame);
    } else {
      console.error('_handleCallFrameSelected received invalid event data', data);
    }
  },

  _handleConsoleCommandEvaluatedInSelectedCallFrame: function() {
    console.log('_handleConsoleCommandEvaluatedInSelectedCallFrame', arguments);
  },

  _handleDebuggerDefault: function(event) {
    console.log('_handleDebuggerDefault', arguments);
  },

  _handleBreakpointAdded: function(event) {
    // console.log('_handleBreakpointAdded', arguments);
    var data = event.data;
    var breakpoint = this._dataConverter.breakpoint(data);
    if (breakpoint) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.BreakpointAdded", breakpoint);
    } else {
      console.error('_handleBreakpointAdded received invalid event data', data);
    }
  },

  _handleBreakpointRemoved: function(event) {
    // console.log('_handleBreakpointRemoved', arguments);
    var data = event.data;
    var breakpoint = this._dataConverter.breakpoint(data);
    if (breakpoint) {
      this._invokeHostIpc(WebInspector.WorkerBridge.Channels.ChannelSend, "Debugger.BreakpointRemoved", breakpoint);
    } else {
      console.error('_handleBreakpointRemoved received invalid event data', data);
    }
  },

  _handleBreakpointsActiveStateChanged: function(event) {
    var data = event.data;
    console.log(data);
  },

  __proto__: WebInspector.Object.prototype
}

WebInspector.workerBridge = new WebInspector.WorkerBridge();
