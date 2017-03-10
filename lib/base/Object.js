
TheDebugger.Object = function() {

}

TheDebugger.Object.prototype = {

    addEventListener: function(eventType, listener, thisObject) {

        if (!this._listeners) {
            this._listeners = new Map();
        }
        if (!this._listeners.has(eventType)) {
            this._listeners.set(eventType, []);
        }
        this._listeners.get(eventType).push({ thisObject: thisObject, listener: listener });
        return new TheDebugger.EventTarget.EventDescriptor(this, eventType, thisObject, listener);
    },

    removeEventListener: function(eventType, listener, thisObject) {

        if (!this._listeners || !this._listeners.has(eventType)) {
            return;
        }

        var listeners = this._listeners.get(eventType);
        for (var i = 0; i < listeners.length; ++i) {
            if (listeners[i].listener === listener && listeners[i].thisObject === thisObject)
                listeners.splice(i--, 1);
        }

        if (!listeners.length)
            this._listeners.delete(eventType);
    },

    removeAllListeners: function() {
        delete this._listeners;
    },

    hasEventListeners: function(eventType)
    {
        return this._listeners && this._listeners.has(eventType);
    },

    dispatchEventToListeners: function(eventType, eventData)
    {
        if (!this._listeners || !this._listeners.has(eventType))
            return false;

        var event = new TheDebugger.Event(this, eventType, eventData);
        var listeners = this._listeners.get(eventType).slice(0);
        for (var i = 0; i < listeners.length; ++i) {
            listeners[i].listener.call(listeners[i].thisObject, event);
            if (event._stoppedPropagation)
                break;
        }

        return event.defaultPrevented;
    }
}

/**
 * @constructor
 * @param {!TheDebugger.EventTarget} target
 * @param {string|symbol} type
 * @param {*=} data
 */
TheDebugger.Event = function(target, type, data)
{
    this.target = target;
    this.type = type;
    this.data = data;
    this.defaultPrevented = false;
    this._stoppedPropagation = false;
}

TheDebugger.Event.prototype = {
    stopPropagation: function()
    {
        this._stoppedPropagation = true;
    },

    preventDefault: function()
    {
        this.defaultPrevented = true;
    },

    /**
     * @param {boolean=} preventDefault
     */
    consume: function(preventDefault)
    {
        this.stopPropagation();
        if (preventDefault)
            this.preventDefault();
    }
}

/**
 * @interface
 */
TheDebugger.EventTarget = function()
{
}

/**
 * @param {!Array<!TheDebugger.EventTarget.EventDescriptor>} eventList
 */
TheDebugger.EventTarget.removeEventListeners = function(eventList)
{
    for (var i = 0; i < eventList.length; ++i) {
        var eventInfo = eventList[i];
        eventInfo.eventTarget.removeEventListener(eventInfo.eventType, eventInfo.method, eventInfo.receiver);
    }
    // Do not hold references on unused event descriptors.
    eventList.splice(0, eventList.length);
}

TheDebugger.EventTarget.prototype = {
    /**
     * @param {string|symbol} eventType
     * @param {function(!TheDebugger.Event)} listener
     * @param {!Object=} thisObject
     * @return {!TheDebugger.EventTarget.EventDescriptor}
     */
    addEventListener: function(eventType, listener, thisObject) { },

    /**
     * @param {string|symbol} eventType
     * @param {function(!TheDebugger.Event)} listener
     * @param {!Object=} thisObject
     */
    removeEventListener: function(eventType, listener, thisObject) { },

    removeAllListeners: function() { },

    /**
     * @param {string|symbol} eventType
     * @return {boolean}
     */
    hasEventListeners: function(eventType) { },

    /**
     * @param {string|symbol} eventType
     * @param {*=} eventData
     * @return {boolean}
     */
    dispatchEventToListeners: function(eventType, eventData) { },
}

TheDebugger.EventTarget.EventDescriptor = function(eventTarget, eventType, receiver, method)
{
    this.eventTarget = eventTarget;
    this.eventType = eventType;
    this.receiver = receiver;
    this.method = method;
}
