
/**
 * Converter chrome protocol format to IPC format.
 */
WebInspector.DataConverter = function() {

}

/**
 * @param {WebInspector.ConsoleMessage} data
 */
WebInspector.DataConverter.console = function(data) {
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
  // Redefine log level: according to js-framework
  var messageText = data.messageText || "";
  if (messageText.startsWith("jsLog")) {
    if (messageText.endsWith("__ERROR")) {
      log.level = "error";
    } else if (messageText.endsWith("__WARN")) {
      log.level = "warn";
    } else if (messageText.endsWith("__INFO")) {
      log.level = "notice";
    } else if (messageText.endsWith("__LOG")) {
      log.level = "debug"
    } else if (messageText.endsWith("__DEBUG")) {
      log.level = "debug";
    }
  }
  return log;
}

/**
 * @param {WebInspector.DOMNode} root
 */
WebInspector.DataConverter.dom = function(root) {
  var dom = null;
  // DOM Removed
  if (root.node && root.parent) {
    dom = WebInspector.DataConverter._convertDomTree(root.node);
    dom.parent = root.parent ? root.parent.id : -1;
  } else {
    // DOM Inserted / Document Updated
    dom = WebInspector.DataConverter._convertDomTree(root);
  }
  return dom;
}

/**
 * Construct dom recursively.
 * @param {WebInspector.DOMNode} root
 * @return {id, nodeName, nodeType, parent, previousSibling, nextSibling, children}
 */
WebInspector.DataConverter._convertDomTree = function(root) {
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
      var child = WebInspector.DataConverter._convertDomTree(children[i]);
      node.children.push(child);
    }
  }
  return node;
}

/**
 * @param {Map<string, string>} styleMap
 */
WebInspector.DataConverter.css = function(styleMap) {
  if (!styleMap) {
    return null;
  }
  retMap = {};
  for (var name of styleMap.keys()) {
    retMap[name] = styleMap.get(name);
  }
  return retMap;
}
