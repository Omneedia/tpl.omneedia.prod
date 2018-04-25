module.exports = function() {
    var request = require('request');
    var Request = {};
    if (global.CFG.current.proxy) var Request = request.defaults({
        'proxy': global.CFG.current.proxy
    });
    else Request = request;
    return function(o, cb) {
        if (global.CFG.current.proxy) Request(o, function(e, r, b) {
            if ((e) || ((r.statusCode != 200) && (r.statusCode != 404))) {
                request(o, cb);
            } else cb(e, r, b);
        })
        else request(o, cb);
    };
}();