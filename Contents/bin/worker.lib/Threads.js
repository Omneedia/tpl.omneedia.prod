module.exports = function (NET, cluster, Config, Settings, URI) {

    var events = require('events');
    global.uri = URI;
    global.settings = Settings;
    global.eventEmitter = new events.EventEmitter();

    Math = require(__dirname + '/../lib/framework/math')();
    Date = require(__dirname + '/../lib/framework/dates')();
    Object = require(__dirname + '/../lib/framework/objects')();
    Array = require(__dirname + '/../lib/framework/arrays')();
    String = require(__dirname + '/../lib/framework/strings')();
    require(__dirname + '/../lib/framework/utils');

    var date = new Date();
    global.Config = Config;

    console.log("\t* thread started @ " + date.toMySQL() + " #" + process.pid);

    var ioclient = require('socket.io-client');
    var port = process.env.port;
    if (!port) port = 3000;

    var express = require('express');
    var app = express();
    var server = app.listen(0, NET.getIPAddress());

    // POST
    var bodyParser = require('body-parser');

    app.use(bodyParser.json({
        limit: '5000mb',
        extended: true
    }));

    app.use(bodyParser.urlencoded({
        limit: '5000mb',
        extended: true
    }));

    function init_thread() {

        // compression
        app.use(require('compression')());

        var path = require('path');
        var fs = require('fs');

        var request = require('request');
        if (process.env.proxy) {
            global.request = request.defaults({
                'proxy': process.env.proxy
            })
        } else global.request = request;

        app.enable('trust proxy');

        // LOGGER
        var morgan = require('mongo-morgan');

        app.use(morgan(Config.session + 'logs', 'combined', {
            collection: "logs"
        }));

        // cookie parser
        var cookieParser = require('cookie-parser');
        app.use(cookieParser('0mneediaRulez!'));

        // Upload
        var multer = require('multer');

        var storage = require('multer-gridfs-storage')({
            url: Config.session + 'upload'
        });

        app.UPLOAD = multer({
            storage: storage
        });

        app.use(express.static(global.PROJECT_WEB));

        app.get('/favicon.ico', function (req, res) {
            fs.readFile(global.PROJECT_WEB + path.sep + 'index.html', function (e, index) {
                if (e) return res.status(404).send('Not found');
                try {
                    var b64 = index.toString('utf-8').split("newLink.href='data:image/png;base64,")[1].split("'")[0];
                } catch (e) {
                    return res.status(404).send('Not found');
                };
                res.end(Buffer.from(b64, 'base64'));
            });
        });

        app.get('/i18n', function (req, res) {
            res.set("Content-Type", 'application/javascript');
            res.send(req.headers['accept-language'].split(';')[0]);
        });

        // Server IO

        var io = require('socket.io')(server, {
            pingTimeout: 60000
        });

        var mongo = require('@omneedia/socket.io-adapter-mongo');

        io.adapter(mongo(Config.session + 'io'));

        // Queue processing
        try {
            global.queue = require(global.PROJECT_SYSTEM + '/queue');
            global.queue = Object.assign(global.queue, require(__dirname + '/../lib/server/global.js'));
        } catch (e) {
            //console.log(e);
        };

        global.processes = {
            add: function (job, params) {
                var qid = require('shortid').generate();
                this.all.push(qid);
                this.pid[qid] = {
                    job: job,
                    params: params
                };
                var p = {
                    qid: qid,
                    job: job,
                    params: params
                };
                this.all.push(p);
                global.eventEmitter.emit('__queue__', p);
                return qid;
            },
            remove: function (job) {

            },
            all: [],
            pid: {},
            on: function (id) {

            },
            process: {}
        };

        global.eventEmitter.on('__queue__', function (o) {
            var child_process = require('child_process');
            child_process.fork('lib/fn', [], {
                env: {
                    sid: o.qid,
                    p: JSON.stringify(o.params),
                    q: o.job,
                    host: NET.getIPAddress(),
                    port: process.env.port
                }
            });
        });

        io.on('connection', function (socket) {

            try {
                var me = require(__dirname + '/../lib/server/global.js')();
                require(PROJECT_SYSTEM + '/io.js')(me, app.io, socket);
            } catch (e) {

            };

            global.OASocketonAuth = function (response) {
                var r = JSON.parse(response);
                socket.emit("#auth", response);
            };

            global.OASocketonFailedAuth = function (response) {
                socket.emit("#failedauth", response);
            };

            // processing queue
            socket.on('__queue__', function (obj) {
                var p = JSON.parse(JSON.stringify(obj));
                delete p.class;
                delete p.fn;
                var fn = {
                    emit: function (msg) {
                        app.io.emit(p.id, msg);
                    }
                };
                global.queue[obj.class][obj.fn](p, fn);
            });

        });

        // Session
        var Session = require('express-session');

        if (Config.session.indexOf('mongodb://') > -1) {
            var MongoStore = require('connect-mongo')(Session);
            var session = Session({
                secret: 'omneedia_rulez',
                saveUninitialized: true,
                resave: true,
                cookie: {
                    maxAge: 1000 * 60 * 24 // 24 hours
                },
                store: new MongoStore({
                    url: Config.session + 'session'
                })
            });
        };

        app.io = io;

        app.use(session);

        if (global.settings.logs) {
            if (global.settings.logs.enabled) {
                app.use(function (req, res, next) {
                    var db = App.using('db');
                    var log = global.settings.logs.log;
                    db.post(log, {
                        stamp: new Date(),
                        method: req.method,
                        url: req.originalUrl,
                        post: JSON.stringify(req.body),
                        session: req.sessionID,
                        uid: req.session.user.uid
                    }, next);
                });
            }
        };

        // share session with socket.io

        var sharedsession = require("express-socket.io-session");

        io.use(sharedsession(session, {
            autoSave: true
        }));

        // END Session

        // auth
        require('../lib/server/auth')(app);

        // Server process
        require('../lib/server/system')(app, express, Config);

        // Secure Express
        var helmet = require('helmet');
        app.use(helmet({
            frameguard: {
                action: 'sameorigin'
            }
        }));

        var expressDefend = require('express-defend');

        app.use(expressDefend.protect({
            maxAttempts: 5, // (default: 5) number of attempts until "onMaxAttemptsReached" gets triggered 
            dropSuspiciousRequest: true, // respond 403 Forbidden when max attempts count is reached 
            consoleLogging: true, // (default: true) enable console logging 
            //            logFile: 'suspicious.log', // if specified, express-defend will log it's output here 
            onMaxAttemptsReached: function (ipAddress, url) {
                console.log('IP address ' + ipAddress + ' is considered to be malicious, URL: ' + url);
            }
        }));

        // API

        require('../lib/server/api')(app, express, Config);

        app.get('/z/(*)', function (req, res) {
            res.set('Content-Type', 'text/html');
            if (req.url.split('/z/').length == 0) return res.status(405).end('METHOD_NOT_ALLOWED');
            if (!req.headers.referer) return res.status(405).end('METHOD_NOT_ALLOWED');
            req.session.fingerprint = req.url.split('/z/')[1];
            req.session.save(function () {
                res.end('<script>top.window.z="' + req.session.fingerprint + '";top.window.BOOTSTRAP_ME();</script>');
            });
        });

        app.get('/Contents/registry.json', function (req, res) {
            res.set('Content-Type', 'application/json');
            //if (!req.headers.referer) return res.status(405).end('METHOD_NOT_ALLOWED');
            var p = {};
            for (var el in global.settings.registry) {
                if (el.indexOf('!') == -1) p[el] = global.settings.registry[el];
            };
            res.set('Content-Type', 'text/javascript');
            res.end(JSON.stringify(p, null, 4));
        });

        setTimeout(function () {
            global.STARTED = true;
        }, 5000);
        //console.log('\t[ OK ] thread #' + require('cluster').worker.id);

    };

    app.use(function (req, res, next) {
        if (!global.STARTED) {
            var html = "<html><head><style>body{width:100wh;height:90vh;color:#fff;background:linear-gradient(-45deg,#EE7752,#E73C7E,#23A6D5,#23D5AB);background-size:400% 400%;-webkit-animation:Gradient 15s ease infinite;-moz-animation:Gradient 15s ease infinite;animation:Gradient 15s ease infinite}@-webkit-keyframes Gradient{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}@-moz-keyframes Gradient{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}@keyframes Gradient{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}h1,h6{font-family:'Open Sans';font-weight:300;text-align:center;position:absolute;top:45%;right:0;left:0};</style><script>setTimeout(function(){location.href=location.href},10000)</script></head><body><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css?family=Open+Sans:300\" type=\"text/css\" /><h1>Application is starting... Please wait</h1></body></html>";
            res.contentType('html');
            res.end(html);
        } else next();
    });

    var io_host = Config.host;

    global.socket = ioclient(io_host, {
        query: "engine=app&iokey=" + setToken() + '&task=' + Config.task + '&hid=' + Config.hid + '&port=' + port + '&thread=' + process.pid + '&appid=' + global.manifest.uid,
        reconnection: true,
        reconnectionDelay: 1000
    });

    global.socket.on('disconnect', function (x) {
        console.log("\t! manager lost...");
    });

    global.socket.on('connect', function () {
        console.log('\t[ OK ] thread #' + require('cluster').worker.id);
    });

    init_thread();

    process.on('message', function (message, connection) {
        if (message !== 'sticky-session:connection') {
            return;
        }
        console.log(message);
        // Emulate a connection event on the server by emitting the
        // event with the connection the master sent us.
        server.emit('connection', connection);

        connection.resume();
    });

};