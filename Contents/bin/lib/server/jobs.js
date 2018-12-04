process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var fs = require('fs');
var path = require('path');
var sep = "/";
var shelljs = require('shelljs');
var util = require('../util');
require('../../worker.lib/utils/crypto')();

Math = require(__dirname + '/../framework/math')();
Date = require(__dirname + '/../framework/dates')();
Object = require(__dirname + '/../framework/objects')();
Array = require(__dirname + '/../framework/arrays')();
String = require(__dirname + '/../framework/strings')();

require(__dirname + '/../framework/utils');

require('../globals');

console.log('');

var Request = require('request');
var obj = {};
if (process.env['proxy']) {
    obj = {
        'proxy': process.env['proxy']
    };
    shelljs.exec('git config --global http.proxy ' + process.env['proxy']);
    shelljs.exec('git config --global https.proxy ' + process.env['proxy']);
} else {
    shelljs.exec('git config --global --unset http.proxy', {
        silent: true
    });
    shelljs.exec('git config --global --unset https.proxy', {
        silent: true
    });
};

global.request = Request.defaults(obj);

process.on('message', message => {

    Config = message.Config;
    global.settings = message.settings;

    fs.readFile(global.PROJECT_HOME + sep + 'app.manifest', function (e, m) {

        global.manifest = JSON.parse(m.toString('utf-8'));
        var job = message.job;

        if (!job) return false;
        var _App = require(global.PROJECT_SYSTEM + '/../jobs/' + job);
        _App = Object.assign(_App, require(__dirname + '/global.js')());

        _App.util = require('../util');

        function callback() {
            console.log('\n[ DONE ]\tJob\'s finished.\n');

            if (global.settings.job[job].type == "loop") {

                var every = global.settings.job[job].run.every;
                if (!every) every = 1000;
                else every = every * 1000;

                setTimeout(function () {
                    _App.init(callback);
                }, every);
            };

        };

        var io_host = Config.host;
        var Config_session = Config.session;

        var ioclient = require('socket.io-client');

        global.socket = ioclient(io_host, {
            query: "engine=app&iokey=" + setToken() + '&task=' + Config.task + '&hid=' + Config.hid + '&port=' + 3000 + '&thread=' + process.pid + '&appid=' + global.manifest.uid,
            reconnection: true,
            reconnectionDelay: 1000
        });

        var ioclient = require('socket.io-client');

        global.socket = ioclient(Config.host, {
            query: "engine=job&iokey=" + setToken() + '&task=' + Config.task + '&job=' + job,
            reconnection: true,
            reconnectionDelay: 1000
        });

        global.socket.on('disconnect', function (x) {
            console.log("\t! manager lost...");
        });

        global.socket.on('connect', function () {
            console.log('\t* connected to Manager...');
        });

        //global.socket.on('#CONFIG', function (r) {

        console.log('\t* launching job ' + job);
        //Config.session = r.session;

        global.registry = global.settings.registry;

        //if (process.env.proxy) Config.session = Config_session;

        _App.init(callback);

        //});


    });

});