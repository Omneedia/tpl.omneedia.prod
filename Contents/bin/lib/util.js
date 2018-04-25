module.exports = {

    mkdir: function(path, callback) {
        var fs = require('fs');
        path = path.replace(/\//g, require('path').sep);
        var sep = require('path').sep;
        var p = path.split(sep);

        function domkdir(dir, i, cb, path) {
            if (!dir[i]) return cb();
            if (!path) path = "";
            fs.mkdir(path + sep + dir[i], function() {
                path = path + sep + dir[i];
                domkdir(dir, i + 1, cb, path);
            });
        };
        p.shift();
        domkdir(p, 0, callback);
    },

    makedirs: function(dirs, cb) {
        var fs = require('fs');

        function make_dir(list, i, cb) {
            if (!list[i]) return cb();
            fs.mkdir(list[i], function(e) {
                make_dir(list, i + 1, cb);
            });
        };
        if (!cb) var cb = function() {};
        make_dir(dirs, 0, cb);
    },

    error: function(message) {
        var chalk = require('chalk');
        var emojic = require("emojic");
        console.log(' ');
        console.log(' ' + emojic.x + chalk.red.bold('   ' + message));
        console.log(' ');
        process.exit();
    }

}