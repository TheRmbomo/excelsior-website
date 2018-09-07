let tb = {
  header: _query('header')[0],
  content: _id('content'),
  pathURL: _id('url').innerText,
  index: parseInt(_id('index').innerText),
  shead: _id('show_header'),
  shead_state: 'closed',
  two: new Two({
    autostart: true
  }).appendTo(_id('content')),
  rModel: {
    width: 30,
    height: 20
  },
  sized: {
    array: [],
    push: function(...e) {
      e.map(e => {
        if (this.array.indexOf(e) === -1) this.array.push(e)
        e[0].stopsize = () => {
          this.array.splice(this.array.indexOf(e), 1)
        }
      })
      tb.resize()
      return this
    }
  },
  resize: () => {
    tb.sized.array.map(obj => {
      var element = obj[0]
      Object.keys(obj[1]).map(k => {
        element[k] = obj[1][k]()
      })
    })
  }
}
loadTwoUtils(tb)

;(() => {
  var {header} = tb
  header.classList.remove('hidden')
  tb.headerHeight = getComputedStyle(header).height
  header.style.top = '-' + tb.headerHeight
  header.classList.add('hidden')
  var headerDIV = header.children[0].children[0],
  backCell = document.createElement('DIV'),
  backLink = document.createElement('A'),
  backButton = document.createElement('BUTTON'),
  backText = document.createTextNode('Back to Path'),
  spacer = document.createElement('DIV')
  headerDIV.children[0].style.width = '3em'
  backCell.classList.add('td')
  backLink.href = tb.pathURL
  backButton.style.minWidth = '4.5em'
  backButton.appendChild(backText)
  backLink.appendChild(backButton)
  backCell.appendChild(backLink)
  headerDIV.insertBefore(spacer, headerDIV.children[1])
  headerDIV.insertBefore(backCell, headerDIV.children[1])
  tb.shead.addEventListener('click', event => {
    var change = {
      shead_top: parseFloat(tb.shead.style.top),
      header_top: parseFloat(header.style.top)
    }
    if (tb.shead_state === 'closed') {
      header.classList.remove('hidden')
      tb.headerHeight = parseFloat(getComputedStyle(header).height)
      header.classList.add('hidden')
      tb.shead_state = 'opening'
      header.classList.remove('hidden')
      stepAnimate({duration: 200, animate: [
        [change, 'shead_top', tb.headerHeight],
        [change, 'header_top', tb.headerHeight]
      ],
      animateCB: () => {
        tb.shead.style.top = change.shead_top + 'px'
        tb.header.style.top = change.header_top + 'px'
      }})
      .then(() => {
        tb.shead_state = 'open'
        tb.shead.style.top = tb.headerHeight + 'px'
        header.style.top = '0px'
      })
    }
    else if (tb.shead_state === 'open') {
      tb.shead_state = 'closing'
      stepAnimate({duration: 200, animate: [
        [change, 'shead_top', -tb.headerHeight],
        [change, 'header_top', -tb.headerHeight],
      ],
      animateCB: () => {
        tb.shead.style.top = change.shead_top + 'px'
        header.style.top = change.header_top + 'px'
      }})
      .then(() => {
        header.classList.add('hidden')
        tb.shead_state = 'closed'
        tb.shead.style.top = '0px'
        header.style.top = '-' + tb.headerHeight + 'px'
      })
    }
  })
})()

window.addEventListener('popstate', event => {
  if (event.state.index !== undefined) tb.resource.change(event.state.index, false)
})

tb.resource = {
  change: (i, push = true) => {
    if (tb.index === i) return
    tb.index = i
    tb.resource.highlight(i)
    _id('frame').contentWindow.location.replace(tb.resources[i].url + '/embed')
    tb.resourceGroup.translation.x = (tb.two.width - i*3*tb.rModel.width)/2
    if (push) history.pushState({index: tb.index}, '', `${tb.pathURL}/${i+1}`)
  },
  highlight: i => {
    var {current} = tb.resourceGroup, next = tb.resources[i].two
    if (current) {
      current.stroke = '#000'
      current.linewidth = 1
    }
    next.stroke = '#5C6'
    next.linewidth = 2
    tb.resourceGroup.current = next
  }
}

;(() => {
  var contentStyle = getComputedStyle(tb.content)
  tb.sized.push(
    [tb.two, {width: ()=>parseFloat(contentStyle.width), height: ()=>parseFloat(contentStyle.height)}]
  )
  tb.resourceGroup = new Two.Group()
  tb.resourceGroup.translation.set(tb.two.width/2,0)
  tb.two.add(tb.resourceGroup)
  tb.loading = tb.two.makeText('Loading...', tb.two.width/2, tb.two.height/2, {
    fill: '#FFF', size: 30, family: 'Cabin, sans-serif'
  })

  tb.sized.push(
    [tb.resourceGroup.translation, {
      x: () => (tb.two.width-tb.index*tb.rModel.width*3)/2,
      y: () => tb.two.height/2
    }],
    [tb.loading, {x: () => tb.two.width/2, y: () => tb.two.height/2}]
  )

  ws.emit('inpath_init', {url: tb.pathURL}, res => {
    tb.two.remove(tb.loading)
    tb.loading.stopsize()
    delete tb.loading
    var {content} = res, stack = [[content.order[0], 0]], width = tb.rModel.width
    while (stack.length) {
      var place = stack.pop(), index = place[1],
      resource = Object.assign(place[0], content.resources[place[0].stackIndex]), next = resource.next
      delete resource.stackIndex
      var group = tb.createModel({
        elements: [
          ['body', new Two.Rectangle(0,0,width,tb.rModel.height)]
        ], parent: tb.resourceGroup, v: {x: index*width*3/2, y: 0},
        gotDOM: elements => {
          elements.group.addEventListener('mousedown', event => {
            if (!event.touches && event.button !== 0) return
            tb.resource.change(elements.group.two.index)
          })
        }
      })
      Object.assign(group, {index})
      resource.two = group
      if (next !== undefined && content.order[next]) stack.push([content.order[next],next])
    }
    content.resources = content.order
    delete content.order
    tb.resources = content.resources
    tb.resource.highlight(tb.index)
    history.replaceState({index: tb.index}, '', window.location)
  })
})()

window.addEventListener('resize', event => {
  tb.resize()
})
