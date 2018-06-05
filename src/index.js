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
module.exports = function(worker){
  return {
    name:'sc-gw',
    settings:{
      worker:null,
      routes:[{
        event:'call', //default
        // whitelist:[],
      }]
    },
    created(){
      if(!worker){
        throw new Error('SocketCluster worker not set. You must pass the worker when creating service.')
      }
      this.routes = {} //handlers
      for(let item of this.settings.routes){ //attach new actions
        this.logger.info('Add handler:', item)
        this.routes[item.event] = this.makeHandler(item)
      }
      const scServer = worker.scServer
      scServer.on('connection', (socket) => {
        this.logger.info('Socket connected:', socket.id)
        for(let action in this.routes){
          debug('Attach event:', action)
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
      async callAction(data, opts, whitelist){
        if(!data || !_.isString(data.action)){
          debug(`BadRequest:`,data)
          throw new BadRequestError()
        } // validate action
        let {action, params} = data
        if(whitelist && !this.checkWhitelist(action, whitelist)){//check whitelist
          debug(`Service "${action}" not found`)
          throw new ServiceNotFoundError(action)
        }
        let meta = this.getMeta(this)
        debug('Call action:', action, params, meta)
        return await this.broker.call(action, params, _.assign({meta},opts))
      },
      makeHandler:function(item){
        let eventName = item.event
        let type = item.type || 'call' // handler type. ['call', 'login']
        let whitelist = item.whitelist
        let opts = item.callOptions
        debug('MakeHandler', eventName)
        const svc = this
        switch (type) {
          case 'call': //call handler
            return async function(data, respond){
              debug(`Handle ${eventName} event:`,data)
              try{
                let res = await svc.callAction(data, opts, whitelist)
                respond(null, res)
              }catch(err){
                debug('Call action error:',err)
                svc.onError(err, respond)
              }
            }
            break;
          case 'login':
            return async function(data, respond){
              debug(`Handle ${eventName} event:`,data)
              try{
                let res = await svc.callAction(data, opts, whitelist)
                debug('Login success', res)
                this.setAuthToken(res) //success
                respond(null, {ok: true})
              }catch(err){
                svc.onError(err, respond)
              }
            }
            break;
          default:
            throw new Error(`Unknow handler type: ${type}`)
        }

      },
      getMeta(socket){
        return {
          user: socket.authToken
        }
      },
      onError(err, respond){
        debug('onError',err)
        const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
        return respond(errObj)
      }
    }
  }
}
