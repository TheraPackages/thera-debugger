
 /**
  * Bridge running on worker side.
  * ipcRenderer.sendToHost(channel[, arg1][, arg2][, ...])
  * ipcRenderer.on(channel, listener)
  */
WebInspector.WorkerBridge = function() {

  this._ipcRenderer = require('electron').ipcRenderer;
  this._dataConverter = WebInspector.DataConverter;

  // Send message from worker to host.
  this._channelSend = "thera_inspector";
  // Console Domain
  WebInspector.targetManager.addModelListener(WebInspector.ConsoleModel, WebInspector.ConsoleModel.Events.MessageAdded, this._handleConsoleMessageAdded, this);
  // DOM Domain
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.DocumentUpdated, this._handleDocumentUpdated, this);
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.DOMMutated, this._handleDOMMutated, this);      // DOM树有变更时
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.NodeInserted, this._handleNodeInserted, this);  // 增加子节点
  WebInspector.targetManager.addModelListener(WebInspector.DOMModel, WebInspector.DOMModel.Events.NodeRemoved, this._handleNodeRemoved, this);    // 删除子节点
  // Debugger Domain
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasEnabled, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasDisabled, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.BeforeDebuggerPaused, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerPaused, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerResumed, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.ParsedScriptSource, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.FailedToParseScriptSource, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.GlobalObjectCleared, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.CallFrameSelected, this._handleDebuggerDefault, this);
  WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.ConsoleCommandEvaluatedInSelectedCallFrame, this._handleDebuggerDefault, this);
  // Source
  WebInspector.workspace.addEventListener(WebInspector.Workspace.Events.UISourceCodeAdded, this._handleUISourceCodeAdded, this);
  // Breakpoint
  WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointAdded, this._handleBreakpointAdded, this);
  WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointRemoved, this._handleBreakpointRemoved, this);

  // Recv message from host.
  this._channelRecv = "thera_command";
  this._hostCommandHandlers = {
    "DOM.getBoxModel": this._domGetBoxModel.bind(this),
    "CSS.getMatchedStylesForNode": this._cssGetMatchedStylesForNode.bind(this),
    "CSS.getComputedStyleForNode": this._cssGetComputedStyleForNode.bind(this),
    "DOM.highlightNode": this._highlightNode.bind(this),
    "Debugger.setBreakpointByUrl": this._setBreakpointByUrl.bind(this),
    "Debugger.removeBreakpoint": this._removeBreakpoint.bind(this),
    "Debugger.stepOver": this._stepOver.bind(this),
    "Debugger.stepInto": this._stepInto.bind(this),
    "Debugger.stepOut": this._stepOut.bind(this),
    "Debugger.resume": this._resume.bind(this)
  }
  this._ipcRenderer.on(this._channelRecv, this._handleHostCommand.bind(this));
}

WebInspector.WorkerBridge.prototype = {

  getDOMModel: function() {
    var mainTarget = WebInspector.targetManager.mainTarget();
    return WebInspector.DOMModel.fromTarget(mainTarget);
  },

  getCSSModel: function() {
    var mainTarget = WebInspector.targetManager.mainTarget();
    return WebInspector.CSSModel.fromTarget(mainTarget);
  },

  getDebuggerModel: function() {
    var mainTarget = WebInspector.targetManager.mainTarget();
    return WebInspector.DebuggerModel.fromTarget(mainTarget);
  },

  /**
   * Send information from worker to host via ipcRenderer.
   */

  _invokeHostIpc: function(channel, action, params) {
    this._ipcRenderer.sendToHost(channel, action, params);
  },

  _handleConsoleMessageAdded: function(event) {
    var data = event.data;
    var log = this._dataConverter.console(data);
    this._invokeHostIpc(this._channelSend, "Console.MessageAdded", log);
  },

  /** Whole document updated. */
  _handleDocumentUpdated: function(event) {
    var domModel = event.target;  /** @type {!WebInspector.DOMModel} */
    var document = event.data;    /** @type {?WebInspector.DOMDocument} */
    this._printDomTree(document);
    var doc = this._dataConverter.dom(document);
    this._invokeHostIpc(this._channelSend, "DOM.DocumentUpdated", doc);
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
    this._invokeHostIpc(this._channelSend, "DOM.NodeInserted", dom)
  },

  /** Sub dom removed. */
  _handleNodeRemoved: function(event) {
    var domModel = event.target;
    var node = event.data;  // Node diff, parentNode
    console.log('Child node removed.');
    this._printDomTree(node.node);
    var dom = this._dataConverter.dom(node);
    this._invokeHostIpc(this._channelSend, "DOM.NodeRemoved", dom);
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
   * Handle commands from host side.
   * @param eventEmitter
   * @param {string} command
   * @param {Object} params
   */
  _handleHostCommand: function(eventEmitter, command, params) {
    // console.log(arguments);
    if (this._hostCommandHandlers[command]) {
      this._hostCommandHandlers[command].apply(this, [params]);
    } else {
      console.log("Unknow host command: " + command, params);
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
          this._invokeHostIpc(this._channelSend, "DOM.getBoxModel", boxModel);
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
          this._invokeHostIpc(this._channelSend, "CSS.getComputedStyleForNode", styles);
        }
      );
    }
  },

  _highlightNode: function(nodeId) {
    var domModel = this.getDOMModel();
    if (domModel && domModel.nodeForId(nodeId)) {

    }
  },

  _handleDebuggerDefault: function(event) {
    console.log(event);
  },

  _handleParsedScriptSource: function(event) {

  },

  /**
   *  params = {
   *    lineNumber: integer,
   *    url: string,
   *    columnNumber: integer,
   *  }
   *  return = {
   *    breakpointId: BreakpointId (stringUrl:line:col)
   *    locations: []
   *  }
   */
  _setBreakpointByUrl: function(breakpoint) {
    console.log(arguments);
    var url = breakpoint.url;
    var lineNumber = breakpoint.lineNumber;
    var columnNumber = breakpoint.columnNumber;
    var condition = breakpoint.condition || '';
    WebInspector.breakpointManager.setBreakpoint(url, lineNumber, columnNumber, condition, true);
  },

  _removeBreakpoint: function(params) {
    console.log(arguments);
  },

  _stepOver: function() {
    var debuggerModel = getDebuggerModel();
    // debuggerModel.stepOver();
  },

  _stepInto: function() {
    var debuggerModel = getDebuggerModel();
    // debuggerModel.setpInto();
  },

  _stepOut: function() {
    var debuggerModel = getDebuggerModel();
    // debuggerModel.stepOut();
  },

  _resume: function() {
    var debuggerModel = getDebuggerModel();
    // debuggerModel.resume();
  },

  _handleUISourceCodeAdded: function() {
    console.log(arguments)
  },

  _handleBreakpointAdded: function() {
    console.log(arguments);
  },

  _handleBreakpointRemoved: function() {
    console.log(arguments);
  },

  __proto__: WebInspector.Object.prototype
}


WebInspector.workerBridge = new WebInspector.WorkerBridge();
