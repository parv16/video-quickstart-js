'use strict';

/**
 * Load Twilio configuration from .env config file - the following environment
 * variables should be set:
 * process.env.TWILIO_ACCOUNT_SID
 * process.env.TWILIO_API_KEY
 * process.env.TWILIO_API_SECRET
 */
require('dotenv').load();

var http = require('http');
var path = require('path');
var AccessToken = require('twilio').jwt.AccessToken;
var VideoGrant = AccessToken.VideoGrant;
var express = require('express');
var randomName = require('./randomname');

var bodyParser = require('body-parser')
var fs = require('fs');

// Create Express webapp.
var app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
// parse application/json
app.use(bodyParser.json({limit: '50mb', extended: true}));

// Set up the paths for the examples.
[
  'bandwidthconstraints',
  'codecpreferences',
  'localvideofilter',
  'localvideosnapshot',
  'mediadevices'
].forEach(function(example) {
  var examplePath = path.join(__dirname, `../examples/${example}/public`);
  app.use(`/${example}`, express.static(examplePath));
});

// Set up the path for the quickstart.
var quickstartPath = path.join(__dirname, '../quickstart/public');
app.use('/quickstart', express.static(quickstartPath));

// Set up the path for the examples page.
var examplesPath = path.join(__dirname, '../examples');
app.use('/examples', express.static(examplesPath));

/**
 * Default to the Quick Start application.
 */
app.get('/', function(request, response) {
  response.redirect('/quickstart');
});

var count = 1;
var lastProcessed = 1;
var exec = require('child_process').exec;

var dir = '/home/OpenFace/imgDir';
var landmarkDetector = '/home/OpenFace/build/bin/FaceLandmarkImg';

var processedPath = '/home/video-quickstart-js/processed';

app.post('/save', function(request, response) {
    var frame = request.body.frame;
    saveFile(frame);
    var cmd = landmarkDetector+' -f '+dir+'/'+lastProcessed+'.png';
    //lastProcessed += 1;
    var q1 = require('sync-exec')(cmd);
    console.log(q1);
    console.log("lastProcessed",lastProcessed);
    var res = base64_encode(processedPath+'/'+lastProcessed+'.jpg');
    lastProcessed += 1;
    //console.log(res);
    response.send({"frame": res}); 
});

function saveFile(frame){
    var base64Data = frame.replace(/^data:image\/png;base64,/, "");
    
    fs.writeFileSync(dir+'/'+count+".png", base64Data, 'base64', function(err) {
    });
    count += 1;
}

function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

/**
 * Generate an Access Token for a chat application user - it generates a random
 * username for the client requesting a token, and takes a device ID as a query
 * parameter.
 */
app.get('/token', function(request, response) {
  var identity = randomName();

  // Create an access token which we will sign and return to the client,
  // containing the grant we just created.
  var token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET
  );

  // Assign the generated identity to the token.
  token.identity = identity;

  // Grant the access token Twilio Video capabilities.
  var grant = new VideoGrant();
  token.addGrant(grant);

  // Serialize the token to a JWT string and include it in a JSON response.
  response.send({
    identity: identity,
    token: token.toJwt()
  });
});

// Create http server and run it.
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log('Express server running:' + port);
});

