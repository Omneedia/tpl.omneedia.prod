module.exports = function (NET, cluster, Config) {

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

    app.use('/', function (req, res) {
        res.set("Content-Type", 'text/html');
        res.end('<script>window.setTimeout(function() {location.reload();},1000);</script>Site is warming up...');
    });

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

        // Upload & POST
        var bodyParser = require('body-parser');

        app.use(bodyParser.json({
            limit: '5000mb',
            extended: true
        }));

        app.use(bodyParser.urlencoded({
            limit: '5000mb',
            extended: true
        }));

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

        var IO = require('./io');
        io.on('connection', IO);

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

        console.log('\n\t* Launched.\n');

    };

    // register worker with manager
    console.log('\n\t- Contacting manager')
    global.request(Config.host + '/io.uri', function (e, r, io_host) {

        global.request(Config.host + '/session.uri', function (e, r, Config_session) {
            /*io_host = process.env.io;
            Config_session = process.env.session;*/

            if (!process.env.proxy) io_host = Config.host;

            global.socket = ioclient(io_host, {
                query: "engine=app&iokey=" + setToken() + '&task=' + Config.task + '&hid=' + Config.hid + '&port=' + port + '&thread=' + process.pid + '&appid=' + global.manifest.uid,
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
                console.log('\t* launching instance');
                Config.session = r.session;
                global.settings = r.config;
                if (process.env.proxy) Config.session = Config_session;
                init_thread();
            });
        });
    });

    process.on('message', function (message, connection) {
        if (message !== 'sticky-session:connection') {
            return;
        }

        // Emulate a connection event on the server by emitting the
        // event with the connection the master sent us.
        server.emit('connection', connection);

        connection.resume();
    });

};