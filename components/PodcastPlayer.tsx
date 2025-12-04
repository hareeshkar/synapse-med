import React, { useState, useEffect, useRef } from "react";
import { PodcastScriptLine } from "../types";
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  Mic2,
  Volume2,
  Loader2,
} from "lucide-react";

interface PodcastPlayerProps {
  script: PodcastScriptLine[];
  audioBase64?: string;
}

const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
  script,
  audioBase64,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioBase64) {
      // Decode Base64 audio to Blob
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/wav" }); // Gemini TTS returns linear PCM encoded in WAV
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBase64]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  if (!script || script.length === 0) return null;

  return (
    <div className="bg-charcoal border-t border-glass-border p-4 flex flex-col gap-4 shadow-2xl z-40 relative">
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        className="hidden"
      />

      {/* Visualizer Header */}
      <div className="flex items-center justify-between text-xs text-clinical-slate uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Mic2
            size={14}
            className={`text-clinical-rose ${isPlaying ? "animate-pulse" : ""}`}
          />
          <span>
            Neural Audio (Gemini 2.5 Flash) •{" "}
            {isPlaying ? "Speaking" : "Paused"}
          </span>
        </div>
        <span>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 items-center">
        {/* Host Avatars */}
        <div className="flex -space-x-3 shrink-0">
          <div
            className={`w-12 h-12 rounded-full border-2 border-clinical-cyan bg-slate-800 flex items-center justify-center overflow-hidden`}
          >
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Professor&backgroundColor=b6e3f4`}
              alt="Prof"
            />
          </div>
          <div
            className={`w-12 h-12 rounded-full border-2 border-clinical-amber bg-slate-800 flex items-center justify-center overflow-hidden`}
          >
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Student&backgroundColor=ffdfbf`}
              alt="Stu"
            />
          </div>
        </div>

        {/* Transcript Bubble (Static for now, synced scrolling would require timestamps from API) */}
        <div className="flex-1 bg-obsidian/50 p-3 rounded-lg border border-glass-border relative overflow-hidden h-24 overflow-y-auto custom-scrollbar">
          {script.map((line, i) => (
            <div key={i} className="mb-2 text-sm">
              <span
                className={`font-bold text-xs ${
                  line.speaker === "Professor"
                    ? "text-clinical-cyan"
                    : "text-clinical-amber"
                }`}
              >
                {line.speaker}:{" "}
              </span>
              <span className="text-gray-200">{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        <button
          className="text-gray-200 hover:text-white"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime -= 10;
          }}
        >
          <Rewind size={20} />
        </button>

        {audioBase64 ? (
          <button
            onClick={togglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isPlaying
                ? "bg-clinical-rose text-white shadow-clinical-rose/20"
                : "bg-clinical-cyan text-black shadow-clinical-cyan/20 hover:scale-105"
            }`}
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-1" />
            )}
          </button>
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-500" size={20} />
          </div>
        )}

        <button
          className="text-gray-200 hover:text-white"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime += 10;
          }}
        >
          <FastForward size={20} />
        </button>
      </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export default PodcastPlayer;
