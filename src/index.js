const _ = require('lodash')
const debug = require('debug')('moleculer-sc')
const nanomatch = require('nanomatch')
const { ServiceNotFoundError } = require("moleculer").Errors;
const { BadRequestError } = require('./errors')
module.exports = {
  name:'sc-gw',
  settings:{
    worker:null,
    routes:[{
      event:'call', //default
      // whitelist:[],
    }]
  },
  created(){
    if(!this.settings.worker){
      throw new Error('SocketCluster worker not set. You must set the worker.')
    }
    const scServer = this.settings.worker.scServer
    scServer.on('connection', (socket) => {
      debug('socket connected:', socket)
      for(let action in this.routes){
        debug('attach event:', action)
        socket.on(action, this.routes[action]) //attach to socket
      }
    })
    this.routes = {}
    for(let item of this.settings.routes){ //attach new actions
      debug('add handler:', item)
      this.routes[item.event] = this.makeHandler(item.event, item.whitelist, item.callOptions)
    }
  },
  methods:{
    checkWhitelist(action, whitelist) {
			return whitelist.find(mask => {
				if (_.isString(mask)) {
					return nanomatch.isMatch(action, mask, { unixify: false });
				}
				else if (_.isRegExp(mask)) {
					return mask.test(action);
				}
			}) != null
		},
    makeHandler:function(eventName, whitelist, opts){
      debug('makeHandler', eventName)
      const svc = this
      return async function(data, respond){
        debug(`handle ${eventName} event`,data, whitelist)
        if(!data || !_.isString(data.action))
          return respond(new BadRequestError())
        let {action, params} = data
        if(whitelist && !svc.checkWhitelist(action, whitelist))
          return respond(new ServiceNotFoundError(action))
        try{
          debug('callAction:', action, params, svc.getMeta(this))
          let ret = await svc.broker.call(action, params, _.assign({
            meta:svc.getMeta(this)
          },opts))
          respond(null, ret)
        }catch(err){
          respond(err)
          debug('error:',err)
        }
      }
    },
    getMeta(socket){
      return {
        user: socket.authToken
      }
    }
  }
}
