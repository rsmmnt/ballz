module.exports =
{
  gameSizeX: 2400, //800
  gameSizeY: 1500, //1000
  goalSize: 360,
  goalDepth: 20,
  maxPlayers: 6,
  restartScore: 10,
  minX: 50,
  minY: 50,
  maxX: 450,
  maxY: 450,
  playerRad: 32,
  ballRad: 20,
  playerColor: 'black',
  ballColor: 'magenta',
  shotInterval: 1000,
  gameTime: 300,
  MAXVELOCITY: 7,
  MAXVELOCITYSQ: 49,
  serverPort: 3000,
  serverHost: '0.0.0.0',
  serverSecret: 'serverSecretMy',
  dbHost: 'localhost',
  dbUser: 'dbuser',
  dbPassword: 'dbuserpassword',
  dbName: 'users',
  ballOptions: {
      isStatic: false,
      restitution: 0.1,
      frictionAir: 0.01,
      friction: 0.3,
      mass: 5,
	  inverseMass: 1/5,
	  frictionStatic: 0.75,
      render: { fillStyle: 'magenta' }
   },
   
  agilePlayerOptions: {
          isStatic: false,
          restitution: 0.1,
          frictionAir: 0.25,
          friction: 0.25,
          mass: 130,
		  inverseMass: 1/120,
		  frictionStatic: 0.5,
        //render: { fillStyle: color /* OPTIONS.playerColor*/ },
		  shotStrength: 0.5/4
		},
  
  defaultPlayerOptions: {
          isStatic: false,
          restitution: 0.1,
          frictionAir: 0.25,
          friction: 0.25,
          mass: 180,
		  inverseMass: 1/180,
		  frictionStatic: 0.5,
         //render: { fillStyle: color /* OPTIONS.playerColor*/ }
		  shotStrength: 0.9/4
        },
  
  shooterPlayerOptions: {
		  isStatic: false,
          restitution: 0.1,
          frictionAir: 0.25,
          friction: 0.25,
          mass: 250,
		  inverseMass: 1/250,
		  frictionStatic: 0.5,
         //render: { fillStyle: color /* OPTIONS.playerColor*/ }
		  shotStrength: 1.8/4	
	  
  }
  
}
