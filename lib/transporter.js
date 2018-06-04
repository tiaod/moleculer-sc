'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _base = require('moleculer/src/transporters/base');

var _base2 = _interopRequireDefault(_base);

var _socketclusterClient = require('socketcluster-client');

var _socketclusterClient2 = _interopRequireDefault(_socketclusterClient);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug2.default)('moleculer-sc:transporter'); /*
                                                                 * moleculer-sc
                                                                 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
                                                                 * MIT Licensed
                                                                 */

class SocketClusterTranspoter extends _base2.default {
  constructor(opts) {
    super(opts);
    if (opts.socket) this.socket = opts.socket;
    if (opts.exchange) this.exchange = opts.exchange;
  }
  connect() {
    if (this.exchange) {
      this.logger.info("Using socketCluster exchange object");
      return this.onConnected();
    }
    return new Promise((resolve, reject) => {
      let socket;
      if (!this.socket) {
        socket = _socketclusterClient2.default.create(this.opts);
        socket.on('connect', () => {
          this.logger.info("SocketCluster client is connected.");
          this.onConnected().then(resolve);
        });
        this.socket = socket;
      } else {
        socket = this.socket;
        this.onConnected().then(resolve);
      }
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
    let sc = this.socket || this.exchange;
    const channel = sc.subscribe(t);
    channel.watch(msg => this.incomingMessage(cmd, msg));
    this.logger.info(`Subscribe to channel: ${t}`);
  }
  publish(packet) {
    if (!(this.socket || this.exchange)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let topic = this.getTopicName(packet.type, packet.target);
      const data = this.serialize(packet);
      debug(`publish to channel: ${topic}, data:${data}`);
      let sc = this.socket || this.exchange;
      sc.publish(topic, data, function (err, ackData) {
        if (err) {
          debug(err);
          return reject(err);
        }
        resolve(ackData);
      });
    });
  }
}

exports.default = SocketClusterTranspoter;