module.exports = function (app) {

    var authom = require("@omneedia/authom");
    var fs = require('fs');
    var path = require('path');
    var sep = "/";

    var util = require('../util');

    global.Auth = {
        officer: function (req, profile, fn) {
            this.register(req, profile, function (err, response) {
                fn(err, response);
            });
        },
        register: function (req, profile, cb) {

            var auth_type = profile.service;
            var off = "Officer";
            var fs = require('fs');
            var Officer = require(global.PROJECT_AUTH + sep + off + ".js");
            Officer.using = function (unit) {
                //built in classes
                if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
                try {
                    return require(global.ROOT + sep + 'node_modules' + sep + unit);
                } catch (e) {
                    return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
                };
            };
            Officer.getProfile = function (user, cb) {
                var response = [];
                if (cb) {
                    fs.readFile(global.PROJECT_AUTH + sep + 'Profiler.json', function (e, r) {
                        var profiler = JSON.parse(r.toString('utf-8'));
                        for (var el in profiler.profile) {
                            var p = profiler.profile[el];
                            if (p.indexOf(user) > -1) response.push(el);
                        };
                        cb(response);
                    })
                } else {
                    // DO NOT USE ANYMORE
                    // WILL BE DEPRECATED
                    if (fs.existsSync(global.PROJECT_AUTH + sep + 'Profiler.json')) {
                        var profiler = JSON.parse(require('fs').readFileSync(global.PROJECT_AUTH + sep + 'Profiler.json', 'utf-8'));
                        for (var el in profiler.profile) {
                            var p = profiler.profile[el];
                            if (p.indexOf(user) > -1) response.push(el);
                        };
                    };
                    return response;
                }
            };
            Officer.login(profile, function (err, response) {
                if (err) return cb(err);
                req.session.authType = auth_type;
                req.session.user = response;
                cb(err, response);
            });
        }
    };

    app.get('/bye', function (req, res) {
        res.setHeader('content-type', 'text/html');
        res.end('<script>top.location.reload(true);window.close();</script>');
    });

    app.post('/pid', function (req, res) {
        var authType = req.session.authType;
        req.session.destroy();
        if (global.settings.auth[authType.toLowerCase()]) var url = global.settings.auth[authType.toLowerCase()].logout;
        else var url = "/bye";
        return res.redirect(url);
    });

    app.get('/logout', function (req, res) {
        //console.log(req.session);
        var authType = req.session.authType;
        req.session.destroy();
        if (global.settings.auth[authType.toLowerCase()]) var url = global.settings.auth[authType.toLowerCase()].logout;
        else var url = "/bye";
        return res.redirect(url);
    });

    function ensureAuthenticated(req, res, next) {
        if (!req.user) req.user = req.session.user;
        if (req.user) return next();
        res.end('{"response":"NOT_LOGIN"}');
    };

    app.get('/account', ensureAuthenticated, function (req, res) {
        if (!req.user) req.user = req.session.user;
        var response = [];
        fs.readFile(global.PROJECT_AUTH + sep + 'Profiler.json', function (e, r) {
            if (e) return res.end(JSON.stringify(req.user));
            var profiler = JSON.parse(r.toString('utf-8'));
            for (var el in profiler.profile) {
                var p = profiler.profile[el];
                if (p.indexOf(req.user.mail.split('@')[0]) > -1) response.push(el);
            };
            req.user.profiles = response;
            res.end(JSON.stringify(req.user));
        });
    });

    app.post('/account', ensureAuthenticated, function (req, res) {

        if (!req.user) req.user = req.session.user;
        var response = [];
        fs.readFile(global.PROJECT_AUTH + sep + 'Profiler.json', function (e, r) {
            if (e) return res.end(JSON.stringify(req.user));
            var profiler = JSON.parse(r.toString('utf-8'));
            for (var el in profiler.profile) {
                var p = profiler.profile[el];
                if (p.indexOf(req.user.mail.split('@')[0]) > -1) response.push(el);
            };
            req.user.profiles = response;
            res.end(JSON.stringify(req.user));
        });

    });

    for (var el in global.settings.auth) {
        var o = global.settings.auth[el];
        o.service = el;
        authom.createServer(o);
    };

    authom.on("auth", function (req, res, data) {
        profile = data;
        //console.log(profile);
        Auth.officer(req, profile, function (err, response) {
            if (!response) {
                global.OASocketonFailedAuth(response);
                // Close the login window
                res.set('Content-Type', 'text/html');
                res.end("<html><body><script>setTimeout(window.close, 100);</script></body></html>");
                return;
            };
            if (typeof response == "object") {
                JSON.parse(JSON.stringify(response));
                req.session.user = response;
                global.OASocketonAuth(JSON.stringify(response));
            } else {
                try {
                    JSON.parse(JSON.stringify(response));
                    req.session.user = response;
                    global.OASocketonAuth(JSON.stringify(response));
                } catch (e) {
                    global.OASocketonFailedAuth(response);
                }
            }

            // Close the login window
            res.set('Content-Type', 'text/html');
            res.end("<html><body><script>setTimeout(window.close, 100);</script></body></html>");
        });
    });

    authom.on("error", function (req, res, data) {
        // called when an error occurs during authentication
        console.log('-- ERROR ------');
        console.log(data);
    });

    app.get("/auth/:service", authom.app);

}