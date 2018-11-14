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

    require('../globals');

    console.log('');
    fs.readFile(global.PROJECT_HOME + sep + 'app.manifest', function (e, m) {
        var manifest = JSON.parse(m.toString('utf-8'));
        var job = process.env.job;
        if (!job) return false;
        var _App = require(global.PROJECT_SYSTEM + '/../jobs/' + job);
        _App = Object.assign(_App, require(__dirname + '/global.js')());

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

        console.log('\n\t- Contacting manager');
        global.request(Config.host + '/io.uri', function (e, r, io_host) {

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