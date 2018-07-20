WebSocket.prototype.isOpen = async function () {
  for (let timeout = 30000; (!this.readyState && timeout); timeout--) {
    await wait(1);
    if (timeout === 1) console.error('WebSocket timed out.');
  }
  return 'Connected';
};

WebSocket.prototype.emit = async function (event, data, callback) {
  if (typeof event !== 'string') return;
  else if (typeof data === 'function') {
    callback = data;
    data = {};
  } else if (typeof callback !== 'function') callback = undefined;

  await this.isOpen();

  let req = {event, data};
  if (callback) req.callback = true;
  this.send(JSON.stringify(req));
  if (!callback) return;

  // Callback
  let socket = this;
  let cb = function () {
    callback.apply(null, arguments);
    delete socket.events[`callback-${event}`];
  };
  cb = cb.bind(cb);
  this.on(`callback-${event}`, cb);
};

WebSocket.prototype.on = function (setEvent, callback) {
  if (!this.events) this.events = {};
  if (typeof setEvent !== 'string') return {on: () => {throw new Error('Invalid event name')}};
  if (typeof callback !== 'function') return this;

  if (!this.onmessage) this.onmessage = eventObj => {
    let req = JSON.parse(eventObj.data), {data} = req, getEvent = req.event;
    let res = (data.args) ? data.args : [data];
    Object.keys(this.events).map(anEvent => {
      if (anEvent === getEvent) this.events[getEvent].apply(null, res);
    });
  };

  if (Object.keys(this.events).indexOf(setEvent) === -1) this.events[setEvent] = callback;
  return this;
};

var ws = new WebSocket('ws://localhost:3002');
