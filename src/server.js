var Resurrect = require('resurrect-js')
var Matter = require('matter-js')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var SAT = require('sat')
var resser = new Resurrect({ revive: false })
var OPTIONS = require('./options.js')
var KEYBOARD = require('./keyboard.json')
var mysql = require('mysql')
var io = require('socket.io')(http)
const uuid = require('uuid/v4')
const session = require('express-session')
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');
const crypto = require('crypto');
const validator = require('validator');
var jwt = require('jsonwebtoken');

console.log(OPTIONS);

var num2Rooms = 0
var num4Rooms = 0
var num6Rooms = 0
var rooms2player = {};
var rooms4player = {};
var rooms6player = {};
var cur2Users = 0
var cur4Users = 0
var cur6Users = 0
var roomrunner = require('./roomserver.js')






//app.use('/signupform', express.static(__dirname + '/../client/signup'));
//app.use(bodyParser.urlencoded({ extended: false }))
/*
app.use(session({
  genid: (req) => {
    console.log('Inside session middleware genid function')
    console.log(`Request object sessionID from client: ${req.sessionID}`)
    return uuid() // use UUIDs for session IDs
  },
  store: new FileStore(),
  secret: 'testsecret',
  resave: false,
  saveUninitialized: true
}));
*/

var db;


function handleDisconnect() {
  db = mysql.createConnection ({
    host: OPTIONS.dbHost,
    user: OPTIONS.dbUser,
    password: OPTIONS.dbPassword,
    database: OPTIONS.dbName
});                                  // the old one cannot be reused.

  db.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  db.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();



app.get('/top100', function(req,res)
{
		console.log("top100fun");
	var query = 'SELECT name, games, (wins/games) as winrate FROM users ORDER BY winrate DESC LIMIT 100';
	
	var html2 = "<html><body bgcolor=\"lightgreen\"> <div align=\"center\" style=\"font-size:2vw\">"
	html2+= "<h1> Top 100 </h1> <a href='/'> <h3> Back to the game </h3> </a> <table border=3 cellpadding=10 style=\"font-size:2vw;\" >";
	html2+= ("<tr><td>" + "Player name" + "</td><td>" + "Games played" + "</td><td>" +  "Win Rate" + "</td></tr>");
	console.log("generating top100");
	db.query(query, function (err, result, fields)
	{
		result.forEach(function(row)
		{
			if(row.games != 0)
			{
			html2+= ("<tr><td>" + row.name + "</td><td>" + parseInt(row.games) + "</td><td>" +  row.winrate + "</td></tr>");
			}
		});
		
		html2+="</table></div></body></html>";
		res.send(html2);
		res.end();
	});


	
	
});

app.use(express.static(__dirname + '/../client'));



var destroy2Room = function(roomId)
{
	delete rooms2player[roomId];
	
}.bind(this);

var destroy4Room = function(roomId)
{
	delete rooms4player[roomId];
	
}.bind(this);

var destroy6Room = function(roomId)
{
	delete rooms6player[roomId];
	
}.bind(this);


var tmp2Sockets = {};
var tmp4Sockets = {};
var tmp6Sockets = {};

//main gamestarting dispatch function
// if number of tmpsockets for any type of game is enough, start it
//pretty stupid, but removal of disconnected users is pretty fast

function roomStarter()
{
	var ids2 = Object.keys(tmp2Sockets);
	var ids4 = Object.keys(tmp4Sockets);
	var ids6 = Object.keys(tmp6Sockets);
	var len2 = ids2.length;
	var len4 = ids4.length;
	var len6 = ids6.length;
	if(len2 >= 2)
	{
		var groupId = '2 ' + num2Rooms;
		rooms2player[groupId] = new roomrunner.gameRoom(io,groupId, 2, destroy2Room, db)
		console.log('create 2Room id 2 ' + num2Rooms);
		var i;
		for(i = 0; i < 2; i++)
		{
			
			var socket = tmp2Sockets[ids2[i]];
			socket.join(groupId)
			rooms2player[groupId].addUser(socket)
			cur2Users += 1	
			delete tmp2Sockets[ids2[i]];

		}
		num2Rooms += 1;
		console.log(Object.keys(rooms2player).length + " 2 player game rooms");	
		
	}
	
	if(len4 >= 4)
	{
		rooms4player['4 ' + num4Rooms] = new roomrunner.gameRoom(io, '4 ' + num4Rooms, 4, destroy4Room, db)
		var i;
		for(i = 0; i < 4; i++)
		{
			var socket = tmp4Sockets[ids4[i]];
			socket.join('4 ' + num4Rooms)
			rooms4player['4 ' + num4Rooms].addUser(socket)
			cur4Users += 1
			delete tmp4Sockets[ids4[i]];
		}
		num4Rooms += 1;
		console.log(Object.keys(rooms4player).length + " 4 player game rooms");	
	
		
	}
	
	if(len6 >= 6)
	{
		rooms6player['6 ' + num6Rooms] = new roomrunner.gameRoom(io, '6 ' + num6Rooms, 6, destroy6Room, db)
		var i;
		for(i = 0; i < 6; i++)
		{
			var socket = tmp6Sockets[ids6[i]];
			socket.join('6 ' + num6Rooms)
			rooms6player['6 ' + num6Rooms].addUser(socket)
			cur6Users += 1
			delete tmp6Sockets[ids6[i]];
		}
		num6Rooms += 1;
		console.log(Object.keys(rooms6player).length + " 6 player game rooms");	
	
		
	}
	
}



io.on('connection', function (socket) {
  
  socket.on('authLogin', function(data)
  {
	  if(validator.isAlphanumeric(data.username))
	  {
	  console.log('login request ' + data.username + ' ' + data.password + 'serversecret' + OPTIONS.serverSecret);
	  var query = 'SELECT name, hash, salt FROM users WHERE name = \"' + data.username + '\"';
	  console.log(query);
	  db.query(query, function (err, result, fields)
	  {
		console.log(err);
		if(result.length > 0)
		{
			if(result[0].hash == crypto.pbkdf2Sync(data.password, result[0].salt, 2, 64, 'sha512').toString('hex'))
			{
				//res.send("Success <a href = \'/\'> Go back </a>");
				console.log("username: " + data.username + " secret:" + OPTIONS.serverSecret);
				var payload = { username: data.username};
				console.log(payload);
				jwt.sign(payload,OPTIONS.serverSecret, function(err, token)
				{
					if(err)
					{
						console.log(err);
					}
					console.log("token = " + token);
					socket.emit('sendAuthToken', {token: token, username: data.username});
					socket.isAuthenthicated = true;
					socket.username = data.username;
					
				});

			}
			else
			{
				socket.emit('loginInfo', 'Wrong password');
			}
		}
		else
		{
			socket.emit('loginInfo', 'Username does not exist');
		}
	  });
	  }
	  else
      {
			socket.emit('loginInfo', 'Username must be alphanumeric');
	  }
	});
	    
  
  
  socket.on('authSignup', function(data)
  {
	  if(validator.isAlphanumeric(data.username))
	  {
		if(data.username.length >= 3)
		{
			if(data.password.length >= 8)
			{
	  
				//console.log('signup request ' + data.username + ' ' + data.password);
				var query = 'SELECT name, hash FROM users WHERE name = \"' + data.username + '\"';
				var isDup = true;
				db.query(query, function (err, result, fields)
				{
					console.log(err);
					console.log(result);
					if(result.length > 0)
					{
						socket.emit('signupInfo', 'User already exists');
			
					}
					else
					{
						var salt = crypto.randomBytes(16).toString('hex');
						var hash = crypto.pbkdf2Sync(data.password, salt, 2, 64, 'sha512').toString('hex');

						db.query('INSERT INTO users ( name , hash, salt, games, wins ) VALUES (\'' + data.username + '\',\'' + hash + '\',\'' + salt + '\', 0, 0)',
						function(err2,result2)
						{
							console.log(err2);
							console.log(result2);
							socket.emit('signupInfo', 'Successful signup');
						});
					}
		
				});
			}
			else
			{
				socket.emit('signupInfo', 'Password is too short');
			}
	  }
	  else
	  {
		  socket.emit('signupInfo', 'Username is too short');
	  }
	  }
	  else
	  {
		  socket.emit('signupInfo', 'Only letters and numbers accepted in username');
	  }
	  
	  
  });
  
  // authenthicating socket through JWT stored in clients cookie 
  
  socket.on('authJwt', function(data)
  {
		
		jwt.verify(data, OPTIONS.serverSecret, function(err, decoded) {
			if(decoded)
			{
				socket.isAuthenthicated = true;
				socket.username = decoded.username;
				socket.emit('authJwtOk');
			}
			
			
		});	  
  });
  
  socket.on('authLogout', function(){
	socket.isAuthenthicated = false;
	socket.username = "";
	
	  
  })
  
  
  socket.on('start2Game', function()
  {
	  tmp2Sockets[socket.id] = socket;
  });
  
  
  socket.on('start4Game', function()
  {
	  tmp4Sockets[socket.id] = socket;  
	  
  });
  
  socket.on('start6Game', function()
  {
	  tmp6Sockets[socket.id] = socket;  
	  
  });
  
  
  socket.on('disconnect', function(){
	 console.log('Socket disconnected');
	 if(tmp2Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp2Sockets[socket.id];
		console.log('from 2WaitingQueue');
	 }
	 if(tmp4Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp4Sockets[socket.id];
		console.log('from 4WaitingQueue');
	 }
	 if(tmp6Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp6Sockets[socket.id];
		console.log('from 6WaitingQueue');
	 }
		
	  
  });
    
});


setInterval(roomStarter,1000);
//start server
var serverport = OPTIONS.serverPort
var ipaddress = OPTIONS.serverHost
http.listen(serverport, ipaddress, function () {
  console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport)
})
