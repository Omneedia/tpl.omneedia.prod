module.exports = function (app, express, Config) {
    var path = require('path');
    var sep = "/";
    var OS = require('os');

    var Manifest = global.manifest;

    //app.use(express.static(OS.tmpdir() + sep + 'tempfiles'));

    var _App = require(global.PROJECT_SYSTEM + sep + "app.js");
    _App = require(__dirname + '/global.js')(_App);

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