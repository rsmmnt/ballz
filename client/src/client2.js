//var io = require('socket.io-client');
var canv = document.getElementById("cv");
var graph = canv.getContext("2d");
console.log("start");
var sc = document.getElementById("sc");
var mousepressed = false;
var socket;
if (!socket) {
        socket = io("http://localhost:3000");
        
    }
	
var resser = new Resurrect();
/*
require(['options'], function(data)
{
	OPTIONS = data;
	console.log("Loaded options");
	
});

*/
//var KEYBOARD = require('./keyboard.json');

var score = 
{
	topscore: 0,
	botscore: 0
}

var keys={};

canv.addEventListener('keydown', function(event)
{
	var key = event.which || event.keyCode;
	keys[event.keyCode] = true;
	
}, false);


canv.addEventListener('keyup', function(event)
{
	var key = event.which || event.keyCode;
	keys[event.keyCode] = false;
	
}, false);




	// variables
		// engine
	let engine = Matter.Engine.create();
		engine.world.gravity.x = 0;
		engine.world.gravity.y = 0;
        engine.broadphase.current = 'bruteForce';
		// render
	let render = Matter.Render.create({
			canvas: document.getElementById('cv'),
			engine: engine,
			options: {
				width: OPTIONS.gameSizeX,
				height: OPTIONS.gameSizeY,
				wireframes: false, // need this or various render styles won't take
				background: OPTIONS.fieldColor
			}
		});
	Matter.Render.run(render);

	socket.on('sendGameState', function(worldSent){
		engine.world.bodies = resser.resurrect(worldSent.world);
		sc.innerHTML = '<h2> Left ' + worldSent.score.botscore + ' Right ' + worldSent.score.topscore + '</h2>'; 
		
		
		
		//console.log("Receiving objects" + worldSent.world);
		
	});
		
	function sendUpdates()
	{
		socket.emit('sendKeypadState',keys);
		
	}
	
	setInterval(sendUpdates,1000/120);