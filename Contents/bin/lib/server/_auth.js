module.exports = function (app) {

    var util = require('../util');
    var sep = "/";
    var passport = require('passport');
    app.use(passport.initialize());
    app.use(passport.session());

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
                console.log(err);
                if (err) return cb(err);
                req.session.authType = auth_type;
                req.session.user = response;
                cb(err, response);
            });
        }
    };

    function onAuthenticate(req, res) {
        var profile = {
            service: req.params.service,
            username: req.user
        };
        //console.log(profile);
        Auth.officer(req, profile, function (err, response) {
            if (!response) {
                global.OASocketonFailedAuth(response);
                // Close the login window
                res.set('Content-Type', 'text/html');
                res.end("<html><body><script>setTimeout(window.close, 100);</script></body></html>");
                return;
            };
            try {
                JSON.parse(JSON.stringify(response));
                req.session.user = response;
                global.OASocketonAuth(JSON.stringify(response));
            } catch (e) {
                console.log(e);
                global.OASocketonFailedAuth(response);
            }
            global.request({
                uri: global.Config.host + '/profile',
                method: "POST",
                form: {
                    task: global.Config.task,
                    user: req.session.user.mail.toLowerCase()
                }
            }, function (e, r, bx) {
                var profiler = JSON.parse(bx);
                var rp = [];
                for (var i = 0; i < profiler.length; i++) {
                    rp.push(profiler[i].name);
                };
                req.user.profiles = rp;
                // Close the login window
                res.set('Content-Type', 'text/html');
                res.end("<html><body><script>setTimeout(window.close, 100);</script></body></html>");
            });
        });
    };

    function service(svc, o) {
        try {
            var SVC = require('@omneedia/passport-' + svc);
        } catch (e) {
            util.error('passport-' + svc + ' not found.')
        };
        var svc = new SVC.Strategy(o, function (login, done) {
            return done(null, login);
        });
        passport.use(svc);
    };

    for (var el in global.settings.auth) {
        var o = global.settings.auth[el];
        o.service = o.type;
        o.redirect = 'http://127.0.0.1:' + global.manifest.server.port + '/auth/' + o.service;
        o.host = 'http://127.0.0.1:' + global.manifest.server.port;
        for (var el in o.login) {
            o.login[el] = o.login[el].replace(/{CALLBACK}/g, o.redirect);
            o.login[el] = o.login[el].replace(/{HOST}/g, o.host);
        };
        service(o.type, o.login);
    };

    app.get('/auth/:service', function (req, res, next) {
        passport.authenticate(req.params.service)(req, res, next)
    }, onAuthenticate);

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (id, cb) {
        cb(null, id);
    });

    app.post('/account', function (req, res) {
        if (!req.session.user) return res.status(400).end('{"err":"NOT_AUTHENTICATED"}');
        req.user = req.session.user;
        var response = [];
        global.request({
            uri: global.Config.host + '/profile',
            method: "POST",
            form: {
                task: global.Config.task,
                user: req.user.mail.toLowerCase()
            }
        }, function (e, r, bx) {
            var profiler = JSON.parse(bx);
            for (var i = 0; i < profiler.length; i++) {
                response.push(profiler[i].name);
            };
            req.user.profiles = response;
            res.end(JSON.stringify(req.user));
        });

    });

    app.get('/logout', function (req, res) {
        //console.log(req.session);
        var authType = req.session.authType;
        req.session.destroy();
        if (global.settings.auth[authType.toLowerCase()]) var url = global.settings.auth[authType.toLowerCase()].logout;
        else var url = "/bye";
        return res.redirect(url);
    });

    app.get('/bye', function (req, res) {
        res.setHeader('content-type', 'text/html');
        res.end('<script>top.location.reload(true);window.close();</script>');
    });
}