const verify = {
  url: require('./../json/url.json'),
  metadata: require('./../json/metadata.json'),
  uuid: require('./../json/uuid.json')
}

var redirect = (current, path, stack) => {
  let redirect = current._redirect[0]
  if (redirect < 0 || redirect > path.length-1) throw 'Invalid redirect'
  if (redirect > 0) path = path.slice(0, -redirect)
  let children = current._redirect.slice(1)
  current = path[0]
  path = path.concat(children)
  for (let i = 1; i < path.length; i++) {
    current = current[path[i]]
  }
  if (current !== undefined) stack.push(current)
}

module.exports = {
  youtube: res => {
    if (!res) throw 'Invalid input'
    var urlRegex = new RegExp(verify.url.regex), url = urlRegex.exec(res)
    if (!(url && url[3])) throw 'Invalid URL'

    url[1] = url[1] ? url[1] + '://' : ''
    if (!/youtube|youtu.be/.exec(url[3])) {
      'Not YouTube'
    } else 'Is YouTube'
    var path = [verify.url, 'youtube', url[3]], stack = [verify.url['youtube'][url[3]]]
    while (stack.length) {
      var domain = stack.pop()
      if (domain === undefined) throw 'Invalid domain'
      if (domain._log) console.log(domain._log)
      if (domain._redirect) {
        redirect(domain, path, stack)
        continue
      }
      else if (domain._regex) {
        if (!domain._index) throw 'Index required on regex'
        let keys = Object.keys(domain._regex), found = false
        for (let i = keys.length-1; i >= 0; i--) {
          let key = keys[i], regex = new RegExp(key), subdir = regex.exec(url[domain._index])
          if (!subdir) continue
          found = true
          domain = domain._regex[key]
          domain._regexResult = subdir
          stack.push(domain)
          break
        }
        if (!found) throw 'No subdirectory'
        continue
      }
      else if (domain._replaceIndex) {
        url[domain._replaceIndex[0]] = domain._regexResult[domain._replaceIndex[1]]
      }
      else if (domain._query) {
        if (!url[domain._query[0]]) throw 'No query given'
        var queries = (query => {
          var obj = {}, vars = query.split('&')
          for (var i = vars.length-1; i >= 0; i--) {
            var pair = vars[i].split('=')
            obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1])
          }
          return obj
        })(url[domain._query[0]])
        if (queries[domain._query[1]] === 'undefined') throw 'No query result'
        url[domain._query[0]] = queries[domain._query[1]]
      }

      if (domain._require && url[domain._require] === undefined) throw 'Index required'

      var fillURL = string => {
        for (var i = 9; i > 0; i--) { string = string.replace('$'+i, url[i]) }
        return string
      }

      if (domain._repeat) {
        url = urlRegex.exec(fillURL(domain._repeat))
        if (!(url && url[3])) throw 'Invalid URL in query'
        stack.push(verify.url['youtube'][url[3]])
        continue
      }
      else if (domain._return) {
        return fillURL(domain._return)
      }
    }
  },
  metadata: (data, err) => {
    var key = data[0], value = (typeof data[1] === 'string' ?
      data[1].replace(/\s{2,}/g, ' ') : data[1]
    )
    var path = [verify.metadata, key], stack = [verify.metadata[key]]
    while (stack.length) {
      let current = stack.pop()
      if (!current) {err('Invalid type'); continue}
      if (current._actions) {
        let currentActions = current._actions.slice().reverse()
        for (let i = currentActions.length - 1; i >= 0; i--) {
          var action = currentActions[i], not_required = false
          switch (action.type) {
            case 'lowercase': value = value.toLowerCase(); break
            case 'replace': {
              if (!action.set) err('No replace \'set\' data')
              let from = new RegExp(action.set[0], action.set[1])
              value = value.replace(from, action.set[2])
              break
            }
            case 'trim': value = value.trim(); break
            case 'require': {
              switch (action.key) {
                case 'length':
                if (action.value === 'undefined') return err('Value required on length')
                let min, max
                if (typeof action.value[0] === 'number') { min = action.value[0] }
                if (typeof action.value[1] === 'number') { max = action.value[1] }
                if (min !== undefined && value.length < min) err('Too short')
                if (max !== undefined && max < value.length) err('Too long')
                break
              }
              break
            }
            case 'match': {
              let regex
              if (action.regex.length) {
                regex = new RegExp(action.regex[0], action.regex[1])
              }
              else if (action.redirect) {
                let path = action.redirect.slice().reverse(), current = verify
                for (let i = path.length - 1; i >= 0; i--) {
                  current = current[path[i]]
                }
                regex = new RegExp(current[0], current[1])
              }
              if (!regex) { err('Server error'); throw 'No regex' }
              if (!regex.exec(value)) err(`Invalid: ${key}`)
              break
            }
            case 'split': value = value.split(action.delimiter); break
            case 'not_required': if (!value) not_required = true; break
          }
          if (not_required) break
        }
      }
      if (current._redirect) {redirect(current, path, stack); continue}
    }
    return value
  },
  uuid: uuid => (r => new RegExp(r[0], r[1]))(verify.uuid.regex).exec(uuid)
}
