module.exports = function (NET, cluster, Config) {

    var fs = require('fs');
    var path = require('path');
    var sep = "/";
    var shelljs = require('shelljs');
    var util = require('../util');
    Math = require(__dirname + '/../framework/math')();
    Date = require(__dirname + '/../framework/dates')();
    Object = require(__dirname + '/../framework/objects')();
    Array = require(__dirname + '/../framework/arrays')();
    String = require(__dirname + '/../framework/strings')();
    require(__dirname + '/../framework/utils');

    var builtin = [
        "assert",
        "buffer",
        "child_process",
        "cluster",
        "crypto",
        "dgram",
        "dns",
        "events",
        "fs",
        "http",
        "https",
        "net",
        "os",
        "path",
        "querystring",
        "readline",
        "stream",
        "string_decoder",
        "timers",
        "tls",
        "tty",
        "url",
        "util",
        "v8",
        "vm",
        "zlib"
    ];

    require('../globals');

    console.log('');
    fs.readFile(global.PROJECT_HOME + sep + 'app.manifest', function (e, m) {
        var manifest = JSON.parse(m.toString('utf-8'));
        var job = process.env.job;
        if (!job) return false;
        var _App = require(global.PROJECT_SYSTEM + '/../jobs/' + job);

        _App.using = function (unit) {
            //built in classes
            if (builtin.indexOf(unit) > -1) return require(unit);
            if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
            if (unit == "scraper") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'scraper' + sep + 'lib' + sep + 'index.js');
            if (unit == "mailer") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'mailer' + sep + 'lib' + sep + 'index.js');
            try {
                return require(global.ROOT + sep + 'node_modules' + sep + unit);
            } catch (e) {
                return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
            };
        };

        var request = require('request');
        if (process.env['proxy']) {
            _App.request = request.defaults({
                proxy: process.env['proxy'],
                encoding: null
            })
        } else _App.request = request.defaults({
            encoding: null
        });

        _App.api = require(global.ROOT + sep + 'node_modules' + sep + "@omneedia" + sep + "api");

        global.manifest = manifest;

        for (var i = 0; i < global.manifest.api.length; i++) {
            if (global.manifest.api[i].indexOf('@') == -1) {

                _App[global.manifest.api[i]] = require(global.PROJECT_API + sep + global.manifest.api[i] + '.js');

                var self = _App[global.manifest.api[i]].model = {
                    _model: {
                        "type": "raw",
                        "metaData": {
                            "idProperty": -1,
                            "totalProperty": "total",
                            "successProperty": "success",
                            "root": "data",
                            "fields": []
                        },
                        "total": 0,
                        "data": [],
                        "success": false,
                        "message": "failure"
                    },
                    init: function () {
                        self._model.metaData.fields = [];
                        self._model.data = [];
                        self._model.success = false;
                        self._model.message = "failure";
                    },
                    fields: {
                        add: function (o) {
                            if (o === Object(o))
                                self._model.metaData.fields.push(o);
                            else {
                                var t = o.split(',');
                                if (t.length == 3) {
                                    var o = {
                                        name: t[0],
                                        type: t[1],
                                        length: t[2]
                                    };
                                } else {
                                    var o = {
                                        name: o,
                                        type: 'string',
                                        length: 255
                                    };
                                };
                                self._model.metaData.fields.push(o);
                            }
                        }
                    },
                    data: {
                        add: function (o) {
                            self._model.data.push(o);
                            self._model.total = self._model.data.length;
                        }
                    },
                    get: function () {
                        self._model.success = true;
                        self._model.message = "success";
                        return self._model;
                    }
                };
                _App[global.manifest.api[i]].IO = {
                    send: function (uri, data, users) {
                        var o = {
                            uri: uri,
                            data: data,
                            users: users
                        };
                        var socket = require('socket.io-client')(global.registry.uri);
                        if (uri.indexOf("#") > -1) socket.emit("#send", JSON.stringify(o));
                    }
                };

                _App[global.manifest.api[i]].using = function (unit) {
                    //built in classes
                    if (builtin.indexOf(unit) > -1) return require(unit);
                    if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
                    if (unit == "scraper") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'scraper' + sep + 'lib' + sep + 'index.js');
                    if (unit == "mailer") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'mailer' + sep + 'lib' + sep + 'index.js');
                    try {
                        return require(global.ROOT + sep + 'node_modules' + sep + unit);
                    } catch (e) {
                        return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
                    };
                };
            }
        };


        _App.tmpdir = function (filename) {
            var OS = require('os');
            return OS.tmpdir();
        };

        _App.temp = function (ext) {
            var uid = Math.uuid();
            var dir = _App.tmpdir() + sep + "tempfiles";
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

        _App.getData = function () {
            return "/data";
        };

        _App.util = require('../util');

        function callback() {
            console.log('\n[ DONE ] Job\'s finished.\n');
            var jobs = global.settings.jobs;
            console.log(jobs);
            for (var i = 0; i < jobs.length; i++) {
                if (jobs[i].run.type == "loop") {
                    var every = jobs[i].run.every;
                    if (!every) every = 1000;
                    else every = every * 1000;
                    setTimeout(function () {
                        _App.init(callback);
                    }, every);
                };
            }
        };

        console.log('\n\t- Contacting manager') global.request(Config.host + '/io.uri', function (e, r, io_host) {

            global.request(Config.host + '/session.uri', function (e, r, Config_session) {

                if (!process.env.proxy) io_host = Config.host;

                var ioclient = require('socket.io-client');

                global.socket = ioclient(io_host, {
                    query: "engine=app&iokey=" + setToken() + '&task=' + Config.task + '&hid=' + Config.hid + '&port=' + 3000 + '&thread=' + process.pid + '&appid=' + global.manifest.uid,
                    reconnection: true,
                    reconnectionDelay: 1000
                });

                global.socket.on('disconnect', function (x) {
                    console.log("\t! manager lost...");
                });

                global.socket.on('connect', function () {
                    console.log('\t* waiting for manager to send settings...');
                });

                global.socket.on('#CONFIG', function (r) {
                    global.settings = r;
                    console.log('\t* launching job ' + job);
                    Config.session = r.session;
                    global.settings = r.config;

                    global.registry = global.settings.registry;

                    if (process.env.proxy) Config.session = Config_session;

                    _App.init(callback);

                });

            });
        });

    });

};