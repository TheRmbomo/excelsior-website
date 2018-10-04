module.exports = obj => ({
  schema: obj,
  extend: function(obj) {
    return Object.assign(obj || {}, this.schema)
  },
  valueOf: function() {return this.schema}
})
