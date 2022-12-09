'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _lokkaTransportHttp = require('lokka-transport-http');

var _lokkaTransportHttp2 = _interopRequireDefault(_lokkaTransportHttp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// if the token expires within the next N ms
// it will be refreshed immediately.
var MIN_REFRESH_TIMEOUT = 1000 * 60;

// if the token is not available, the job will
// wait for this number of milliseconds
var MAX_JOB_WAIT_TIME = 1000 * 10;
var ERR_JOB_TIMEOUT = new Error('job timeout');

var Transport = function () {
  function Transport(endpoint, arg2, arg3) {
    (0, _classCallCheck3.default)(this, Transport);

    if (endpoint) {
      this._endpoint = endpoint;
    } else {
      throw new Error('endpoint is required');
    }

    // the options argument is optional
    if (typeof arg3 === 'function') {
      this._options = arg2;
      this._refreshFn = arg3;
    } else {
      this._options = {};
      this._refreshFn = arg2;
    }

    if (!this._refreshFn) {
      throw new Error('refresh function is required');
    }

    // the "Authorization" header will be used to store the JWT token
    // make sure the user is not using it for anything else.
    if (this._options.headers && this._options.headers.Authorization) {
      throw new Error('the "Authorization" header should not exist');
    }

    // The HTTP transport will be (re-)created with every token refresh.
    // This is done because we need to change headers with each refresh.
    this._transport = null;

    // queue requests here when this.token is null.
    // after refreshing the token, process the queue.
    this._waitlist = [];

    // true if the transport is manually closed
    // no further communication will be possible
    this._closed = false;

    // refresh immediately
    this._scheduleRefresh(0);
  }

  (0, _createClass3.default)(Transport, [{
    key: 'send',
    value: function send(query, variables, opname) {
      var _this = this;

      if (this._closed) {
        throw new Error('transport is closed');
      }

      if (this._transport) {
        return this._transport.send(query, variables, opname);
      }

      return new _promise2.default(function (resolve, reject) {
        var job = { query: query, variables: variables, opname: opname, resolve: resolve, reject: reject, done: false };
        _this._waitlist.push(job);

        setTimeout(function () {
          if (!job.done) {
            job.done = true;
            reject(ERR_JOB_TIMEOUT);
          }
        }, MAX_JOB_WAIT_TIME);
      });
    }
  }, {
    key: 'close',
    value: function close() {
      this._transport = null;
      this._closed = true;
    }
  }, {
    key: '_processWaitlist',
    value: function _processWaitlist() {
      var _this2 = this;

      var jobs = this._waitlist;
      this._waitlist = [];

      jobs.forEach(function (job) {
        var query = job.query,
            variables = job.variables,
            opname = job.opname,
            resolve = job.resolve,
            reject = job.reject,
            done = job.done;

        if (!done) {
          job.done = true;
          _this2.send(query, variables, opname).then(resolve, reject);
        }
      });
    }
  }, {
    key: '_refreshToken',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
        var token, options, payload, expires;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this._closed) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt('return');

              case 2:
                _context.prev = 2;
                _context.next = 5;
                return this._refreshFn();

              case 5:
                token = _context.sent;

                if (token) {
                  _context.next = 8;
                  break;
                }

                throw new Error('invalid token');

              case 8:
                options = (0, _assign2.default)({ headers: {} }, this._options);

                options.headers.Authorization = 'Bearer ' + token;

                this._transport = new _lokkaTransportHttp2.default(this._endpoint, options);
                this._processWaitlist();

                // assuming the token has an expiration time
                // TODO handle tokens without expiration times
                payload = _jsonwebtoken2.default.decode(token);

                if (!(!payload || !payload.exp)) {
                  _context.next = 15;
                  break;
                }

                throw new Error('invalid token');

              case 15:

                // schedule next token refresh
                expires = payload.exp * 1000;

                this._scheduleRefresh(expires);
                _context.next = 23;
                break;

              case 19:
                _context.prev = 19;
                _context.t0 = _context['catch'](2);

                // console.log the error??
                this._transport = null;
                this._scheduleRefresh(0);

              case 23:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[2, 19]]);
      }));

      function _refreshToken() {
        return _ref.apply(this, arguments);
      }

      return _refreshToken;
    }()
  }, {
    key: '_scheduleRefresh',
    value: function _scheduleRefresh(expires) {
      var _this3 = this;

      var now = Date.now();
      var timeLeft = expires - now;

      if (timeLeft <= MIN_REFRESH_TIMEOUT) {
        this._refreshToken();
        return;
      }

      // add some slack time to avoid queuing
      var timeout = timeLeft - MIN_REFRESH_TIMEOUT;
      setTimeout(function () {
        return _this3._refreshToken();
      }, timeout);
    }
  }]);
  return Transport;
}();

exports.default = Transport;