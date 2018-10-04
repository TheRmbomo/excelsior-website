let creator = {
  two: new Two({
    fullscreen: true
  }).appendTo(_id('canvas')),
  header: _query('header')[0],
  isOpen: {
    resourceMenu: 'closed',
    header: 'closed'
  },
  view: new Two.Group(),
  hud: new Two.Group(),
  resourceGroups: new Two.Group(),
  resources: new Two.Group(),
  arrows: new Two.Group()
  ,sized: {
    array: [],
    push: function(...e) {
      e.map(e => {
        if (this.array.indexOf(e) === -1) this.array.push(e)
        e[0].stopsize = () => this.array.splice(this.array.indexOf(e), 1)
      })
      tb.resize()
      return this
    }
  }
  ,resize: () => {
    tb.sized.array.map(obj => {
      var element = obj[0]
      Object.keys(obj[1]).map(k => {
        element[k] = obj[1][k]()
      })
    })
  }
  ,resourceMenu: {
    data: {
      get width() {
        var v = Math.min(500,window.innerWidth/2-20)
        try {
          creator.resourceMenu.body.width = v
        }
        catch {}
        return v
      }
      ,get height() {return creator.two.height-40}
    }
  }
}
loadTwoUtils(creator)

window.addEventListener('resize', event => {
  var {two} = creator
  setTimeout(() => {
    creator.isOpen.resourceMenu = 'closed'
    creator.isOpen.header = 'closed'
    // console.log('creator.resourceMenu.width', creator.resourceMenu.width)
    // creator.resourceMenu.width = Math.min(500,window.innerWidth/2-20)

    var capWidth = Math.max(two.width, 500), capHeight = Math.max(two.height, 500)
    creator.background.width = capWidth
    creator.background.height = capHeight
    creator.background.translation.set(capWidth/2, capHeight/2)
    creator.resourceMenu.translation.set(two.width, two.height/2)
    creator.resourceMenu.body.height = two.height-40
    if (debug) console.log('Change for scrolling');
    // creator.resourceMenu.results.translation.y = -two.height/2+100
    creator.headerMenu.open.translation.set(two.width - 60, 10)
    creator.isOpen.header = 'closed'
    creator.header.style.display = ''
    creator.header.style.top = `${-creator.headerHeight}px`
  })
})

;(() => {
  var {
    two, getDOM, view, hud,
    header,
    resourceGroups, resources, arrows
  } = creator
  header.classList.remove('hidden')
  creator.headerHeight = getComputedStyle(header).height
  header.style.top = '-' + creator.headerHeight
  header.classList.add('hidden')
  creator.canvas = two.renderer.domElement

  creator.pathURL = _id('url').innerText
  var headerDIV = header.children[0].children[0],
  backCell = document.createElement('DIV'),
  backLink = document.createElement('A'),
  backButton = document.createElement('BUTTON'),
  backText = document.createTextNode('Back to Path'),
  spacer = document.createElement('DIV')
  headerDIV.children[0].style.width = '3em'
  backCell.classList.add('td')
  backLink.href = creator.pathURL
  backButton.style.minWidth = '4.5em'
  backButton.appendChild(backText)
  backLink.appendChild(backButton)
  backCell.appendChild(backLink)
  headerDIV.insertBefore(spacer, headerDIV.children[1])
  headerDIV.insertBefore(backCell, headerDIV.children[1])

  var background = new Two.Rectangle(
    Math.max(two.width, 500)/2,
    Math.max(two.height, 500)/2,
    Math.max(two.width, 500),
    Math.max(two.height, 500)
  )
  two.scene.zoom = 0
  two.inertia = {
    resistance: 10,
    minSpeed: 150,
    endSpeed: 100
  }
  two.sceneScale = 1
  view._matrix.manual = true
  creator.background = background
  background.fill = '#99A'
  background.name = 'scene'

  resourceGroups.name = 'resourceGroups'
  resources.name = 'resourceList'
  arrows.name = 'arrows'
  resourceGroups.add([arrows, resources])
  two.scene.add([view, hud])
  getDOM(hud).catch(e => console.error(e))

  var loading = new Two.Text('Loading...', two.width/2, (two.height-40)/2, {
    size: 60, fill: '#FFF', family: 'Cabin, sans-serif'
  })
  hud.add(loading)
  getDOM(loading).then(e => e.style.cursor = 'default').catch(e => null)
  hud.loading = loading

  view.add(background)
  Object.assign(view, {
    v: new Two.Vector(0, 0),
    v0: new Two.Vector(0, 0)
  })
  resourceGroups.addTo(view).translation.set(100,100)
  getDOM(background)
})()

creator.mouse = Object.assign(creator.mouse || {}, {
  start: (element, listener, passive) => {
    if (passive !== undefined) var opt = {passive}
    element.addEventListener('mousedown', listener)
    element.addEventListener('touchstart', listener, opt)
  },
  end: (element, listener, passive) => {
    if (passive !== undefined) var opt = {passive}
    element.addEventListener('click', listener)
    element.addEventListener('touchend', event => {
      if (event.target !== element) return
      listener(event)
    }, opt)
  },
  down: event => {
    event.preventDefault()
    var {two, view} = creator,
    targetT = event.target.two,
    canDrag = event.target === creator.canvas || (targetT && targetT.name === 'scene')
    handleContextMenu = () => {
      if (targetT && creator.contextMenu) {
        if (targetT === creator.contextMenu.body || targetT.name === 'cmOption') {
          return
        }
      }
      if (creator.contextMenu) {
        creator.contextMenu.parent.remove(creator.contextMenu)
        delete creator.contextMenu
      }
    },
    leftButton = () => {
      view.v.clear()
      view.v0.clear()
      creator.mouse.events({
        move: page => view.v0.copy(view.v.addSelf(page).subSelf(two.mouse)),
        up: () => {
          var lambda = two.inertia.resistance,
          velocity = view.v,
          velocity_0 = view.v0,
          speed = velocity_0.length() * 60

          if (speed < two.inertia.minSpeed) return

          view.inertiaDur = -Math.log(two.inertia.endSpeed / speed) / lambda
          view.lambda_v0 = lambda / speed
          view.one_ve_v0 = Math.max(1 - two.inertia.endSpeed / speed, 0.8)
          animate(duration => {
            if (two.is_moving) return
            duration /= 1000
            var amount = (Math.exp(-lambda * duration) - view.lambda_v0) / view.one_ve_v0
            velocity.addSelf(velocity_0.multiplyScalar(amount))
            if (duration < view.inertiaDur) return true
          })
        }
      })
    },
    rightButton = () => {
      if (!event.touches) var page = {x: event.pageX, y: event.pageY}
      else var page = {x: event.touches[0].pageX, y: event.touches[0].pageY}
      creator.createContextMenu({
        options: [
          ['home', 'Reset View']
        ], parent: creator.hud, v: page,
        gotDOM: elements => {
          var {home} = elements
          creator.mouse.start(home, event => {
            var m_elements = creator.view._matrix.elements
            var v = {x: m_elements[2]/m_elements[0], y: m_elements[5]/m_elements[4]}
            creator.view._matrix.translate(-v.x, -v.y)
            creator.view.translation.set(m_elements[2], m_elements[5])
          })
        }
      })
      if (creator.contextMenu) creator.mouse.events({
        move: page => creator.contextMenu.translation.copy(page).addSelf({
          x: creator.contextMenu.width/2,
          y: creator.contextMenu.height/2
        })
      })
    }

    if (canDrag || event.button === 0 || event.touches) handleContextMenu()
    if (canDrag) {
      if (event.touches || event.button === 0) leftButton()
      if (event.button === 2) rightButton()
      if (event.touches) creator.mouse.countTouch(window, 0).then(n => {
        if (n > 1) rightButton()
      })
    }
  },
  redirect: target => event => {
    target.dispatchEvent(new MouseEvent(event.type, event))
  },
  countTouch: (element, time) => {
    element.touches++
    clearTimeout(element.touchInterval)
    return new Promise(resolve => {
      element.touchInterval = setTimeout(() => {
        var {touches} = element
        resolve(touches)
        element.touches = 0
      }, time || 500)
    })
  }
})
window.addEventListener('mousewheel', event => {
  var two = creator.two
  if (event.ctrlKey) event.preventDefault()
  if (event.deltaY) {
    if (two.scene.zoom >= 9 && event.deltaY < 0) return
    if (two.scene.zoom <= -7 && event.deltaY > 0) return
    two.scene.zoom = Math.min(Math.max(two.scene.zoom - event.deltaY/125,-7),9)
    var page = new Two.Vector(event.pageX, event.pageY),
    halfView = new Two.Vector((two.width)/2,(two.height)/2), oldScale = two.sceneScale,
    zoom = {
      '-7':1/4, '-6':1/3, '-5':1/2, '-4':2/3, '-3':3/4, '-2':4/5, '-1':9/10, 0:1, 1:11/10,
      2:5/4, 3:3/2, 4:7/4, 5:2, 6:5/2, 7:3, 8:4, 9:5
    }
    two.sceneScale = zoom[two.scene.zoom] || 1
    var scaledHalfView = halfView.clone().divideScalar(two.sceneScale)

    var matrix = creator.view._matrix,
    m_elements = matrix.elements,
    translate = new Two.Vector(m_elements[2], m_elements[5])

    creator.view.translation.copy(translate)
    translate.subSelf(page)
    .divideSelf({x: m_elements[0], y: m_elements[4]})
    matrix.translate(-translate.x, -translate.y)
    matrix.scale(two.sceneScale/oldScale)
    matrix.translate(translate.x, translate.y)
    creator.view.translation.set(m_elements[2], m_elements[5])
  }
})
window.addEventListener('contextmenu', event => event.preventDefault())
creator.mouse.start(window, creator.mouse.down, false)

creator.createContextMenu = opt => {
  var removeContextMenu = () => { if (creator.contextMenu) {
    creator.contextMenu.parent.remove(creator.contextMenu)
    delete creator.contextMenu
  }}
  removeContextMenu()
  var {width, optionHeight, gap, options, v, gotDOM} = opt,
  is_gotDOM = typeof gotDOM === 'function'
  if (!options) throw 'No options given'
  width = width || 150
  optionHeight = optionHeight || 30
  gap = gap || 5
  if (is_gotDOM) var elements = []
  var height = options.length*optionHeight+(options.length+1)*gap,
  optionButtons = options.map((option, i) => {
    var group = creator.createModel({
      name: option[0], elements: [
        ['body', new Two.Rectangle(0,0,width-2*gap,optionHeight)],
        ['text', new Two.Text(option[1],0,0)]
      ], v: {x: 0, y: (optionHeight-height)/2+gap*(i+1)+optionHeight*i}
    })
    group.children.map(child => {
      child.name = 'cmOption'
      if (is_gotDOM) elements.push(child)
    })
    if (is_gotDOM) elements.push(group)
    return group
  })
  if (v) {v.x += width/2; v.y += height/2}
  creator.contextMenu = creator.createModel({
    v, elements: [
      ['body', new Two.Rectangle(0,0,width,height)]
    ], parent: opt.parent
  }).add(optionButtons)
  creator.contextMenu.width = width
  creator.contextMenu.height = height
  if (is_gotDOM) {
    elements.push(creator.contextMenu)
    creator.getDOMs(elements)
    .then(elements => (
      options.map(option => elements[option[0]].style.cursor = 'pointer'), elements)
    )
    .then(gotDOM)
  }
  return creator.contextMenu
}

creator.createTextbox = opt => {
  opt = Object.assign({x:0, y:0, w:100, h:100, t_in:0, ty:2}, opt)
  var {x,y,w,h,ty,t_in,text,style,name,extra,gotDOM,data} = opt
  ,align = {left: (t_in-w)/2 + x}, tx = align[style.alignment] || x
  var elements = [
    ['body', new Two.Rectangle(x,y,w,h)]
    ,['text', new Two.Text(text,tx,ty,style)]
  ]
  if (extra) elements.push(...extra)
  return creator.createModel({elements,name,gotDOM,data})
}

creator.resource = {
  create: opt => {
    opt = Object.assign({
      v: new Two.Vector(0,0),
      w: 100, h: 100
    }, opt)

    var {
      v, w, h,
      parent, resource
    } = opt,
    group = creator.createModel({
      elements: [
        ['previous', new Two.Rectangle(-w*3/5,0,w/5,h/5)],
        ['body', new Two.Rectangle(0,0,w,h)],
        ['next', new Two.Rectangle(w*3/5,0,w/5,h/5)],
        ['trash', new Two.Rectangle(-w*2/5+2,w*2/5-2,w/5,h/5)]
      ]
      ,parent, gotDOM: e => {
        var {group, body, previous, next, trash} = e

        body.style.cursor = 'move'
        previous.style.cursor = next.style.cursor = 'copy'
        trash.style.cursor = 'url(/img/cursors/trash24white.png),pointer'

        body.redirectTo = creator.mouse.redirect(body)
        creator.mouse.start(body, event => {
          if (!event.touches) {
            if (event.button !== 0) return
            var cursor = true, page = new Two.Vector(event.pageX, event.pageY)
          }
          else var touch = true, page = new Two.Vector(
            event.touches[0].pageX, event.touches[0].pageY
          )
          var offset = page.subSelf(body.two.parent.translation)
          creator.mouse.events({
            move: page => {
              if (cursor) {
                var delta = new Two.Vector().sub(page, creator.two.mouse)
                .divideScalar(creator.two.sceneScale)
                body.two.parent.translation.addSelf(delta)
              }
              else if (touch) {
                body.two.parent.translation.copy(creator.two.mouse)
                .subSelf(creator.view.translation)
                .subSelf({x:100,y:100})
              }
              group.style.pointerEvents = 'none'
            },
            up: () => {
              group.style.pointerEvents = ''
            }
          })
        })
        creator.mouse.start(previous, creator.resource.dragInsert('previous'))
        creator.mouse.start(next, creator.resource.dragInsert('next'))
        creator.mouse.end(trash, event => {
          var resource = event.currentTarget.two.parent
          if (!resource.arrow_next && !resource.arrow_previous) {
            return
          }
          resource.parent.remove(resource)

          var removeNext = replace => {
            creator.arrows.remove(resource.arrow_next)
            var nextResource = resource.arrow_next.next
            nextResource.translation.off('change', nextResource.update_previous)
            if (!replace) {
              if (resource === creator.two.firstElement)
              creator.two.firstElement = nextResource
              delete nextResource.update_previous
              delete nextResource.arrow_previous
            }
          },
          removePrevious = replace => {
            var previousResource = resource.arrow_previous.previous
            previousResource.translation.off('change', previousResource.update_next)
            if (!replace) {
              creator.arrows.remove(resource.arrow_previous)
              delete previousResource.update_next
              delete previousResource.arrow_next
            }
          }

          if (resource.arrow_next && resource.arrow_previous) {
            removeNext(true)
            removePrevious(true)
            var nextResource = resource.arrow_next.next
            previousResource = resource.arrow_previous.previous

            nextResource.arrow_previous = previousResource.arrow_next
            previousResource.arrow_next.next = nextResource

            let update = creator.updateArrow(
              previousResource, nextResource, previousResource.arrow_next
            )
            update()
            nextResource.update_previous = previousResource.update_next = update
            nextResource.translation.on('change', update)
            previousResource.translation.on('change', update)
          }
          else if (resource.arrow_next && !resource.arrow_previous) {
            removeNext(false)
          }
          else if (!resource.arrow_next && resource.arrow_previous) {
            removePrevious(false)
          }
          creator.path.save()
        })

        if (resource) {
          group.two.name = 'occupied_resource'
          creator.resource.core.create({
            resource, parent: group.two, scale: 0.55,
            gotDOM: creator.resource.core.embed_mousedown(group.two)
          })
        }
      }
    })
    group.width = w*7/5
    group.name = 'empty_resource'
    group.resource = {}
    if (resource) group.resource.info = resource

    group.trash.linewidth = 0
    group.trash.fill = '#D88'

    group.translation.copy(v)
    return group
  },
  dragInsert: type => event => {
    if (!event.touches) {
      if (event.button !== 0) return
    }
    var direction = type === 'previous' ? -1 : 1
    creator.resource.connect({
      vf: currentResource => currentResource.translation.clone().addSelf({
        x: (currentResource.width/2)*direction, y: 0
      }),
      type, currentResource: event.target.two.parent,
      mouseEvents: newResource => creator.mouse.events({
        move: page => {
          var delta = page.clone().subSelf(creator.two.mouse)
          .divideScalar(creator.two.sceneScale)
          newResource.translation.addSelf(delta)
        }
      })
    })
    creator.path.save()
  },
  order: opt => {
    var {
      d1, d2, a1, a2, u1, u2,
      o0, o1, o2,
      currentResource, newResource, arrow
    } = opt

    if (!currentResource[a1]) {
      currentResource[a1] = arrow, arrow[d1] = currentResource
      newResource[a2] = arrow, arrow[d2] = newResource

      let update = creator.updateArrow.apply(null, o0.map(k => opt[k]))
      currentResource[u1] = newResource[u2] = update
      update()
      currentResource.translation.on('change', update)
      newResource.translation.on('change', update)
    }
    else {
      let oldUpdate = currentResource[u1],
      oldArrow = currentResource[a1],
      oldResource = oldArrow[d2]
      Object.assign(opt, {oldArrow, oldResource})
      currentResource.translation.off('change', oldUpdate)
      oldResource.translation.off('change', oldUpdate)

      oldResource[a2] = arrow, arrow[d2] = oldResource
      newResource[a1] = arrow, arrow[d1] = newResource
      newResource[a2] = oldArrow, oldArrow[d2] = newResource

      let updateOld = creator.updateArrow.apply(null, o1.map(k => opt[k]))
      let updateNew = creator.updateArrow.apply(null, o2.map(k => opt[k]))
      oldResource[u2] = newResource[u1] = updateNew
      newResource[u2] = currentResource[u1] = updateOld
      updateNew()
      updateOld()
      oldResource.translation.on('change', updateNew)
      newResource.translation.on('change', updateNew)
      newResource.translation.on('change', updateOld)
      currentResource.translation.on('change', updateOld)
    }
  },
  connect: opt => {
    var {currentResource, resource} = opt,
    arrow = new Two.Group(),
    arrow_segment = new Two.Path([new Two.Anchor(),new Two.Anchor()]),
    arrow_head = new Two.Path([new Two.Anchor(),new Two.Anchor(),new Two.Anchor()])
    arrow.add(arrow_segment, arrow_head)
    arrow.segment = arrow_segment
    arrow.head = arrow_head
    arrow_segment.linewidth = 2
    arrow_head.linewidth = 2
    arrow_head.noFill()
    arrow_head.vertices[0].set(-5,10)
    arrow_head.vertices[1].set(0,0)
    arrow_head.vertices[2].set(5,10)
    arrow.addTo(creator.arrows)

    var insertResource = order => {
      var newResource = creator.resource.create({
        v: opt.v ? opt.v : opt.vf ? opt.vf(currentResource) : undefined,
        resource
      })
      creator.resources.children.splice(order, 0, newResource)
      if (typeof opt.mouseEvents === 'function') opt.mouseEvents(newResource)
      return newResource
    }
    ,order = currentResource.parent.children.indexOf(currentResource)
    ,insert = {
      previous: {
        order, checkFirst: currentResource === creator.two.firstElement
        ,get keys() {return this._keys}
        ,set keys(newResource) {return this._keys = {
          d1: 'next', d2: 'previous',
          a1: 'arrow_previous', a2: 'arrow_next',
          u1: 'update_previous', u2: 'update_next',
          o0: ['newResource', 'currentResource', 'arrow'],
          o1: ['newResource', 'currentResource', 'oldArrow'],
          o2: ['oldResource', 'newResource', 'arrow'],
          currentResource, newResource, arrow
        }}
      }
      ,next: {
        order: order + 1, checkFirst: false
        ,get keys() {return this._keys}
        ,set keys(newResource) {return this._keys = {
          d1: 'previous', d2: 'next',
          a1: 'arrow_next', a2: 'arrow_previous',
          u1: 'update_next', u2: 'update_previous',
          o0: ['currentResource', 'newResource', 'arrow'],
          o1: ['currentResource', 'newResource', 'oldArrow'],
          o2: ['newResource', 'oldResource', 'arrow'],
          currentResource, newResource, arrow
        }}
      }
    }
    ,action = insert[opt.type]
    if (!action) throw 'Invalid type'

    var newResource = insertResource(action.order)
    action.keys = newResource
    if (action.checkFirst) creator.two.firstElement = newResource
    creator.resource.order(action.keys)
    return newResource
  },
  core: {
    create: opt => {
      var {getDOM, createModel} = creator, v = opt.v || {x:0,y:0}
      core = createModel({
        elements: [['body', new Two.Rectangle(0, 0, 100, 100)]]
        ,parent: opt.parent, v
      })
      opt.parent.resource = opt.parent.resource || {}
      if (opt.parent) opt.parent.resource.core = core

      if (opt.resource) {
        core.resource = opt.resource
        if (opt.resource.image_path) {
          var texture = new Two.Texture(opt.resource.image_path),
          image = new Two.Rectangle(0,0, 100, 100)
          core.add(image)
          image.fill = texture
          texture.image.width = texture.image.height = 100
          getDOM(image).then(e => e.style.pointerEvents = 'none')
        }
      }
      core.scale = opt.scale || 1
      if (opt.v) core.translation.set(opt.v.x, opt.v.y)

      creator.getDOMs([core, core.body]).then(opt.gotDOM)
      return core
    },
    embed_mousedown: core => elements => {
      var core_group = elements.group
      core_group.style.cursor = 'move'
      core_group.style.pointerEvents = ''
      core_group.touches = 0
      var contextMenu = page => creator.createContextMenu({
        options: [
          ['clear', 'Remove']
        ], parent: creator.hud, v: page,
        gotDOM: elements => {
          creator.mouse.end(elements.clear, event => {
            core.remove(core.resource.core)
            core.resource = {}
            core.name = 'empty_resource'
            creator.path.save()
            if (creator.contextMenu) {
              creator.contextMenu.parent.remove(creator.contextMenu)
              delete creator.contextMenu
            }
          })
        }
      })
      creator.mouse.start(core_group, event => {
        if (!event.touches) {
          if (event.button === 0) return core.body._renderer.elem.redirectTo(event)
          else if (event.button === 2) contextMenu({x: event.pageX, y: event.pageY})
        }
        else {
          creator.mouse.countTouch(core_group, 500).then(n => {
            if (n === 1) core.body._renderer.elem.redirectTo(event)
            else if (n > 1) contextMenu({
              x: event.touches[0].pageX, y: event.touches[0].pageY
            })
          })
        }
      })
    }
  }
}

creator.updateArrow = (as, ae, arrow) => () => {
  var distance = as.width/2+5,
  constant = Math.min(distance/as.translation.distanceTo(ae.translation), 0.499),
  svx = arrow.segment.vertices,
  aeTl = ae.translation.clone().lerp(as.translation, constant)
  svx[0].copy(as.translation.clone().lerp(ae.translation, constant))
  svx[1].copy(aeTl)
  arrow.head.translation.copy(aeTl)
  var asv = new Two.Vector().sub(svx[1], svx[0])
  arrow.head.rotation = Math.atan(asv.y/asv.x) + Math.PI/2 + ((asv.x < 0) ? Math.PI : 0) || 0
}

creator.path = {
  verify: () => {
    var {
      two, resources
    } = creator
    if (!two.firstElement) throw 'No first element'

    var alternates = []
    for (var i = resources.children.length - 1; i >= 0; i--) {
      var current = resources.children[i]
      if (!current.arrow_previous && current !== two.firstElement) {
        alternates.push(current)
      }
    }
    while (alternates.length) {
      var resource = alternates.pop()
      resource.opacity = 0.6
      if (!resource.arrow_next) continue
      if (resource.arrow_next.next.name === 'conditional') {
        // TODO: Add conditional nodes
      } else {
        alternates.unshift(resource.arrow_next.next)
      }
    }
  },
  save: () => {
    creator.path.verify()
    var initial = creator.two.firstElement,
    queue = [initial], results = [{}],
    url = creator.pathURL.split('/')[2].split('-')
    while (queue.length) {
      var resource = queue.pop(), index = results.length - 1
      if (resource.resource) results[index].resource = resource.resource.info
      if (!resource.arrow_next) continue
      var newIndex = results.push({}) - 1
      results[newIndex - 1].next = newIndex
      if (resource.arrow_next.next.name === 'conditional') {
        // TODO: Add conditional nodes
        // results[newIndex].test = resource.test
      } else queue.unshift(resource.arrow_next.next)
    }
    return ws.emit('creator_save', {url, save: results})
  }
}

;(() => {
  var {
    two, getDOM,
    createModel, createTextbox, isOpen,
    view, hud, resources, resourceMenu
  } = creator,
  url = creator.pathURL.split('/')[2].split('-')

  ws.emit('creator_init', {url}, res => {
    hud.remove(hud.loading)
    delete hud.loading
    if (!res) return console.error('Error: Server sent invalid response.')
    var opt = {}
    opt.parent = resources
    if (res.status === 'new') ws.emit('creator_save', {url, save: [{}]})
    else if (res.status === 'loaded') {
      if (res.content[0].resource) opt.resource = res.content[0].resource
    }
    var {content} = res
    if (res.status === 'loaded' && content[0]) {
      let stack = [[content[0], 0]], promise = Promise.resolve(), current
      while (stack.length) {
        let item = stack.pop(), resource = item[0], index = item[1]
        if (index === 0) {
          current = creator.resource.create(opt)
          two.firstElement = current
        }
        else {
          promise = promise.then(getDOM(current)).then(e => {
            current = creator.resource.connect({
              v: {x: current.translation.x + 180, y: 0},
              resource: resource.resource, type: 'next', currentResource: current
            })
          })
        }
        if (!(resource.next || resource.test)) continue
        if (resource.test) {
          // TODO: conditionals
        }
        var next = resource.next
        if (next) stack.push([content[next], next])
      }
    }
  })

  var menuElements = {}, menuButtons = {
    gap: 10,
    value: 60-creator.resourceMenu.data.width/2,
    get: function(width) {
      var oldValue = this.value + width/2
      this.value += this.gap + width
      return oldValue
    },
  }
  ,{icons} = resourceMenu
  ,createOption = opt => createTextbox({
    w: opt.w, h: 40, text: opt.text, style: {size: 20}, x: 0, y: 0,
    name: opt.name, gotDOM: e => {
      var text = e[opt.name + '_text'], body = e[opt.name + '_body']
      text.style.cursor = 'default'
      text.two.translation.x =
      body.two.translation.x =
      menuButtons.get(body.two.width = text.getBoundingClientRect().width + 10)
      if (opt.gotDOM) opt.gotDOM()
    }
  })
  ,data = {
    get gap() {return resourceMenu.data.width/8-25/2}
    ,results: {
      get y() {return this.marginTop/2-this.marginBottom}
      ,get w() {return resourceMenu.data.width-2*data.gap}
      ,get h() {return resourceMenu.data.height-this.marginTop-this.marginBottom}
      ,_totalH: 0
      ,get totalH() {return this._totalH || this.h}
      ,set totalH(v) {
        this._totalH = v
        try {
          var {scroll} = creator.resourceMenu.results,
          oldH = scroll.handle.height
          scroll.handle.height = data.scroll.handleH
          scroll.handle.dom._scrolling = 0
          scroll.handle.defaultScroll =
          scroll.handle.translation.y = (scroll.handle.height - oldH)/2
        } catch {}
      }
      ,marginTop: 150, marginBottom: 15
      ,icons: {
         get w() {return resourceMenu.data.width/6 + 50/3}
        ,get h() {return this.w}
        ,get x() {return -(data.results.w - this.w)/2}
        ,get y() {return -(data.results.h - this.h)/2}
      }
    }
    ,scroll: {
      w: 10
      ,get x() {return (resourceMenu.data.width-this.w)/2-30}
      ,get handleH() {return Math.pow(data.results.h,2)/data.results.totalH}
    }
  }

  menuElements.search = createOption({w: 70, text: 'Search', name: 'search'})
  menuElements.bookmarks = createOption({w: 110, text: 'Bookmarks', name: 'bookmarks'})
  menuElements.recommended = createOption({w: 140, text: 'Recommended', name: 'recommended'})
  menuElements.create = createOption({w: 70, text: 'Create', name: 'create'})
  menuElements.menubar = createModel({
    v: {x: resourceMenu.data.width/2, y: -(two.height-40)/2+50}, name: 'menubar', elements: [
      ['body', new Two.Rectangle(0,0,resourceMenu.data.width-100,50), e => ({
        fill: '#DDD', opacity: 0.3, linewidth: 0
      })],
      ['search', menuElements.search],
      ['bookmarks', menuElements.bookmarks],
      ['recommended', menuElements.recommended],
      ['create', menuElements.create]
    ]
  })
  menuElements.scroll = createModel({
    name: 'scroll', v: {x: data.scroll.x, y:0}, elements: [
      ['body', new Two.Rectangle(0,0,data.scroll.w,data.results.h,5), e=>({
        linewidth: 0, fill: '#DDD', opacity: 0.6
      })]
      ,['handle', new Two.Rectangle(0,0,data.scroll.w,data.scroll.handleH), e=>({
        linewidth: 0, fill: '#AAD', opacity: 1
      })]
    ]
  })
  menuElements.results = createModel({
    v: {x: resourceMenu.data.width/2, y: data.results.y}, elements: [
      ['body', new Two.RoundedRectangle(0,0,data.results.w+10,data.results.h+10,5)
      ,e=>({linewidth: 0, fill: '#DDD', opacity: 0.3})]
      ,['icons', createModel()]
      ,['iconsMask', new Two.Rectangle(0, 0, data.results.w, data.results.h+10)]
      ,['scroll', menuElements.scroll]
    ]
  })
  resourceMenu = creator.resourceMenu = Object.assign(createModel({
    parent: hud, v: {x: two.width, y: two.height/2}, elements: [
      ['body', new Two.RoundedRectangle(
        resourceMenu.data.width/2, 0, resourceMenu.data.width, resourceMenu.data.height, 5
      ), e => ({fill: '#888', opacity: 0.3})]
      ,['open', new Two.Rectangle(-10,0,20,20)]
      ,['menubar', menuElements.menubar]
      ,['results', menuElements.results]
    ]
    ,gotDOM: e => {
      var {open} = e, handle = e.results.two.scroll.handle.dom, {resourceMenu} = creator
      ,{icons, iconsMask} = resourceMenu.results
      ,fn = () => creator.mouse.start(open, event => {
        if (!event.touches && event.button !== 0) return

        var changeState = (dir, state, newWidth) => stepAnimate({duration: 200, animate: [
          [v => resourceMenu.translation.x += v, dir*resourceMenu.data.width]
        ]}).then(()=>(isOpen.resourceMenu = state, resourceMenu.translation.x = newWidth))
        ,openState = {
          closed: {
            run: () => {
              new Promise(resolve => {
                if (resourceMenu.loading) resourceMenu.remove(loading)
                resourceMenu.loading = new Two.Text('Loading...', 250, 0, {
                  size: 60, fill: '#FFF', family: 'Cabin, sans-serif'
                })
                var {loading} = resourceMenu
                resourceMenu.add(loading)
                getDOM(loading).then(e => e.style.cursor = 'default')
                .catch(e => {
                  resourceMenu.remove(loading)
                  delete resourceMenu.loading
                })
                ws.emit('creator_loadMenu', resolve)
              })
              .then(res => {
                if (res.error) {
                  resourceMenu.loading.size = 30
                  resourceMenu.loading.value = 'We\'ve encountered an error.'
                  return console.error(res)
                }
                resourceMenu.remove(resourceMenu.loading)
                delete resourceMenu.loading
                var icons = resourceMenu.results.icons, rows = Math.ceil(res.length/3)
                data.results.totalH = Math.max(
                  rows*data.results.icons.h+(rows-1)*data.gap, data.results.totalH
                )
                icons.remove(icons.children)
                for (var i = 0; i < res.length; i++) {
                  var resource = res[i], order = {x: i % 3, y: Math.floor(i/3)}
                  creator.resource.core.create({
                    resource, parent: icons
                    ,get gotDOM() {return resourceCoreActions(this.v)}
                    ,v: {
                      x: data.results.icons.x + order.x*(data.results.icons.w + data.gap)
                      ,y: data.results.icons.y + order.y*(data.results.icons.h + data.gap)
                    }
                  })
                }
              })
            }
            ,setState: 'opening'
            ,animate: () => changeState(-1, 'open', two.width - resourceMenu.data.width)
          }
          ,open: {
            run: () => {}
            ,setState: 'closing'
            ,animate: () => changeState(1, 'closed', two.width)
          }
        }
        var currentState = isOpen.resourceMenu
        if (!openState[currentState]) return
        openState[currentState].run()
        isOpen.resourceMenu = openState[currentState].setState
        openState[currentState].animate()
      })

      // handle.data = {
      //   get scrollTop() {return -(handle.two.parent.body.height - handle.two.height)/2}
      //   ,get scrollBottom() {return -this.scrollTop}
      //   ,get viewBottom() {return data.results.totalH - data.results.h}
      // }
      Object.defineProperty(handle, 'scrolling', {
        get: function() {return this._scrolling}
        ,set: function(v) {
          this._scrolling = v
          var scale = data.results.totalH/data.results.h,
          scrollTop = -(handle.two.parent.body.height - handle.two.height)/2,
          scrollBottom = -scrollTop,
          viewBottom = data.results.totalH - data.results.h
          handle.two.translation.y = v + handle.two.defaultScroll
          icons.translation.y = -v*scale
          iconsMask.translation.y = v*scale
          if (handle.two.translation.y <= scrollTop) {
            handle.two.translation.y = scrollTop
            icons.translation.y = 0
            iconsMask.translation.y = 0
          }
          else if (handle.two.translation.y >= scrollBottom) {
            handle.two.translation.y = scrollBottom
            icons.translation.y = -viewBottom
            iconsMask.translation.y = viewBottom
          }
        }
      })

      creator.mouse.start(handle, event => {
        if (!event.touches && event.button !== 0) return
        handle.mouse = true
        handle.two.fill = '#668'
        creator.mouse.events({
          move: page => {
            var d = page.clone().subSelf(creator.two.mouse)
            handle.scrolling += d.y
          },
          up: () => {
            handle.mouse = false
            handle.scrolling = Math.max(
              0, Math.min(handle.scrolling,-2*handle.two.defaultScroll)
            )
            handle.two.fill = '#AAD'
          }
        })
      })
      handle.addEventListener('mouseover', event => {
        if (handle.mouse) return
        handle.two.fill = '#88D'
      })
      handle.addEventListener('mouseout', event => {
        if (handle.mouse) return
        handle.two.fill = '#AAD'
      })
      try {fn()} catch (e) {console.log(e)}
    }
  }), resourceMenu)
  console.log(resourceMenu.results.iconsMask)
  resourceMenu.results.icons.mask = resourceMenu.results.iconsMask
  animate(duration => {
    // resourceMenu.results.iconsMask.translation.x += Math.cos(duration/1000)
    // resourceMenu.results.iconsMask.translation.y += Math.sin(duration/1000)
    // console.log(resourceMenu.results.iconsMask.translation.x);
    // return true
  })

  var resourceCoreActions = pos => elements => {
    var {group, body} = elements, core = group.two
    body.redirectTo = creator.mouse.redirect(body)

    var removeTooltip = () => {
      if (!core.tooltip) return
      core.remove(core.tooltip)
      if (core.children.names.indexOf('tooltip') !== -1) {
        core.children.names.splice(core.children.names.indexOf('tooltip'),1)
      }
      delete core.tooltip
    }
    ,removeContextMenu = () => {
      if (creator.contextMenu) {
        creator.contextMenu.parent.remove(creator.contextMenu)
        delete creator.contextMenu
      }
    }
    ,openInformation = () => {
      if (creator.information) {
        hud.remove(creator.information)
        delete creator.information
      }
      var data = {
        w: 600, h: 500
        ,unit: {
          w:30, h:30
        }
      }
      ,author = createModel({
        name: 'author', elements: [
          ['body', new Two.Rectangle(0, 0, data.w-20, data.unit.h), e => ({fill: '#446'})],
          ['text', new Two.Text('Author:',
            -data.w/2+20, 2, {alignment: 'left', size: 20}
          )],
          ['value', new Two.Text(core.resource.author,
            -data.w/2+20, 2, {alignment: 'left', size: 20}
          )]
        ]
        ,v: {x: 0, y: (data.unit.h-data.h)/2+90+5}, data: e => ({fill: '#FFF'})
      })
      ,createdAt = createModel({
        name: 'createdAt', elements: [
          ['body', new Two.Rectangle(0, 0, data.w-20, data.unit.h), e => ({fill: '#446'})],
          ['text', new Two.Text('Created On:',
            -data.w/2+20, 2, {alignment: 'left', size: 20}
          )],
          ['value', new Two.Text(core.resource.created_at,
            -data.w/2+20, 2, {alignment: 'left', size: 20}
          )]
        ]
        ,v: {x: 0, y: (data.unit.h-data.h)/2+120+10}, data: e => ({fill: '#FFF'})
      })
      ,description = createModel({
        name: 'description', elements: [
          ['body', new Two.Rectangle(0, 25, data.w-20, 100)],
          ['label', new Two.Text('Description',
            -data.w/2+10, -50+10, {alignment: 'left', size: 20}
          )],
          ['text', new Two.Text(core.resource.description,
            -data.w/2+20, 25-50+20, {alignment: 'left', size: 20}
          )]
        ]
        ,v: {x: 0, y: (-data.h+50)/2+170+30}, data: e => ({fill: '#FFF'})
      })
      ,information = creator.information = createModel({
        parent: hud, elements: [
          ['body', new Two.Rectangle(0, 0, data.w, data.h), e=>({fill:'#446'})]
          ,['topbar', new Two.Rectangle(0, 15-data.h/2, data.w, 30)]
          ,['close', new Two.Rectangle(data.w/2-15,15-data.h/2, 30, 30)]
          ,['displayName', new Two.Text(core.resource.display_name,
            0, 15-data.h/2+45, {family: 'Cabin, sans-serif', size: 30, weight: 1000}
          ), e => ({fill: '#FFF'})]
          ,['author', author]
          ,['createdAt', createdAt]
          ,['description', description]
        ]
        ,gotDOM: e => {
          var fn = () => {
            var {
              group, topbar, close, displayName, author, createdAt, description
            } = e
            creator.mouse.start(topbar, event => {
              group.two.moved = true
              creator.mouse.events({
                move: page => {
                  group.two.translation.addSelf(page).subSelf(two.mouse)
                  creator.infoT = {
                    x: creator.information.translation.x,
                    y: creator.information.translation.y
                  }
                },
                up: () => {
                  var tl_0 = group.two.translation
                  if (tl_0.x < -data.w/2+60 || tl_0.x > two.width+data.w/2-30 ||
                    tl_0.y < data.h/2 || tl_0.y > two.height+data.h/2-30
                  ) {
                    group.two.moved = false
                    var tl = {
                      x: Math.min(Math.max(tl_0.x,-data.w/2+60),two.width+data.w/2-30),
                      y: Math.min(Math.max(tl_0.y,data.h/2),two.height+data.h/2-30)
                    }
                    stepAnimate({duration: 1000, stop: () => group.two.moved, animate: [
                      [v => tl_0.x += v, tl.x-tl_0.x], [v => tl_0.y += v, tl.y-tl_0.y]
                    ]}).then(() => group.two.moved ? '' : (tl_0.x = tl.x, tl_0.y = tl.y))
                  }
                }
              })
            })
            creator.mouse.end(close, event => {
              if (!creator.information) return
              hud.remove(creator.information)
              delete creator.information
            })
            displayName.style.cursor = createdAt.style.cursor = description.style.cursor =
            author.two.text.dom.style.cursor = 'default'

            author.two.value.dom.style.cursor = 'pointer'
            author.two.value.translation.x += (
              author.two.text.dom.getBoundingClientRect().width + 10
            )
            creator.mouse.end(author.two.value.dom, event => {
              if (event.button !== 0) return
              creator.openTab(core.resource.author_url)
            })
            author.two.value.dom.addEventListener('mouseover', event => {
              author.two.value.fill = '#8AF'
            })
            author.two.value.dom.addEventListener('mouseout', event => {
              author.two.value.fill = '#FFF'
            })
            createdAt.two.value.translation.x += (
              createdAt.two.text.dom.getBoundingClientRect().width + 10
            )
          }
          try {fn()} catch (e) {console.log(e)}
        }
        ,data: e => ({
          translation: (creator.infoT ? e.translation.copy(creator.infoT)
          : e.translation.set(two.width/2, two.height/2))
        })
      })
      {
        information.author.body.fill =
        information.createdAt.body.fill =
        information.topbar.fill = '#446'
        information.body.opacity = 0.4
        information.close.fill = '#D44'
      }
    }

    group.style.cursor = 'grab'

    creator.mouse.start(group, event => {
      var page = (!event.touches ? {x: event.pageX, y: event.pageY}
        : {x: event.touches[0].pageX, y: event.touches[0].pageY}
      )
      ,leftButton = () => {
        removeTooltip()
        var clone = core.clone()
        creator.resourceMenu.add(creator.createModel({
          elements: [['clone', clone]],
          v: clone.parent.parent.translation.clone().addSelf(
            creator.resourceMenu.results.icons.translation
          )
        }))
        group.style.pointerEvents = 'none'
        core.position = pos
        clone.key = 'group'
        core.children.names.map((key, i) => clone[key] = clone.children[i])
        var cloneDOM = creator.getDOMs([clone, clone.body])

        cloneDOM.then(elements => elements.group.style.pointerEvents = 'none')
        stepAnimate({duration: 100, animate: [
          [v => clone.opacity += v, -0.6]
        ]}).then(() => clone.opacity = 0.4)

        creator.mouse.events({
          move: page => clone.translation.addSelf(page).subSelf(two.mouse),
          over: target => {
            var twoE = target.two
            if (!twoE) return delete clone.target

            if (twoE.parent && twoE.parent.resource) {
              clone.target = {dom: target, two: twoE.parent}
            } else delete clone.target
          },
          up: () => {
            document.body.style.cursor = 'default'
            group.style.pointerEvents = ''
            var dropPosition = {x: clone.translation.x, y: clone.translation.y}
            stepAnimate({duration: 100, animate: [
              [v => clone.opacity += v, 0.6]
            ]}).then(() => clone.opacity = 1)

            if (clone.target && clone.target.two.name === 'empty_resource') {
              clone.translation.clear()
              clone.target.two.add(clone)
              clone.target.two.name = 'occupied_resource'
              clone.target.two.resource = {info: core.resource, core: clone}
              cloneDOM.then(creator.resource.core.embed_mousedown(clone.target.two))
              stepAnimate({duration: 100, animate: [
                [v => clone.scale += v, -0.45]
              ]}).then(() => clone.scale = 0.55)
              return creator.path.save()
            }

            // Bounce
            var dx = core.position.x - dropPosition.x,
            dy = core.position.y - dropPosition.y,
            d = Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2)), t = Math.min(d/4,300)

            stepAnimate({duration: t, animate: [
              [v => clone.translation.x += v, dx], [v => clone.translation.y += v, dy]
            ]}).then(() => clone.parent.remove(clone))
          }
        })
      }
      ,rightButton = () => creator.createContextMenu({
        options: [
          ['information', 'Information'],
          ['visit_page', 'Visit Page']
        ], parent: hud, v: page
        ,gotDOM: elements => {
          var {group, body, information, visit_page} = elements
          creator.mouse.start(group, event => {
            var rightButton = () => {
              creator.contextMenu.parent.remove(creator.contextMenu)
              delete creator.contextMenu
              return
            }
            if (!event.touches && event.button === 2) rightButton()
            else if (event.touches) creator.mouse.countTouch(group, 500).then(rightButton)
          })
          creator.mouse.start(information, event => {
            if (event.touches || event.button === 0) openInformation()
          })
          creator.mouse.start(visit_page, event => {
            if (event.touches || event.button === 0) creator.openTab(core.resource.url)
          })
        }
      })
      if (!event.touches) {
        if (event.button === 0) return leftButton()
        else if (event.button === 2) return rightButton()
      }
      else {
        leftButton()
        creator.mouse.countTouch(group, 500).then(n => {
          if (n > 1) rightButton()
        })
      }
    })

    group.addEventListener('mouseenter', () => {
      core.is_hover = true
      new Promise((resolve, reject) => setTimeout(() => {
        if (core.is_hover) resolve()
        else reject()
      }, 200))
      .then(() => {
        removeTooltip()
        var height = 30, display_name = core.resource.display_name
        if (display_name.length > 14) display_name = display_name.slice(0,14).trim() + '-'
        core.tooltip = createModel({
          elements: [
            ['body', new Two.Rectangle(0,0,core.body.width,height), e => ({
              fill: '#000'
            })],
            ['text', new Two.Text(display_name,0,0), e => ({
              fill: '#FFF'
            })]
          ]
          ,gotDOM: e => {
            try {e.text.style.pointerEvents = 'none'}
            catch (e) {}
          }
          ,parent: core, data: e => ({translation: e.translation.set(
            e.translation.x, (core.body.height + height)/2 + 5
          )})
        })
      }, e => e)
      .catch(e => console.log(e))
    })
    group.addEventListener('mouseleave', () => {
      core.is_hover = false
      removeTooltip()
    })
  }
  creator.headerMenu = createModel({
    elements: [
      ['open', new Two.Rectangle(two.width - 60, 10, 20, 20)]
    ]
    ,parent: hud, gotDOM: e => {
      try {
        var {open} = e, {header} = creator
        creator.mouse.start(e.open, event => {
          if (!event.touches && event.button !== 0) return
          var change = {header_top: parseFloat(header.style.top)}
          ,changeState = (dir, state, then) => {
            stepAnimate({duration: 200, animate: [
              [v => open.two.translation.y += v + 0.0015, dir*creator.headerHeight],
              [v => (change.header_top += v, header.style.top = change.header_top + 'px'),
                dir*creator.headerHeight
              ]
            ]})
            .then((isOpen.header = state, then))
          }
          ,openState = {
            closed: {
              run: () => {
                header.classList.remove('hidden')
                creator.headerHeight = parseFloat(getComputedStyle(header).height)
              }
              ,setState: 'opening'
              ,animate: function() {changeState(1, 'open', this.then)}
              ,then: () => {
                open.two.translation.y = creator.headerHeight + 10
                header.style.top = '0'
              }
            }
            ,open: {
              run: () => {
                change.header_top = 0
              }
              ,setState: 'closing'
              ,animate: function() {changeState(-1, 'closed', this.then)}
              ,then: () => {
                header.classList.add('hidden')
                open.two.translation.y = 10
                header.style.top = -creator.headerHeight + 'px'
              }
            }
          }
          ,currentState = isOpen.header
          if (!openState[currentState]) return
          openState[currentState].run()
          isOpen.header = openState[currentState].setState
          openState[currentState].animate()
        })
      }
      catch (e) {console.log(e)}
    }
  })
})()

creator.two.bind('update', frameCount => {
  var two = creator.two,
  view = creator.view,
  velocity = view.v

  var camera = {
    x: view._matrix.elements[2],
    y: view._matrix.elements[5]
  }

  // if (!two.is_moving && false) {
  //   var smoothReturn = x => (Math.abs(x) + Math.exp(-Math.abs(x)))/2
  //   if (camera.x < two.topLeft.x) {
  //     console.log(camera.x, two.topLeft.x);
  //     velocity.x += smoothReturn(camera.x - two.topLeft.x)
  //   } else if (camera.x > two.bottomRight.x) {
  //     velocity.x -= smoothReturn(camera.x - two.bottomRight.x)
  //   }
  //   if (camera.y < two.topLeft.y) {
  //     velocity.y += smoothReturn(camera.y - two.topLeft.y)
  //   } else if (camera.y > two.bottomRight.y) {
  //     velocity.y -= smoothReturn(camera.y - two.bottomRight.y)
  //   }
  // }

  var scale = new Two.Vector(view._matrix.elements[0], view._matrix.elements[4])

  if (!velocity.isZero()) {
    velocity.divideSelf(scale)
    view._matrix.translate(velocity.x, velocity.y)
    view.translation.set(view._matrix.elements[2], view._matrix.elements[5])
    velocity.clear()
  }
}).play()
