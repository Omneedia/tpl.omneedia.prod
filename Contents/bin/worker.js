/**
 *
 *	Omneedia Worker Foundation
 *	v 0.9.9-Alpha
 *
 **/

// task=xxx port=3000 node worker.js

var cluster = require('cluster');
var os = require('os');
var fs = require('fs');

var bonjour = require('bonjour')();

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

var CONFIG = __dirname + '/../config/';

require('./worker.lib/utils/fs')();
require('./worker.lib/utils/crypto')();

var NET = require('./worker.lib/utils/net');

var startMaster = require("./worker.lib/Master");
var startThreads = require('./worker.lib/Threads');

if (cluster.isMaster) {
    console.log('\nDiscovering hypervisor...');
    bonjour.find({
        type: 'hypervisor',
        subtypes: [
            NET.getIPAddress()
        ]
    }, function (service) {

        var Config = {};
        Config = service.txt;

        console.log('[OK] Found ' + service.txt.host);
        startMaster(NET, cluster, Config);

    });
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