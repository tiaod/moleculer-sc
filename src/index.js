const _ = require('lodash')
const debug = require('debug')('moleculer-sc')
const nanomatch = require('nanomatch')
module.exports = {
  name:'sc-gw',
  settings:{
    worker:null,
    // whitelist:[]
  },
  created(){
    if(!this.settings.worker){
      throw new Error('SocketCluster worker not set. You must set the worker.')
    }
    this.handlers = {}
  },
  async started(){
    const scServer = this.settings.worker.scServer
    scServer.on('connection', (socket) => {
      debug('socket connected:', socket)
      for(let action in this.handlers){
        socket.on(action, this.handlers[action]) //attach to socket
      }
    })
  },
  methods:{
    checkWhitelist(action) {
			return this.settings.whitelist.find(mask => {
				if (_.isString(mask)) {
					return nanomatch.isMatch(action, mask, { unixify: false });
				}
				else if (_.isRegExp(mask)) {
					return mask.test(action);
				}
			}) != null
		},
    async getPublicActions() {
      let res = await this.broker.call("$node.services",{
        skipInternal: true,
        withActions: true
      })
      let allActions = _.flatMap(res, svc=>{
        return _.keys(svc.actions)
      })
      if(this.settings.whitelist){
        return allActions.filter(action=>this.checkWhitelist(action))
      }else{
        return allActions
      }
    },
    makeHandler:_.memoize(function(actionName){
      debug('makeHandler', actionName)
      const svc = this
      return async function(params, respond){
        try{
          debug('callAction:', actionName, params, svc.getMeta(this))
          let ret = await svc.broker.call(actionName, params, {
            meta:svc.getMeta(this)
          })
          respond(null, ret)
        }catch(err){
          respond(err)
          debug('error:',err)
        }
      }
    }),
    async updateHandlers(){
      let actions = await this.getPublicActions()
      let removedActions = _.keys(this.handlers).filter(item=>!actions.includes(item))
      for(let removed of removedActions){ //remove old actions
        debug('remove handler:', removed)
        delete this.handlers[removedActions]
      }
      for(let action of actions){ //attach new actions
        debug('add handler:', action)
        this.handlers[action] = this.makeHandler(action)
      }
    },
    getMeta(socket){
      return {
        user: socket.authToken
      }
    }
  },
  events:{
    'services.changed':function(payload, sender){
      this.updateHandlers()
    }
  }
}
