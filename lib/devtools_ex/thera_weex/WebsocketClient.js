/**
 * Created by godsong on 16/6/14.
 */
var EventEmitter = require('./EventEmitter.js');

function WebsocketClient(url) {
    this.connect(url);
}
WebsocketClient.prototype = {
    constructor: WebsocketClient,
    connect: function (url) {
        var This = this;
        This.isSocketReady = false;
        This._sended = [];
        This._received = [];
        if (This.ws) {    // 关闭前一次连接
            This.ws.onopen = null;
            This.ws.onmessage = null;
            This.ws.onclose = null;
            if (This.ws.readyState == WebSocket.OPEN) {
                This.ws.close();
            }

        }
        var ws = new WebSocket(url);  // 新建连接
        This.ws = ws;
        ws.onopen = function () {
            This.isSocketReady = true;
            This.emit('socketOpened');    // Websocket ready 通知
        };
        ws.onmessage = function (e) {
            console.log("#debugger#" + JSON.stringify(e));
            var message = JSON.parse(e.data);
            if (message.method) {
                This.emit(message.method, message); // 消息分发
            }
        };
        ws.onclose = function () {
            This.isSocketReady = false;
            /* setTimeout(function(){
             This.connect(url);
             },800);*/
        };

    },
    send: function (data) {     // 发送ws消息
        console.log("#debugger# " + JSON.stringify(data));
        if (this.isSocketReady) {
            this.ws.send(JSON.stringify(data));
        }
        else {
            this.once('socketOpened', function () { // 订阅 WebSocket ready
                this.ws.send(JSON.stringify(data))
            }.bind(this));
        }
    }

};
WebsocketClient.prototype.__proto__ = new EventEmitter(); // 继承于 EventEmitter

module.exports = WebsocketClient;
