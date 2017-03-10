
module.exports.DebugCommand = {

  GetMatchedStylesForNode: "CSS.getMatchedStylesForNode",
  GetComputedStyleForNode: "CSS.getComputedStyleForNode",
  GetBoxModel: "DOM.getBoxModel",
  HighlightNode: "DOM.highlightNode",

  SetPauseOnExceptions: "Debugger.setPauseOnExceptions",
  SetBreakpointByUrl: "Debugger.setBreakpointByUrl",
  SetBreakpoint: "Debugger.setBreakpoint",
  RemoveBreakpoint: "Debugger.removeBreakpoint",
  Resume: "Debugger.resume",
  StepOver: "Debugger.stepOver",
  StepInto: "Debugger.stepInto",
  StepOut: "Debugger.stepOut",
  SelectCallFrame: "Debugger.selectCallFrame",
  GetProperties: "Runtime.getProperties",
  EvaluateOnSelectedCallFrame: "Debugger.evaluateOnSelectedCallFrame",
  Evaluate: "Runtime.evaluate"
}

module.exports.DebugEvent = {

  BreakpointAdded: "Debugger.BreakpointAdded",
  BreakpointRemoved: "Debugger.BreakpointRemoved",
  DebuggerPaused: "Debugger.DebuggerPaused",
  CallFrameSelected: "Debugger.CallFrameSelected",
  DebuggerResumed: "Debugger.DebuggerResumed",

  GetProperties: "Runtime.GetProperties",
  EvaluateOnSelectedCallFrame: "Debugger.EvaluateOnSelectedCallFrame",
  Evaluate: "Runtime.Evaluate",

  UISourceCodeAdded: "Workspace.UISourceCodeAdded",
  ParsedScriptSource: "Debugger.ParsedScriptSource"
}
