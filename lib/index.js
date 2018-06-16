'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/*
 * moleculer-sc
 * Copyright (c) 2018 tiaod (https://github.com/tiaod/moleculer-sc)
 * MIT Licensed
 */

const _ = require('lodash');
const debug = require('debug')('moleculer-sc');
const nanomatch = require('nanomatch');

const ServiceNotFoundError = require("moleculer").Errors.ServiceNotFoundError;

var _require = require('./errors');

const BadRequestError = _require.BadRequestError;


module.exports = function (worker) {
  return {
    name: 'sc-gw',
    settings: {
      worker: null,
      routes: [{
        event: 'call' //default
        // whitelist:[],
      }]
    },
    created() {
      if (!worker) {
        throw new Error('SocketCluster worker not set. You must pass the worker when creating service.');
      }
      this.routes = {}; //handlers
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.settings.routes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          let item = _step.value;
          //attach new actions
          this.logger.info('Add handler:', item);
          this.routes[item.event] = this.makeHandler(item);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      const scServer = worker.scServer;
      scServer.on('connection', socket => {
        this.logger.info('Socket connected:', socket.id);
        for (let action in this.routes) {
          debug('Attach event:', action);
          socket.on(action, this.routes[action]); //attach to socket
        }
      });
    },
    methods: {
      checkWhitelist(action, whitelist) {
        return whitelist.find(mask => {
          if (_.isString(mask)) {
            return nanomatch.isMatch(action, mask, { unixify: false });
          } else if (_.isRegExp(mask)) {
            return mask.test(action);
          }
        }) != null;
      },
      callAction(socket, data, opts, whitelist) {
        var _this = this;

        return _asyncToGenerator(function* () {
          if (!data || !_.isString(data.action)) {
            debug(`BadRequest:`, data);
            throw new BadRequestError();
          } // validate action
          let action = data.action,
              params = data.params;

          if (whitelist && !_this.checkWhitelist(action, whitelist)) {
            //check whitelist
            debug(`Service "${action}" not found`);
            throw new ServiceNotFoundError(action);
          }
          let meta = _this.getMeta(socket);
          debug('Call action:', action, params, meta);
          return yield _this.broker.call(action, params, _.assign({ meta }, opts));
        })();
      },
      makeHandler: function makeHandler(item) {
        let eventName = item.event;
        let type = item.type || 'call'; // handler type. ['call', 'login']
        let whitelist = item.whitelist;
        let opts = item.callOptions;
        debug('MakeHandler', eventName);
        const svc = this;
        switch (type) {
          case 'call':
            //call handler
            return (() => {
              var _ref = _asyncToGenerator(function* (data, respond) {
                debug(`Handle ${eventName} event:`, data);
                try {
                  let res = yield svc.callAction(this, data, opts, whitelist);
                  respond(null, res);
                } catch (err) {
                  debug('Call action error:', err);
                  svc.onError(err, respond);
                }
              });

              return function (_x, _x2) {
                return _ref.apply(this, arguments);
              };
            })();
            break;
          case 'login':
            return (() => {
              var _ref2 = _asyncToGenerator(function* (data, respond) {
                debug(`Handle ${eventName} event:`, data);
                try {
                  let res = yield svc.callAction(this, data, opts, whitelist);
                  debug('Login success', res);
                  this.setAuthToken(res); //success
                  respond(null, { ok: true });
                } catch (err) {
                  svc.onError(err, respond);
                }
              });

              return function (_x3, _x4) {
                return _ref2.apply(this, arguments);
              };
            })();
            break;
          default:
            throw new Error(`Unknow handler type: ${type}`);
        }
      },
      getMeta(socket) {
        return {
          user: socket.authToken
        };
      },
      onError(err, respond) {
        debug('onError', err);
        const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
        return respond(errObj);
      }
    },
    actions: {
      publish(ctx) {
        return new Promise(function (resolve, reject) {
          worker.exchange.publish(ctx.params.topic, ctx.params.data, function (err, ackData) {
            if (err) {
              debug(err);
              return reject(err);
            }
            return resolve(ackData);
          });
        });
      }
    }
  };
};