import { motion } from 'framer-motion';
import { Camera, Mic, MicOff, VideoOff, SkipForward, Square, Flag, Settings, SwitchCamera, Heart, Gamepad2, MonitorPlay, ScreenShare, ScreenShareOff } from 'lucide-react';
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
  state,
  // New props
  onSettings,
  onReactions,
  onGames,
  onPiP,
  onScreenShare,
  isScreenSharing,
  isPiP,
}) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end items-center pb-8 overflow-hidden">
      <motion.div 
        drag
        dragMomentum={false}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto flex items-center gap-1.5 p-2 glass rounded-full shadow-2xl border border-white/10 flex-wrap justify-center max-w-[95vw] cursor-grab active:cursor-grabbing"
      >
        {/* Media Controls */}
        <DockButton 
          icon={camEnabled ? Camera : VideoOff} 
          onClick={toggleCam} 
          active={camEnabled}
          color="accent"
          tooltip="Camera"
        />
        {camEnabled && (
          <DockButton 
            icon={SwitchCamera} 
            onClick={switchCamera} 
            color="muted"
            tooltip="Flip"
          />
        )}
        <DockButton 
          icon={micEnabled ? Mic : MicOff} 
          onClick={toggleMic} 
          active={micEnabled}
          color="accent"
          tooltip="Mic"
        />
        
        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Screen Share */}
        <DockButton 
          icon={isScreenSharing ? ScreenShareOff : ScreenShare} 
          onClick={onScreenShare} 
          active={isScreenSharing}
          color={isScreenSharing ? "success" : "muted"}
          tooltip={isScreenSharing ? "Stop Share" : "Share Screen"}
          disabled={state !== 'connected'}
        />

        {/* PiP */}
        <DockButton 
          icon={MonitorPlay} 
          onClick={onPiP} 
          active={isPiP}
          color={isPiP ? "accent" : "muted"}
          tooltip="PiP"
          disabled={state !== 'connected'}
        />

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Social */}
        <DockButton 
          icon={Heart} 
          onClick={onReactions} 
          color="muted"
          tooltip="React"
          disabled={state !== 'connected'}
        />
        <DockButton 
          icon={Gamepad2} 
          onClick={onGames} 
          color="muted"
          tooltip="Games"
          disabled={state !== 'connected'}
        />

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Navigation */}
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

        <div className="w-px h-8 bg-white/10 mx-1" />

        <DockButton 
          icon={Flag} 
          onClick={onReport} 
          disabled={state !== 'connected'}
          color="danger"
          tooltip="Report"
        />
      </motion.div>
    </div>
  );
}

function DockButton({ icon: Icon, onClick, active = false, disabled = false, label, color, solid = false, tooltip }) {
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
      title={tooltip}
      className={cn(
        "relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-full transition-colors duration-200",
        !active && !solid && "text-white/40",
        disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:y-0",
        colorClasses[color]
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
      {label && <span className="text-sm font-bold pr-1">{label}</span>}
    </motion.button>
  );
}
