
window.XMLHttpRequest.prototype.open = (function(original) {
  const unmappedUrlPrefixes = [
    'thera_',
  ];
  return function(method, url, async, user, password) {
    let newUrl;
    for (let i = 0; i < unmappedUrlPrefixes.length; i++) {
      if (url.startsWith(unmappedUrlPrefixes[i]) ||
          url.startsWith('./' + unmappedUrlPrefixes[i])) {
        newUrl = url;
      }
    }
    if (!newUrl) {
      newUrl = '../vendors/devtools/front_end/' + url;
    }
    return original.call(this, method, newUrl, async, user, password);
  };
})(window.XMLHttpRequest.prototype.open);

// Originally defined in Runtime.js
window.loadScriptsPromise = (function(original) {
  return function(urls, base) {
    // Prevents the path to the current file to be prepended, so that
    // the overwritten XHR.open can properly prepend the new path prefix.
    const newBase = base === undefined ? './' : base;
    return original(urls, newBase);
  };
})(window.loadScriptsPromise);

// WebInspector.SourceMap indirectly needs this in order to load inline source maps.
window.InspectorFrontendHost = {
  loadNetworkResource(url, headers, streamId, callback) {
    const dataPrefix = 'data:application/json;base64,';
    if (url.startsWith(dataPrefix)) {
      const response = window.atob(url.slice(dataPrefix.length));
      window.WebInspector.Streams.streamWrite(streamId, response);
      callback({statusCode: 200});
    } else {
      callback({statusCode: 404});
    }
  },
};

window.Runtime.startApplication('thera_inspector');
