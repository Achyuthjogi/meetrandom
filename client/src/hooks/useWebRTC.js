import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC() {
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle, searching, connected, disconnected
  const [onlineCount, setOnlineCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [facingMode, setFacingMode] = useState('user');

  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize Socket
  useEffect(() => {
    const s = io('/', { path: '/socket.io' });
    socketRef.current = s;
    setSocket(s);

    s.on('stats', ({ online }) => setOnlineCount(online));
    s.on('waiting', () => setConnectionState('searching'));
    
    s.on('matched', async ({ isInitiator }) => {
      setConnectionState('connected');
      await setupWebRTC(isInitiator, s);
    });

    s.on('partner-left', () => {
      cleanupWebRTC();
      setConnectionState('disconnected');
      addMessage({ text: 'Stranger has disconnected.', type: 'system' });
    });

    s.on('msg', ({ text, from }) => {
      if (from === 'stranger') setIsTyping(false);
      addMessage({ text, from });
    });

    s.on('typing', (typing) => setIsTyping(typing));

    // WebRTC Signaling
    s.on('signal-offer', async (offer) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(offer);
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      s.emit('signal-answer', answer);
    });

    s.on('signal-answer', async (answer) => {
      if (pcRef.current) await pcRef.current.setRemoteDescription(answer);
    });

    s.on('signal-candidate', async (candidate) => {
      if (pcRef.current) await pcRef.current.addIceCandidate(candidate);
    });

    return () => {
      s.disconnect();
      cleanupWebRTC();
    };
  }, []);

  const setupWebRTC = async (isInitiator, s) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        s.emit('signal-candidate', event.candidate);
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.emit('signal-offer', offer);
    }
  };

  const cleanupWebRTC = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
  };

  const startCamera = async (mode = facingMode) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available. You must use HTTPS or localhost to access the camera.');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode }, 
        audio: true 
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      setFacingMode(mode);

      // update tracks if connected
      if (pcRef.current) {
         stream.getTracks().forEach(track => {
             const sender = pcRef.current.getSenders().find(s => s.track?.kind === track.kind);
             if (sender) sender.replaceTrack(track);
             else pcRef.current.addTrack(track, stream);
         });
      }
      return true;
    } catch (err) {
      console.error('Failed to get media:', err.message || err);
      return false;
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    return await startCamera(newMode);
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  };

  const toggleTrack = (kind) => {
    if (!localStream) return false;
    const track = localStream.getTracks().find((t) => t.kind === kind);
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  };

  const findPartner = (interests = []) => {
    cleanupWebRTC();
    setMessages([]);
    socketRef.current?.emit('find-partner', { interests });
    setConnectionState('searching');
  };

  const stopChat = () => {
    cleanupWebRTC();
    socketRef.current?.emit('stop');
    setConnectionState('idle');
  };

  const sendMessage = (text) => {
    socketRef.current?.emit('msg', text);
    socketRef.current?.emit('typing', false);
  };

  const typingTimeout = useRef(null);

  const sendTyping = (typing) => {
    if (typing) {
      socketRef.current?.emit('typing', true);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('typing', false);
      }, 2000);
    } else {
      clearTimeout(typingTimeout.current);
      socketRef.current?.emit('typing', false);
    }
  };

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }]);
  }, []);

  return {
    connectionState,
    localStream,
    remoteStream,
    onlineCount,
    messages,
    isTyping,
    startCamera,
    stopCamera,
    toggleTrack,
    findPartner,
    stopChat,
    sendMessage,
    sendTyping,
    switchCamera,
  };
}
