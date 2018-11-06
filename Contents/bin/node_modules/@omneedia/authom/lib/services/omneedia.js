var EventEmitter = require("events").EventEmitter
var util = require("util");

function OA_Auth(options) {

    this.on("request", function(req, res) {
        var _p = this;

        var ip = req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
        var OA = {
            authenticate: function(req, res, callback) {
                if (typeof req.query.pid == "undefined") {
                    var redirectURL = options.server.uri;
                    res.writeHead(307, { 'Location': redirectURL });
                    res.write('<a href="' + redirectURL + '">login</a>');
                    res.end();
                } else {
                    // we collect information
                    global.request({
                        url: options.server.uri.split('/login')[0] + '/pid',
                        method: "post",
                        form: {
                            pid: req.query.pid
                        }
                    }, function(err, resp, body) {
                        var response = JSON.parse(body);
                        callback(null, true, response.userid, null);
                    });
                }
            }
        };
        OA.authenticate(req, res, function(err, status, username, extended) {
            var profile = {
                service: "letmein",
                username: username
            };
            if (err) {
                _p.emit("error", req, res, err);
            } else {
                _p.emit("auth", req, res, profile)
            }
        });

    });
    EventEmitter.call(this);
};

util.inherits(OA_Auth, EventEmitter);

module.exports = OA_Auth;