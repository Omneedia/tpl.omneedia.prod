module.exports = function (socket) {
    var IO = this;
    var fs = require('fs');
    var shelljs = require('shelljs');

    function io(socket) {
        //console.log(socket);
        // AUTH
        global.OASocketonAuth = function (response) {
            var r = JSON.parse(response);
            console.log('--------------------------------------');
            /*
            if (!Clients.uid[r.uid]) Clients.uid[r.uid] = [];
            if (!Clients.mail[r.mail]) Clients.mail[r.mail] = [];
            if (Clients.uid[r.uid].indexOf(socket.id) == -1) Clients.uid[r.uid].push(socket.id);
            if (Clients.mail[r.mail].indexOf(socket.id) == -1) Clients.mail[r.mail].push(socket.id);*/
            socket.emit("#auth", response);
        };
        global.OASocketonFailedAuth = function (response) {
            socket.emit("#failedauth", response);
        };
    };
    /*
        function io(socket) {
            if (socket.handshake.query.engine) {
                console.log('* Service [' + socket.handshake.query.engine.toUpperCase() + '] ' + socket.id + ' connected from ' + socket.handshake.headers["x-real-ip"]);
                var ip = socket.handshake.headers["x-real-ip"];
                if (global.TRUSTED_HOSTS.indexOf(ip) == -1) {
                    console.log('* Unauthorized - ' + socket.id + ' from ' + socket.handshake.headers["x-real-ip"]);
                    socket.disconnect('* Unauthorized');
                };
            } else
                console.log('+ Client ' + socket.id + ' connected from ' + socket.handshake.headers["x-real-ip"]);

            // send config to builder
            if (socket.handshake.query.engine.toUpperCase() == "BUILDER") {
                mysql_query('SELECT * FROM config WHERE id="' + socket.handshake.query.registry + '"', function(e, r) {
                    if (e) return socket.emit('#BUILDER#OFFLINE', {});
                    if (r.length > 0) return socket.emit('#BUILDER#ONLINE', r[0]);
                    socket.emit('#BUILDER#OFFLINE', {});
                });
            };

            // send config to worker
            if (socket.handshake.query.engine.toUpperCase() == "WORKER") {
                mysql_query('SELECT * FROM config WHERE id="' + socket.handshake.query.registry + '"', function(e, r) {
                    if (e) return socket.emit('#WORKER#OFFLINE', {});
                    if (r.length > 0) return socket.emit('REGISTER_WORKER', r[0]);
                    socket.emit('#WORKER#OFFLINE', {});
                });
            };

            // #OAINSTANCE
            socket.on('WORKER#ONLINE', function(data) {
                console.log(data);
            });

            // #OASERVICE
            socket.on('OAWORKER#ONLINE', function(data) {
                mysql_query('',function(e,r) {

                });
            });
            socket.on('OASERVICE#ONLINE', function(data) {
                mysql_query('DELETE FROM services WHERE host="' + data.host + '"', function(e, r) {
                    console.log("- Registering service");
                    for (var el in data) {
                        console.log('  * ' + el + ' = ' + data[el]);
                    };
                    mysql_query('INSERT INTO services VALUES("' + socket.id + '","' + data.uuid + '","' + data.host + '","' + data.service + '","' + data.pid + '","' + data.label + '","' + data.threads + '","' + data.os + '","' + data.release + '")', function(e, r) {
                        data.pid = socket.id;
                        mysql_query('SELECT * FROM hypervisors WHERE uuid="' + data.uuid + '"', function(e, r) {
                            if (r.length <= 0) return console.log('! Not registered.');
                            var r = r[0];
                            IO.emit('OASERVICE#REGISTER','{}');

                        });
                    });
                });
            });

            function sendHeartbeat() {
                setTimeout(sendHeartbeat, 8000);
                IO.emit('ping', { beat: 1 });
            };

            setTimeout(sendHeartbeat, 8000);

            socket.on('disconnect', function(s) {
                console.log('* Closing ' + socket.id + ' - ' + s);
                if (socket.handshake.query.engine) {
                    mysql_query('DELETE FROM services WHERE PID="' + socket.id + '"', function(e, r) {
                        if (r.affectedRows > 0) {
                            IO.emit("OASERVICE#UNREGISTER", socket.id);
                            console.log("* Service " + socket.handshake.query.engine + socket.id + " unregistered.");
                        };
                    });
                } else {

    }

    });
    };
    */

    //return io(socket);
    if (socket.handshake.query.iokey) {
        if (Token(Buffer.from(socket.handshake.query.iokey, 'base64').toString())) io(socket)
        else {
            console.log('* Unauthorized - ' + socket.id + ' from ' + socket.handshake.headers["x-real-ip"]);
            socket.disconnect('* Unauthorized');
        }
        return;
    };

    console.log('* Unauthorized - ' + socket.id + ' from ' + socket.handshake.headers["x-real-ip"]);
    socket.disconnect('* Unauthorized');
}