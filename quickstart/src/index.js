'use strict';

var Video = require('twilio-video');
var activeRoom;
var previewTracks;
var identity;
var roomName;
var imageCapture;
var canvas;
var modifiedCanvas;

function modifyTrack(localtracks){
  var localaudiotrack = localtracks[0];
  var localvideotrack = localtracks[1];
  imageCapture = new ImageCapture(localvideotrack.mediaStreamTrack);
  canvas = document.createElement('canvas');
  document.getElementsByTagName('body')[0].appendChild(canvas);
  modifiedCanvas = document.createElement('canvas');
  document.getElementsByTagName('body')[0].appendChild(modifiedCanvas);

  window.setInterval(function() {
  imageCapture.grabFrame()
  .then(imageBitmap => {
    drawCanvas(imageBitmap);
  })
  .catch(error => console.log(error));
  }, 100);
  let stream = modifiedCanvas.captureStream();

  localvideotrack = stream.getVideoTracks().map(track => new Video.LocalVideoTrack(track));
  localaudiotrack = new Video.LocalAudioTrack(localaudiotrack.mediaStreamTrack);

  //localvideotrack = stream.getVideoTracks().map(track => new Video.RemoteVideoTrack(track));
  localtracks[0] = localaudiotrack;
  localtracks[1] = localvideotrack[0];
  
  $.getJSON('/token', function(data) {
    identity = data.identity;
    log("Joining room '" + 'ROOMB' + "' in order to forward tracks...");
    Video.connect(data.token, {name:'ROOMB', logLevel:'off', tracks:localtracks}).then(roomBJoined, function(error) {
      log('Could not connect to Twilio: ' + error.message);
    });
  });

  return localtracks;
}

var toPost = 0;
function drawCanvas(img) {
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
  /*canvas.width = getComputedStyle(canvas).width.split('px')[0];
  canvas.height = getComputedStyle(canvas).height.split('px')[0];
  let ratio  = Math.min(canvas.width / img.width, canvas.height / img.height);
  let x = (canvas.width - img.width * ratio) / 2;
  let y = (canvas.height - img.height * ratio) / 2;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height,
      x, y, img.width * ratio, img.height * ratio);
  */
  let frame = canvas.toDataURL();
  var modifiedFrame;
  if(toPost%10 == 0){
  console.log("UnModified: ",frame)
  $.post( "/save", { frame: frame }, function( data ) {
      modifiedFrame = data.frame;
      console.log("Modified: ",modifiedFrame)
      if(modifiedFrame){
        var image = new Image();
        image.onload = function() {
          modifiedCanvas.width = img.width;
          modifiedCanvas.height = img.height;
          modifiedCanvas.getContext('2d').drawImage(image, 0, 0, img.width, img.height);
        };
        image.src = 'data:image/jpg;base64,'+modifiedFrame;
      }
  }, "json");
  }
  else{
      modifiedCanvas.width = img.width;
      modifiedCanvas.height = img.height;
      modifiedCanvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
  }
  toPost += 1;
}

// Attach the Tracks to the DOM.
function attachTracks(tracks, container) {
    tracks.forEach(function(track) {
      container.appendChild(track.attach());
    });
}

// Attach the Participant's Tracks to the DOM.
function attachParticipantTracks(participant, container) {
  var tracks = Array.from(participant.tracks.values());
  attachTracks(tracks, container);
}

// Detach the Tracks from the DOM.
function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);

// Obtain a token from the server in order to connect to the Room.
$.getJSON('/token', function(data) {
  identity = data.identity;
    roomName = 'ROOMA';

    log("Joining room '" + roomName + "'...");
    var connectOptions = {
      name: roomName,
      logLevel: 'off',
      audio: false,
      video: false
    };

    if (previewTracks) {
      connectOptions.tracks = previewTracks;
    }

    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
      log('Could not connect to Twilio: ' + error.message);
    });

  // Bind button to leave Room.
  // log('Leaving room...');
  // activeRoom.disconnect();
});

// Successfully connected!
function roomJoined(room) {
  window.room = activeRoom = room;

  log("Joined as '" + identity + "'");

  // Attach the Tracks of the Room's Participants.
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var previewContainer = document.getElementById('remote-media');
    attachParticipantTracks(participant, previewContainer);
  });

  // When a Participant joins the Room, log the event.
  room.on('participantConnected', function(participant) {
    log("Joining: '" + participant.identity + "'");
  });

  // When a Participant adds a Track, attach it to the DOM.
  room.on('trackAdded', function(track, participant) {
    log(participant.identity + " added track: " + track.kind);
    var previewContainer = document.getElementById('remote-media');
    attachTracks([track], previewContainer);
    if(track.kind == 'video')
    forwardTracksToROOMB(room);
  });

  // When a Participant removes a Track, detach it from the DOM.
  room.on('trackRemoved', function(track, participant) {
    log(participant.identity + " removed track: " + track.kind);
    detachTracks([track]);
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on('participantDisconnected', function(participant) {
    log("Participant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on('disconnected', function() {
    log('Left');
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
      previewTracks = null;
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    activeRoom = null;
  });
}

// Activity log.
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}

// Forward tracks to ROOMB
function forwardTracksToROOMB(room){
  //var localtracks = Array.from(room.localParticipant.tracks.values());
  var localtracks = Array.from(room.participants.values().next().value.tracks.values());
  localtracks =  modifyTrack(localtracks);
  /*$.getJSON('/token', function(data) {
    identity = data.identity;
    log("Joining room '" + 'ROOMB' + "' in order to forward tracks...");
    Video.connect(data.token, {name:'ROOMB', logLevel:'off', tracks:localtracks}).then(roomBJoined, function(error) {
      log('Could not connect to Twilio: ' + error.message);
    });
  });*/
}

function roomBJoined(room){
  log("ROOMB JOINED");
}


