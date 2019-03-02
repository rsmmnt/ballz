
var Resurrect = require('resurrect-js');
var Matter = require('matter-js');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');
var resser = new Resurrect({revive: false});
var OPTIONS = require('./options.js');
var KEYBOARD = require('./keyboard.json');

var Users = [];
var Sockets = [];
var Score = 
{
	topscore: 0,
	botscore: 0
}


findIndex = function(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }

    return -1;
};


var numPlayers = 0;
var constraint;

let engine = Matter.Engine.create();
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;
engine.broadphase.current = 'bruteForce';
//let runner = Matter.Runner.create();
//runner.delta = 10;
Matter.Events.on(engine,"beforeTick", moveLoop);
Matter.Events.on(engine,"afterTick", sendUpdates);
engine.timing.delta = 1000/60;  


function updateLoop()
{ 
 Matter.Events.trigger(engine, 'beforeTick', { timestamp: engine.timing.timestamp });
 Matter.Events.trigger(engine, 'tick', { timestamp: engine.timing.timestamp });
 Matter.Engine.update(engine, engine.timing.delta);
 Matter.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });
}
setInterval(updateLoop,engine.timing.delta*2);



//ball creation
var ballplayed = Matter.Bodies.circle(OPTIONS.gameSizeX/2, OPTIONS.gameSizeY/2, OPTIONS.ballRad, {
			isStatic: false,
			restitution: 0.999,
			frictionAir: 0.01,
			friction: 0.1,
			mass: 20,
			render: { fillStyle: OPTIONS.ballColor }
		});
ballplayed.playing = false;

// add walls
Walls = [   wall(OPTIONS.gameSizeX/2, 10, OPTIONS.gameSizeX , 20),
			wall(OPTIONS.gameSizeX/2, OPTIONS.gameSizeY-10, OPTIONS.gameSizeX, 20),
			wall(10, (OPTIONS.gameSizeY - OPTIONS.goalSize)/4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2),
			wall(OPTIONS.gameSizeX - 10, (OPTIONS.gameSizeY - OPTIONS.goalSize)/4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2),
			wall(10, OPTIONS.gameSizeY - (OPTIONS.gameSizeY - OPTIONS.goalSize)/4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2),
			wall(OPTIONS.gameSizeX - 10, OPTIONS.gameSizeY - (OPTIONS.gameSizeY - OPTIONS.goalSize)/4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2),

			];

Matter.World.add(engine.world, Walls);
Matter.World.add(engine.world,ballplayed);
		

		
		
io.on('connection', function(socket) 
{
	console.log('A user connected!', socket.handshake.query.type);

    var type = socket.handshake.query.type;
    var radius = OPTIONS.playerRad;
	var newbody = Matter.Bodies.circle(OPTIONS.minX + Math.random()*(OPTIONS.maxX-OPTIONS.minX),
		OPTIONS.minY + Math.random()*(OPTIONS.maxY-OPTIONS.minY), OPTIONS.playerRad, {
			isStatic: false,
			restitution: 0.999,
			frictionAir: 0.25,
			friction: 0.25,
			mass: 200,
			render: { fillStyle: OPTIONS.playerColor }
		},200);
		
	Matter.Body.setInertia(newbody, Infinity);
    
	var currentPlayer = {
        id: socket.id,
        x: OPTIONS.minX + Math.random()*(OPTIONS.maxX-OPTIONS.minX),
        y: OPTIONS.minY + Math.random()*(OPTIONS.maxY-OPTIONS.minY),
        lastHeartbeat: new Date().getTime(),
        target: {
            x: 0,
            y: 0
        },
		keypad: {},
		body: newbody,
		name: "guest",
		playing: false,
		lastShot: new Date()
    };
	Users.push(currentPlayer);
	Sockets.push(socket);
	Matter.World.add(engine.world, currentPlayer.body);
	
	socket.on('sendKeypadState', function(keypad) {
		currentPlayer.keypad = keypad;
		currentPlayer.lastHeartbeat = new Date().getTime();
		
	});
	
	socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });
	
	socket.on('disconnect', function () {
			//remove player body and optionally constraint
			var idx = findIndex(Users,currentPlayer.id);
			if (idx > -1)
			{	
				if(Users[idx].playing)
				{
					constraint.bodyA.playing = false;
					constraint.bodyB.playing = false;
					Matter.World.remove(engine.world,constraint);
				}
		
				Matter.World.remove(engine.world, Users[idx].body);
			
				Users.splice(findIndex(Users, currentPlayer.id), 1);
				console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');
				socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
			}
	});
	
});


function wall(x, y, width, height) {
	return Matter.Bodies.rectangle(x, y, width, height,  {
			isStatic: true,
			restitution: 0.999,
			render: { fillStyle: '#868e96' }
			
	});
}


function sendUpdates()
{
	//send world to all sockets, performance bottleneck with full object serialization through resurrect-js
	//should be changed
	io.sockets.emit('sendGameState',
	{
		world: resser.stringify(engine.world.bodies),
		score: Score
	}
	);
	//console.log("sending world update");
		
}



// main loop

function moveLoop()
{
	
	//check if goal scored, remove optional joint and reset state
	
	if(ballplayed.position.x < OPTIONS.goalDepth )
	{
		Score.topscore +=1;
		Users.forEach(function(user)
		{
			if(user.playing)
			{
					Matter.Composite.remove(engine.world,constraint);
					user.playing = false;
			}
			
		});
		ballplayed.playing = false;
		Matter.Body.setPosition(ballplayed, {x: OPTIONS.gameSizeX/2, y: OPTIONS.gameSizeY/2});
		Matter.Body.setVelocity(ballplayed, {x: 0, y: 0});
		
	}
	if(ballplayed.position.x > OPTIONS.gameSizeX-OPTIONS.goalDepth)
	{
		Users.forEach(function(user)
		{
			if(user.playing)
			{
					Matter.Composite.remove(engine.world,constraint);
					user.playing = false;
			}
			
		});
		ballplayed.playing = false;
		Score.botscore +=1;
		Matter.Body.setPosition(ballplayed, {x: OPTIONS.gameSizeX/2, y: OPTIONS.gameSizeY/2});
		Matter.Body.setVelocity(ballplayed, {x: 0, y: 0});
		
	}
	
	
	//apply movement forces from key inputs
	var ballCollisions = 0;
	var ballColl;
	var playingUser;
	Users.forEach( function(user){
		user.target = {x:0, y: 0};
		if(user.keypad[KEYBOARD.keyW] === true)
		{
		user.target.y -= 1;
		}
		if(user.keypad[KEYBOARD.keyA] === true)
		{
		user.target.x -= 1;
		}
		if(user.keypad[KEYBOARD.keyS] === true)
		{
		user.target.y += 1;
		}
		if(user.keypad[KEYBOARD.keyD] === true)
		{
		user.target.x += 1;
		}
		
		
		Matter.Vector.div(user.target, Matter.Vector.magnitude(user.target) );
		Matter.Body.applyForce(user.body,{x: user.body.position.x - user.target.x,y: user.body.position.y - user.target.y}, user.target);
		
		//and check + count all collisions with ball
		var tmpcollision = Matter.SAT.collides(user.body, ballplayed);
		if(tmpcollision.collided || user.playing) 
		{
			ballCollisions += 1;
			ballColl = user;
		}
		if(user.playing)
		{
			playingUser = user;
		}
	});
	
	// if more than two players collide with ball, joint mechanics don't work, remove joint if it exists,
	// apply forces from all shooters
	if(ballCollisions > 1)
	{
		//console.log("handling multiple collisions");
		if(ballplayed.playing == true)
		{
			playingUser.playing = false;
			ballplayed.playing = false;
			Matter.Composite.remove(engine.world,constraint);
		}
		Users.forEach( function(user)
		{
			var tmpTime = new Date();
			// players can shoot with intervals > shotInterval
			if(user.keypad[KEYBOARD.space] == true && (tmpTime - user.lastShot) > OPTIONS.shotInterval )
			{
				user.lastShot = tmpTime;
				var frc = Matter.Vector.magnitude(Matter.Vector.sub(user.body.position,ballplayed.position));

				Matter.Body.applyForce(ballplayed, 
				{
					x:ballplayed.position.x - user.body.position.x, 
					y:ballplayed.position.y - user.body.position.y
				}
				,
				{
				x: ( ballplayed.position.x - user.body.position.x)/frc,
				y: (ballplayed.position.y - user.body.position.y)/frc
			});
			}
			
			
		});	
	}
	
	
	// if one player collides with ball/ has ball
	if(ballCollisions == 1)
	{
		// if already has ball
		if(ballColl.playing == true)
		{
			
				var tmpTime = new Date();
				if(ballColl.keypad[KEYBOARD.space] == true && (tmpTime - ballColl.lastShot) > OPTIONS.shotInterval )
				{
				ballColl.playing = false;
				ballplayed.playing = false;
				Matter.Composite.remove(engine.world,constraint);
				ballColl.lastShot = tmpTime;
				var frc = Matter.Vector.magnitude(Matter.Vector.sub(ballColl.body.position,ballplayed.position));

				Matter.Body.applyForce(ballplayed, 
				{
					x:ballplayed.position.x - ballColl.body.position.x, 
					y:ballplayed.position.y - ballColl.body.position.y
				}
				,
				{
				x: ( ballplayed.position.x - ballColl.body.position.x)/frc,
				y: (ballplayed.position.y - ballColl.body.position.y)/frc
				});
				
				}
			
		}
		//if doesn't have ball (no joint)
		else
		{
			var tmpTime = new Date();
			if(ballColl.keypad[KEYBOARD.space] == true && (tmpTime - ballColl.lastShot) > OPTIONS.shotInterval )
			{
			ballColl.lastShot = tmpTime;
			var frc = Matter.Vector.magnitude(Matter.Vector.sub(ballColl.body.position,ballplayed.position));

			Matter.Body.applyForce(ballplayed, 
			{
				x:ballplayed.position.x - ballColl.body.position.x, 
				y:ballplayed.position.y - ballColl.body.position.y
			}
			,
			{
			x: ( ballplayed.position.x - ballColl.body.position.x)/frc,
			y: (ballplayed.position.y - ballColl.body.position.y)/frc
			});
				
			}
			else
			{
			//joint creation
			
			ballplayed.playing = true;
			ballColl.playing = true;
			Matter.Body.setVelocity(ballplayed,{x:0,y:0});
			constraint = Matter.Constraint.create({
			bodyA: ballColl.body,
			bodyB: ballplayed
			});
			Matter.World.add(engine.world,constraint);
			}
			
			
		}
		
	}	
			
	// set maximum velocity for ball 
	if( Matter.Vector.magnitude(ballplayed.velocity) > OPTIONS.MAXVELOCITYSQ)
	{
		var angle = Math.atan2(ballplayed.velocity.y, ballplayed.velocity.x);
         Matter.Body.setVelocity( ballplayed, {x: Math.cos(angle) * OPTIONS.MAXVELOCITY, y: Math.sin(angle) * OPTIONS.MAXVELOCITY});

	}
	Matter.Body.setAngularVelocity(ballplayed, 0);

}
// run server
var serverport = OPTIONS.serverPort;
var ipaddress = OPTIONS.serverHost;
http.listen( serverport, ipaddress, function() {
    console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});