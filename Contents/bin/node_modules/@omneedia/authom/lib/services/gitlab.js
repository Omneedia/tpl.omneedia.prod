var OAuth2 = require("./oauth2")
  , util = require("util")

function GitLab(options) {
  console.log(options);
  this.code = {
    protocol: options.protocol,
    host: options.host,
    pathname: "/oauth/authorize",
    query: {
      client_id: options.id,
      redirect_uri: options.redirect_uri,
	  //redirect_uri: "http://127.0.0.1:3000/auth",
      state: options.secret,
	  response_type: "code"
    }
  }

  this.token = {
    method: "POST",
    host:   options.host,
    path:   "/oauth/token",
    query: {
      client_id: options.id,
      client_secret: options.secret,
	  code: "RETURNED_CODE",
	  grant_type: "authorization_code"
    }
  }

  this.user = {
    host: "lab.cerema-dtm.fr",
    path: "/api/v3/user",
    query: {}
  }

  this.on("request", this.onRequest.bind(this))

  OAuth2.call(this);
}

util.inherits(GitLab, OAuth2)

module.exports = GitLab
