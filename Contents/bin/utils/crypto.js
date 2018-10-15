module.exports = function () {
    global.encrypt = function (text) {
        var crypto = require('crypto');
        var key = "0mneediaRulez!";
        var cipher = crypto.createCipher('aes-256-cbc', key);
        var crypted = cipher.update(text, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    }

    global.Token = function (text) {
        var date = new Date().toMySQL().split(' ')[0];
        var d = require('crypto').createHash('md5').update(date).digest('hex');
        console.log(d);
        if (text == d) return true;
        else return false;
    };

    global.setToken = function () {
        var d = new Date().toMySQL().split(' ')[0];
        return require('crypto').createHash('md5').update(d).digest('hex');
    };
};