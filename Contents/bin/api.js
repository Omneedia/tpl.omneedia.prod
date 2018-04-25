module.exports = function (app) {
    var fs = require('fs');
    var path = require('path');
    var sep = "/";

    function processRoute(req, resp, next) {

        var fs = require('fs');
        var path = require('path');

        var parseFunction = require('@omneedia/parse-function')
        var parser = parseFunction({
            ecmaVersion: 2017
        });

        function process_api(d, i, batch, res) {
            if (!d[i]) return res.end(JSON.stringify(batch, 'utf8'));

            var api = d[i];
            try {
                var name = require.resolve(api.action);
                delete require.cache[name];
            } catch (e) {};
            if (!api.action) return resp.status(400).end('BAD_REQUEST');
            try {
                if (api.action == "__QUERY__") {
                    var x = require(global.ROOT + sep + "node_modules" + sep + "@omneedia" + sep + "db" + sep + api.action + ".js");
                } else
                    var x = require(global.PROJECT_API + sep + api.action + ".js");
                x.fingerprint = req.session.fingerprint;
            } catch (e) {
                return resp.status(400).end('BAD_REQUEST');
            };
            x.auth = req.session.user;
            x.session = req.session;
            x.using = function (unit) {
                //built in classes
                if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
                try {
                    return require(global.ROOT + sep + 'node_modules' + sep + unit);
                } catch (e) {
                    return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
                };
            };

            // Upload
            x.getFile = function (filename, cb) {
                return filename;
            };
            x.tmpdir = function (filename) {
                var OS = require('os');
                return OS.tmpdir();
            };
            x.temp = function (ext) {
                var uid = Math.uuid();
                var dir = x.tmpdir() + sep + "tempfiles";
                fs.mkdir(dir, function () {});
                var filename = uid;
                if (ext) filename += "." + ext;
                return {
                    uid: uid,
                    filename: filename,
                    dir: dir,
                    path: dir + sep + filename,
                    url: "/tmp/" + filename
                };
            };

            // Sockets API
            x.IO = {
                send: function (uri, data, users) {
                    /*var o = {
                    	uri: uri
                    	, data: data
                    	, users: users
                    };
                    var socket = require('socket.io-client')('http://' + global.registry.uri);
                    if (uri.indexOf("#") > -1) socket.emit("#send", JSON.stringify(o));*/
                }
            };

            var myfn = parser.parse(x[api.method]);
            var response = {};
            response.params = myfn.args;
            var p = [];
            if (response.params.length > 1) {
                for (var e = 0; e < response.params.length - 1; e++) {
                    if (!api.data) return resp.status(400).end('BAD_REQUEST');
                    p.push(api.data[e]);
                };
            };
            p.push(function (err, response) {
                if (err) {
                    batch.push({
                        action: api.action,
                        method: api.method,
                        result: response,
                        message: err.message,
                        data: err,
                        tid: api.tid,
                        type: "rpc"
                    });
                } else {
                    err = null;
                    batch.push({
                        action: api.action,
                        method: api.method,
                        result: response,
                        tid: api.tid,
                        type: "rpc"
                    });
                };
                process_api(d, i + 1, batch, res);
            });
            try {
                x[api.method].apply({}, p);
            } catch (e) {
                batch.push({
                    type: 'exception',
                    action: api.action,
                    method: api.method,
                    message: e.message,
                    data: e
                });
                process_api(d, i + 1, batch, res);
            }

        };

        var data = req.body;

        var d = [];
        if (data instanceof Array) {
            d = data;
        } else {
            d.push(data);
        };

        process_api(d, 0, [], resp);
    };

    var sqlinjection = function (req, res, next) {

        if (!req.session.fingerprint) return res.status(401).end('UNAUTHORIZED');
        if (!req.headers.z) return res.status(401).end('UNAUTHORIZED');
        if (req.session.fingerprint != req.headers.z) return res.status(401).end('UNAUTHORIZED');

        function hasSql(value) {

            if (value === null || value === undefined) {
                return false;
            }

            // sql regex reference: http://www.symantec.com/connect/articles/detection-sql-injection-and-cross-site-scripting-attacks
            var sql_meta = new RegExp('(%27)|(--)|(%23)', 'i');
            if (sql_meta.test(value)) {
                /*console.log('-0---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_meta2 = new RegExp('((%3D)|(=))[^\n]*((%27)|(\')|(--)|(%3B)|(;))', 'i');
            if (sql_meta2.test(value)) {
                /*console.log('-1---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_typical = new RegExp('w*((%27)|(\'))((%6F)|o|(%4F))((%72)|r|(%52))', 'i');
            if (sql_typical.test(value)) {
                /*console.log('-2---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_union = new RegExp('((%27)|(\'))union', 'i');
            if (sql_union.test(value)) {
                return true;
            }

            return false;
        };

        var containsSql = false;

        function iterate(obj) {
            var walked = [];
            var stack = [{
                obj: obj,
                stack: ''
            }];
            while (stack.length > 0) {
                var item = stack.pop();
                var obj = item.obj;
                for (var property in obj) {
                    if (obj.hasOwnProperty(property)) {
                        if (typeof obj[property] == "object") {
                            var alreadyFound = false;
                            for (var i = 0; i < walked.length; i++) {
                                if (walked[i] === obj[property]) {
                                    alreadyFound = true;
                                    break;
                                }
                            }
                            if (!alreadyFound) {
                                walked.push(obj[property]);
                                stack.push({
                                    obj: obj[property],
                                    stack: item.stack + '.' + property
                                });
                            }
                        } else {
                            if (hasSql(property)) return true;
                            if (hasSql(obj[property])) return true;
                        }
                    }
                }
            }
        };
        if (req.originalUrl !== null && req.originalUrl !== undefined) {
            if (hasSql(req.originalUrl) === true) {
                containsSql = true;
            };
            if (!req.body.length) {
                containsSql = iterate(req.body);
            } else {
                for (var i = 0; i < req.body.length; i++) {
                    var item = req.body[i];
                    containsSql = iterate(item);
                };
            }
        };

        if (containsSql) return res.status(403).end('SQL_INJECTION');
        next();
    };

    app.post('/api', sqlinjection, processRoute);

    if (!process.env.task) {
        app.get('/api', function (req, res) {
            var fs = require('fs');
            var response = {
                omneedia: {
                    engine: global.$_VERSION
                },
                namespace: global.manifest.namespace,
                classes: []
            };

            fs.readdir(global.PROJECT_WEB + sep + "Contents" + sep + "Services", function (e, classes) {
                if (e) return res.status(404).send('Not found');
                var myclass = [];
                for (var i = 0; i < classes.length; i++) {
                    if ((classes[i] != "node_modules") && (classes[i] != "sql") && (classes[i].substr(0, 1) != ".")) myclass.push(classes[i].split('.js')[0]);
                };
                response.classes = myclass;
                res.header("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(response, null, 4));
            })
        });

        app.get('/api/:ns', function (req, res) {
            var url = req.url.split('?');
            if (url.length > 1) {
                if (url[1].indexOf("javascript") > -1) {
                    var REMOTE_API = {};
                    REMOTE_API.url = "http://" + req.headers.host + "/api";
                    REMOTE_API.type = "remoting";
                    REMOTE_API.namespace = "App";
                    REMOTE_API.descriptor = "App.REMOTING_API";
                    REMOTE_API.actions = {};
                    REMOTE_API.actions[req.params.ns] = [];

                    if (req.params.ns.indexOf("__QUERY__") == -1) {
                        // MicroAPI
                        fs.stat(PROJECT_WEB + sep + "Contents" + sep + "Services" + sep + req.params.ns + ".js", function (e, s) {
                            if (e) return res.status(404).send('Not found');
                            try {
                                var _api = require(PROJECT_WEB + sep + "Contents" + sep + "Services" + sep + req.params.ns + ".js");
                            } catch (e) {
                                return res.status(404).send('Not found');
                            };
                            for (var e in _api) {
                                if (_api[e]) {
                                    if (_api[e].toString().substr(0, 8) == "function") {
                                        var obj = {};
                                        obj.name = e;
                                        var myfn = _api[e].toString().split('function')[1].split('{')[0].trim().split('(')[1].split(')')[0].split(',');
                                        obj.len = myfn.length - 1;
                                        REMOTE_API.actions[req.params.ns][REMOTE_API.actions[req.params.ns].length] = obj;
                                    }
                                }
                            };
                            REMOTE_API.headers = {
                                z: "%FINGERPRINT%"
                            };
                            var str = "if (Ext.syncRequire) Ext.syncRequire('Ext.direct.Manager');Ext.namespace('App');";
                            str += "App.REMOTING_API=" + JSON.stringify(REMOTE_API, null).replace(/"%FINGERPRINT%"/g, "window.z") + ";";
                            str += "Ext.Direct.addProvider(App.REMOTING_API);";
                            res.header("Content-Type", "application/json; charset=utf-8");
                            res.end(str);
                        });
                    } else {
                        // QRL (Query Resource Locator)

                        fs.stat(__dirname + sep + '..' + sep + '..' + sep + "node_modules" + sep + '@omneedia' + sep + "db" + sep + "__QUERY__.js", function (e, s) {
                            if (e) return res.status(404).send('Not found');

                            var _api = require(__dirname + sep + '..' + sep + '..' + sep + "node_modules" + sep + '@omneedia' + sep + "db" + sep + "__QUERY__.js");
                            for (var e in _api) {
                                if (_api[e]) {
                                    if (_api[e].toString().substr(0, 8) == "function") {
                                        var obj = {};
                                        obj.name = e;
                                        var myfn = _api[e].toString().split('function')[1].split('{')[0].trim().split('(')[1].split(')')[0].split(',');
                                        obj.len = myfn.length - 1;
                                        REMOTE_API.actions[req.params.ns][REMOTE_API.actions[req.params.ns].length] = obj;
                                    }
                                }
                            };
                            REMOTE_API.headers = {
                                z: "%FINGERPRINT%"
                            };
                            var str = "if (Ext.syncRequire) Ext.syncRequire('Ext.direct.Manager');Ext.namespace('App');";
                            str += "App.REMOTING_API=" + JSON.stringify(REMOTE_API, null).replace(/"%FINGERPRINT%"/g, "window.z") + ";";
                            str += "Ext.Direct.addProvider(App.REMOTING_API);";
                            res.header("Content-Type", "application/json; charset=utf-8");
                            res.end(str);

                        });
                    };
                } else return res.status(404).send('Not found');
            } else return res.status(404).send('Not found');
        });
    };
}