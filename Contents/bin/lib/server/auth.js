module.exports = function (app) {

    var authom = require("@omneedia/authom");
    var fs = require('fs');
    var path = require('path');
    var sep = "/";

    var util = require('../util');

    // officer
    global.officer = {
        using: function (unit) {
            //built in classes
            if (unit == "db") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'db' + sep + 'lib' + sep + 'index.js');
            if (unit == "mailer") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'mailer' + sep + 'lib' + sep + 'index.js');
            try {
                return require(global.ROOT + sep + 'node_modules' + sep + unit);
            } catch (e) {
                return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
            };
        },
        getProfile: function (user, cb) {
            var response = [];
            // DEPRECATED
            if (!cb) return response;

            global.request({
                uri: global.Config.host + '/api/profile',
                method: "POST",
                form: {
                    user: user,
                    task: global.Config.task
                }
            }, function (e, r, b) {
                cb(JSON.parse(b));
            });
        },
        profiles: {
            getAll: function (cb) {
                global.request({
                    uri: global.Config.host + '/api/profile/all',
                    method: "POST",
                    form: {
                        task: global.Config.task
                    }
                }, function (e, r, b) {
                    console.log('****** ' + global.Config.host + '/api/profile/all');
                    console.log(e);
                    console.log(b);
                    console.log('******');
                    if (e) return cb(e);
                    cb(null, JSON.parse(b));
                });
            },
            get: function (o, cb) {
                if (!o) cb("NO_PROFILE_ID");
                global.request({
                    uri: global.Config.host + '/api/profile/1',
                    method: "POST",
                    form: {
                        task: global.Config.task,
                        profile: o
                    }
                }, function (e, r, b) {
                    console.log('****** ' + global.Config.host + '/api/profile/all');
                    console.log(e);
                    console.log(b);
                    console.log('******');
                    if (e) return cb(e);
                    cb(null, JSON.parse(b));
                });
            }
        }
    };

    var _Officer = require(global.PROJECT_AUTH + sep + "Officer" + ".js");
    if (_Officer.published) {
        global.officer = Object.assign(_Officer.published, global.officer);
    };

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
                if (unit == "mailer") return require(global.ROOT + sep + 'node_modules' + sep + '@omneedia' + sep + 'mailer' + sep + 'lib' + sep + 'index.js');
                try {
                    return require(global.ROOT + sep + 'node_modules' + sep + unit);
                } catch (e) {
                    return require(global.PROJECT_BIN + sep + 'node_modules' + sep + unit);
                };
            };
            // Profiles
            Officer.profiles = {
                getAll: function (cb) {
                    global.request({
                        uri: global.Config.host + '/api/profile/all',
                        method: "POST",
                        form: {
                            task: global.Config.task
                        }
                    }, function (e, r, b) {
                        if (e) return cb(e);
                        cb(null, JSON.parse(b));
                    });
                },
                get: function (o, cb) {
                    if (!o) cb("NO_PROFILE_ID");
                    global.request({
                        uri: global.Config.host + '/api/profile/1',
                        method: "POST",
                        form: {
                            task: global.Config.task,
                            profile: o
                        }
                    }, function (e, r, b) {
                        if (e) return cb(e);
                        cb(null, JSON.parse(b));
                    });
                }
            };
            Officer.getProfile = function (user, cb) {
                var response = [];
                // DEPRECATED
                if (!cb) return response;

                global.request({
                    uri: global.Config.host + '/api/profile',
                    method: "POST",
                    form: {
                        user: user,
                        task: global.Config.task
                    }
                }, function (e, r, b) {
                    cb(JSON.parse(b));
                });

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
        console.log(req.session);
        var authType = req.session.authType;
        req.session.destroy();
        try {
            if (global.settings.auth[authType.toLowerCase()]) var url = global.settings.auth[authType.toLowerCase()].logout;
            else var url = "/bye";
        } catch (e) {
            var url = "/bye";
        };
        return res.redirect(url);
    });

    function ensureAuthenticated(req, res, next) {
        if (!req.user) req.user = req.session.user;
        if (req.user) return next();
        res.end('{"response":"NOT_LOGIN"}');
    };
    /*
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
        */
    app.post('/account', ensureAuthenticated, function (req, res) {

        if (!req.user) req.user = req.session.user;
        var response = [];
        global.request({
            uri: global.Config.host + '/api/profile/all',
            method: "POST",
            form: {
                task: global.Config.task
            }
        }, function (e, r, b) {
            if (e) return cb(e);
            var profiler = JSON.parse(b);
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
        o.service = o.type;
        authom.createServer(o);
    };

    authom.on("auth", function (req, res, data) {
        profile = data;
        Auth.officer(req, profile, function (err, response) {

            if (!response) {
                global.OASocketonFailedAuth(response);
                // Close the login window
                try {
                    res.set('Content-Type', 'text/html');
                } catch (e) {};
                res.end("<html><body><script>setTimeout(window.close, 100);</script></body></html>");
                return;
            };
            try {
                JSON.parse(JSON.stringify(response));
                req.session.user = response;
                global.OASocketonAuth(JSON.stringify(response));
            } catch (e) {
                global.OASocketonFailedAuth(response);
            }
            // Close the login window
            try {
                res.set('Content-Type', 'text/html');
            } catch (e) {};
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