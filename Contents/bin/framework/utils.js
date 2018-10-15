module.exports = function () {
	global.isFunction = function (functionToCheck) {
		var getType = {};
		return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
	};
	global.isArray = function (a) {
		return (!!a) && (a.constructor === Array);
	};
	global.isObject = function (a) {
		return (!!a) && (a.constructor === Object);
	};
}();