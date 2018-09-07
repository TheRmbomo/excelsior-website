let creator = {
  two: new Two({
    fullscreen: true
    // width: parseFloat(getComputedStyle(document.body).width),
    // height: parseFloat(getComputedStyle(document.body).height) - 5
  }).appendTo(_id('canvas')),
  header: _query('header')[0],
  resourceMenuWidth: Math.min(500,window.innerWidth/2-20),
  isOpen: {
    resourceMenu: 'closed',
    header: 'closed'
  },
  view: new Two.Group(),
  hud: new Two.Group(),
  resourceGroups: new Two.Group(),
  resources: new Two.Group(),
  arrows: new Two.Group()
}
loadTwoUtils(creator)

window.addEventListener('resize', event => {
  var {two} = creator
  setTimeout(() => {
    creator.canvas.style.display = 'none'
    two.width = parseFloat(getComputedStyle(document.body).width)
    two.height = parseFloat(getComputedStyle(document.body).height) - 5
    creator.canvas.style.display = ''

    creator.isOpen.resourceMenu = 'closed'
    creator.isOpen.header = 'closed'
    creator.resourceMenuWidth = Math.min(500,window.innerWidth/2-20)

    creator.background.width = Math.max(two.width, 500)
    creator.background.height = Math.max(two.height, 500)
    creator.background.translation.set(Math.max(two.width, 500)/2, Math.max(two.height, 500)/2)
    creator.resourceMenu.translation.set(two.width, two.height/2)
    creator.resourceMenu.menu.height = two.height-40
    creator.resourceMenu.results.translation.y = -two.height/2+100
    creator.headerMenu.open.translation.set(two.width - 60, 10)
    creator.isOpen.header = 'closed'
    creator.header.style.display = ''
    creator.header.style.top = `${-creator.headerHeight}px`
  })
})

;(() => {
  var {
    two, getDOM, view, hud,
    header, headerHeight,
    resourceGroups, resources, arrows
  } = creator
  header.style.display = 'block'
  headerHeight = parseFloat(getComputedStyle(header).height)
  header.style.display = ''
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
  getDOM(loading).then(e => e.style.cursor = 'default').catch(e => console.error(e))
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
        element: view,
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
        element: creator.contextMenu,
        move: page => creator.contextMenu.translation.copy(page).addSelf({
          x: creator.contextMenu.width/2,
          y: creator.contextMenu.height/2
        })
      })
    }

    if (canDrag || event.button === 0 || event.touches) {
      handleContextMenu()
    }
    if (canDrag) {
      if (event.touches || event.button === 0) {
        leftButton()
      }
      if (event.button === 2) {
        rightButton()
      }
      if (event.touches) {
        creator.mouse.countTouch(window, 0).then(n => {
          if (n > 1) rightButton()
        })
      }
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
    var page = new Two.Vector(event.pageX, event.pageY)
    var halfView = new Two.Vector((two.width)/2,(two.height)/2)
    var oldScale = two.sceneScale
    two.sceneScale = (() => {
      switch (two.scene.zoom) {
        case -7: return 1/4
        case -6: return 1/3
        case -5: return 1/2
        case -4: return 2/3
        case -3: return 3/4
        case -2: return 4/5
        case -1: return 9/10
        case 0: return 1
        case 1: return 11/10
        case 2: return 5/4
        case 3: return 3/2
        case 4: return 7/4
        case 5: return 2
        case 6: return 5/2
        case 7: return 3
        case 8: return 4
        case 9: return 5
        default: return 1
      }
    })()
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
      ], v: {x: 0, y: (-height+optionHeight)/2+gap*(i+1)+optionHeight*i}
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
    .then(elements => {
      options.map(option => {
        elements[option[0]].style.cursor = 'pointer'
      })
      return elements
    })
    .then(gotDOM)
  }
  return creator.contextMenu
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
      ], parent
    })
    group.width = w*7/5
    group.name = 'empty_resource'
    group.resource = {}
    if (resource) group.resource.info = resource

    group.trash.linewidth = 0
    group.trash.fill = '#D88'

    creator.getDOMs([group, group.body, group.previous, group.next, group.trash])
    .then(elements => {
      var {group, body, previous, next, trash} = elements

      body.style.cursor = 'move'
      previous.style.cursor = next.style.cursor = 'copy'
      trash.style.cursor = 'url(/img/cursors/trash24white.png),pointer'

      body.redirectTo = creator.mouse.redirect(body)
      creator.mouse.start(body, event => {
        if (!event.touches) {
          if (event.button !== 0) return
          var cursor = true, page = new Two.Vector(event.pageX, event.pageY)
        }
        else {
          var touch = true, page = new Two.Vector(event.touches[0].pageX, event.touches[0].pageY)
        }
        var offset = page.subSelf(body.two.parent.translation)
        creator.mouse.events({
          element: body.two,
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
        var groupT = group.two
        groupT.name = 'occupied_resource'
        creator.resource.core.create({
          resource, parent: groupT, scale: 0.55,
          gotDOM: creator.resource.core.embed_mousedown(groupT)
        })
      }
    })
    .catch(e => console.log(e))

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
        element: newResource, move: page => {
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
    },
    order = currentResource.parent.children.indexOf(currentResource)

    if (opt.type === 'previous') {
      newResource = insertResource(order)
      if (currentResource === creator.two.firstElement)
      creator.two.firstElement = newResource
      creator.resource.order({
        d1: 'next', d2: 'previous',
        a1: 'arrow_previous', a2: 'arrow_next',
        u1: 'update_previous', u2: 'update_next',
        o0: ['newResource', 'currentResource', 'arrow'],
        o1: ['newResource', 'currentResource', 'oldArrow'],
        o2: ['oldResource', 'newResource', 'arrow'],
        currentResource,
        newResource,
        arrow
      })
    }
    else if (opt.type === 'next') {
      newResource = insertResource(order + 1)
      creator.resource.order({
        d1: 'previous', d2: 'next',
        a1: 'arrow_next', a2: 'arrow_previous',
        u1: 'update_next', u2: 'update_previous',
        o0: ['currentResource', 'newResource', 'arrow'],
        o1: ['currentResource', 'newResource', 'oldArrow'],
        o2: ['newResource', 'oldResource', 'arrow'],
        currentResource,
        newResource,
        arrow
      })
    } else throw 'Invalid type'
    return newResource
  },
  core: {
    create: opt => {
      var {
        getDOM, createModel
      } = creator,
      core = createModel({
        elements: [
          ['body', new Two.Rectangle(0, 0, 100, 100)]
        ], parent: opt.parent
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

      creator.getDOMs([core, core.body]).then(opt.gotDOM)
      return core
    },
    embed_mousedown: groupT => elements => {
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
            groupT.remove(groupT.resource.core)
            groupT.resource = {}
            groupT.name = 'empty_resource'
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
          if (event.button === 0) return groupT.body._renderer.elem.redirectTo(event)
          else if (event.button === 2) contextMenu({x: event.pageX, y: event.pageY})
        }
        else {
          creator.mouse.countTouch(core_group, 500).then(n => {
            if (n === 1) groupT.body._renderer.elem.redirectTo(event)
            else if (n > 1) contextMenu({x: event.touches[0].pageX, y: event.touches[0].pageY})
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
    createModel, isOpen,
    view, hud, resources
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
    var initial = creator.resource.create(opt)
    two.firstElement = initial
    var {content} = res
    if (res.status === 'loaded' && content[content[0].next]) {
      let stack = [content[content[0].next]], current = initial,
      promise = Promise.resolve()
      while (stack.length) {
        let resource = stack.pop()
        promise = promise.then(getDOM(current)).then(e => {
          current = creator.resource.connect({
            v: {x: current.translation.x + 180, y: 0},
            resource: resource.resource,
            type: 'next', currentResource: current
          })
        })
        if (!(resource.next || resource.test)) continue
        if (resource.test) {
          // TODO: conditionals
        }
        if (resource.next) stack.push(content[resource.next])
      }
    }
  })

  creator.resourceMenu = createModel({
    elements: [
      ['menu', new Two.RoundedRectangle(0, 0, 0, two.height-40, 5)],
      ['open', new Two.Rectangle(-10, 0,20,20)],
      ['results', new Two.Group()]
    ],
    parent: hud
  })
  var {resourceMenu} = creator
  resourceMenu.translation.set(two.width, two.height/2)
  resourceMenu.menu.opacity = 0.3
  resourceMenu.menu.fill = '#888'
  resourceMenu.results.translation.set(100,(-(two.height-40))/2+100)

  var resourceCoreActions = order => elements => {
    var {group, body} = elements,
    groupT = group.two

    body.redirectTo = creator.mouse.redirect(body)

    var removeTooltip = () => {
      if (groupT.tooltip) {
        groupT.remove(groupT.tooltip)
        if (groupT.childKeys.indexOf('tooltip') !== -1) {
          groupT.childKeys.splice(groupT.childKeys.indexOf('tooltip'),1)
        }
        delete groupT.tooltip
      }
    },
    removeContextMenu = () => {
      if (creator.contextMenu) {
        creator.contextMenu.parent.remove(creator.contextMenu)
        delete creator.contextMenu
      }
    }

    group.style.cursor = 'grab'

    creator.mouse.start(group, event => {
      if (!event.touches) var page = {x: event.pageX, y: event.pageY}
      else var page = {x: event.touches[0].pageX, y: event.touches[0].pageY}
      var leftButton = () => {
        removeTooltip()
        var clone = groupT.clone()
        group.style.pointerEvents = 'none'
        groupT.position = {x: order.x*150, y: order.y*150}
        clone.key = 'group'
        groupT.childKeys.map((key, i) => clone[key] = clone.children[i])
        var cloneDOM = creator.getDOMs([clone, clone.body])
        cloneDOM.then(elements => elements.group.style.pointerEvents = 'none')
        stepAnimate({duration: 100, animate: [
          [clone, 'opacity', -0.6]
        ]}).then(() => clone.opacity = 0.4)

        creator.mouse.events({
          element: clone,
          move: page => clone.translation.addSelf(page).subSelf(two.mouse),
          over: target => {
            var twoE = target.two
            if (!twoE) return delete clone.target

            if (twoE.parent && twoE.parent.resource) {
              clone.target = {dom: target, two: twoE.parent}
            } else delete clone.target
          },
          up: () => {
            group.style.pointerEvents = ''
            var dropPosition = {x: clone.translation.x, y: clone.translation.y}
            stepAnimate({duration: 100, animate: [
              [clone, 'opacity', 0.6]
            ]})
            .then(() => clone.opacity = 1)

            if (clone.target && clone.target.two.name === 'empty_resource') {
              clone.translation.clear()
              clone.target.two.add(clone)
              clone.target.two.name = 'occupied_resource'
              clone.target.two.resource = {info: groupT.resource, core: clone}
              cloneDOM.then(creator.resource.core.embed_mousedown(clone.target.two))
              stepAnimate({duration: 100, animate: [
                [clone, 'scale', -0.45]
              ]})
              .then(() => clone.scale = 0.55)
              return creator.path.save()
            }

            // Bounce
            stepAnimate({duration: 200, animate: [
              [clone.translation, 'x', groupT.position.x - dropPosition.x],
              [clone.translation, 'y', groupT.position.y - dropPosition.y]
            ]})
            .then(() => {
              clone.translation.set(groupT.position.x, groupT.position.y)
              clone.parent.remove(clone)
            })
          }
        })
      },
      rightButton = () => creator.createContextMenu({
        options: [
          ['information', 'Information'],
          ['visit_page', 'Visit Page'],
          // ['hide', 'Hide Result']
        ], parent: hud, v: page,
        gotDOM: elements => {
          var {
            group, body, information, visit_page
          } = elements
          creator.mouse.start(group, event => {
            var rightButton = () => {
              creator.contextMenu.parent.remove(creator.contextMenu)
              delete creator.contextMenu
              return
            }
            if (!event.touches) {
              if (event.button === 2) rightButton()
            }
            else {
              creator.mouse.countTouch(group, 500).then(n => {
                rightButton()
              })
            }
          })
          creator.mouse.start(information, event => {
            if (!event.touches) {
              if (event.button !== 0) return
            }
            if (creator.information) {
              hud.remove(creator.information)
              delete creator.information
            }
            var body_w = 600, body_h = 500,
            author = createModel({
              elements: [
                ['body', new Two.Rectangle(0, 0, body_w-20, 30)],
                ['label', new Two.Text('Author:',
                  -body_w/2+20, 2, {alignment: 'left', size: 20}
                )],
                ['text', new Two.Text(groupT.resource.author,
                  -body_w/2+20, 2, {alignment: 'left', size: 20}
                )]
              ], name: 'author'
            }),
            createdAt = createModel({
              elements: [
                ['body', new Two.Rectangle(0, 0, body_w-20, 30)],
                ['label', new Two.Text('Created On:',
                  -body_w/2+20, 2, {alignment: 'left', size: 20}
                )],
                ['text', new Two.Text(groupT.resource.created_at,
                  -body_w/2+20, 2, {alignment: 'left', size: 20}
                )]
              ], name: 'createdAt'
            }),
            description = createModel({
              elements: [
                ['body', new Two.Rectangle(0, 25, body_w-20, 100)],
                ['label', new Two.Text('Description',
                  -body_w/2+10, -50+10, {alignment: 'left', size: 20}
                )],
                ['text', new Two.Text(groupT.resource.description,
                  -body_w/2+20, 25-50+20, {alignment: 'left', size: 20}
                )]
              ], name: 'description'
            })
            creator.information = createModel({
              elements: [
                ['body', new Two.Rectangle(0, 0, body_w, body_h)],
                ['topbar', new Two.Rectangle(0, (-body_h+30)/2, body_w, 30)],
                ['close', new Two.Rectangle((body_w-30)/2,(-body_h+30)/2, 30, 30)],
                ['displayName', new Two.Text(groupT.resource.display_name,
                  0, (-body_h+30)/2+45, {family: 'Cabin, sans-serif',
                  size: 30, weight: 1000
                })],
                ['author', author],
                ['createdAt', createdAt],
                ['description', description]
              ], parent: hud
            })
            var {information} = creator
            if (creator.infoT) information.translation.copy(creator.infoT)
            else information.translation.set(two.width/2, two.height/2)
            information.author.fill =
            information.createdAt.fill =
            information.description.label.fill = '#FFF'
            information.body.fill =
            information.author.body.fill =
            information.createdAt.body.fill =
            information.topbar.fill = '#446'
            information.body.opacity = 0.4
            information.close.fill = '#D44'
            information.displayName.fill = '#FFF'
            author.translation.set(0, (-body_h+30)/2+90+5)
            createdAt.translation.set(0, (-body_h+30)/2+120+10)
            description.translation.set(0, (-body_h+50)/2+170+30)

            creator.getDOMs([
              information,
              information.topbar, information.close, information.displayName,
              information.author, information.author.label, information.author.text,
              information.createdAt, information.createdAt.label, information.createdAt.text,
              information.description
            ])
            .then(elements => {
              var {group, topbar, close, displayName, author, author_label, author_text,
              createdAt, createdAt_label, createdAt_text, description} = elements
              creator.mouse.start(topbar, event => {
                creator.mouse.events({
                  element: group,
                  move: page => {
                    group.two.translation.addSelf(page).subSelf(two.mouse)
                    creator.infoT = {
                      x: creator.information.translation.x,
                      y: creator.information.translation.y
                    }
                  },
                  up: () => {
                    var tl_0 = group.two.translation, tl = {
                      x: Math.min(Math.max(tl_0.x,-body_w/2+60),two.width+body_w/2-30),
                      y: Math.min(Math.max(tl_0.y,body_h/2),two.height+body_h/2-30)
                    }; stepAnimate({duration: 1000, animate: [
                      [tl_0, 'x', tl.x-tl_0.x], [tl_0, 'y', tl.y-tl_0.y]
                    ]}).then(() => (tl_0.x = tl.x, tl_0.y = tl.y))
                  }
                })
              })
              creator.mouse.end(close, event => {
                if (creator.information) {
                  hud.remove(creator.information)
                  delete creator.information
                }
              })
              displayName.style.cursor =
              author_label.style.cursor =
              createdAt.style.cursor =
              description.style.cursor = 'default'
              author_text.style.cursor = 'pointer'

              author_text.two.translation.x += (
                author_label.getBoundingClientRect().width + 10
              )
              creator.mouse.end(author_text, event => {
                if (event.button !== 0) return
                creator.openTab(groupT.resource.author_url)
              })
              author_text.addEventListener('mouseover', event => {
                author_text.two.fill = '#8AF'
              })
              author_text.addEventListener('mouseout', event => {
                author_text.two.fill = '#FFF'
              })
              createdAt_text.two.translation.x += (
                createdAt_label.getBoundingClientRect().width + 10
              )
            })
          })
          creator.mouse.start(visit_page, event => {
            if (!event.touches) {
              if (event.button !== 0) return
            }
            creator.openTab(groupT.resource.url)
          })
          // creator.mouse.start(hide, event => {
          //   if (!event.touches) {
          //     if (event.button !== 0) return
          //   }
          //   // TODO: add to db for preferences
          // })
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
      groupT.is_hover = true
      new Promise((resolve, reject) => setTimeout(() => {
        if (groupT.is_hover) resolve()
        else reject()
      }, 200))
      .then(() => {
        removeTooltip()
        var height = 30, display_name = groupT.resource.display_name
        if (display_name.length > 14) {
          display_name = display_name.slice(0,14).trim() + '-'
        }
        groupT.tooltip = createModel({
          elements: [
            ['body', new Two.Rectangle(0,0,groupT.body.width,height)],
            ['text', new Two.Text(display_name,0,0)]
          ],
          parent: groupT
        })
        // groupT.childKeys.push('tooltip')
        groupT.tooltip.translation.y = (groupT.body.height + height)/2 + 5
        groupT.tooltip.body.fill = '#000'
        groupT.tooltip.text.fill = '#FFF'
        return creator.getDOMs([
          groupT.tooltip,
          groupT.tooltip.body,
          groupT.tooltip.text
        ])
      })
      .then(elements => {
        var {group, body, text} = elements
        text.style.pointerEvents = 'none'
      })
      .catch(e => e)
    })
    group.addEventListener('mouseleave', () => {
      groupT.is_hover = false
      removeTooltip()
    })
  }

  getDOM(resourceMenu.open)
  .then(e => {
    creator.mouse.start(e, event => {
      if (!event.touches) {
        if (event.button !== 0) return
      }
      var {resourceMenuWidth} = creator
      if (isOpen.resourceMenu === 'closed') {
        new Promise(resolve => {
          var loading = new Two.Text('Loading...', 250, 0, {
            size: 60, fill: '#FFF', family: 'Cabin, sans-serif'
          })
          getDOM(loading)
          .then(e => e.style.cursor = 'default')
          resourceMenu.add(loading)
          resourceMenu.loading = loading
          ws.emit('creator_loadMenu', resolve)
        })
        .then(res => {
          if (res.error) {
            resourceMenu.loading.size = 30
            resourceMenu.loading.value = 'We\'ve encountered an error.'
            return console.error(res.error)
          }
          resourceMenu.remove(resourceMenu.loading)
          delete resourceMenu.loading
          resourceMenu.results.remove(resourceMenu.results.children)
          res.map(resource => {
            var number = resourceMenu.results.children.length,
            order = {x: number % 3, y: Math.floor(number/3)}

            var resourceCore = creator.resource.core.create({
              resource,
              parent: resourceMenu.results,
              gotDOM: resourceCoreActions(order)
            })
            resourceCore.translation.set(order.x*150, order.y*150)
          })
        })
        isOpen.resourceMenu = 'opening'
        stepAnimate({duration: 200, animate: [
          [resourceMenu.menu, 'width', resourceMenuWidth],
          [resourceMenu.menu.translation, 'x', resourceMenuWidth/2],
          [resourceMenu.translation, 'x', -resourceMenuWidth]
        ]})
        .then(() => {
          isOpen.resourceMenu = 'open'
          resourceMenu.menu.width = resourceMenuWidth
          resourceMenu.translation.x = two.width - resourceMenuWidth
          resourceMenu.menu.translation.x = resourceMenuWidth/2
        })
      }
      else if (isOpen.resourceMenu === 'open') {
        isOpen.resourceMenu = 'closing'
        stepAnimate({duration: 200, animate: [
          [resourceMenu.menu, 'width', -resourceMenuWidth],
          [resourceMenu.menu.translation, 'x', -resourceMenuWidth/2],
          [resourceMenu.translation, 'x', resourceMenuWidth]
        ]})
        .then(() => {
          resourceMenu.results.remove(resourceMenu.results.children)
          isOpen.resourceMenu = 'closed'
          resourceMenu.menu.width = 0
          resourceMenu.translation.x = two.width
          resourceMenu.menu.translation.x = 0
        })
      }
    })
  })

  creator.headerMenu = createModel({
    elements: [
      ['open', new Two.Rectangle(two.width - 60, 10, 20, 20)]
    ],
    parent: hud
  })
  var {header, headerMenu, headerHeight} = creator
  getDOM(headerMenu.open)
  .then(open => {
    creator.mouse.start(open, event => {
      if (!event.touches) {
        if (event.button !== 0) return
      }
      var change = {}
      if (isOpen.header === 'closed') {
        isOpen.header = 'opening'
        header.style.display = 'block'
        change.tempHeight = -headerHeight
        header.style.top = `${headerHeight}px`

        stepAnimate({duration: 200, animate: [
          [open.two.translation, 'y', headerHeight],
          [change, 'tempHeight', headerHeight]
        ],
        animateCB: () => {
          header.style.top = `${change.tempHeight}px`
        }})
        .then(() => {
          isOpen.header = 'open'
          open.two.translation.y = headerHeight + 10
          header.style.top = '0'
        })
      }
      else if (isOpen.header === 'open') {
        isOpen.header = 'closing'
        change.tempHeight = 0

        stepAnimate({duration: 200, animate: [
          [open.two.translation, 'y', -headerHeight],
          [change, 'tempHeight', -headerHeight]
        ],
        animateCB: () => {
          header.style.top = `${change.tempHeight}px`
        }})
        .then(() => {
          isOpen.header = 'closed'
          header.style.display = ''
          open.two.translation.y = 10
          header.style.top = `${-headerHeight}px`
        })
      }
    })
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
