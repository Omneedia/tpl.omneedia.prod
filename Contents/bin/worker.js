/**
 *
 *	Omneedia Worker Foundation
 *	v 0.9.9-Alpha
 *
 **/

// task=manager/task port=3000 node worker.js

var cluster = require('cluster');
var os = require('os');
var fs = require('fs');
var shelljs = require('shelljs');

var networkInterfaces = require('os').networkInterfaces();

var IP = [];
for (var e in networkInterfaces) IP.push(networkInterfaces[e][0].address);

function ERROR(message) {

    console.log(' ');
    console.log('[GURU-MEDITATION]');
    console.log(message);
    console.log(' ');
    process.exit();

}

//var CONFIG = __dirname + '/../config/';

require('./worker.lib/utils/fs')();
require('./worker.lib/utils/crypto')();

var NET = require('./worker.lib/utils/net');

var startMaster = require("./worker.lib/Master");
var startThreads = require('./worker.lib/Threads');

if (!process.env.task) return console.log('ERR: Please provide a task!');
var task = process.env.task;
if (task.indexOf('://') == -1) task = 'https://' + task;

var lt = task.lastIndexOf('/');
var host = task.substr(0, lt);
task = task.substr(lt + 1, task.length);

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

if (cluster.isMaster) {


    var Config = {
        host: host,
        task: task
    };

    startMaster(NET, cluster, Config);

} else {

    process.on('message', function (data) {
        if (data.msgFromMaster) {
            var Config = JSON.parse(data.msgFromMaster);
            fs.readFile(__dirname + '/../app.manifest', function (e, r) {
                if (e) {
                    console.log('[FAILED]   No manifest found');
                    return process.exit();
                };
                global.manifest = JSON.parse(r.toString('utf-8'));
                require('./lib/globals.js');
                startThreads(NET, cluster, Config);
            });
        }
    })

};