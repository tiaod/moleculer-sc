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
          this.routes[item.event] = this.makeHandler(item.event, item.whitelist, item.callOptions);
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
          // this.logger.info('Attach event:', action)
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
      makeHandler: function makeHandler(eventName, whitelist, opts) {
        debug('MakeHandler', eventName);
        const svc = this;
        return (() => {
          var _ref = _asyncToGenerator(function* (data, respond) {
            debug(`Handle ${eventName} event:`, data);
            if (!data || !_.isString(data.action)) {
              debug(`BadRequest:`, data);
              return svc.onError(new BadRequestError(), respond);
            } // validate action
            let action = data.action,
                params = data.params;

            if (whitelist && !svc.checkWhitelist(action, whitelist)) {
              //check whitelist
              debug(`Service "${action}" not found`);
              return svc.onError(new ServiceNotFoundError(action), respond);
            }
            try {
              debug('Call action:', action, params, svc.getMeta(this));
              let ret = yield svc.broker.call(action, params, _.assign({
                meta: svc.getMeta(this)
              }, opts));
              respond(null, ret);
            } catch (err) {
              debug('Call action error:', err);
              svc.onError(err, respond);
            }
          });

          return function (_x, _x2) {
            return _ref.apply(this, arguments);
          };
        })();
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
    }
  };
};