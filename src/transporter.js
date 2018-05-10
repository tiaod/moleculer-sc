/*
 * moleculer-sc
 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
 * MIT Licensed
 */

import Transporter from 'moleculer/src/transporters/base'
import socketCluster from 'socketcluster-client'

class SocketClusterTranspoter extends Transporter {
  constructor(opts){
    super(opts)
  }
  connect(){
    return new Promise((resolve, reject)=>{
      const socket = socketCluster.create(this.opts)
      this.socket = socket
      socket.on('connect', ()=> {
        this.logger.info("SocketCluster client is connected.");
        this.onConnected().then(resolve)
      })
      socket.on('error',(e)=>{
        this.logger.error("SocketCluster error.", e.message);
				this.logger.debug(e);
        reject(e);
      })
      socket.on('close',()=>{
        this.connected = false;
        this.logger.warn("SocketCluster client is disconnected.");
      })
    })
  }
  disconnect(){
    if(this.socket){
      this.socket.disconnect()
      this.socket = null
    }
  }
  subscribe(cmd, nodeID){
    const t = this.getTopicName(cmd, nodeID);
    const channel = this.socket.subscribe(t)
    channel.watch(msg=>this.incomingMessage(cmd, msg))
    this.logger.info(`Subscribe to channel: ${t}`)
  }
  publish(pakcet){
    if(!this.socket) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      let topic = this.getTopicName(packet.type, packet.target);
      const data = this.serialize(packet);
      this.logger.info(`publish to channel: ${topic}, data:${data}`)
      this.socket.publish(topic,data,function(err,ackData){
        if(err) return reject(err)
        resolve(ackData)
      })
    });
  }
}

export default SocketClusterTranspoter
