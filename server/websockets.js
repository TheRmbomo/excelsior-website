// const mongoose = require('mongoose');
const validator = require('validator');

const ws = require('./ws');
const {User} = require('./models/user');
const {Path} = require('./models/path');

ws.on('connection', socket => {
  socket.on('searchUser', (name, send) => {
    // send is callback, sends back to client
    if (!name) return send([{error: 'Please enter a name.'}]);
    User.find({name: new RegExp('^'+name, 'i')})
      .then(users => send(users))
      .catch(e => console.log(e));
  });

  socket.on('show_more', (req, send) => {
    let content = [];
    let page = req.page;
    let status = 'next';
    Path.findById(req.path).then(path => {
      if (!path) return Promise.reject({status: 'last'});
      let first = 10*page, last = first + 9;
      page++;
      for (let i=first; i<last; i++) {
        if (i === path.content.length) {
          status = 'last';
          break;
        }
        content.push(path.content[i]);
      }
      send({status, page, content});
    }).catch(error => send(error));
  });

  socket.on('get_resource', async (resource, send) => {
    let request = await (resource ? Path.findById(resource.pathid) : Path.find()).catch(e => console.log(e));
    if (!request) return send({error: 'Resource not found.'});
    if (resource) request = request.content;
    let desiredPropertyList = ['name', 'description', 'url'];
    let properties = [];
    request.map(resource => {
      let object = [];
      Object.keys(resource['_doc']).map(property => {
        if (desiredPropertyList.indexOf(property) !== -1) {
          let formatname;
          switch (property) {
            case 'name':
            formatname = 'Name';
            break;
            case 'description':
            formatname = 'Description';
            break;
            case 'url':
            formatname = 'URL';
            break;
          }
          object.push({name: property, formatname, value: resource[property]});
        }
      });
      properties.push(object);
    });
    let iteminfo = request.map((item, i) => {
      return {id: item._id, properties: properties[i]};
    });
    let response = {iteminfo};
    if (resource) Object.assign(response, {type: 'resource'});
    else Object.assign(response, {type: 'path'});
    send(response);
  });

  socket.on('create_path', (pathinfo, send) => {
    let {name, description} = pathinfo;
    let newpath = new Path({name, description});
    newpath.save().then(() => {
      send({type: 'path'});
    }).catch(error => {
      error.type = "path";
      send(error);
    });
  });

  socket.on('create_resource', async (pathinfo, send) => {
    let {name, url, id} = pathinfo;
    url = validateURL(url);
    let errors = {}
    if (url.error) {
      Object.assign(errors, url.error);
      return send({errors, type: 'resource'});
    }
    let path = await Path.findById(id);
    try {
      path.content.push({name, url});
      await path.save();
      send({type: 'resource'});
    } catch (error) {
      error.type = "resource";
      send(error);
    }
  });

  socket.on('edit_resource', (req, send) => {
    let update = {};
    req.update.map(property => {
      switch (property.name) {
        case 'name':
        update.name = validateString(property.value, 'name');
        break;
        case 'description':
        update.description = validateString(property.value, 'description');
        break;
        case 'url':
        update.url = validateURL(property.value);
        break;
      }
    });
    let errors = {};
    Object.keys(update).map(property => {
      if (update[property].error) {
        errors[property] = update[property].error[property];
      }
    });
    if (Object.keys(errors).length) return send({errors, type: req.type, id: req.id});
    let id = req.id, search;
    if (req.type === 'path') search = {'_id': id};
    else {
      let pathid = req.pathid;
      search = {'_id': pathid, 'content._id': id};
      update._id = id;
      update = {'content.$': update};
    }
    Path.findOneAndUpdate(search, {
      $set: update
    }).then(() => {
      send({type: req.type});
    }).catch(error => send({error}));
  });

  socket.on('delete_path', (path, send) => {
    let remove = id => Path.findByIdAndRemove(id).then(removedpath => {
      if (!removedpath) return Promise.reject('Path was not found.');
      send({type: 'path'});
    }).catch(error => send({error}));

    if (path.ids) path.ids.map(id => remove(id));
    else remove(path.id);
  });

  socket.on('delete_resource', (req, send) => {
    let matchIds = (req.ids) ? {$in: req.ids} : req.id;
    Path.update({'_id': req.pathid},{
      $pull: {content: {'_id': matchIds}}
    }).then(() => {
      send({type: 'resource'});
    }).catch(error => send({error}));
  });

  // socket.say('any', {});
});
