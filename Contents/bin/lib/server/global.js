module.exports = function () {
    var _App = this;

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
        copy: function (ff, dest, cb, ndx, err) {
            var me = this;
            if (Array.isArray(ff)) {
                if (!ndx) return this.copy(ff, dest, cb, -1, []);
                if (ndx == -1) ndx = 0;
                if (!ff[ndx]) return cb(err);
                var filename = ff[ndx];
            } else var filename = ff;
            this.reader(filename, {
                output: "buffer"
            }, function (e, o) {
                if (e) {
                    if (err) {
                        err.push(e);
                        return me.copy(ff, dest, cb, ndx + 1, err);
                    }
                    return cb(e);
                };
                dest = _App.getData() + '/' + dest + '/';
                dest = dest.replace(/\/\//g, "/");
                util.mkdir(dest, function () {
                    if (o) App.using('fs').writeFile(dest + o.originalname, o.buffer, function (e) {
                        console.log(dest + o.originalname);
                        if (e) {
                            if (err) {
                                err.push(e);
                                return me.copy(ff, dest, cb, ndx + 1, err);
                            }
                            return cb(e);
                        } else {
                            if (err) return me.copy(ff, dest, cb, ndx + 1, err);
                            else return cb([]);
                        }
                    });
                });
            });
        },
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
            if (Array.isArray(global.settings['docs'])) set = global.settings['docs'][0];
            else set = global.settings['docs'];
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
                        up.filename = list[ndx].filename;
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
            var isUpload = false;
            if (!cb) {
                cb = options;
                options = {
                    output: "json"
                };
            };
            if (!cb) return false;

            function err(x, code) {
                if (!code) code = 400;
                if (cb.end) return cb.status(code).end(x);
                else return cb(x);
            };
            if (!ff) return err('METHOD_NOT_ALLOWED');
            if (!isObject(ff)) {
                ff = {
                    docId: ff
                }
            } else {
                if (!ff.docId) ff.docId = ff.filename;
                if (ff.encoding) isUpload = true;
            };
            var mongoose = require('mongoose');
            var Grid = require('gridfs-stream');
            Grid.mongo = mongoose.mongo;
            var conn = mongoose.createConnection(Config.session + 'upload');

            conn.once('open', function () {
                var gfs = Grid(conn.db);
                gfs.files.find({
                    filename: ff.docId
                }).toArray(function (err, files) {
                    console.log(files);
                    if (err) return err('NOT_FOUND', 404);
                    if (files.length == 0) {
                        if (!global.settings['docs']) return cb("DOCS_SETTINGS_REQUIRED", null);
                        if (Array.isArray(global.settings['docs'])) var set = global.settings['docs'][0];
                        else var set = global.settings['docs'];
                        var db = set.split('://')[0];
                        var tb = set.split('://')[1];
                        _App.using('db').query(db, 'select * from ' + tb + ' where docId="' + ff.docId + '"', function (e, r) {
                            if (cb.end) {
                                if (r.length == 0) return cb.status(404).end('NOT_FOUND');
                                cb.set('Content-disposition', 'inline; filename="' + r[0].filename + '"');
                                cb.set("Content-Type", r[0].type);
                                cb.set("Content-Length", r[0].size);
                                var buf = new Buffer(r[0]._blob.split(';base64,')[1], 'base64');
                                return cb.end(buf);
                            } else {
                                if (r.length == 0) return cb('NOT_FOUND');
                                r[0].docId = ff.docId;
                                if (options.output == "buffer") {
                                    r[0].buffer = new Buffer(r[0]._blob, 'base64');
                                    delete r[0]._blob;
                                };
                                cb(null, r[0]);
                            }
                        });
                    } else {
                        if (err) return err('NOT_FOUND', 404);
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
                                if (options.output.indexOf("buf") > -1) {
                                    if (cb.end) {
                                        cb.set('Content-disposition', 'inline; filename="' + files[0].filename + '"');
                                        cb.set("Content-Type", files[0].contentType);
                                        cb.set("Content-Length", files[0].length);
                                        return cb.end(fbuf);
                                    } else return cb(null, {
                                        filename: files[0].filename,
                                        originalname: ff.originalname,
                                        type: files[0].contentType,
                                        size: files[0].length,
                                        buffer: fbuf
                                    });
                                };
                                if (cb.end) {
                                    cb.set('Content-disposition', 'inline; filename="' + files[0].filename + '"');
                                    cb.set("Content-Type", files[0].contentType);
                                    cb.set("Content-Length", files[0].length);
                                    return cb.end(fbuf);
                                } else {
                                    var response = {
                                        filename: files[0].filename,
                                        originalname: ff.originalname,
                                        type: files[0].contentType,
                                        size: files[0].length,
                                        _blob: "data:" + files[0].contentType + ";base64," + fbuf.toString('base64')
                                    };
                                    cb(null, response);
                                }
                            });
                        } else return err('NOT_FOUND', 404);
                    }
                })
            });

        }
    }

    _App.tmpdir = function (filename) {
        var OS = require('os');
        return OS.tmpdir();
    };

    _App.temp = function (ext) {
        var fs = require('fs');
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

    _App.makePDF = function (url, out, cb) {
        const puppeteer = require('puppeteer');
        class Webpage {
            static async generatePDF(url) {
                const browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }); // Puppeteer can only generate pdf in headless mode.
                const page = await browser.newPage();
                await page.goto(url); // Adjust network idle as required. 
                const pdfConfig = {
                    path: _App.temp('pdf').path, // Saves pdf to disk. 
                    format: 'A4',
                    printBackground: true,
                    margin: { // Word's default A4 margins
                        top: '2.54cm',
                        bottom: '2.54cm',
                        left: '2.54cm',
                        right: '2.54cm'
                    }
                };
                await page.emulateMedia('screen');
                const pdf = await page.pdf(pdfConfig); // Return the pdf buffer. Useful for saving the file not to disk. 

                await browser.close();

                return pdf;
            }
        }

        (async () => {
            const buffer = await Webpage.generatePDF(url);
            if (out) {
                if (!cb) cb = function () {};
                _App.using('fs').writeFile(out, buffer, cb);
            } else return buffer;
        })();
    };

    _App.log = function (action, key, value, uid) {

        if (global.settings['logs']) {
            if (global.settings['logs'].enabled) {

                var set = global.settings['logs'].log;
                var o = {
                    type: "log",
                    action: action,
                    method: key,
                    stamp: new Date(),
                    uid: uid,
                    post: JSON.stringify(value)
                };
                _App.using('db').post(set, o, function (e, r) {
                    //console.log(r);
                });
            };
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