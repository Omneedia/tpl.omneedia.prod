module.exports = function() {
    global.qstr = function(str) {
        //if (typeof str === 'object') return "";
        if (str == "null") return 'NULL';
        if (!str) return "NULL";
        try {
            if (str.indexOf('’') > -1) str = str.replace(/’/g, "'");
        } catch (e) {};
        try {
            var obj = '\'' + str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function(char) {
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

    global.mysql_query = function(sql, cb) {
        var mysql = require('mysql');
        var connection = mysql.createConnection("mysql://root@127.0.0.1:" + Config['port.db'] + "/omneedia");
        connection.connect();
        connection.query(sql, cb);
        connection.end();
    };

    global.mysql_model = function(sql, fn) {

        function getMySQLType(typ) {
            var types = require('mysql').Types;
            for (var el in types) {
                if (types[el] == typ) return el;
            };
        };
        var model = {
            "type": "raw",
            "metaData": {
                "idProperty": -1,
                "totalProperty": "total",
                "successProperty": "success",
                "root": "data",
                "fields": [],
                "columns": []
            },
            "total": 0,
            "data": [],
            "success": false,
            "message": "failure"
        };
        var sql2 = sql.split('LIMIT')[0];
        mysql_query(sql2, function(err, rows, fields) {
            if (!err) {
                var total = rows.length;
                mysql_query(sql, function(err, rows, fields) {
                    if (!err) {
                        model.success = true;
                        model.message = "OK";
                        model.data = rows;
                        model.total = total;
                        for (var i = 0; i < fields.length; i++) {
                            var field = fields[i];
                            var typ = getMySQLType(field.type).toLowerCase();
                            if (typ == "var_string") typ = "string";
                            if (typ == "long") typ = "int";
                            if (typ == "newdecimal") typ = "float";
                            if (typ == "blob") typ = "string";
                            if (typ == "tiny") typ = "boolean";
                            if (typ == "short") typ = "int";
                            if (typ == "double") typ = "float";
                            if (field.flags == "16899") model.metaData.idProperty = field.name;
                            var o = {
                                name: field.name,
                                type: typ,
                                length: field.length
                            };
                            if (o.type.indexOf("date") > -1) {
                                o.dateFormat = 'c';
                                o.type = "date";
                            };
                            model.metaData.fields[model.metaData.fields.length] = o;
                        };
                    } else {
                        model.message = err;
                    };
                    fn(err, model);
                });
            } else {
                model.message = err;
                fn(err, model);
            }
        });


    };

    global.q = function(sql, obj, cb) {
        var mysql = require('mysql');
        var connection = mysql.createConnection(Config.db);
        connection.connect();
        connection.query(sql, obj, cb);
        connection.end();
    };


}