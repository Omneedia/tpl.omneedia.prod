module.exports = {

    testPort: function(port, host, pid, cb) {
        net.createConnection(port, host).on("connect", function(e) {
            cb("success", pid, e);
        }).on("error", function(e) {
            cb("failure", pid, e);
        });
    },

    getIPAddress: function() {
        var interfaces = require('os').networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];

            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                    return alias.address;
            }
        }

        return '0.0.0.0';
    }

}