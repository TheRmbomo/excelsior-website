var address = 'ws://192.168.1.223:3000'

WebSocket.prototype.emit = function (event, data, callback) {
  if (typeof event !== 'string') return
  else if (typeof data === 'function') {
    callback = data
    data = {}
  } else if (typeof callback !== 'function') callback = undefined

  var req = {event, data}, promise = Promise.resolve()
  if (callback) req.callback = true
  if (ws.readyState !== 1) promise = promise.then(() => new Promise(resolve => {
    let interval = setInterval(() => {
      if (ws.available) return resolve(clearInterval(interval))
    }, 50)
  }))
  promise.then(() => ws.send(JSON.stringify(req))).catch(e => console.log(e))
  if (!callback) return
  
  // Callback
  ws.on(`callback-${event}`, function () {
    callback.apply(null, arguments)
    delete ws.events[`callback-${event}`]
  })
};

WebSocket.prototype.on = function (setEvent, callback) {
  if (typeof setEvent !== 'string') return {on: () => {throw new Error('Invalid event name')}}
  if (typeof callback !== 'function') return this
  if (!this.events) {
    return {on: () => {console.error('Unable to create event'); return this}}
  }

  if (Object.keys(this.events).indexOf(setEvent) === -1) this.events[setEvent] = callback
  // console.dir(Object.keys(ws.events).join(','));
  // console.dir(Object.values(ws.events).join(','));

  return this
}

var ws = new WebSocket(address)
ws.events = {}
ws.onopen = function onopen() {
  ws.onmessage = eventObj => {
    if (eventObj.data === 'pong') return this.available = true
    try {
      var req = JSON.parse(eventObj.data), {data} = req, getEvent = req.event,
      res = (data.args) ? data.args : [data]
    } catch (e) {return}
    Object.keys(this.events).map(anEvent => {
      if (anEvent === getEvent) this.events[getEvent].apply(this, res)
    })
  }
  ws.onclose = () => {
    var interval = setInterval(() => {
      if (ws.readyState === 0) return
      if (ws.readyState === 1) return clearInterval(interval)

      let oldWs_events = ws.events
      ws = new WebSocket(address)
      ws.events = oldWs_events
      ws.onopen = onopen
    }, 50)
  }
  new Promise(resolve => {
    let interval = setInterval(() => {
      if (this.readyState !== 1) return
      if (this.available) return resolve(clearInterval(interval))
      ws.send('ping')
    }, 50)
  })
}
