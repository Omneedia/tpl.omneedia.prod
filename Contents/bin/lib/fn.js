module.exports = function () {

    var fs = require('fs');
    var sep = "/";
    var util = require('./util');
    //var setmeup = require('./settings');

    require(__dirname + '/globals.js');

    fs.readFile(global.PROJECT_HOME + sep + 'app.manifest', function (e, r) {
        if (e) util.error("Can't find app.manifest ... Must be run inside your project root.");
        try {
            global.manifest = JSON.parse(r.toString('utf-8'));
        } catch (e) {
            console.log(e);
            util.error('Manifest not readable');
        };

        var fn = require(__dirname + '/server/global.js')(manifest);

        var sid = process.env['sid'];
        var q = process.env['q'];
        var p = process.env['p'];

        var socket = require('socket.io-client')('http://127.0.0.1:' + global.manifest.server.port);
        socket.on('connect', function (s) {

            if (global.manifest.processes.indexOf(q.split('.')[0]) == -1) {
                //util.error("Process not found.");
                socket.emit('__queue__', {
                    id: sid,
                    event: "failed",
                    class: _cla,
                    fn: _fn,
                    result: "PROCESS_NOT_FOUND"
                });
                return socket.disconnect;
            };

            var _cl = q.split('.')[0];
            var _cla = q.split('.')[0];
            var _fn = q.split('.')[1];
            _cl = require(global.PROJECT_PROCESSES + '/' + _cl);

            fn = Object.assign(fn, _cl);
            var task = {
                sid: socket.id,
                payload: JSON.parse(p),
                progress: function (str) {
                    socket.emit('__queue__', {
                        id: sid,
                        event: "progress",
                        class: _cla,
                        fn: _fn,
                        result: str
                    });
                },
                fail: function (result) {
                    socket.emit('__queue__', {
                        id: sid,
                        event: "failed",
                        class: _cla,
                        fn: _fn,
                        result: result
                    });
                    socket.disconnect();
                },
                end: function (result) {
                    socket.emit('__queue__', {
                        id: sid,
                        event: "end",
                        class: _cla,
                        fn: _fn,
                        result: result
                    });
                    socket.disconnect();
                }
            };
            fn[_fn](task);
        });

    });
}();