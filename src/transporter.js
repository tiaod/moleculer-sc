/*
 * moleculer-sc
 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
 * MIT Licensed
 */

import Transporter from 'moleculer/src/transporters/base'
import socketCluster from 'socketcluster-client'
import Debug from 'debug'
const debug = Debug('moleculer-sc:transporter')

class SocketClusterTranspoter extends Transporter {
  constructor(opts){
    super(opts)
    if(opts.socket) this.socket = opts.socket
    if(opts.exchange) this.exchange = opts.exchange
  }
  connect(){
    if(this.exchange) {
      this.logger.info("Using socketCluster exchange object");
      return this.onConnected()
    }
    return new Promise((resolve, reject)=>{
      let socket
      if(!this.socket){
        socket = socketCluster.create(this.opts)
        socket.on('connect', ()=> {
          this.logger.info("SocketCluster client is connected.");
          this.onConnected().then(resolve)
        })
        this.socket = socket
      }else{
        socket = this.socket
        this.onConnected().then(resolve)
      }
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
    let sc = this.socket || this.exchange
    const channel = sc.subscribe(t)
    channel.watch(msg=>this.incomingMessage(cmd, msg))
    this.logger.info(`Subscribe to channel: ${t}`)
  }
  publish(packet){
    if(!(this.socket || this.exchange)) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      let topic = this.getTopicName(packet.type, packet.target);
      const data = this.serialize(packet);
      this.logger.info(`publish to channel: ${topic}, data:${data}`)
      let sc = this.socket || this.exchange
      sc.publish(topic,data,function(err,ackData){
        if(err){
          debug(err)
          return reject(err)
        }
        resolve(ackData)
      })
    });
  }
}

export default SocketClusterTranspoter
