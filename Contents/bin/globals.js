module.exports = function () {

    var sep = "/";

    global.ROOT = __dirname + sep + '..' + sep + '..' + sep + 'bin';
    global.PROJECT_HOME = __dirname + sep + '..' + sep + '..';
    global.PROJECT_BIN = PROJECT_HOME + sep + "bin";
    global.PROJECT_WEB = PROJECT_HOME + sep + "www";
    global.PROJECT_ETC = PROJECT_HOME + sep + "etc";
    global.PROJECT_TMP = PROJECT_HOME + sep + "tmp";
    global.PROJECT_AUTH = PROJECT_HOME + sep + "auth";
    global.PROJECT_API = PROJECT_HOME + sep + "api";
    global.PROJECT_SYSTEM = PROJECT_HOME + sep + "var";


}();