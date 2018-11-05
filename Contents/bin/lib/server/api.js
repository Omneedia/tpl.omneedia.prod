module.exports = function (app, express, Config) {
    var fs = require('fs');
    var path = require('path');
    var sep = "/";

    function processRoute(req, resp, next) {

        var fs = require('fs');
        var path = require('path');

        var parseFunction = require('@omneedia/parse-function')
        var parser = parseFunction({
            ecmaVersion: 2017
        });

        function process_api(d, i, batch, res) {
            if (!d[i]) return res.end(JSON.stringify(batch, 'utf8'));

            var api = d[i];
            try {
                var name = require.resolve(api.action);
                delete require.cache[name];
            } catch (e) {};
            if (!api.action) return resp.status(400).end('BAD_REQUEST');
            try {
                if (api.action == "__QUERY__") {
                    var x = require(global.ROOT + sep + "node_modules" + sep + "@omneedia" + sep + "db" + sep + api.action + ".js");
                } else
                    var x = require(global.PROJECT_API + sep + api.action + ".js");
                //x.fingerprint = req.session.fingerprint;
            } catch (e) {
                return resp.status(400).end('BAD_REQUEST');
            };
            x.auth = req.session.user;
            x.session = req.session;

            x = require(__dirname + '/global.js')(x);

            var myfn = parser.parse(x[api.method]);
            var response = {};
            response.params = myfn.args;
            var p = [];
            if (response.params.length > 1) {
                for (var e = 0; e < response.params.length - 1; e++) {
                    if (!api.data) return resp.status(400).end('BAD_REQUEST');
                    p.push(api.data[e]);
                };
            };
            p.push(function (err, response) {
                if (err) {
                    batch.push({
                        action: api.action,
                        method: api.method,
                        result: response,
                        message: err.message,
                        data: err,
                        tid: api.tid,
                        type: "rpc"
                    });
                } else {
                    err = null;
                    batch.push({
                        action: api.action,
                        method: api.method,
                        result: response,
                        tid: api.tid,
                        type: "rpc"
                    });
                };
                process_api(d, i + 1, batch, res);
            });
            try {
                x[api.method].apply({}, p);
            } catch (e) {
                batch.push({
                    type: 'exception',
                    action: api.action,
                    method: api.method,
                    message: e.message,
                    data: e
                });
                process_api(d, i + 1, batch, res);
            }

        };

        var data = req.body;

        var d = [];
        if (data instanceof Array) {
            d = data;
        } else {
            d.push(data);
        };

        process_api(d, 0, [], resp);
    };

    var sqlinjection = function (req, res, next) {
        try {
            var headers = req.headers.cookie.split('; ');
            var cookie_header = -1;
        } catch (e) {

        }

        /*for (var i = 0; i < headers.length; i++) {
            if (headers[i].indexOf('z=') > -1) cookie_header = headers[i].split('z=')[1];
        };
        if (!req.session.fingerprint) return res.status(401).end('UNAUTHORIZED');
        if (!req.headers.z) {
            if (cookie_header != req.session.fingerprint) return res.status(401).end('UNAUTHORIZED');
        } else {
            if (req.session.fingerprint != req.headers.z) return res.status(401).end('UNAUTHORIZED');
        };*/

        function hasSql(value) {

            if (value === null || value === undefined) {
                return false;
            }

            // sql regex reference: http://www.symantec.com/connect/articles/detection-sql-injection-and-cross-site-scripting-attacks
            var sql_meta = new RegExp('(%27)|(--)|(%23)', 'i');
            if (sql_meta.test(value)) {
                /*console.log('-0---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_meta2 = new RegExp('((%3D)|(=))[^\n]*((%27)|(\')|(--)|(%3B)|(;))', 'i');
            if (sql_meta2.test(value)) {
                /*console.log('-1---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_typical = new RegExp('w*((%27)|(\'))((%6F)|o|(%4F))((%72)|r|(%52))', 'i');
            if (sql_typical.test(value)) {
                /*console.log('-2---');
                console.log(value);
                console.log('----');*/
                return true;
            }

            var sql_union = new RegExp('((%27)|(\'))union', 'i');
            if (sql_union.test(value)) {
                return true;
            }

            return false;
        };

        var containsSql = false;

        function iterate(obj) {
            var walked = [];
            var stack = [{
                obj: obj,
                stack: ''
            }];
            while (stack.length > 0) {
                var item = stack.pop();
                var obj = item.obj;
                for (var property in obj) {
                    if (obj.hasOwnProperty(property)) {
                        if (typeof obj[property] == "object") {
                            var alreadyFound = false;
                            for (var i = 0; i < walked.length; i++) {
                                if (walked[i] === obj[property]) {
                                    alreadyFound = true;
                                    break;
                                }
                            }
                            if (!alreadyFound) {
                                walked.push(obj[property]);
                                stack.push({
                                    obj: obj[property],
                                    stack: item.stack + '.' + property
                                });
                            }
                        } else {
                            if (hasSql(property)) return true;
                            if (hasSql(obj[property])) return true;
                        }
                    }
                }
            }
        };
        if (req.originalUrl !== null && req.originalUrl !== undefined) {
            if (hasSql(req.originalUrl) === true) {
                containsSql = true;
            };
            if (!req.body.length) {
                containsSql = iterate(req.body);
            } else {
                for (var i = 0; i < req.body.length; i++) {
                    var item = req.body[i];
                    containsSql = iterate(item);
                };
            }
        };

        if (containsSql) return res.status(403).end('SQL_INJECTION');
        next();
    };

    app.post('/api', sqlinjection, processRoute);

}