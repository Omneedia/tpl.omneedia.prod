module.exports = function (NET, cluster, Config) {

    var port = process.env.port;
    if (!port) port = 3000;

    var numCPUs = require('os').cpus().length;
    var net = require('net');

    var numCPUs = 1;

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
                msgFromMaster: JSON.stringify(Config)
            });
            workers[i].on('exit', function (worker, code, signal) {
                console.log('\t! RESPAWING WORKER#', i);
                spawn(i);
            });
        };

        // Spawn workers.
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

    };

    init();

};