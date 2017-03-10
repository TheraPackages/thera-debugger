
// const vm = require('vm');
// const url = require('url');
const child_process = require('child_process');

self = {}
argv = process.argv;  // [AppBin, entryJs, args]
self.host = argv[2];
self.other = argv[3];

/**
 * Adapt WebWorker api.
 */
postMessage = function(message) {
  process.send(message);
}

/**
 * Synchronous request remote script from same domain and eval immediately.
 */
importScripts = function(url) {
  var cmd = `curl "http://${self.host}${url}"`;
  var script = child_process.execSync(cmd);
  eval(script);
}

/**
 * Weex Runtime. Adopted from weex-devtool package.
 */
self.$$frameworkFlag={};
var injectedGlobals = [
    'Promise',
    // W3C
    'window',
    'global',
    'screen',
    'document',
    'navigator',
    'location',
    'fetch',
    'Headers',
    'Response',
    'Request',
    'URL',
    'URLSearchParams',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'alert',
    // ModuleJS
    'define',
    'require',
    // Weex
    'bootstrap',
    'register',
    'render',
    '__d',
    '__r',
    '__DEV__',
    '__weex_define__',
    '__weex_require__',
    '__weex_viewmodel__',
    '__weex_document__',
    '__weex_bootstrap__',
    '__weex_options__',
    '__weex_data__',
    '__weex_downgrade__'
];
EventEmitter = require('../lib/EventEmitter.js');
// 这里importScripts动态eval的结果，方法不会添加到global域内，Runtime构造不起来
require('./js-framework.js');
function createWeexBundleEntry(sourceUrl){
    var code='';
    if(self.$$frameworkFlag[sourceUrl]){
        code+=self.$$frameworkFlag[sourceUrl]+'\n';
    }
    code+='__weex_bundle_entry__(';
    injectedGlobals.forEach(function(g,i){
        if(g==='location'||g==='navigator'){
            code+='typeof '+g+'==="undefined"||'+g+'===self.'+g+'?undefined:'+g;
        }
        else{
            code+='typeof '+g+'==="undefined"?undefined:'+g;
        }

        if(i<injectedGlobals.length-1){
            code+=',';
        }

    });
    code+=');';
    return code;
}
// @me
// var clearConsole = self.console.clear.bind(self.console);
self.__WEEX_DEVTOOL__=true;
var eventEmitter = new EventEmitter();
// 接收主进程消息 @me
// onmessage = function (message) {
//     eventEmitter.emit(message.data.method, message.data)
// };
// Format of process message is different from WebWork.
process.on('message', function(message) {
  eventEmitter.emit(message.method, message);
});

callNative = function (instance, tasks, callback) {
    for(var i=0;i<tasks.length;i++){
        var task=tasks[i];
        if(task.method=='addElement'){
            for(var key in task.args[1].style){
                if(Number.isNaN(task.args[1].style[key])){
                    console.error('invalid value [NaN] for style ['+key+']',task);
                    //task.args[1].style[key]=0;
                }
            }
        }
    }
    postMessage({
        method: 'WxDebug.callNative',
        params: {
            instance: instance,
            tasks: tasks,
            callback: callback
        }
    })
};
callAddElement = function(instance, ref, dom, index, callback){
    postMessage({
        method: 'WxDebug.callAddElement',
        params: {
            instance: instance,
            ref: ref,
            dom:dom,
            index:index,
            callback: callback
        }
    })
};
__logger = function (level, msg) {
    console[level]('native:', msg);
};
nativeLog = function (text) {
    console.log(text);
};
eventEmitter.on('WxDebug.initJSRuntime', function (message) {
    // importScripts(message.params.url); // @me
    for (var key in message.params.env) {
        if(message.params.env.hasOwnProperty(key)) {
            self[key] = message.params.env[key];
        }
    }
});
eventEmitter.on('WxDebug.changeLogLevel', function (message) {
    self.WXEnvironment.logLevel = message.params;
});
eventEmitter.on('Console.messageAdded', function (message) {
    console.error('[Native Error]', message.params.message.text);
});
var instanceMap = {};
eventEmitter.on('WxDebug.callJS', function (data) {
    var method = data.params.method;
    if (method === 'createInstance') {
        var url = data.params.sourceUrl;
        postMessage({
            method: 'WxRuntime.clearLog',
        });
        importScripts(url);
        createInstance(data.params.args[0], createWeexBundleEntry(url), data.params.args[2], data.params.args[3]);
        instanceMap[data.params.args[0]] = true;
    }
    else if (method === 'destroyInstance') {
        if (instanceMap[data.params.args[0]]) {
            destroyInstance(data.params.args[0]);
            delete instanceMap[data.params.args[0]];
        }
        else {
            console.warn('invalid destroyInstance[' + data.params.args[0] + '] because runtime has been refreshed(It does not impact your code. )');
        }
    }
    else {
      // console.log(data);
        // self[data.params.method].apply(null, data.params.args);
    }
});

function dump(id) {
    postMessage({
        method: 'WxRuntime.dom',
        params: getRoot(id)
    })
}
