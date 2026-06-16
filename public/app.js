/**
 * MeetRandom — Client Application
 *
 * Handles:
 *  - Socket.IO connection to signaling server
 *  - WebRTC peer connection lifecycle
 *  - Local camera/mic management
 *  - UI state machine (idle → searching → connected → disconnected)
 *  - Text chat
 */

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const landingScreen   = $('landingScreen');
const chatScreen      = $('chatScreen');
const startLargeBtn   = $('startLargeBtn');
const localVideo      = $('localVideo');
const remoteVideo     = $('remoteVideo');
const selfOverlay     = $('selfOverlay');
const strangerOverlay = $('strangerOverlay');
const searchingAnim   = $('searchingAnim');
const disconnectedMsg = $('disconnectedMsg');
const idleMsg         = $('idleMsg');
const newChatBtn      = $('newChatBtn');
const nextBtn         = $('nextBtn');
const stopBtn         = $('stopBtn');
const backBtn         = $('backBtn');
const chatMessages    = $('chatMessages');
const chatForm        = $('chatForm');
const chatInput       = $('chatInput');
const chatSendBtn     = $('chatSendBtn');
const toggleCamBtn    = $('toggleCamBtn');
const toggleMicBtn    = $('toggleMicBtn');
const camOnIcon       = $('camOnIcon');
const camOffIcon      = $('camOffIcon');
const micOnIcon       = $('micOnIcon');
const micOffIcon      = $('micOffIcon');
const onlineCountEl   = $('onlineCount');
const toastEl         = $('toast');

// ─── State ───────────────────────────────────────────────────────────────────
let socket = null;
let localStream = null;
let peerConnection = null;
let camEnabled = true;
let micEnabled = true;
let currentState = 'idle'; // idle | searching | connected | disconnected

// WebRTC config — uses free STUN servers, add TURN for production
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// ─── Initialize ──────────────────────────────────────────────────────────────

function init() {
  socket = io({ reconnection: true, reconnectionAttempts: 10 });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    showToast('Connection lost. Reconnecting...');
  });

  socket.on('online-count', (count) => {
    onlineCountEl.textContent = count;
  });

  socket.on('waiting', () => {
    setState('searching');
  });

  socket.on('matched', async ({ roomId, isInitiator }) => {
    console.log(`[Match] Room: ${roomId}, Initiator: ${isInitiator}`);
    setState('connected');
    await setupPeerConnection(isInitiator);
  });

  socket.on('webrtc-offer', async (offer) => {
    if (!peerConnection) return;
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('webrtc-answer', answer);
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  });

  socket.on('webrtc-answer', async (answer) => {
    if (!peerConnection) return;
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
    }
  });

  socket.on('webrtc-ice-candidate', async (candidate) => {
    if (!peerConnection) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  });

  socket.on('chat-message', (msg) => {
    appendChatMessage(msg.text, msg.from);
  });

  socket.on('partner-disconnected', () => {
    console.log('[Match] Partner disconnected');
    cleanupPeerConnection();
    setState('disconnected');
    showToast('Stranger has disconnected');
  });

  // ── UI Event Listeners ──────────────────────────────────────────────────
  startLargeBtn.addEventListener('click', enterChat);
  newChatBtn.addEventListener('click', startNewChat);
  nextBtn.addEventListener('click', skipToNext);
  stopBtn.addEventListener('click', stopChat);
  backBtn.addEventListener('click', exitToLanding);
  toggleCamBtn.addEventListener('click', toggleCamera);
  toggleMicBtn.addEventListener('click', toggleMic);
  chatForm.addEventListener('submit', sendMessage);
}

// ─── Screen Navigation ──────────────────────────────────────────────────────

async function enterChat() {
  try {
    await acquireLocalMedia();
    landingScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    setState('idle');
    showToast('Camera ready! Click "New Chat" to find someone');
  } catch (err) {
    console.error('[Media] Failed to acquire camera:', err);
    showToast('Could not access camera/mic. Please allow permissions.');
  }
}

function exitToLanding() {
  stopChat();
  releaseLocalMedia();
  chatScreen.style.display = 'none';
  landingScreen.style.display = 'flex';
}

// ─── Local Media ────────────────────────────────────────────────────────────

async function acquireLocalMedia() {
  if (localStream) return;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: true,
  });

  localVideo.srcObject = localStream;
  selfOverlay.classList.add('hidden');
  camEnabled = true;
  micEnabled = true;
  updateMediaIcons();
}

function releaseLocalMedia() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  selfOverlay.classList.remove('hidden');
}

function toggleCamera() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  camEnabled = !camEnabled;
  track.enabled = camEnabled;
  updateMediaIcons();
}

function toggleMic() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  micEnabled = !micEnabled;
  track.enabled = micEnabled;
  updateMediaIcons();
}

function updateMediaIcons() {
  camOnIcon.style.display  = camEnabled ? '' : 'none';
  camOffIcon.style.display = camEnabled ? 'none' : '';
  toggleCamBtn.classList.toggle('off', !camEnabled);

  micOnIcon.style.display  = micEnabled ? '' : 'none';
  micOffIcon.style.display = micEnabled ? 'none' : '';
  toggleMicBtn.classList.toggle('off', !micEnabled);
}

// ─── UI State Machine ───────────────────────────────────────────────────────

function setState(state) {
  currentState = state;

  // Reset all overlays
  searchingAnim.style.display   = 'none';
  disconnectedMsg.style.display = 'none';
  idleMsg.style.display         = 'none';
  strangerOverlay.classList.remove('hidden');

  switch (state) {
    case 'idle':
      idleMsg.style.display = 'flex';
      newChatBtn.disabled = false;
      nextBtn.disabled    = true;
      stopBtn.disabled    = true;
      chatInput.disabled  = true;
      chatSendBtn.disabled = true;
      break;

    case 'searching':
      searchingAnim.style.display = 'flex';
      newChatBtn.disabled = true;
      nextBtn.disabled    = true;
      stopBtn.disabled    = false;
      chatInput.disabled  = true;
      chatSendBtn.disabled = true;
      break;

    case 'connected':
      strangerOverlay.classList.add('hidden');
      newChatBtn.disabled = false;
      nextBtn.disabled    = false;
      stopBtn.disabled    = false;
      chatInput.disabled  = false;
      chatSendBtn.disabled = false;
      chatInput.focus();
      addSystemMessage('You are now connected with a stranger. Say hi!');
      break;

    case 'disconnected':
      disconnectedMsg.style.display = 'flex';
      newChatBtn.disabled = false;
      nextBtn.disabled    = true;
      stopBtn.disabled    = true;
      chatInput.disabled  = true;
      chatSendBtn.disabled = true;
      addSystemMessage('Stranger has disconnected.');
      break;
  }
}

// ─── Chat Actions ───────────────────────────────────────────────────────────

function startNewChat() {
  cleanupPeerConnection();
  clearChat();
  socket.emit('find-partner');
  setState('searching');
  addSystemMessage('Looking for someone to chat with...');
}

function skipToNext() {
  cleanupPeerConnection();
  clearChat();
  socket.emit('skip');
  socket.emit('find-partner');
  setState('searching');
  addSystemMessage('Looking for someone new...');
}

function stopChat() {
  cleanupPeerConnection();
  socket.emit('stop');
  setState('idle');
  addSystemMessage('You have disconnected.');
}

// ─── Text Chat ──────────────────────────────────────────────────────────────

function sendMessage(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || currentState !== 'connected') return;
  socket.emit('chat-message', text);
  chatInput.value = '';
  chatInput.focus();
}

function appendChatMessage(text, from) {
  const div = document.createElement('div');
  div.classList.add('chat-msg', from);
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.classList.add('chat-system-msg');
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
  chatMessages.innerHTML = '';
}

// ─── WebRTC ─────────────────────────────────────────────────────────────────

async function setupPeerConnection(isInitiator) {
  cleanupPeerConnection();

  peerConnection = new RTCPeerConnection(rtcConfig);

  // Add local tracks to connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle incoming remote tracks
  peerConnection.ontrack = (event) => {
    console.log('[WebRTC] Remote track received');
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', event.candidate);
    }
  };

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed') {
      showToast('Connection failed. Try again.');
      cleanupPeerConnection();
      setState('disconnected');
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ICE state:', peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === 'disconnected' || 
        peerConnection.iceConnectionState === 'failed') {
      // Give a moment before declaring disconnected
      setTimeout(() => {
        if (peerConnection && 
            (peerConnection.iceConnectionState === 'disconnected' || 
             peerConnection.iceConnectionState === 'failed')) {
          cleanupPeerConnection();
          setState('disconnected');
          addSystemMessage('Connection lost.');
        }
      }, 3000);
    }
  };

  // If initiator, create and send offer
  if (isInitiator) {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('webrtc-offer', offer);
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    }
  }
}

function cleanupPeerConnection() {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

// ─── Toast ──────────────────────────────────────────────────────────────────

let toastTimeout = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// ─── Boot ───────────────────────────────────────────────────────────────────
init();
