const { UnAuthorizedError } = require('./errors')
const { ServiceNotFoundError } = require("moleculer").Errors
module.exports = {
  name:'sc-gw',
  settings:{
    worker:null,
    acl:null,
  },
  created(){
    if(!this.settings.worker){
      throw new Error('SocketCluster worker not set. You must set the worker.')
    }
    const scServer = this.settings.worker.scServer
    scServer.on('connection', (socket) => {
      socket.on('message',this.handler())
    })
  },
  methods:{
    getUserId(socket){
      if(socket.authToken && socket.authToken.id){
        return socket.authToken.id
      }
    },
    getMeta(socket){
      return {
        user: socket.authToken
      }
    },
    async callAction(eventName, params, socket){
      if(this.settings.acl){
        let [serviceName, actionName] = eventName.split('.',2)
        console.log([serviceName, actionName])
        let userId = this.getUserId(socket)
        if(!userId){
          throw new UnAuthorizedError()
        }
        if(!await this.settings.acl.isAllowed(userId, serviceName, actionName)){
          throw new ServiceNotFoundError(eventName)
        }
      }
      //create(broker, action, nodeID, params, opts)
      return this.broker.call(eventName, params, this.getMeta(socket))
    },
    handler(){
      const svc = this
      return async function(msg){
        if(msg == '#2') return
        let obj
        try{
          obj = this.decode(msg)
        }catch(err){
          svc.logger.debug('received invalid message:',msg)
          return
        }
        svc.logger.debug('recevied message:',obj)
        let respond = { //响应的内容
          rid:obj.cid //回调函数的id
        }
        try{
          respond.data = await svc.callAction(obj.event, obj.data, this)
        }catch(err){
          svc.logger.error("  Request error!", err.name, ":", err.message, "\n", err.stack, "\nData:", err.data);
          respond.error = {
            type:err.type,
            message: err.message,
            code: err.code,
            data: err.data
          }
        }
        this.send( this.encode(respond))
      }
    }
  }
}
