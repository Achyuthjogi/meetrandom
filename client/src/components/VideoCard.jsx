import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, User } from 'lucide-react';
import { cn } from '../lib/utils';

const SEARCH_MESSAGES = [
  "Finding your next random vibe...",
  "Scanning the internet...",
  "Matching energy levels...",
  "Connecting to someone interesting..."
];

export function VideoCard({ stream, isLocal, state, muted }) {
  const videoRef = useRef(null);
  const [msgIndex, setMsgIndex] = React.useState(0);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (state === 'searching' && !isLocal) {
      const interval = setInterval(() => {
        setMsgIndex((i) => (i + 1) % SEARCH_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [state, isLocal]);

  const showOverlay = !stream || (state !== 'connected' && !isLocal);

  return (
    <div className="relative w-full h-full bg-surface rounded-[24px] overflow-hidden border border-white/5 shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted || isLocal}
        className={cn(
          "w-full h-full object-cover transition-all duration-700",
          isLocal && "transform -scale-x-100",
          showOverlay && "filter blur-xl scale-110 opacity-50"
        )}
      />

      <AnimatePresence mode="wait">
        {showOverlay && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-background/40 backdrop-blur-md"
          >
            {state === 'searching' && !isLocal ? (
              <div className="flex flex-col items-center">
                <div className="relative mb-6">
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-accent rounded-full"
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-cyan rounded-full"
                  />
                  <div className="relative bg-surface p-4 rounded-full border border-white/10 z-10">
                    <User className="w-8 h-8 text-white/50" />
                  </div>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.p
                    key={msgIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg font-medium text-white/90"
                  >
                    {SEARCH_MESSAGES[msgIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            ) : !isLocal && state === 'idle' ? (
               <div className="text-white/60 font-medium">Click Next to find a vibe</div>
            ) : !isLocal && state === 'disconnected' ? (
               <div className="text-danger font-medium">Stranger disconnected</div>
            ) : isLocal && !stream ? (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p>Waiting for Camera...</p>
                <span className="text-xs text-white/40 max-w-[200px]">If denied, you can still use text chat.</span>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Label Badge */}
      <div className="absolute top-4 left-4 z-20">
        <div className="glass px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase text-white/80">
          {isLocal ? 'You' : 'Stranger'}
        </div>
      </div>
    </div>
  );
}
