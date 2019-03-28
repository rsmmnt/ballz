
var Resurrect = require('resurrect-js')
var Matter = require('matter-js')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var SAT = require('sat')
var resser = new Resurrect({ revive: false })
var OPTIONS = require('./options.js')
var KEYBOARD = require('./keyboard.json')

var findIndex = function (arr, id) {
  var len = arr.length
  while (len--) {
    if (arr[len].id === id) {
      return len
    }
  }

  return -1
}

module.exports = {

  gameRoom: function (_io, socketGroup, _neededPlayers, destroyCallback, sqlConnection) {
    this.sql = sqlConnection;
	this.destroyer = destroyCallback;
	//console.log(destroyCallback);
	this.io = _io
    this.socketGroup = socketGroup
    this.Users = []
    this.Sockets = []
    this.Score =
	{
		topscore: 0,
		botscore: 0
	}
    this.numPlayers = 0
    this.neededPlayers = _neededPlayers;
    this.constraint = null;
    this.maxTime = 60 * 1000 * 2;
    this.startTime = 0;
    this.stopper = 0;

    this.engine = Matter.Engine.create()
    this.engine.world.gravity.x = 0
    this.engine.world.gravity.y = 0
    this.engine.broadphase.current = 'bruteForce'

    this.engine.timing.delta = 1000 / 60

    // ball creation
    this.ballplayed = Matter.Bodies.circle(OPTIONS.gameSizeX / 2, OPTIONS.gameSizeY / 2, OPTIONS.ballRad, OPTIONS.ballOptions)
    this.ballplayed.playing = false
    // console.log(this.ballplayed);
    this.wall = function (x, y, width, height) {
      return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: true,
        restitution: 0.1,
        render: { fillStyle: '#868e96' }

      })
    }
	
	this.goalPost = function(x,y,radius)
	{
		return Matter.Bodies.circle(x,y,radius, {
			 isStatic: true,
			 restitution: 0.999,
			 render: { fillStyle: 'black' }
			
		});
		
	}

    // add walls
	// write some field customizer with eval?
    this.Walls = [ this.wall(OPTIONS.gameSizeX / 2, 10, OPTIONS.gameSizeX, 20),
      this.wall(OPTIONS.gameSizeX / 2, OPTIONS.gameSizeY - 10, OPTIONS.gameSizeX, 20),
      this.wall(10, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 2),
      this.wall(OPTIONS.gameSizeX - 10, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 2),
      this.wall(10, OPTIONS.gameSizeY - (OPTIONS.gameSizeY - OPTIONS.goalSize) / 4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 2),
      this.wall(OPTIONS.gameSizeX - 10, OPTIONS.gameSizeY - (OPTIONS.gameSizeY - OPTIONS.goalSize) / 4, 20, (OPTIONS.gameSizeY - OPTIONS.goalSize) / 2),
	  this.goalPost(10, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2, 12),
	  this.goalPost(10, (OPTIONS.gameSizeY + OPTIONS.goalSize)/2, 12),
	  this.goalPost(OPTIONS.gameSizeX - 10, (OPTIONS.gameSizeY - OPTIONS.goalSize)/2, 12),
	  this.goalPost(OPTIONS.gameSizeX - 10, (OPTIONS.gameSizeY + OPTIONS.goalSize)/2, 12)
	  		    
    ]
	
	this.Walls.forEach(function(item)
	{
		item.restitution = 0.999;
		
	});
	
	
	var test = this.wall(OPTIONS.gameSizeX / 2, OPTIONS.gameSizeY - 10, OPTIONS.gameSizeX, 20);
	test.restitution = 0.999;
	console.log('wall restitution' + test.restitution);

    Matter.World.add(this.engine.world, this.Walls)
    Matter.World.add(this.engine.world, this.ballplayed)

    console.log('created engine')

    this.updateLoop = function () {
      // console.log(this);
      // sleep(50000);
      // console.log(this.engine);
      Matter.Events.trigger(this.engine, 'beforeTick', { timestamp: this.engine.timing.timestamp })
      Matter.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp })
      Matter.Engine.update(this.engine, this.engine.timing.delta)
      Matter.Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp })

      // console.log("updateLoop");
      // console.log(this);
      // Matter.Events.trigger(this.engine, 'beforeTick');
      // Matter.Events.trigger(this.engine, 'tick');
      // Matter.Engine.update(this.engine, this.engine.timing.delta);
      // Matter.Events.trigger(this.engine, 'afterTick');

      if ((new Date() - this.startTime) > this.maxTime) {
	 clearInterval(this.stopper)
	 this.updateStats();
	 this.io.to(this.socketGroup).emit('endgame');
	 
	 
	 //console.log(this.destroyer);
	 this.destroyer(this.socketGroup);
      }
    }.bind(this)
	
	this.updateStats = function()
	{
		let i;
		for(i = 0; i < this.Users.length; i++)
		{
			if(this.Users[i].sock.isAuthenthicated)
			{
				var query = "UPDATE users SET games = games + 1 WHERE name = " +  "\"" + this.Users[i].sock.username + "\"";
				this.sql.query(query, function(err,result)
				{
					console.log(err);
					console.log(result);
				});
				
				if(i < this.Users.length/2)
				{
					if(this.Score.topscore < this.Score.botscore)
					{
					    query = "UPDATE users SET wins = wins + 1 WHERE name = " + "\"" + this.Users[i].sock.username + "\"";
						this.sql.query(query, function(err,result)
						{
							console.log(err);
							console.log(result);
						});
					
					}
				}
				else
				{
					if(this.Score.topscore > this.Score.botscore)
					{
					    query = "UPDATE users SET wins = wins + 1 WHERE name = " +  "\"" + this.Users[i].sock.username + "\"";
						this.sql.query(query, function(err,result)
						{
							console.log(err);
							console.log(result);
						});
					
					}
					
					
				}
				
				
				
			
			}
		}
		
		
		
	}.bind(this);
	
    this.startGame = function () {
      console.log('Starting game')
      this.placeAllObjects();
	  this.io.to(this.socketGroup).emit('sendGameState',
        {
          world: resser.stringify(this.engine.world.bodies),
          score: this.Score
        }
      );
	  
	 // Matter.Events.on(this.engine, 'beforeTick', this.moveLoop)
     // Matter.Events.on(this.engine, 'afterTick', this.sendUpdates)
        Matter.Events.on(this.engine, 'beforeTick', this.moveLoop)
      Matter.Events.on(this.engine, 'afterTick', this.sendUpdates)
	  // this.updateLoop();
      this.stopper = setInterval(this.updateLoop, this.engine.timing.delta * 2)
    }.bind(this)
	
    this.addUser = function (socket) {
      if (this.numPlayers == this.neededPlayers) {
        console.log('Not needed player trying to connect')
        return
      }
      this.numPlayers += 1
      console.log('A user connected!', socket.handshake.query.type)
      var type = socket.handshake.query.type
      var radius = OPTIONS.playerRad
      var color = (this.numPlayers <= this.neededPlayers/2) ? 'blue' : 'red'
	  var newbody = Matter.Bodies.circle(OPTIONS.minX + Math.random() * (OPTIONS.maxX - OPTIONS.minX),
        OPTIONS.minY + Math.random() * (OPTIONS.maxY - OPTIONS.minY), OPTIONS.playerRad, {
          isStatic: false,
          restitution: 0.999,
          frictionAir: 0.25,
          friction: 0.25,
          mass: 100,
          render: { fillStyle: color /* OPTIONS.playerColor*/ },
		  shotStrength: 1
        }, 200)

      Matter.Body.setInertia(newbody, Infinity)

      var currentPlayer = {
        id: socket.id,
        x: OPTIONS.minX + Math.random() * (OPTIONS.maxX - OPTIONS.minX),
        y: OPTIONS.minY + Math.random() * (OPTIONS.maxY - OPTIONS.minY),
        lastHeartbeat: new Date().getTime(),
        target: {
          x: 0,
          y: 0
        },
        keypad: {},
        body: newbody,
        name: 'guest',
        playing: false,
        lastShot: new Date(),
        sock: socket,
		playerTypeSet: false
      }
      this.Users.push(currentPlayer)
      this.Sockets.push(socket)
      Matter.World.add(this.engine.world, currentPlayer.body)

      socket.on('sendKeypadState', function (keypad) {
        currentPlayer.keypad = keypad
        currentPlayer.lastHeartbeat = new Date().getTime()
      })

      socket.on('pingcheck', function () {
        socket.emit('pongcheck')
      })
	  
	  socket.on('setPlayerType', function(type)
	  {
		if(currentPlayer.playerTypeSet == false)
		{
			
			if(type == 'agile')
			{
				Object.assign(currentPlayer.body, OPTIONS.agilePlayerOptions);
				
			}
			else if(type == 'shooter')
			{
				Object.assign(currentPlayer.body, OPTIONS.shooterPlayerOptions);
				
			}
			else
			{
				Object.assign(currentPlayer.body, OPTIONS.defaultPlayerOptions);

			}
			currentPlayer.playerTypeSet = true;
		}
		 
		  
	  });

      /*socket.on('disconnect', function () {
        // remove player body and optionally constraint
        
		var idx = findIndex(this.Users, currentPlayer.id)
        if (idx > -1) {
          if (this.Users[idx].playing) {
            this.constraint.bodyA.playing = false
            this.constraint.bodyB.playing = false
            Matter.World.remove(this.engine.world, this.constraint)
          }

          Matter.World.remove(this.engine.world, this.Users[idx].body)

          this.Users.splice(findIndex(this.Users, currentPlayer.id), 1)
          console.log('[INFO] User ' + currentPlayer.name + ' disconnected!')
          socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name })
        }
		
      }.bind(this)) */
      if (this.numPlayers == this.neededPlayers) {
        this.startGame()
        this.startTime = new Date()
      }
    }.bind(this)
	
	this.placeAllObjects = function()
	{
		Matter.Body.setPosition(this.ballplayed, { x: OPTIONS.gameSizeX / 2, y: OPTIONS.gameSizeY / 2 })
        Matter.Body.setVelocity(this.ballplayed, { x: 0, y: 0 })
		var i = 0;
		var ystep = OPTIONS.gameSizeY/(this.numPlayers/2 + 1);
		for(i = 0; i < this.numPlayers; i++)
		{
			var plx = (i < this.numPlayers/2) ? OPTIONS.gameSizeX*(1/4) : OPTIONS.gameSizeX*(3/4);
			var ply = (i%(this.numPlayers/2))*ystep + ystep;
			Matter.Body.setPosition(this.Users[i].body, {x: plx, y: ply});
			Matter.Body.setVelocity(this.Users[i].body, {x: 0, y: 0})
		}
		
		
	}.bind(this)
	
    this.sendUpdates = function () {
      // send world to all sockets, performance bottleneck with full object serialization through resurrect-js
      // should be changed
	  var coords = [];
	  var i;
	  var timeLeft = this.maxTime - (new Date() - this.startTime);
	  for(i = 0; i < this.engine.world.bodies.length; i++)
	  {
		  
		  coords.push(this.engine.world.bodies[i].position); 
	  }
	  this.io.to(this.socketGroup).emit('sendCoordinates',
        {
          positions: coords,
          score: this.Score,
		  timeleft: timeLeft
        }
      );
	  
      // console.log("sending world update");
    }.bind(this)

    // main loop

    this.moveLoop = function () {
      // check if goal scored, remove optional joint and reset state

      if (this.ballplayed.position.x < OPTIONS.goalDepth) {
        this.Score.topscore += 1
        this.Users.forEach(function (user) {
          if (user.playing) {
            Matter.Composite.remove(this.engine.world, this.constraint)
            user.playing = false
          }
        }.bind(this))
        this.ballplayed.playing = false
        Matter.Body.setPosition(this.ballplayed, { x: OPTIONS.gameSizeX / 2, y: OPTIONS.gameSizeY / 2 })
        Matter.Body.setVelocity(this.ballplayed, { x: 0, y: 0 })
		this.placeAllObjects();
      }
      if (this.ballplayed.position.x > OPTIONS.gameSizeX - OPTIONS.goalDepth) {
        this.Users.forEach(function (user) {
          if (user.playing) {
            Matter.Composite.remove(this.engine.world, this.constraint)
            user.playing = false
          }
        }.bind(this))
        this.ballplayed.playing = false
        this.Score.botscore += 1
        Matter.Body.setPosition(this.ballplayed, { x: OPTIONS.gameSizeX / 2, y: OPTIONS.gameSizeY / 2 })
        Matter.Body.setVelocity(this.ballplayed, { x: 0, y: 0 })
		this.placeAllObjects();
      }

      // apply movement forces from key inputs
      var ballCollisions = 0
      var ballColl = 0
      var playingUser = 0
      this.Users.forEach(function (user) {
        user.target = { x: 0, y: 0 }
        if (user.keypad[KEYBOARD.keyW] === true) {
          user.target.y -= 1
        }
        if (user.keypad[KEYBOARD.keyA] === true) {
          user.target.x -= 1
        }
        if (user.keypad[KEYBOARD.keyS] === true) {
          user.target.y += 1
        }
        if (user.keypad[KEYBOARD.keyD] === true) {
          user.target.x += 1
        }

        user.target = Matter.Vector.normalise(user.target);
        Matter.Body.applyForce(user.body, { x: user.body.position.x - user.target.x, y: user.body.position.y - user.target.y }, user.target)
        // console.log(this);
        // and check + count all collisions with ball
        // console.log(user.body);
        // console.log(this.ballplayed);
        var tmpcollision = Matter.SAT.collides(user.body, this.ballplayed)
        if (tmpcollision.collided || user.playing) {
          ballCollisions += 1
          ballColl = user
        }
        if (user.playing) {
          playingUser = user
        }
      }.bind(this))

      // if more than two players collide with ball, joint mechanics don't work, remove joint if it exists,
      // apply forces from all shooters
      if (ballCollisions > 1) {
        // console.log("handling multiple collisions");
        if (this.ballplayed.playing == true) {
          playingUser.playing = false
          this.ballplayed.playing = false
          Matter.Composite.remove(this.engine.world, this.constraint)
        }
        /*
		this.Users.forEach(function (user) {
          var tmpTime = new Date()
          // players can shoot with intervals > shotInterval
          if (user.keypad[KEYBOARD.space] == true && (tmpTime - user.lastShot) > OPTIONS.shotInterval) {
            user.lastShot = tmpTime
            var frc = Matter.Vector.magnitude(Matter.Vector.sub(user.body.position, this.ballplayed.position))

            Matter.Body.applyForce(this.ballplayed,
              {
                x: this.ballplayed.position.x - user.body.position.x,
                y: this.ballplayed.position.y - user.body.position.y
              }
              ,
              {
                x: user.body.shotStrength*(this.ballplayed.position.x - user.body.position.x) / frc,
                y: user.body.shotStrength*(this.ballplayed.position.y - user.body.position.y) / frc
              })
          }
        }.bind(this))
		*/
      }

      // if one player collides with ball/ has ball
      else if (ballCollisions == 1) {
        // if already has ball
        if (ballColl.playing == true) {
          var tmpTime = new Date()
          if (ballColl.keypad[KEYBOARD.space] == true && (tmpTime - ballColl.lastShot) > OPTIONS.shotInterval) {
            ballColl.playing = false
            this.ballplayed.playing = false
            Matter.Composite.remove(this.engine.world, this.constraint)
            ballColl.lastShot = tmpTime
            var frc = Matter.Vector.magnitude(Matter.Vector.sub(ballColl.body.position, this.ballplayed.position))
			//Matter.Body.setVelocity(this.ballplayed, {x: 0, y:0});
            Matter.Body.applyForce(this.ballplayed,
              {
                x: this.ballplayed.position.x - ballColl.body.position.x,
                y: this.ballplayed.position.y - ballColl.body.position.y
              }
              ,
              {
                x: ballColl.body.shotStrength*(this.ballplayed.position.x - ballColl.body.position.x) / frc,
                y: ballColl.body.shotStrength*(this.ballplayed.position.y - ballColl.body.position.y) / frc
              })
          }
        }
        // if doesn't have ball (no joint)
        else {
          tmpTime = new Date()
          if (ballColl.keypad[KEYBOARD.space] == true && (tmpTime - ballColl.lastShot) > OPTIONS.shotInterval) {
            ballColl.lastShot = tmpTime
            var frc = Matter.Vector.magnitude(Matter.Vector.sub(ballColl.body.position, this.ballplayed.position))
			//Matter.Body.setVelocity(this.ballplayed, {x: 0, y:0});

            Matter.Body.applyForce(this.ballplayed,
              {
                x: this.ballplayed.position.x - ballColl.body.position.x,
                y: this.ballplayed.position.y - ballColl.body.position.y
              }
              ,
              {
                x: ballColl.body.shotStrength*(this.ballplayed.position.x - ballColl.body.position.x) / frc,
                y: ballColl.body.shotStrength*(this.ballplayed.position.y - ballColl.body.position.y) / frc
              })
          } else {
            // joint creation

            this.ballplayed.playing = true
            ballColl.playing = true
            Matter.Body.setVelocity(this.ballplayed, { x: 0, y: 0 })
            this.constraint = Matter.Constraint.create({
              bodyA: ballColl.body,
              bodyB: this.ballplayed,
			  length: OPTIONS.ballRad + OPTIONS.playerRad
            })
            Matter.World.add(this.engine.world, this.constraint)
          }
        }
      }

      // set maximum velocity for ball
      if (Matter.Vector.magnitude(this.ballplayed.velocity) > OPTIONS.MAXVELOCITYSQ) {
        var angle = Math.atan2(this.ballplayed.velocity.y, this.ballplayed.velocity.x)
        Matter.Body.setVelocity(this.ballplayed, { x: Math.cos(angle) * OPTIONS.MAXVELOCITY, y: Math.sin(angle) * OPTIONS.MAXVELOCITY })
      }
      Matter.Body.setAngularVelocity(this.ballplayed, 0)
    }.bind(this)
  }
// run server
}
