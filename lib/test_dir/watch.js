/* auto created by dumplings server with weex-devtool */

define('@weex-component/watch.we', function (require, exports, module) {

;
  var globalEvent = require('@weex-module/globalEvent');
  var mtop = require('@weex-module/mtop');

  module.exports = {
    data: function () {return {
      stubHeight: 400
    }},
    methods: {
      requestRemote: function() {
      	var self = this;
      	return;
      	mtop.send({
      		api: "mtop.tmall.coldsteel.assistant.updateSession",
      		v: "1.0",
      		param: {
      			"content": "m123_"
      		}
      	}, function (wxResponse) {
      		try {
      			wxResponse = self.safeParseJson(wxResponse);
      			wxResponse = wxResponse || {};
      			if (wxResponse.result === "WX_SUCCESS" || wxResponse.result == "MSG_SUCCESS") {
      				var mtopResponse = self.safeParseJson(wxResponse.data);
      				if (mtopResponse && true) {
	      				self.handleSuccess(mtopResponse);
	      				return;
      				}
      			}
      		} catch (e) {
      			console.log(e);
      		}
      		self.handleFailed();
      	});
	    },

  	  safeParseJson: function(param) {
  	  	if (param instanceof Object) {
  	  		return param;
  	  	}
    		try {
    			return JSON.parse(param);
    		} catch (e) {
    			console.log(e);
    		}
    		return null;
  	  },

  	  handleSuccess: function(response) {
  	  	this.stubHeight = 264;
  	  	console.log('handleSuccess', this.stubHeight, response);
  	  },

  	  handleFailed: function() {
  	  	this.stubHeight = 1;
  	  	console.log('handleFailed', this.stubHeight, response);
  	  }
    },

    created: function() {
    	var self = this;
      	globalEvent.addEventListener("oreo_did_refresh", function (e) {
            self.requestRemote();
        });
        self.requestRemote();
	},

	destroyed: function () {
		globalEvent.removeEventListener("oreo_did_refresh");
	}
  }


;module.exports.style = {
  "cell": {
    "marginTop": 10,
    "marginLeft": 10,
    "marginBottom": 10,
    "flexDirection": "row",
    "backgroundColor": "#ffffff"
  },
  "thumb": {
    "width": 200,
    "height": 200,
    "borderRadius": 30
  },
  "thumb-sub": {
    "width": 100,
    "height": 100,
    "marginLeft": 10
  },
  "thumb-stretch": {
    "resize": "stretch",
    "opacity": 0.5
  },
  "thumb-contain": {
    "resize": "contain",
    "opacity": 0.75
  },
  "thumb-cover": {
    "resize": "cover"
  },
  "title": {
    "textAlign": "center",
    "flex": 1,
    "color": "#808080",
    "fontSize": 50
  },
  "title-sub": {
    "width": 240
  },
  "title-sub1": {
    "fontSize": 28,
    "color": "#ff0000",
    "fontStyle": "normal",
    "fontWeight": "normal",
    "textDecoration": "underline",
    "textAlign": "left",
    "textOverflow": "ellipsis",
    "lines": 1
  },
  "title-sub2": {
    "fontSize": 26,
    "color": "#00ff00",
    "fontStyle": "italic",
    "fontWeight": "bold",
    "textAlign": "right",
    "textOverflow": "clip"
  },
  "title-sub3": {
    "fontSize": 24,
    "color": "#0000ff",
    "textDecoration": "line-through",
    "textAlign": "center",
    "textOverflow": "string"
  },
  "title-sub4": {
    "fontSize": 22,
    "color": "#ff00ff",
    "backgroundColor": "#aaaaaa"
  },
  "bar": {
    "backgroundColor": "#00ffff",
    "width": 100,
    "height": 220,
    "borderWidth": 10,
    "borderTopWidth": 4,
    "borderBottomWidth": 4,
    "borderColor": "#ff0000",
    "borderRightColor": "#0000ff",
    "borderRadius": 1
  }
}

;module.exports.template = {
  "type": "div",
  "style": {
    "height": function () {return this.stubHeight}
  },
  "children": [
    {
      "type": "div",
      "classList": [
        "cell"
      ],
      "children": [
        {
          "type": "image",
          "classList": [
            "thumb"
          ],
          "attr": {
            "src": "https://gw.alicdn.com/tps/TB1pFWCKFXXXXcuXVXXXXXXXXXX-720-1080.jpg"
          }
        },
        {
          "type": "div",
          "style": {
            "marginLeft": 20,
            "marginRight": 20,
            "padding": 5,
            "borderWidth": 10
          },
          "children": [
            {
              "type": "text",
              "classList": [
                "title"
              ],
              "attr": {
                "value": "W大标题"
              }
            },
            {
              "type": "text",
              "classList": [
                "title-sub",
                "title-sub1"
              ],
              "attr": {
                "value": "很长的Weex标题很长的Weex标题很长的标题"
              }
            },
            {
              "type": "text",
              "classList": [
                "title-sub",
                "title-sub2"
              ],
              "attr": {
                "value": "标题Sub2"
              }
            },
            {
              "type": "text",
              "classList": [
                "title-sub",
                "title-sub3"
              ],
              "attr": {
                "value": "标题Sub3"
              }
            },
            {
              "type": "text",
              "classList": [
                "title-sub",
                "title-sub4"
              ],
              "attr": {
                "value": "标题Sub4"
              }
            }
          ]
        },
        {
          "type": "div",
          "classList": [
            "bar"
          ],
          "children": [
            {
              "type": "text",
              "style": {
                "marginTop": 20
              },
              "attr": {
                "value": "Thera"
              }
            }
          ]
        }
      ]
    },
    {
      "type": "div",
      "style": {
        "flexDirection": "row"
      },
      "children": [
        {
          "type": "image",
          "classList": [
            "thumb-sub"
          ],
          "attr": {
            "src": "https://gw.alicdn.com/tps/TB15WGuOVXXXXa.XXXXXXXXXXXX-375-185.png"
          }
        },
        {
          "type": "image",
          "classList": [
            "thumb-sub",
            "thumb-stretch"
          ],
          "attr": {
            "src": "https://gw.alicdn.com/tps/TB15WGuOVXXXXa.XXXXXXXXXXXX-375-185.png"
          }
        },
        {
          "type": "image",
          "classList": [
            "thumb-sub",
            "thumb-contain"
          ],
          "attr": {
            "src": "https://gw.alicdn.com/tps/TB15WGuOVXXXXa.XXXXXXXXXXXX-375-185.png"
          }
        },
        {
          "type": "image",
          "classList": [
            "thumb-sub",
            "thumb-cover"
          ],
          "attr": {
            "src": "https://gw.alicdn.com/tps/TB15WGuOVXXXXa.XXXXXXXXXXXX-375-185.png"
          }
        }
      ]
    }
  ]
}

;})

// require module
bootstrap('@weex-component/watch.we', {"transformerVersion":"0.3.1"})