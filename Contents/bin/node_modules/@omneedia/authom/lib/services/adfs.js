var EventEmitter = require("events").EventEmitter
var util = require("util");

function ADFS(options) {

	this.on("request", function (req, res) {
		var _p = this;

		var adfs = {
			authenticate: function (req, res, callback) {
				var host = req.get('host');
				// If we are in production
				if (process.env.task) {
					// NGINX don't relay hostname 
					if (req.headers['x-forwarded-server']) host = req.headers['x-forwarded-server'];
				};
				if (!req.query.code) return res.redirect(options.login.authorizationURL + "?client_id=" + options.login.clientID + "&response_type=code&redirect_uri=" + req.protocol + "://" + host + "/auth/adfs&resource=" + req.protocol + "://" + host);
				var request = require('request');
				console.log({
					uri: options.login.tokenURL,
					method: "POST",
					form: {
						grant_type: "authorization_code",
						client_id: options.login.clientID,
						client_secret: options.login.clientSecret,
						redirect_uri: req.protocol + "://" + host + "/auth/adfs",
						code: req.query.code
					},
					tls: {
						rejectUnauthorized: false
					}
				});
				request({
					uri: options.login.tokenURL,
					method: "POST",
					form: {
						grant_type: "authorization_code",
						client_id: options.login.clientID,
						client_secret: options.login.clientSecret,
						redirect_uri: req.protocol + "://" + host + "/auth/adfs",
						code: req.query.code
					},
					tls: {
						rejectUnauthorized: false
					}
				}, function (e, r, b) {
					var token;

					if (e) return callback(true, false, e);

					try {
						var b = JSON.parse(b);
						var jwt_decode = require('jwt-decode');
						var token = jwt_decode(b.access_token);
						var profile = {
							service: "adfs",
							username: token.login.toLowerCase(),
							userid: token.login.toLowerCase(),
							lastname: token.name,
							firstname: token.firstname,
							org: token.department
						};

						callback(null, true, profile, null)

					} catch (e) {
						callback(true, false, e);
					}
				});
			}
		};
		adfs.authenticate(req, res, function (err, status, profile, extended) {
			console.log(status);
			console.log(profile);
			if (err) {
				_p.emit("error", req, res, err);
			} else {
				_p.emit("auth", req, res, profile)
			}
		});

	});
	EventEmitter.call(this);
};

util.inherits(ADFS, EventEmitter);

module.exports = ADFS;