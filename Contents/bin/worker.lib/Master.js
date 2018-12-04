module.exports = function (NET, cluster, Config) {

    var port = process.env.port;
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

    Math = require(__dirname + '/../lib/framework/math')();
    Date = require(__dirname + '/../lib/framework/dates')();
    Object = require(__dirname + '/../lib/framework/objects')();
    Array = require(__dirname + '/../lib/framework/arrays')();
    String = require(__dirname + '/../lib/framework/strings')();

    function init() {

        console.log('\nOmneedia Worker started at ' + NET.getIPAddress() + ":" + port + " (" + numCPUs + " threads)");

        console.log(' ');

        process.on('exit', function () {
            console.log(' ');
            console.log('\t- Worker stopped.');
            console.log(' ');
        });

        process.on('SIGINT', process.exit); // catch ctrl-c
        process.on('SIGTERM', process.exit); // catch kill 

        var workers = [];

        var worker_index = function (ip, len) {
            var s = '';
            for (var i = 0, _len = ip.length; i < _len; i++) {
                if (ip[i] !== '.') {
                    s += ip[i];
                }
            };
            if (s.indexOf(':') > -1) s = s.substr(s.lastIndexOf(':') + 1, 255);
            return Number(s) % len;
        };

        // Helper function for spawning worker at index 'i'.
        var spawn = function (i) {
            workers[i] = cluster.fork();
            workers[i].send({
                config: JSON.stringify(Config),
                settings: JSON.stringify(global.settings)
            });
            workers[i].on('exit', function (worker, code, signal) {
                console.log('\t! RESPAWING WORKER#', i);
                spawn(i);
            });
        };

        // register worker with manager
        console.log('\t- Contacting manager');

        const {
            fork
        } = require('child_process');

        require('fs').readFile(__dirname + '/../../app.manifest', function (e, r) {
            global.manifest = JSON.parse(r.toString('utf-8'));
            global.request(Config.host + '/io.uri', function (e1, r, io_host) {

                global.request(Config.host + '/session.uri', function (e2, r, Config_session) {

                    if (!process.env.proxy) io_host = Config.host;

                    Config.host = io_host;

                    var ioclient = require('socket.io-client');

                    global.socket = ioclient(io_host, {
                        query: "engine=app&cluster=master&iokey=" + setToken() + '&task=' + Config.task + '&hid=' + Config.hid + '&port=' + port + '&thread=' + process.pid + '&appid=' + global.manifest.uid,
                        reconnection: true,
                        reconnectionDelay: 1000
                    });

                    global.socket.on('disconnect', function (x) {
                        console.log("\t! manager lost...");
                    });

                    global.socket.on('connect', function () {
                        console.log('\t* waiting for manager to send settings...');
                    });



                    global.socket.on('#job', function (s) {
                        console.log('\t- master sent job to worker.');

                        var job = s.job;
                        var r = s.settings;

                        function forkJob(job) {
                            const compute = fork('./lib/server/jobs.js', undefined, {
                                env: process.env
                            });
                            compute.on('exit', function (worker, code, signal) {
                                console.log('\t! RESPAWING JOB');
                                forkJob(job);
                            });
                            if (!r.config.job) r.config.job = {};
                            if (!r.config.job[job]) r.config.job[job] = {
                                type: "loop",
                                run: {
                                    every: 1
                                }
                            };
                            compute.send({
                                job: job,
                                Config: Config,
                                settings: r.config
                            });
                        };
                        forkJob(job);


                    });

                    global.socket.on('#CONFIG', function (r) {

                        console.log('\t* launching instance');
                        Config.session = r.session;
                        global.settings = r.config;
                        if (process.env.proxy) Config.session = Config_session;

                        if (global.manifest.jobs.length > 0) {
                            console.log('\t* launching jobs');
                            global.socket.emit('job', {
                                task: Config.task,
                                jobs: global.manifest.jobs
                            });
                        };

                        for (var i = 0; i < numCPUs; i++) {
                            spawn(i);
                        };

                        var server = net.createServer({
                            pauseOnConnect: true
                        }, function (connection) {
                            var worker = workers[worker_index(connection.remoteAddress, numCPUs)];
                            worker.send('sticky-session:connection', connection);
                        }).listen(port);

                        console.log('\t- Worker starting...');

                    });
                });
            });
        });




    };

    var numCPUs = require('os').cpus().length;
    var net = require('net');

    //var numCPUs = 1;

    if (port == "auto") {
        var fp = require("find-free-port")
        fp(3000, function (err, freePort) {
            port = freePort;
            init();
        });
    } else {
        if (!port) port = 3000;
        init();
    }

};