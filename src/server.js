var Resurrect = require('resurrect-js')
var Matter = require('matter-js')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var SAT = require('sat')
var resser = new Resurrect({ revive: false })
var OPTIONS = require('./options.js')
var KEYBOARD = require('./keyboard.json')
var io = require('socket.io')(http)
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



//rooms2player['2 ' + num2Rooms] = new roomrunner.gameRoom(io, '2 ' + num2Rooms, 2, destroy2Room)
//rooms4player['4 ' + num4Rooms] = new roomrunner.gameRoom(io, '4 ' + num4Rooms, 4, destroy4Room)



//console.log(destroy2Room);
//console.log(destroy4Room);

var tmp2Sockets = {};
var tmp4Sockets = {};
var tmp6Sockets = {};
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
		rooms2player['2 ' + num2Rooms] = new roomrunner.gameRoom(io, '2 ' + num2Rooms, 2, destroy2Room)
		console.log('create 2Room id 2 ' + num2Rooms);
		var i;
		for(i = 0; i < 2; i++)
		{
			//console.log(tmp2Sockets);
			//console.log(Object.keys(tmp2Sockets));
			//console.log(Object.keys(tmp2Sockets)[i]);
			
			var socket = tmp2Sockets[ids2[i]];
			socket.join('2 ' + num2Rooms)
			rooms2player['2 ' + num2Rooms].addUser(socket)
			cur2Users += 1	
			delete tmp2Sockets[ids2[i]];

		}
		num2Rooms += 1;
		console.log(Object.keys(rooms2player).length + " 2 player game rooms");	
		
	}
	
	if(len4 >= 4)
	{
		rooms4player['4 ' + num4Rooms] = new roomrunner.gameRoom(io, '4 ' + num4Rooms, 4, destroy4Room)
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
		rooms6player['6 ' + num6Rooms] = new roomrunner.gameRoom(io, '6 ' + num6Rooms, 6, destroy6Room)
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
	 console.log('User disconnected from waiting queue');
	 if(tmp2Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp2Sockets[socket.id];
	 }
	 if(tmp4Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp4Sockets[socket.id];
	 }
	 if(tmp6Sockets.hasOwnProperty(socket.id))
	 {
		delete tmp6Sockets[socket.id];
	 }
		
	  
  });
  
  
  //socket.emit('setSocketGroup', ' ' + numRooms)
  
});


setInterval(roomStarter,1000);

var serverport = OPTIONS.serverPort
var ipaddress = OPTIONS.serverHost
http.listen(serverport, ipaddress, function () {
  console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport)
})
