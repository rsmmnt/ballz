//var io = require('socket.io-client');
var canv = document.getElementById("cv");
var canvdiv = document.getElementById("gameCanvas");
var graph = canv.getContext("2d");
console.log("start");
var leftsc = document.getElementById("leftSc");
var rightsc = document.getElementById("rightSc");
var sc = document.getElementById("sc");
var start2Btn = document.getElementById("start2Button");
var start4Btn = document.getElementById("start4Button");
var start6Btn = document.getElementById("start6Button");
var typeSelector = document.getElementById("typeSelector");
var loginDiv = document.getElementById("login");
var loginBtn = document.getElementById("loginBtn");
$('#loginDiv').hide();

//var startimg = document.getElementById("startimg");

var mousepressed = false;
var socketGroup = '';
var socket;
var engine;
var render;
var username = "guest";

var gameStarted = false;
canvdiv.style.visibility = "hidden";
//startimg.style.display = "block";
var resser = new Resurrect();
/*
require(['options'], function(data)
{
	OPTIONS = data;
	console.log("Loaded options");
	
});

*/
//var KEYBOARD = require('./keyboard.json');


if (!socket) {
        socket = io("http://" + OPTIONS.serverHost + ":" + OPTIONS.serverPort);  
}

var score = 
{
	topscore: 0,
	botscore: 0
}

// Controls

var keys={};

window.addEventListener('keydown', function(event)
{
	var key = event.which || event.keyCode;
	keys[event.keyCode] = true;
	
}, false);


window.addEventListener('keyup', function(event)
{
	var key = event.which || event.keyCode;
	keys[event.keyCode] = false;
	
}, false);


// Auth handling

socket.on('sendAuthToken', function(data)
{
    Cookies.set('token', data.token, { expires: 365 });
	Cookies.set('username', data.username, { expires: 365 });
	username = data.username;
	$('#authDiv').html("<h2> " + Cookies.get('username') + "</h2>");
	$('#authDiv').show();
	$('#loginDiv').hide();
	$('#loginBtn').hide();
	$('#logoutBtn').show();
});

socket.on('loginInfo', function(data){
	
$('#loginResponse').html(data);
});


socket.on('signupInfo', function(data){

$('#signupResponse').html(data);	
	
	
});

socket.on('authJwtOk', function(){
	//username = data.username;
	$('#authDiv').innerHTML = Cookies.get('username');
	$('#authDiv').show();
	$('#loginDiv').hide();
	$('#loginBtn').hide();
	$('#logoutBtn').show();
	
	
});


$('#logoutBtn').hide();
var token = Cookies.get('token');
if(token)
{
	socket.emit('authJwt',token);
}
if(Cookies.get('username'))
{
$('#authDiv').html("<h2>" + Cookies.get('username') + "</h2>");
}
else
{
$('#authDiv').html("<h2> Guest </h2>");
	
}
$('#authDiv').show();
console.log(Cookies.get('username'));

$('#loginSubmit').click(function(){
	socket.emit('authLogin', { username: $('#loginUsername').val(), password: $('#loginPassword').val()});
	
});

$('#signupSubmit').click(function(){
	if($('#signupPassword').val() == $('#signupPassword2').val())
	{
	socket.emit('authSignup', { username: $('#signupUsername').val(), password: $('#signupPassword').val()});
	}
	else
	{
	$('#signupResponse').html("Passwords do not match");	
	}
});

$('#logoutBtn').click(function(){
	socket.emit('authLogout');
	Cookies.remove('username');
	Cookies.remove('token');
	//Cookies.set('username','Guest');
	$('#authDiv').html( "<h2> Guest </h2>");
	$('#authDiv').show();
	$('#loginDiv').hide();
	$('#loginBtn').show();
	$('#logoutBtn').hide();
	
});


// game stuff

function startGame()
{

	var token = Cookies.get('token');
	if(token)
	{
		socket.emit('authJwt',token);
	}
	//$('#authDiv').html("<h2>" + Cookies.get('username') + "</h2>");
	//$('#authDiv').show();
	
	
	
	engine = Matter.Engine.create();
	engine.world.gravity.x = 0;
	engine.world.gravity.y = 0;
    engine.broadphase.current = 'bruteForce';
		// render
	
	var bnds = { 
            min: { x: 0, y: 0 }, 
            max: { x: 1600, y: 1000 }
        };
	
	
	
	render = Matter.Render.create({
			canvas: document.getElementById('cv'),
			engine: engine,
			bounds: bnds,
			options: {
				width: OPTIONS.gameSizeX,
				height: OPTIONS.gameSizeY,
				//pixelRatio: 'auto',
				wireframes: false, // need this or various render styles won't take
				background: OPTIONS.fieldColor,
				hasBounds: true
			}
		});
	Matter.Render.run(render);
	
	socket.on('sendGameState', function(worldSent){
		engine.world.bodies = resser.resurrect(worldSent.world);
		sc.innerHTML = '<h2> Left ' + worldSent.score.botscore + ' Right ' + worldSent.score.topscore + '</h2>'; 
		//canv.style.visibility = "visible";
		canvdiv.style.visibility = 'visible';
		//startimg.style.display = 'none';
		//console.log("Receiving objects" + worldSent.world);
		
	});
	
	socket.on('sendCoordinates', function(message){
		var i;
		for(i = 0; i < engine.world.bodies.length; i++)
		{
			engine.world.bodies[i].position = message.positions[i];
		}
	//	Matter.World.scale(engine.world,0.5,0.5,{x:0, y:0});
		
		score.topscore = message.score.topscore;
		score.botscore = message.score.botscore;
		sc.innerHTML = '<h3>' + 'Time left: ' + new Date(message.timeleft).getMinutes() + ':' + new Date(message.timeleft).getSeconds() + '</h3>'; 
		leftsc.innerHTML = '<h1>' + score.botscore + '</h1>'; 
		rightsc.innerHTML = '<h1>' + score.topscore + '</h1>';
		var value = typeSelector[typeSelector.selectedIndex].value;
		socket.emit('setPlayerType', value);
		
		
	});
	
	socket.on('setSocketGroup', function(sockGroup)
	{
		socketGroup = sockGroup;
	});
	
	socket.on('endgame', function(){
		sc.innerHTML = '<h3>Game Over!</h3>';
		leftsc.innerHTML = '<h1>' + score.botscore + '</h1>'; 
		rightsc.innerHTML = '<h1>' + score.topscore + '</h1>';
		gameStarted = false;
		start2Btn.innerHTML='New 1x1 game';
		start4Btn.innerHTML='New 2x2 game';
		start6Btn.innerHTML='New 3x3 game';
	});
		
	function sendUpdates()
	{
		socket.emit('sendKeypadState',keys);
		
	}
	
	setInterval(sendUpdates,1000/60);
	
	
	
}


// buttons handling

start2Btn.addEventListener("click", function(){
	window.dispatchEvent(new Event('resize'));
	if(gameStarted == false)
	{
	//canv.style.visibility = "hidden";
	sc.innerHTML = '<h2>Waiting for players...<h2>';
	gameStarted = true;
	/*if (!socket) {
        socket = io("http://" + OPTIONS.serverHost + ":" + OPTIONS.serverPort);  
    }*/
	socket.emit('start2Game');
	startGame();
	}
});

start4Btn.addEventListener("click", function(){
	window.dispatchEvent(new Event('resize'));
	if(gameStarted == false)
	{
	//canv.style.visibility = "hidden";
	sc.innerHTML = '<h2>Waiting for players...<h2>';
	gameStarted = true;
	/*if (!socket) {
        socket = io("http://" + OPTIONS.serverHost + ":" + OPTIONS.serverPort);  

    }*/
	socket.emit('start4Game');
	startGame();
	}
});

start6Btn.addEventListener("click", function(){
	window.dispatchEvent(new Event('resize'));
	if(gameStarted == false)
	{
	//canv.style.visibility = "hidden";
	sc.innerHTML = '<h2>Waiting for players...<h2>';
	gameStarted = true;
	/*if (!socket) {
        socket = io("http://" + OPTIONS.serverHost + ":" + OPTIONS.serverPort);  

    }*/
	socket.emit('start6Game');
	startGame();
	}
});

loginBtn.addEventListener("click", function(){
	$('#loginDiv').toggle();
	if($('#loginDiv').is(':visible'))
	{
		loginBtn.innerHTML = "Close login widget";
	}
	else
	{
		loginBtn.innerHTML = "Login/Signup"
	}
	$('#loginResponse').html("");
	$('#signupResponse').html("");
});

// to resize canvas with window

window.addEventListener("resize", function(){
	if(OPTIONS.gameSizeX/document.documentElement.clientWidth >= OPTIONS.gameSizeY/document.documentElement.clientHeight)
	{
		render.options.width = document.documentElement.clientWidth*0.8;
		render.options.height = (OPTIONS.gameSizeY/OPTIONS.gameSizeX)*render.options.width;
	}
	else
	{
		render.options.height = document.documentElement.clientHeight*0.8;
		render.options.width = (OPTIONS.gameSizeX/OPTIONS.gameSizeY)*render.options.height;		
	}
	console.log(' ' + document.documentElement.clientWidth + ' ' + document.documentElement.clientHeight);
	
	render.canvas.height = render.options.height;
	render.canvas.width = render.options.width;
	//Matter.Render.run(render);
   // canvas.width = OPTIONS.gameSizeX * (window.innerWidth/OPTIONS.gameSizeX);
   // canvas.height = OPTIONS.gameSizeY * (window.innerHeight/OPTIONS.gameSizeY);
});
	




	// variables
		// engine
