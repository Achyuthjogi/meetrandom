import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { createGame, tryMove, getGameStatus, stateToFEN, stateFromFEN } from '../lib/chessEngine';

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Friend system
  const [friendRequested, setFriendRequested] = useState(false);
  const [friendAccepted, setFriendAccepted] = useState(false);
  const [friendRoomCode, setFriendRoomCode] = useState('');
  const [friendRequestReceived, setFriendRequestReceived] = useState(false);

  // Games
  const [tttBoard, setTttBoard] = useState(Array(9).fill(null));
  const [tttIsMyTurn, setTttIsMyTurn] = useState(false);
  const [tttMySymbol, setTttMySymbol] = useState('X');
  const [tttWinner, setTttWinner] = useState(null);
  const [wyrQuestion, setWyrQuestion] = useState(null);
  const [wyrMyPick, setWyrMyPick] = useState(null);
  const [wyrPartnerPick, setWyrPartnerPick] = useState(null);
  
  // Chess
  const [chessState, setChessState] = useState(null);
  const [chessIsMyTurn, setChessIsMyTurn] = useState(false);
  const [chessMyColor, setChessMyColor] = useState('w');
  const [chessStatus, setChessStatus] = useState('playing');

  // Icebreaker
  const [icebreakerQuestion, setIcebreakerQuestion] = useState(null);

  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);

  const resetGameState = useCallback(() => {
    setTttBoard(Array(9).fill(null));
    setTttIsMyTurn(false);
    setTttMySymbol('X');
    setTttWinner(null);
    setWyrQuestion(null);
    setWyrMyPick(null);
    setWyrPartnerPick(null);
    setIcebreakerQuestion(null);
    setChessState(null);
    setChessIsMyTurn(false);
    setChessMyColor('w');
    setChessStatus('playing');
    setFriendRequested(false);
    setFriendAccepted(false);
    setFriendRoomCode('');
    setFriendRequestReceived(false);
  }, []);

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
      resetGameState();
    });

    s.on('msg', ({ text, from }) => {
      if (from === 'stranger') setIsTyping(false);
      addMessage({ text, from });
    });

    s.on('typing', (typing) => setIsTyping(typing));

    // ── Reactions ──────────────────────────────────────────────
    s.on('reaction', (emoji) => {
      // This will be handled by the App component via onRemoteReaction callback
      if (reactionCallbackRef.current) reactionCallbackRef.current(emoji);
    });

    // ── Icebreaker ─────────────────────────────────────────────
    s.on('icebreaker', (question) => {
      setIcebreakerQuestion(question);
    });

    // ── Games: Tic-Tac-Toe ─────────────────────────────────────
    s.on('game-start', (gameType) => {
      if (gameType === 'ttt') {
        setTttBoard(Array(9).fill(null));
        setTttMySymbol('O'); // Receiver is O
        setTttIsMyTurn(false); // Initiator goes first
        setTttWinner(null);
        if (gameStartCallbackRef.current) gameStartCallbackRef.current(gameType);
      } else if (gameType === 'chess') {
        setChessState(createGame());
        setChessMyColor('b'); // Receiver is black
        setChessIsMyTurn(false); // Initiator (white) goes first
        setChessStatus('playing');
        if (gameStartCallbackRef.current) gameStartCallbackRef.current(gameType);
      }
    });

    s.on('game-move', (data) => {
      if (data.game === 'ttt') {
        setTttBoard(prev => {
          const newBoard = [...prev];
          newBoard[data.index] = data.symbol;
          const winner = checkTTTWinner(newBoard);
          if (winner) setTttWinner(winner);
          return newBoard;
        });
        setTttIsMyTurn(true);
      } else if (data.game === 'chess') {
        setChessState(prev => {
          if (!prev) return prev;
          const moveResult = tryMove(prev, data.fromRow, data.fromCol, data.toRow, data.toCol, data.promotion);
          const newState = moveResult || stateFromFEN(data.fen);
          setChessStatus(getGameStatus(newState));
          return newState;
        });
        setChessIsMyTurn(true);
      }
    });

    s.on('game-reset', () => {
      setTttBoard(Array(9).fill(null));
      setTttWinner(null);
      setTttIsMyTurn(false);
      if (chessState) {
        setChessState(createGame());
        setChessStatus('playing');
        setChessIsMyTurn(false); // Let initiator reset logic handle it
      }
    });

    // ── Games: Would You Rather ────────────────────────────────
    s.on('wyr-question', (question) => {
      setWyrQuestion(question);
      setWyrMyPick(null);
      setWyrPartnerPick(null);
    });

    s.on('wyr-pick', (pick) => {
      setWyrPartnerPick(pick);
    });

    // ── Friend System ──────────────────────────────────────────
    s.on('friend-request-received', () => {
      setFriendRequestReceived(true);
    });

    s.on('friend-accepted', ({ roomCode }) => {
      setFriendAccepted(true);
      setFriendRoomCode(roomCode);
    });

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

  // Callback refs for App-level handlers
  const reactionCallbackRef = useRef(null);
  const gameStartCallbackRef = useRef(null);

  const setOnRemoteReaction = useCallback((cb) => {
    reactionCallbackRef.current = cb;
  }, []);

  const setOnGameStart = useCallback((cb) => {
    gameStartCallbackRef.current = cb;
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
    setIsScreenSharing(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
  };

  const startCamera = async (mode = facingMode) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available. You must use HTTPS or localhost to access the camera.');
        return false;
      }

      // IMPORTANT: On mobile, stop ALL existing tracks BEFORE requesting new
      // ones. Mobile devices only allow one camera stream at a time — if the
      // old stream is still active, getUserMedia for the other camera will fail.
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }

      let stream;
      try {
        // Use { exact: mode } so the browser is forced to pick the requested
        // camera. A bare string like 'environment' is treated as "ideal" and
        // many mobile browsers just silently return the same (front) camera.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: mode } },
          audio: true,
        });
      } catch (exactErr) {
        // Fallback 1: try without "exact" (works on desktop & some devices)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: true,
          });
        } catch (fallbackErr) {
          // Fallback 2: enumerate devices and pick a different deviceId
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          if (videoDevices.length > 1) {
            // Pick the device that is NOT the one we were using
            const currentTrackLabel = cameraTrackRef.current?.label || '';
            const otherDevice = videoDevices.find(
              (d) => d.label !== currentTrackLabel
            ) || videoDevices[1];
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: otherDevice.deviceId } },
              audio: true,
            });
          } else {
            // Only one camera — just re-open it
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
          }
        }
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      setFacingMode(mode);

      // Save camera video track reference
      cameraTrackRef.current = stream.getVideoTracks()[0];

      // Update tracks in the active peer connection
      if (pcRef.current) {
        stream.getTracks().forEach((track) => {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track?.kind === track.kind);
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

  // ── Screen Sharing ──────────────────────────────────────────────
  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in peer connection
      if (pcRef.current) {
        const videoSender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }
      }

      // Update local stream for display
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newStream = new MediaStream([screenTrack, ...(audioTrack ? [audioTrack] : [])]);
        setLocalStream(newStream);
        localStreamRef.current = newStream;
      }

      setIsScreenSharing(true);

      // Handle user stopping screen share via browser UI
      screenTrack.onended = () => {
        stopScreenShare();
      };

      return true;
    } catch (err) {
      console.error('Screen share error:', err);
      return false;
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    // Restore camera track
    if (cameraTrackRef.current && pcRef.current) {
      const videoSender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(cameraTrackRef.current);
      }

      // Restore local stream
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newStream = new MediaStream([cameraTrackRef.current, ...(audioTrack ? [audioTrack] : [])]);
        setLocalStream(newStream);
        localStreamRef.current = newStream;
      }
    }

    setIsScreenSharing(false);
  };

  const findPartner = (interests = []) => {
    cleanupWebRTC();
    setMessages([]);
    resetGameState();
    socketRef.current?.emit('find-partner', { interests });
    setConnectionState('searching');
  };

  const stopChat = () => {
    cleanupWebRTC();
    socketRef.current?.emit('stop');
    setConnectionState('idle');
    resetGameState();
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

  // ── Reaction (send) ─────────────────────────────────────────────
  const sendReaction = useCallback((emoji) => {
    socketRef.current?.emit('reaction', emoji);
  }, []);

  // ── Icebreaker (send) ───────────────────────────────────────────
  const sendIcebreaker = useCallback((question) => {
    socketRef.current?.emit('icebreaker', question);
    setIcebreakerQuestion(question);
  }, []);

  const dismissIcebreaker = useCallback(() => {
    setIcebreakerQuestion(null);
  }, []);

  // ── Games ───────────────────────────────────────────────────────
  const startGame = useCallback((gameType) => {
    socketRef.current?.emit('game-start', gameType);
    if (gameType === 'ttt') {
      setTttBoard(Array(9).fill(null));
      setTttMySymbol('X'); // Initiator is X
      setTttIsMyTurn(true); // Initiator goes first
      setTttWinner(null);
    } else if (gameType === 'chess') {
      setChessState(createGame());
      setChessMyColor('w'); // Initiator is white
      setChessIsMyTurn(true); // White goes first
      setChessStatus('playing');
    }
  }, []);

  const makeTTTMove = useCallback((index) => {
    setTttBoard(prev => {
      const newBoard = [...prev];
      newBoard[index] = tttMySymbol;
      socketRef.current?.emit('game-move', { game: 'ttt', index, symbol: tttMySymbol });
      const winner = checkTTTWinner(newBoard);
      if (winner) setTttWinner(winner);
      setTttIsMyTurn(false);
      return newBoard;
    });
  }, [tttMySymbol]);

  const resetTTT = useCallback(() => {
    setTttBoard(Array(9).fill(null));
    setTttWinner(null);
    setTttIsMyTurn(tttMySymbol === 'X'); // X always goes first
    socketRef.current?.emit('game-reset');
  }, [tttMySymbol]);

  const makeChessMove = useCallback((fromRow, fromCol, toRow, toCol, promotion = null) => {
    setChessState(prev => {
      if (!prev) return prev;
      const newState = tryMove(prev, fromRow, fromCol, toRow, toCol, promotion);
      if (newState) {
        setChessStatus(getGameStatus(newState));
        setChessIsMyTurn(false);
        const fen = stateToFEN(newState);
        socketRef.current?.emit('game-move', {
          game: 'chess',
          fromRow, fromCol, toRow, toCol, promotion, fen
        });
        return newState;
      }
      return prev;
    });
  }, []);

  const resetChess = useCallback(() => {
    setChessState(createGame());
    setChessStatus('playing');
    setChessIsMyTurn(chessMyColor === 'w');
    socketRef.current?.emit('game-reset');
  }, [chessMyColor]);

  const sendWYRQuestion = useCallback((question) => {
    setWyrQuestion(question);
    setWyrMyPick(null);
    setWyrPartnerPick(null);
    socketRef.current?.emit('wyr-question', question);
  }, []);

  const pickWYR = useCallback((pick) => {
    setWyrMyPick(pick);
    socketRef.current?.emit('wyr-pick', pick);
  }, []);

  // ── Friend System ───────────────────────────────────────────────
  const sendFriendRequest = useCallback(() => {
    socketRef.current?.emit('friend-request');
    setFriendRequested(true);
  }, []);

  // ── Skip Reason ─────────────────────────────────────────────────
  const sendSkipReason = useCallback((reason) => {
    if (reason) socketRef.current?.emit('skip-reason', reason);
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
    // Screen sharing
    isScreenSharing,
    shareScreen,
    stopScreenShare,
    // Reactions
    sendReaction,
    setOnRemoteReaction,
    // Icebreaker
    icebreakerQuestion,
    sendIcebreaker,
    dismissIcebreaker,
    // Games
    startGame,
    setOnGameStart,
    tttBoard,
    tttIsMyTurn,
    tttMySymbol,
    tttWinner,
    makeTTTMove,
    resetTTT,
    wyrQuestion,
    wyrMyPick,
    wyrPartnerPick,
    sendWYRQuestion,
    pickWYR,
    // Chess
    chessState,
    chessIsMyTurn,
    chessMyColor,
    chessStatus,
    makeChessMove,
    resetChess,
    // Friend
    friendRequested,
    friendAccepted,
    friendRoomCode,
    friendRequestReceived,
    sendFriendRequest,
    // Skip reason
    sendSkipReason,
    // Socket ref for reactions hook
    socketRef,
  };
}

// ── TTT Winner Check ──────────────────────────────────────────────
function checkTTTWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],            // diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every(cell => cell !== null)) return 'draw';
  return null;
}
