'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _base = require('moleculer/src/transporters/base');

var _base2 = _interopRequireDefault(_base);

var _socketclusterClient = require('socketcluster-client');

var _socketclusterClient2 = _interopRequireDefault(_socketclusterClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * moleculer-sc
 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
 * MIT Licensed
 */

class SocketClusterTranspoter extends _base2.default {
  constructor(opts) {
    super(opts);
  }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = _socketclusterClient2.default.create(this.opts);
      this.socket = socket;
      socket.on('connect', () => {
        this.logger.info("SocketCluster client is connected.");
        this.onConnected().then(resolve);
      });
      socket.on('error', e => {
        this.logger.error("SocketCluster error.", e.message);
        this.logger.debug(e);
        reject(e);
      });
      socket.on('close', () => {
        this.connected = false;
        this.logger.warn("SocketCluster client is disconnected.");
      });
    });
  }
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  subscribe(cmd, nodeID) {
    const t = this.getTopicName(cmd, nodeID);
    const channel = this.socket.subscribe(t);
    channel.watch(msg => this.incomingMessage(cmd, msg));
    this.logger.info(`Subscribe to channel: ${t}`);
  }
  publish(packet) {
    if (!this.socket) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let topic = this.getTopicName(packet.type, packet.target);
      const data = this.serialize(packet);
      this.logger.info(`publish to channel: ${topic}, data:${data}`);
      this.socket.publish(topic, data, function (err, ackData) {
        if (err) return reject(err);
        resolve(ackData);
      });
    });
  }
}

exports.default = SocketClusterTranspoter;