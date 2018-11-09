module.exports = function (_App) {
    var path = require('path');
    var sep = "/";
    var util = require('../util');

    var Manifest = global.manifest;

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
    _App.file = {
        writer: function (ff, cb) {
            var me = this;
            var set, db, tb;
            var results = [];
            if (cb.end) {
                // via system
                if (!ff) return cb.status(400).end("METHOD_NOT_ALLOWED");
                if (!global.settings['docs']) return cb.status(400).end("DOCS_SETTINGS_REQUIRED");
            } else {
                // via api
                if (!ff) return cb("METHOD_NOT_ALLOWED");
                if (!global.settings['docs']) return cb("DOCS_SETTINGS_REQUIRED");
            };

            if (!Array.isArray(ff)) ff = [ff];
            set = global.settings['docs'][0];
            db = set.split('://')[0];
            tb = set.split('://')[1];

            function upload_blob(list, ndx, cb) {
                if (!list[ndx]) return cb(results);
                // check if file is already uploaded
                _App.using('db').query(db, 'select docId from ' + tb + ' where docId="' + list[ndx].docId + '"', function (err, rrr) {
                    if (err) {
                        results.push("DOCS_ENGINE_NOT_FOUND");
                        return upload_blob(list, ndx + 1, cb);
                    };
                    if (rrr.length > 0) {
                        results.push("ALREADY_UPLOADED");
                        return upload_blob(list, ndx + 1, cb);
                    };
                    me.reader(list[ndx].docId, function (err, up) {
                        if (err) {
                            results.push({
                                docId: list[ndx].docId,
                                status: "ERR",
                                results: err
                            });
                            return upload_blob(list, ndx + 1, cb);
                        };
                        up.docId = list[ndx].docId;
                        _App.using('db').post(db, tb, up, function (err, x) {
                            if (err) results.push({
                                docId: list[ndx].docId,
                                status: "ERR",
                                results: err
                            });
                            else results.push({
                                docId: list[ndx].docId,
                                status: "OK",
                                results: up
                            })
                            upload_blob(list, ndx + 1, cb);
                        });
                    });
                });

            }

            upload_blob(ff, 0, function () {
                cb(results);
            });
        },
        reader: function (ff, options, cb) {
            var fs = require('fs');
            if (!cb) {
                cb = options;
                options = {};
            };
            // If it's a string, the file is in the upload queue
            // If it's an object, the file is in the cloud
            if (cb.end) {
                // via system
                if (!ff) return cb.status(400).end("METHOD_NOT_ALLOWED", null);
                if (!global.settings['docs']) return cb.status(400).end("DOCS_SETTINGS_REQUIRED", null);
                if (!isObject(ff)) {
                    ff = {
                        docId: ff
                    }
                };
                // Check if the file is in the upload
                var mongoose = require('mongoose');
                var Grid = require('gridfs-stream');
                Grid.mongo = mongoose.mongo;
                var conn = mongoose.createConnection(Config.session + 'upload');
                conn.once('open', function () {
                    var gfs = Grid(conn.db);
                    gfs.files.find({
                        filename: ff.docId
                    }).toArray(function (err, files) {
                        if (err) return cb.status(404).end('NOT_FOUND');
                        if (files.length > 0) {
                            var readstream = gfs.createReadStream({
                                filename: ff.docId
                            });
                            readstream.on('error', function (err) {
                                return cb.status(404).end('NOT_FOUND');
                            });
                            cb.set('Content-disposition', 'inline; filename="' + ff.docId + '"');
                            cb.set("Content-Type", files[0].contentType);
                            cb.set("Content-Length", files[0].length);
                            readstream.pipe(cb);
                        } else {
                            // The file is not in the upload
                            var set = global.settings['docs'][0];
                            var db = set.split('://')[0];
                            var tb = set.split('://')[1];
                            _App.using('db').query(db, 'select * from ' + tb + ' where docId="' + ff.docId + '"', function (e, r) {
                                if (r.length == 0) return cb.status(404).end('NOT_FOUND');
                                cb.set('Content-disposition', 'inline; filename="' + r[0].filename + '"');
                                cb.set("Content-Type", r[0].type);
                                cb.set("Content-Length", r[0].size);
                                var buf = new Buffer(r[0]._blob.split(';base64,')[1], 'base64');
                                cb.end(buf);
                            });
                        }
                    });
                });

            } else {
                // via api
                if (!global.settings['docs']) return cb("DOCS_SETTINGS_REQUIRED", null);
                if (!isObject(ff)) return cb("MISMATCHED_OBJECT", null);
                if (!isObject(ff)) {
                    ff = {
                        docId: ff
                    }
                };

                // Check if the file is in the upload
                var mongoose = require('mongoose');
                var Grid = require('gridfs-stream');
                Grid.mongo = mongoose.mongo;
                var conn = mongoose.createConnection(Config.session + 'upload');
                conn.once('open', function () {
                    var gfs = Grid(conn.db);
                    gfs.files.find({
                        filename: ff.docId
                    }).toArray(function (err, files) {
                        if (err) return cb.status(404).end('NOT_FOUND');
                        if (files.length > 0) {
                            var readstream = gfs.createReadStream({
                                filename: ff.docId
                            });
                            readstream.on('error', function (err) {
                                return cb('NOT_FOUND', null);
                            });
                            const bufs = [];
                            readstream.on('data', function (chunk) {
                                bufs.push(chunk);
                            });
                            readstream.on('end', function () {
                                const fbuf = Buffer.concat(bufs);
                                var response = {
                                    filename: files[0].filename,
                                    type: files[0].contentType,
                                    size: files[0].length,
                                    _blob: "data:" + files[0].contentType + ";base64," + fbuf.toString('base64')
                                };
                                cb(null, response);
                            });
                        } else {
                            // The file is not in the upload
                            var set = global.settings['docs'][0];
                            var db = set.split('://')[0];
                            var tb = set.split('://')[1];
                            _App.using('db').query(db, 'select * from ' + tb + ' where docId="' + ff.docId + '"', function (e, r) {
                                if (r.length == 0) return cb('NOT_FOUND', null);
                                r[0].docId = ff.docId;
                                cb(null, r[0]);
                            });
                        }
                    });
                });

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

    var request = require('request');
    if (global.CFG) {
        if (global.CFG.current) {
            if (global.CFG.current.proxy) {
                _App.request = request.defaults({
                    proxy: global.CFG.current.proxy,
                    encoding: null
                })
            } else _App.request = request.defaults({
                encoding: null
            })
        }
    };

    _App.queue = {
        add: function (task, params) {

        }
    };

    _App.getData = function () {
        return '/data';
    };

    _App.cors = require('cors');

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


        };
    };

    return _App;
}