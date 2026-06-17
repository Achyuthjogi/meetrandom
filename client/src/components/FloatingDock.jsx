import { motion } from 'framer-motion';
import { Camera, Mic, MicOff, VideoOff, SkipForward, Square, Flag, Settings, SwitchCamera } from 'lucide-react';
import { cn } from '../lib/utils';

export function FloatingDock({ 
  onNext, 
  onStop, 
  onReport, 
  camEnabled, 
  micEnabled, 
  toggleCam, 
  toggleMic,
  switchCamera,
  state 
}) {
  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 glass rounded-full shadow-2xl border border-white/10"
    >
      <DockButton 
        icon={camEnabled ? Camera : VideoOff} 
        onClick={toggleCam} 
        active={camEnabled}
        color="accent"
      />
      {camEnabled && (
        <DockButton 
          icon={SwitchCamera} 
          onClick={switchCamera} 
          color="muted"
        />
      )}
      <DockButton 
        icon={micEnabled ? Mic : MicOff} 
        onClick={toggleMic} 
        active={micEnabled}
        color="accent"
      />
      
      <div className="w-px h-8 bg-white/10 mx-2" />

      {state === 'connected' || state === 'searching' ? (
        <DockButton 
          icon={Square} 
          onClick={onStop} 
          label="Stop"
          color="danger"
          solid
        />
      ) : null}

      <DockButton 
        icon={SkipForward} 
        onClick={onNext} 
        label={state === 'connected' ? 'Skip' : 'Next'}
        color="success"
        solid
      />

      <div className="w-px h-8 bg-white/10 mx-2" />

      <DockButton 
        icon={Flag} 
        onClick={onReport} 
        disabled={state !== 'connected'}
        color="danger"
      />
      <DockButton 
        icon={Settings} 
        onClick={() => {}} 
        color="muted"
      />
    </motion.div>
  );
}

function DockButton({ icon: Icon, onClick, active = false, disabled = false, label, color, solid = false }) {
  const colorClasses = {
    accent: solid ? "bg-accent hover:bg-accent/80 text-white" : "hover:bg-accent/20 text-white/70 hover:text-accent",
    success: solid ? "bg-success hover:bg-success/80 text-background" : "hover:bg-success/20 text-white/70 hover:text-success",
    danger: solid ? "bg-red-500 hover:bg-red-600 text-white" : "hover:bg-red-500/20 text-white/70 hover:text-red-500",
    muted: solid ? "bg-surface hover:bg-surface/80 text-white" : "hover:bg-white/10 text-white/50 hover:text-white"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-colors duration-200",
        !active && !solid && "text-white/40",
        disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:y-0",
        colorClasses[color]
      )}
    >
      <Icon className="w-5 h-5" />
      {label && <span className="text-sm font-bold pr-1">{label}</span>}
    </motion.button>
  );
}
