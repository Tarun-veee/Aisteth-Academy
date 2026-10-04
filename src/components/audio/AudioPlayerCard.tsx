import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface AudioPlayerCardProps {
  id: string;
  audioSrc: string;
  label: string;
  subtitle?: string;
  activePlayingId: string | null;
  onPlayStateChange: (id: string, isPlaying: boolean) => void;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  id,
  audioSrc,
  label,
  subtitle,
  activePlayingId,
  onPlayStateChange,
  selected = false,
  onSelect,
  disabled = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const isCurrentActive = activePlayingId === id;

  // Sync state if another player started playing
  useEffect(() => {
    if (!isCurrentActive && isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  }, [isCurrentActive, isPlaying]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange(id, false);
    } else {
      audioRef.current.play().catch((err) => console.warn('Audio play error:', err));
      setIsPlaying(true);
      onPlayStateChange(id, true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 1;
      setProgress((cur / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
    onPlayStateChange(id, false);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      onPlayStateChange(id, true);
    }
  };

  return (
    <div
      onClick={() => {
        if (!disabled && onSelect) onSelect();
      }}
      className={`relative p-4 rounded-2xl transition-all border-2 select-none ${
        selected
          ? 'bg-brand-50/70 border-brand-600 shadow-soft'
          : 'bg-surface-white border-slate-200 hover:border-slate-300'
      } ${disabled ? 'opacity-90' : 'cursor-pointer active:scale-[0.99]'}`}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="flex items-center justify-between gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm ${
            isPlaying
              ? 'bg-brand-600 text-white'
              : 'bg-brand-50 text-brand-700 border border-brand-200'
          }`}
          aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Info & Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-content-primary truncate">{label}</h4>
            <span className="text-xs font-mono text-content-secondary">
              {duration ? `${Math.round(duration)}s` : 'Demo'}
            </span>
          </div>

          {subtitle && <p className="text-xs text-content-secondary mb-2 truncate">{subtitle}</p>}

          {/* Progress track */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Action Controls: Selection Pill / Restart */}
        <div className="flex items-center gap-1.5 shrink-0">
          {progress > 0 && (
            <button
              type="button"
              onClick={handleRestart}
              className="p-2 rounded-lg text-content-secondary hover:bg-slate-100"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {onSelect && (
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
