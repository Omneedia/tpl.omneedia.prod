module.exports = {
    request: function (o, cb) {
        var request = require('request');
        try {
            if (global.CFG.current.proxy) var R = request.defaults({
                proxy: global.CFG.current.proxy
            });
            else var R = request;
        } catch (e) {
            var R = request;
        };
        return R(o, cb);
    },
    connect: function (name, fn) {
        var shortid = require('shortid');
        name = name.split('cloud://')[1];
        var uri = "https://" + name.split('/')[0].split('@')[1] + '/';
        var auth = {
            username: name.split(':')[0],
            password: name.split(':')[1].split('@')[0]
        };
        var site = name.split('/')[1];
        var db = name.split('/')[2].split('?');
        if (db.length > 1) var branch = db[1];
        else var branch = "default";
        db = db[0];
        if (db.indexOf('@') > -1) {
            var version = db.split('@')[1];
            db = db.split('@')[0];
        } else var version = -1;
        if ((branch != "default") && (version != -1)) return fn('BRANCH_VERSION_MISMATCH', null);
        var options = {
            uri: uri,
            method: "get",
            auth: auth,
            headers: {
                'User-Agent': 'cloud-db',
                'PID': shortid.generate()
            }
        };
        var o = {
            options: options,
            db: db,
            site: site,
            branch: branch,
            version: version
        };
        this.request(options, function (e, r, b) {
            if (e) return fn('SERVER_UNREACHABLE', null);
            if (r.statusCode != 200) return fn('CONNECTION_REFUSED', null);
            fn(null, o);
        });
    },
    query: function (name, sql, fn) {
        var p = this;
        this.connect(name, function (err, q) {
            if (err) return fn(err, null);
            q.options.method = "POST";
            q.options.form = {
                site: q.site,
                branch: q.branch,
                db: q.db,
                version: q.version,
                sql: q.options.headers.PID + new Buffer(sql).toString('base64')
            };
            p.request(q.options, function (e, r, b) {
                if (e) return fn('{"ERR":' + JSON.stringify(e) + '}', null);
                var result = JSON.parse(b);
                if (result.ERR) return fn(result, null);
                return fn(null, result);
            })
        });
    },
    model: function (name, sql, fn) {
        var p = this;
        this.connect(name, function (err, q) {
            if (err) return fn(err, null);
            q.options.method = "POST";
            q.options.form = {
                type: "model",
                site: q.site,
                branch: q.branch,
                db: q.db,
                version: q.version,
                sql: q.options.headers.PID + new Buffer(sql).toString('base64')
            };
            p.request(q.options, function (e, r, b) {
                if (e) return fn('{"ERR":' + JSON.stringify(e) + '}', null);
                var result = JSON.parse(b);
                if (result.ERR) return fn(result, null);
                return fn(null, result);
            })
        });
    },
    store: function (name, sql, fn) {
        var p = this;
        this.connect(name, function (err, q) {
            if (err) return fn(err, null);
            q.options.method = "POST";
            q.options.form = {
                type: "store",
                site: q.site,
                branch: q.branch,
                db: q.db,
                version: q.version,
                sql: q.options.headers.PID + new Buffer(sql).toString('base64')
            };
            p.request(q.options, function (e, r, b) {
                if (e) return fn('{"ERR":' + JSON.stringify(e) + '}', null);
                var result = JSON.parse(b);
                if (result.ERR) return fn(result, null);
                return fn(null, result);
            })
        });
    },
    del: function (name, tb, ndx, cb) {
        var p = this;
        this.connect(name, function (err, q) {
            if (err) return fn(err, null);
            q.options.method = "POST";
            q.options.form = {
                type: "del",
                tb: tb,
                ndx: ndx,
                site: q.site,
                branch: q.branch,
                db: q.db,
                version: q.version
            };
            p.request(q.options, function (e, r, b) {
                if (e) return fn('{"ERR":' + JSON.stringify(e) + '}', null);
                var result = JSON.parse(b);
                if (result.ERR) return fn(result, null);
                return fn(null, result);
            })
        });
    },
    posts: function (name, tb, o, ndx, results, cb) {
        var _p = this;
        this.post(name, tb, o[ndx], function (e, r) {
            if (ndx + 1 < o.length) {
                if (e) results.push(e);
                else results.push(r);
                _p.posts(name, tb, o, ndx + 1, results, cb);
            } else {
                if (e) results.push(e);
                else results.push(r);
                cb(null, results);
            };
        });
    },
    showColumns: function (name, tb, cb) {
        var p = this;
        this.connect(name, function (err, q) {
            if (err) return cb(err, null);
            q.options.method = "POST";
            q.options.form = {
                type: "showcolumns",
                tb: tb,
                site: q.site,
                branch: q.branch,
                db: q.db,
                version: q.version
            };
            p.request(q.options, function (e, r, b) {
                if (e) return cb(e, null);
                var result = JSON.parse(b);
                if (result.ERR) return cb(result, null);
                return cb(null, result);
            })
        });
    },
    post: function (name, tb, o, cb) {

        var p = this;

        if (Object.prototype.toString.call(o) === '[object Array]') {
            if (o.length == 0) {
                response.message = "success";
                response.success = true;
                cb(response);
                return;
            };
            this.posts(name, tb, o, 0, [], cb);
            return;
        };

        function qstr(str) {
            //if (typeof str === 'object') return "";
            if (str == "null") return 'NULL';
            if (!str) return "NULL";
            try {
                if (str.indexOf('’') > -1) str = str.replace(/’/g, "'");
            } catch (e) {};
            try {
                var obj = '\'' + str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
                    //console.log('o');
                    switch (char) {
                        case "\0":
                            return "\\0";
                        case "\x08":
                            return "\\b";
                        case "\x09":
                            return "\\t";
                        case "\x1a":
                            return "\\z";
                        case "\n":
                            return "\\n";
                        case "\r":
                            return "\\r";
                        case "%":
                            return "%";
                        case "\"":
                        case "'":
                        case "\\":
                            return "\\" + char; // prepends a backslash to backslash, percent,
                            // and double/single quotes
                    }
                }) + '\'';
            } catch (e) {
                return '\'' + str + '\'';
            };
            return obj;
        };

        function isDate(fld, e, response) {
            for (var i = 0; i < response.length; i++) {
                if (response[i].Field == fld) {
                    if (response[i].Type.indexOf('date') > -1) return true;
                    else return false;
                };
            };
        };

        function ISODateString(d) {
            if (!d) return null;

            function isDate(d) {
                return (d instanceof Date && !isNaN(date.valueOf()));
            };
            String.prototype.toDate = function () {
                try {
                    var mydate = this.split('T')[0];
                    var mytime = this.split('T')[1].split('Z')[0];
                    var y = mydate.split('-')[0] * 1;
                    var M = mydate.split('-')[1] * 1 - 1;
                    var d = mydate.split('-')[2] * 1;
                    var h = mytime.split(':')[0] * 1;
                    var m = mytime.split(':')[1] * 1;
                    var s = mytime.split(':')[2] * 1;
                    var x = new Date(y, M, d, h, m, s);
                    //x.setHours(x.getHours() - x.getTimezoneOffset() / 60);
                    return x;
                } catch (e) {
                    return new Date(0, 0, 0, 0, 0, 0);
                }
            };

            function pad(n) {
                return n < 10 ? '0' + n : n
            };
            try {
                if (!isDate(d)) d = d.toDate();
            } catch (e) {};
            return d.getFullYear() + '-' +
                pad(d.getMonth() + 1) + '-' +
                pad(d.getDate()) + ' ' +
                pad(d.getHours()) + ':' +
                pad(d.getMinutes()) + ':' +
                pad(d.getSeconds());
        };

        function getBase64(fld, x, ob, cb) {
            if (!fld[x]) cb();
            else {
                var path = ob[fld[x].Field];
                if (!path) {
                    x++;
                    getBase64(fld, x, ob, cb);
                    return;
                };
                var request = App.using('request').defaults({
                    encoding: null
                });
                if (path.indexOf('url(') > -1) path = path.substr(path.indexOf('url(') + 1, path.length - 1);
                if (path.indexOf('://') > -1)
                    request.get(path, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body, 'binary').toString('base64');
                            ob[fld[x].Field] = data;
                            x++;
                            getBase64(fld, x, ob, cb);
                        } else {
                            // ressource non disponible
                            x++;
                            getBase64(fld, x, ob, cb);
                        }
                    });
                else {
                    x++;
                    getBase64(fld, x, ob, cb);
                }
            }
        };
        // get index
        var all_o = [];
        for (var el in o) all_o.push(el);
        var ISDBX = 0;
        this.showColumns(name, tb, function (e, response) {
            var r = [];
            var _fields = [];
            var _boolean = [];
            var zobj = {};
            for (var i = 0; i < response.length; i++) {
                if (all_o.indexOf(response[i].Field) > -1) zobj[response[i].Field] = o[response[i].Field];
                if (response[i].Key == "PRI") r.push({
                    Column_name: response[i].Field
                });
                var tytpe = response[i].Type.toUpperCase();
                if (response[i].Field == "createdAt") isDBX = 1;

                if (tytpe.indexOf("TINYINT") > -1) _boolean.push(response[i].Field);
                if ((tytpe == "LONGTEXT") || (tytpe.indexOf('BLOB') > -1) || (tytpe.indexOf('BINARY') > -1)) _fields.push(response[i]);
            };
            o = zobj;
            getBase64(_fields, 0, o, function () {
                if (r.length > 0) {
                    var ndx = r[0].Column_name;
                    if (!o[ndx]) {
                        console.log('_____ INSERT');
                        var fields = [];
                        var values = [];
                        var ol = 0;
                        for (var el in o) {
                            fields.push(el);
                            if (_boolean.indexOf(el) > -1) {
                                if (o[el] == "true") o[el] = '1';
                                if (o[el] == "false") o[el] = '0';
                                if (o[el]) o[el] = '1';
                                if (!o[el]) o[el] = '0';
                                if (o[el] === null) o[el] = '0';
                            };
                            if (isDate(el, o[el], response)) {
                                try {
                                    if (o[el].indexOf('T') > -1) values.push(qstr(o[el].split('T')[0] + ' ' + o[el].split('T')[1].split('Z')[0]));
                                } catch (e) {
                                    values.push(qstr(ISODateString(o[el])));
                                }
                            } else {
                                if (typeof o[el] === 'object') values.push(qstr(JSON.stringify(o[el])));
                                else {
                                    try {
                                        if (o[el].toLowerCase() == "null") values.push(o[el].toUpperCase());
                                        else values.push(qstr(o[el]));
                                    } catch (e) {
                                        values.push(qstr(o[el]));
                                    }
                                }
                            };
                            if (!values[ol]) values.push('NULL');
                            ol++;
                        };
                        if (isDBX == 1) {
                            fields.push("createdAt");
                            values.push(qstr(new Date().toISOString().slice(0, 19).replace('T', ' ')));
                            fields.push("updatedAt");
                            values.push(qstr(new Date().toISOString().slice(0, 19).replace('T', ' ')));
                        };
                        var sql = "INSERT INTO " + tb + " (" + fields.join(',') + ") VALUES (" + values.join(',') + ")";
                        console.log(sql);
                        p.query(name, sql, function (err, rows) {
                            //console.log(err);
                            if (rows) {
                                err = null;
                                rows.method = "INSERT";
                            } else rows = err;
                            cb(err, rows);
                        });
                    } else {
                        var sql = "SELECT * FROM " + tb + " WHERE ";
                        var params = [];
                        for (var j = 0; j < r.length; j++) {
                            var ndx = r[j].Column_name;
                            params.push(ndx + '=' + qstr(o[ndx]));
                        };
                        sql += params.join(' AND ');
                        console.log(sql);
                        p.query(name, sql, function (err, rows) {
                            if (rows.length == 0) {
                                console.log('_____ INSERT');
                                var fields = [];
                                var values = [];
                                var ol = 0;
                                for (var el in o) {
                                    fields.push(el);
                                    if (_boolean.indexOf(el) > -1) {
                                        if (o[el] == "true") o[el] = '1';
                                        if (o[el] == "false") o[el] = '0';
                                        if (o[el]) o[el] = '1';
                                        if (!o[el]) o[el] = '0';
                                        if (o[el] === null) o[el] = '0';
                                    };
                                    if (isDate(el, o[el], response)) {
                                        try {
                                            if (o[el].indexOf('T') > -1) values.push(qstr(o[el].split('T')[0] + ' ' + o[el].split('T')[1].split('Z')[0]));
                                        } catch (e) {
                                            values.push(qstr(ISODateString(o[el])));
                                        }
                                    } else {
                                        if (typeof o[el] === 'object') values.push(qstr(JSON.stringify(o[el])));
                                        else {
                                            try {
                                                if (o[el].toLowerCase() == "null") values.push(o[el].toUpperCase());
                                                else values.push(qstr(o[el]));
                                            } catch (e) {
                                                values.push(qstr(o[el]));
                                            }
                                        }
                                    };
                                    if (!values[ol]) values.push('NULL');
                                    ol++;
                                };
                                if (isDBX == 1) {
                                    fields.push("createdAt");
                                    values.push(qstr(new Date().toISOString().slice(0, 19).replace('T', ' ')));
                                    fields.push("updatedAt");
                                    values.push(qstr(new Date().toISOString().slice(0, 19).replace('T', ' ')));
                                };
                                var sql = "INSERT INTO " + tb + " (" + fields.join(',') + ") VALUES (" + values.join(',') + ")";
                                console.log(sql);
                                p.query(name, sql, function (err, rows) {
                                    if (rows) {
                                        err = null;
                                        rows.method = "INSERT";
                                    } else rows = err;
                                    cb(err, rows);
                                });
                            } else {
                                console.log('_____ UPDATE');
                                var fields = [];
                                for (var el in o) {
                                    if (_boolean.indexOf(el) > -1) {
                                        if (o[el] == "true") o[el] = '1';
                                        if (o[el] == "false") o[el] = '0';
                                        if (o[el]) o[el] = '1';
                                        if (!o[el]) o[el] = '0';
                                        if (o[el] === null) o[el] = '0';
                                    };
                                    if (isDate(el, o[el], response)) {
                                        try {
                                            if (o[el].indexOf('T') > -1) values.push(el + '=' + qstr(o[el].split('T')[0] + ' ' + o[el].split('T')[1].split('Z')[0]));
                                        } catch (e) {
                                            fields.push(el + '=' + qstr(ISODateString(o[el])));
                                        }
                                    } else {
                                        if (typeof o[el] === 'object') fields.push(el + '=' + qstr(JSON.stringify(o[el])));
                                        else {
                                            try {
                                                if (o[el].toLowerCase() == "null") fields.push(el + '=' + o[el]);
                                                else fields.push(el + '=' + qstr(o[el]));
                                            } catch (e) {
                                                fields.push(el + '=' + qstr(o[el]));
                                            }
                                        }
                                    };
                                };
                                if (isDBX == 1) {
                                    fields.push("updatedAt");
                                    values.push('updatedAt="' + new Date().toISOString().slice(0, 19).replace('T', ' ') + '"');
                                };
                                var sql = "UPDATE " + tb + " SET " + fields.join(',') + " WHERE " + params.join(' AND ');
                                console.log(sql);
                                p.query(name, sql, function (err, rows) {
                                    if (rows) {
                                        err = null;
                                        rows.method = "UPDATE";
                                        rows.indexID = ndx;
                                        rows.indexValue = o[ndx];
                                    } else rows = err;
                                    cb(err, rows);
                                });

                            }
                        });
                    }
                } else cb("ERR: No index in table", null);
            });
        });
    }
}