var wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
_id = selector => document.getElementById(selector),
_class = selector => document.getElementsByClassName(selector),
_query = selector => document.querySelectorAll(selector),
getParents = (depth, element) => {
  if (!depth || !element) throw 'Arguments required: depth, element'
  return (function dive() {
    if (element.parentNode) element = element.parentNode
    else return element
    depth--
    if (depth !== 0) return dive(element)
    else return element
  })(element)
},
round = (num, place=2) => Math.round(num*Math.pow(10,place))/Math.pow(10,place),
getUnset = (elem, property) => {
  let original = elem.style[property]
  elem.style[property] = ''
  let unset = getComputedStyle(elem)[property]
  elem.style[property] = original
  return unset
}

// console.oldLog = console.log
//
// console.log = message => {
//   let debug = _id('debug')
//   if (!debug) return
//
//   if (debug.children.length >= 5) debug.children[0].outerHTML = ''
//   _id('debug').innerHTML += `<div>${message}</div>`
// }

var animate = (render, jump = true) => {
  var running = true, start = null, lastFrame = null
  return new Promise(resolve => {
    ;(function loop(now) {
      if (!start) start = now
      if (!lastFrame) lastFrame = now

      var deltaT = now - lastFrame, reduce = (!jump && deltaT > 1000)
      if (reduce) {
        start += deltaT
        deltaT = 0
      }
      var duration = now - start
      res = render(duration, deltaT)
      lastFrame = now
      if (res === true) {
        return requestAnimationFrame(loop)
      } else return resolve(res)
    })(start)
  })
},
animateResult = opt => new Promise((resolve, reject) => {
  opt = Object.assign({
    elements: [],
    n_elements: [],
    properties: [],
    conditions: [],
    delta: [],
    units: [],
    initials: [],
    stepSize: 0,
    duration: 0,
    stepTotal: 0,
    jump: true,
    fps: 60,
    overflow: 0
  }, opt)
  if (!opt.elements.length) reject('Element required')
  if (opt.stepSize && opt.duration) reject('Both stepSize and duration cannot be defined')
  if (!opt.stepSize && !opt.duration) opt.stepSize = 100
  if (opt.stepSize < 0 || opt.stepSize > 100) reject('stepSize must be in range 0-100')
  if (!opt.n_elements.length) opt.n_elements = opt.properties.map(i => 0)
  opt.delta = opt.properties.map(i => [''])
  opt.stepSize /= 100

  opt.parse_property = property => {
    if (typeof property === 'number') return [[property],[]]
    values = property.split(/[^\d.]+/g).map(i => (i || i === '0') ? parseFloat(i) : i)
    text = property.match(/[^\d.]+/g)
    return [values || [], text || []]
  }

  try {
    for (var i = 0; i < opt.properties.length; i++) {
      var element = opt.elements[opt.n_elements[i]],
      current = opt.parse_property(element.style[opt.properties[i]] || getComputedStyle(element)[opt.properties[i]]),
      condition = opt.parse_property(opt.conditions[i]),
      i_values = current[0], i_text = current[1],
      f_values = condition[0], f_text = condition[1]
      opt.initials[i] = i_values
      for (var j = 0; j < i_values.length; j++) {
        if (!i_values[j] && i_values[j] !== 0) continue
        opt.delta[i][j] = f_values[j] - i_values[j]
      }
      opt.units[i] = f_text.map((text, i) => i_text[i] || text)
    }
  } catch (e) {
    return reject(e)
  }
  return resolve()
}).then(() => animate((duration, dT) => {
  if (opt.jump) {
    duration += opt.overflow
    dT += opt.overflow
  }
  update = up_opt => {
    if (opt.jump) {
      if (up_opt.type === 'step') up_opt.step = Math.min(up_opt.partial_jump, 1 - opt.stepTotal)
      opt.overflow = Math.max(up_opt.overflow, 0)
    } else opt.overflow = 0

    for (var i = 0; i < opt.properties.length; i++) {
      var precision = (opt.properties[i] === 'backgroundColor') ? 0 : 2
      var element = opt.elements[opt.n_elements[i]],
      change = opt.delta[i].map(e => round(e*up_opt.step, 8)),
      final = opt.initials[i].map((e,j) => (e || e === 0) ? round(e + change[j],8) : e)
      opt.initials[i] = final
      element.style[opt.properties[i]] = final.reduce((text, now, j) => {
        return text += (now ? now.toFixed(precision) : now) + (opt.units[i][j] || '')
      }, '')
    }
    opt.stepTotal += up_opt.step
    if (opt.stepTotal >= 1) return opt.overflow
    return true
  }

  if (opt.stepSize) {
    let step = Math.min(opt.stepSize, 1-opt.stepTotal),
    partial_jump = (dT*opt.fps/1000)*step
    return update({
      type: 'step',
      step,
      partial_jump,
      overflow: (partial_jump-1)/opt.stepSize*(1000/opt.fps)
    })
  } else {
    return update({
      type: 'duration',
      step: dT/opt.duration,
      overflow: duration - opt.duration
    })
  }
}, opt.jump))
.catch(e => console.error(Error(e))),
error_blurb = error => {
  if (!error) return
  var id = Object.keys(error)[0]
  error = error[id]

  var elem = _id(id)
  if (!elem) return
  var message = (() => {
    var part = ''
    switch (error.type) {
      case 'required':
      return 'This is required.'
      case 'invalid':
      return 'This entry is invalid.'
      case 'length':
      part += 'Must be '
      if (error.min) part += `at least ${error.min} characters long`
      if (error.min && error.max) part += ' and '
      if (error.max) part += `at most ${error.max} characters long`
      part += '.'
      return part
      case 'matching':
      return 'Passwords do not match.'
      default:
      return ''
    }
    return part
  })()

  elem.parentNode.classList.add('relative')
  var unset = getUnset(elem, 'backgroundColor');
  elem.style.backgroundColor = unset
  var error_box = document.createElement('DIV')
  var error = document.createTextNode(message)
  error_box.classList.add('absolute','round','padding')
  Object.assign(error_box.style, {
    width: '10em',
    backgroundColor: 'rgb(180,170,180)',
    color: 'rgb(20,20,20)',
    border: '2px solid rgb(100,40,40)',
    transform: 'scaleY(0)',
    transformOrigin: '50% 0',
    zoom: 1,
    filter: 'alpha(opacity=0)',
    opacity: 0
  })
  error_box.style.left = elem.offsetLeft + 'px'
  error_box.appendChild(error)
  elem.parentNode.appendChild(error_box)
  animateResult({
    elements: [elem,error_box],
    n_elements: [0,1,1,1,1],
    properties: ['backgroundColor', 'opacity', 'filter', 'transform'],
    conditions: ['rgb(120,50,50)', 1, 'alpha(opacity=100)', 'scaleY(1)'],
    stepSize: 5
  })
  .then(() => wait(2000))
  .then(() => animateResult({
    elements: [error_box],
    n_elements: [0,0],
    properties: ['opacity', 'filter'],
    conditions: [0, 'alpha(opacity=100)'],
    stepSize: 5
  }))
  .then(() => {
    error_box.remove()
    error.remove()
  })
}
