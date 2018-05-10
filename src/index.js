/*
 * moleculer-sc
 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
 * MIT Licensed
 */

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
    this.routes = {} //handlers
    for(let item of this.settings.routes){ //attach new actions
      this.logger.info('Add handler:', item)
      this.routes[item.event] = this.makeHandler(item.event, item.whitelist, item.callOptions)
    }
    const scServer = this.settings.worker.scServer
    scServer.on('connection', (socket) => {
      this.logger.info('Socket connected:', socket)
      for(let action in this.routes){
        // this.logger.info('Attach event:', action)
        socket.on(action, this.routes[action]) //attach to socket
      }
    })
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
      debug('MakeHandler', eventName)
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
