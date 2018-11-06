var API = {
	_HOSTS: {},
	query: function(s,args,callback) 
	{
		if (require('fs').existsSync(__dirname+require('path').sep+"api.settings")) {
			var arr=JSON.parse(require('fs').readFileSync(__dirname+require('path').sep+"api.settings","utf-8"));
		} else {
			var arr=MSettings.api;
		};

		for (var i=0;i<arr.length;i++)
		{
			this._HOSTS[arr[i].split('/')[1]]=arr[i].split('/')[0];
		};
		
		var service=s.split('.')[0];
		var name=s.split('.')[1];
		
		var http=require('http');
		
		var host=this._HOSTS[service].split(':')[0];
		if (!this._HOSTS[service].split(':')[1])
		var port=80;
		else
		var port=this._HOSTS[service].split(':')[1]*1;
		
		var user = [
		{
			action: service,
			method: name,
			data: args,
			type: "rpc",
			tid: 1
		}
		];
							
		var userString = JSON.stringify(user);
		
		var headers = {
		  'Content-Type': 'application/json',
		  'Content-Length': userString.length
		};
			
		var options = {
		  host: host,
		  port: port,
		  path: '/api',
		  method: 'POST',
		  headers: headers
		};

		var req = http.request(options, function(res) {
			res.setEncoding('utf-8');

			var responseString = '';

			res.on('data', function(data) {
				responseString += data;
			});

			res.on('end', function() {
				var resultObject = JSON.parse(responseString);
				callback(null,resultObject[0].result);
			});
		});

		req.on('error', function(e) {
		  console.log(e);
		});

		req.write(userString);

	}	
};

module.exports = API;
