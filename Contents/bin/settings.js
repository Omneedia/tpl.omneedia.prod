module.exports = function () {
    update: function (manifest, cb) {
        console.log(global.settings);
        cb();
    }
}