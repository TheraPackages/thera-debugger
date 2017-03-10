/**
 * Created by godsong on 16/6/29.
 */

function EventEmitter() {
    this._handlers = {};
}
EventEmitter.prototype = {
    constructor: EventEmitter,
    off: function (method, handler) {
        if (handler) {
            for (var i = 0; i < this._handlers[method].length; i++) {
                if (this._handlers[method][i] === handler) {
                    this._handlers[method].splice(i, 1);
                    i--;
                }
            }
        }
        else {
            this._handlers[method] = [];
        }
    },
    once: function (method, handler) {        //
        var self = this;
        var fired = false;

        function g() {
            self.off(method, g);
            if (!fired) {
                fired = true;
                handler.apply(self, Array.prototype.slice.call(arguments));
            }
        }

        this.on(method, g);
    },
    on: function (method, handler) {            // 订阅事件
        if (this._handlers[method]) {
            this._handlers[method].push(handler);
        }
        else {
            this._handlers[method] = [handler];
        }
    },

    _emit: function (method, args, context) {   // 具体分发事件
        var handlers = this._handlers[method];
        if (handlers && handlers.length > 0) {  // 向on订阅的handler分发事件
            handlers.forEach(function (handler) {
                handler.apply(context, args)
            });
            return true;
        }
        else {
            return false;
        }
    },

    emit: function (method) {       // 分发事件的接口
        var context = {};
        var args = Array.prototype.slice.call(arguments, 1);  // 参数部分
        if (!this._emit(method, args, context)) { // 如果具体的method没有订阅handler
            this._emit('*', args, context)        // 就分发给*
        }
        this._emit('$finally', args, context);
        return context;
    }
};

// 同时提供给 Debugger.js 和 Worker 里的 Runtime.js 使用，worker环境里没有module
if (typeof module === "undefined") {
  module = {};
}

module.exports = EventEmitter;
