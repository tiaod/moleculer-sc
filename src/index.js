// import _ from 'lodash'
// import nanomatch from 'nanomatch'
module.exports = {
  name:'sc-gw',
  settings:{
    worker:null,
    acl:null,
    // callOptions:{}
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
    // checkWhitelist(eventName) {
		// 	return this.settings.whitelist.find(mask => {
		// 		if (_.isString(mask)) {
		// 			return nanomatch.isMatch(eventName, mask, { unixify: false });
		// 		}
		// 		else if (_.isRegExp(mask)) {
		// 			return mask.test(eventName);
		// 		}
		// 	}) != null;
		// },
    checkWhitelist(userId, eventName){

    },
    callAction(eventName, params, socket){
      //create(broker, action, nodeID, params, opts)
      return this.broker.call(eventName, params, {
        meta: {
          user: socket.authToken
        }
      })
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
        // if (svc.settings.acl) {
  			// 	if (!svc.checkWhitelist(obj.event)) {
  			// 		svc.logger.debug(`  The '${obj.event}' event is not in the whitelist!`);
        //     return
  			// 	}
  			// }

        let respond = { //响应的内容
          rid:obj.cid //回调函数的id
        }
        try{
          respond.data = await svc.callAction(obj.event, obj.data, this)
        }catch(err){
          svc.logger.error("  Request error!", err.name, ":", err.message, "\n", err.stack, "\nData:", err.data);
          respond.error = {
            type:err.type,
            message: err.message
          }
        }

        this.send( this.encode(respond))
      }
    }
  }
}
