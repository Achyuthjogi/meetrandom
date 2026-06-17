import { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { VideoCard } from './components/VideoCard';
import { FloatingDock } from './components/FloatingDock';
import { ChatPanel } from './components/ChatPanel';
import { useWebRTC } from './hooks/useWebRTC';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  const [view, setView] = useState('onboarding'); // onboarding, room
  
  const {
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
  } = useWebRTC();

  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const handleStart = async (interests) => {
    await startCamera(); // If it fails, that's okay, localStream will just be null
    setView('room');
    findPartner(interests);
  };

  const handleNext = () => {
    findPartner();
  };

  const handleStop = () => {
    stopChat();
  };

  const handleToggleCam = async () => {
    if (!localStream) {
      const success = await startCamera();
      if (success) {
        setCamEnabled(true);
        setMicEnabled(true);
      }
      return;
    }
    const isEnabled = toggleTrack('video');
    setCamEnabled(isEnabled);
  };

  const handleToggleMic = async () => {
    if (!localStream) {
      const success = await startCamera();
      if (success) {
        setCamEnabled(true);
        setMicEnabled(true);
      }
      return;
    }
    const isEnabled = toggleTrack('audio');
    setMicEnabled(isEnabled);
  };

  const handleExit = () => {
    stopChat();
    stopCamera();
    setView('onboarding');
  };

  return (
    <div className="relative w-full min-h-[100dvh] bg-background font-sans overflow-x-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {view === 'onboarding' ? (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Onboarding onStart={handleStart} onlineCount={onlineCount} />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col p-4 md:p-6 gap-6 z-10 w-full"
          >
            {/* Top Bar */}
            <header className="flex items-center justify-between z-20 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-bold text-white shadow-lg">M</div>
                <span className="font-bold text-xl tracking-tight text-white">MeetRandom</span>
              </div>
              <button 
                onClick={handleExit}
                className="px-4 py-2 rounded-full glass text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Exit Room
              </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col lg:flex-row gap-6 pb-[100px] lg:pb-0">
              
              {/* Video Grid (takes up majority of screen) */}
              <div className="flex-1 flex flex-col sm:flex-row gap-4 lg:gap-6">
                <div className="w-full aspect-square sm:flex-1 sm:h-auto sm:aspect-auto relative">
                  <VideoCard 
                    stream={remoteStream} 
                    isLocal={false} 
                    state={connectionState} 
                  />
                </div>
                <div className="w-full aspect-square sm:flex-1 sm:h-auto sm:aspect-auto relative">
                  <VideoCard 
                    stream={localStream} 
                    isLocal={true} 
                    state={connectionState} 
                    muted={!micEnabled}
                  />
                </div>
              </div>

              {/* Chat Panel */}
              <div className="w-full h-[500px] lg:h-auto lg:flex-1 lg:max-w-[400px] flex-shrink-0 z-20">
                <ChatPanel 
                  messages={messages}
                  onSend={sendMessage}
                  onChange={(val) => sendTyping(val.length > 0)}
                  isTyping={isTyping}
                  state={connectionState}
                />
              </div>

            </main>

            <FloatingDock 
              onNext={handleNext}
              onStop={handleStop}
              onReport={() => alert('User reported.')}
              camEnabled={camEnabled}
              micEnabled={micEnabled}
              toggleCam={handleToggleCam}
              toggleMic={handleToggleMic}
              switchCamera={switchCamera}
              state={connectionState}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
