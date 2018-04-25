module.exports = function (app, express) {
    var path = require('path');
    var sep = "/";
    var OS = require('os');

    var Manifest = global.manifest;

    app.use(express.static(OS.tmpdir() + sep + 'tempfiles'));

    var _App = require(global.PROJECT_SYSTEM + sep + "app.js");

    _App.file = {
        reader: function (ff, cb) {
            var fs = require('fs');
            if (!ff.docId) {
                var path = global.upload_dir + sep + ff;
                fs.stat(path, function (e, stat) {
                    if (e) {
                        if (cb.end) cb.end("NOT_FOUND");
                        else cb("NOT_FOUND", null);
                        return;
                    };
                    var __EXT__ = require('../framework/exts.js')();
                    if (isFunction(cb)) fs.readFile(path, cb);
                    else {
                        if (!cb.end) {
                            cb("MISMATCHED_OBJECT", null);
                            return;
                        }
                        fs.stat(path, function (err, stats) {
                            if (err) cb(err, null);
                            else {
                                cb.set('Content-disposition', 'inline; filename="' + require('path').basename(path) + '"');
                                cb.set("Content-Type", __EXT__.getContentType(path));
                                cb.set("Content-Length", stats.size);
                                fs.readFile(path, function (err, buf) {
                                    if (cb.end) {
                                        if (err) cb.status(404).end('NOT_FOUND');
                                        else cb.end(buf);
                                    } else {
                                        if (err) cb('NOT_FOUND', null);
                                        else cb(null, buf);
                                    }
                                });
                            };
                        });
                    };
                });
            } else {
                if (ff._blob) {
                    if (ff._blob.indexOf(';base64') > -1) {
                        var buf = new Buffer(ff._blob.split(';base64,')[1], 'base64');
                        if (isFunction(cb)) {
                            cb(null, buf);
                        } else {
                            if (cb.end) {
                                cb.set('Content-disposition', 'inline; filename="' + ff.filename + '"');
                                cb.set("Content-Type", ff.type);
                                cb.set("Content-Length", ff.size);
                                cb.end(buf);
                            }
                        };
                    } else {
                        if (cb.end) cb.end("MISMATCHED_OBJECT");
                        else cb("MISMATCHED_OBJECT", null);
                    };
                } else {
                    if (cb.end) cb.end("MISMATCHED_OBJECT");
                    else cb("MISMATCHED_OBJECT", null);
                };
            }
        }
    };
    /*
    _App.upload = {
        toBase64: function (filename, cb) {
            var fs = require('fs');
            var _EXT_ = require('../framework/exts')();
            if (!filename) {
                cb("ID_NOT_FOUND", null);
                return;
            };
            var path = filename;
            fs.stat(path, function (e, r) {
                if (e) return cb("NOT_FOUND", null);
                fs.readFile(path, function (e, bin) {
                    var base64Image = new Buffer(bin, 'binary').toString('base64');
                    cb(null, "data:" + _EXT_.getContentType(path) + ";base64," + base64Image);
                });
            });

        },
        dir: PROJECT_HOME + sep + 'bin' + sep + 'uploads'
    };*/
    app.upload = function (root, cb) {
        app.post(root, app.UPLOAD.any(), function (req, res, next) {
            if (!req.files) return cb("UPLOAD_FAILED", null);
            if (req.files.length == 0) return cb(req, res, null, []);
            var o = {
                id: [],
                file: req.files[0]
            };
            o.id = req.files[0].filename;
            if (!cb) return res.end(JSON.stringify(o.id));
            return cb(req, res, null, o);
        });
    }

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

    _App.cors = require('cors');

    _App.IO = {
        send: function (uri, data, users) {
            var o = {
                uri: uri,
                data: data,
                users: users
            };
            var socket = require('socket.io-client')('http://' + getIPAddress() + ':' + Manifest.server.port);
            if (uri.indexOf("#") > -1) socket.emit("#send", JSON.stringify(o));
        }
    };

    _App.using = function (unit) {
        //built in classes
        if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
        try {
            return require(global.ROOT + sep + 'node_modules' + sep + unit);
        } catch (e) {
            return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
        };
    };

    _App.api = require(global.ROOT + sep + 'node_modules' + sep + "@omneedia" + sep + "api");

    for (var i = 0; i < Manifest.api.length; i++) {
        if (Manifest.api[i].indexOf('@') == -1) {

            _App[Manifest.api[i]] = require(global.PROJECT_API + sep + Manifest.api[i] + '.js');
            var self = _App[Manifest.api[i]].model = {
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
            // deprecated
            //_App[Manifest.api[i]].DB = require(global.ROOT + sep + 'node_modules' + sep + "@omneedia" + sep + "db" +sep + "DB.js");
            //_App[Manifest.api[i]].DB = require(global.ROOT + sep + 'node_modules' + sep + "@omneedia" + sep + "db" + sep + "lib" + sep + "index.js");
            _App[Manifest.api[i]].IO = {
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
            _App[Manifest.api[i]].using = function (unit) {
                return require(global.ROOT + sep + 'node_modules' + sep + unit);
            };

            if (!process.env.task) {
                var setmeup = require('../settings');
                setmeup.update(global.manifest, function (settings) {
                    if (settings.config) app.config = settings.config;
                    if (settings.db) app.db = settings.db;
                    if (settings.auth) app.auth = settings.auth;
                    _App.init(app, express);
                });
            } else {
                if (global.settings.config) app.config = global.settings.config;
                if (global.settings.db) app.db = global.settings.db;
                if (global.settings.auth) app.auth = global.settings.auth;
                _App.init(app, express);

            }


        };
    };
}