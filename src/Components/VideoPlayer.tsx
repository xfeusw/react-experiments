import { useEffect, useMemo, useRef, useState } from "react";

type PlayerState = {
  playing: boolean;
  current: number;
  duration: number;
  muted: boolean;
  volume: number; // 0..1
};

type PlayerCommands = {
  togglePlay: () => void;
  seekTo: (t: number) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  fullscreen: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function App() {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 16
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>Video Player (components)</h2>
      <VideoPlayer src="video.mp4"/>
    </div>
  );
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [state, setState] = useState<PlayerState>({
    playing: false,
    current: 0,
    duration: 0,
    muted: false,
    volume: 1,
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoadedMetadata = () =>
      setState((s) => ({ ...s, duration: v.duration || 0 }));
    const onTimeUpdate = () =>
      setState((s) => ({ ...s, current: v.currentTime || 0 }));
    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onVolume = () =>
      setState((s) => ({ ...s, volume: v.volume, muted: v.muted }));

    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);

    // init snapshot
    onLoadedMetadata();
    onTimeUpdate();
    onVolume();
    setState((s) => ({ ...s, playing: !v.paused }));

    return () => {
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
    };
  }, []);

  const commands: PlayerCommands = useMemo(
    () => ({
      togglePlay: async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
          if (v.paused) await v.play();
          else v.pause();
        } catch (e) {
          console.error("play() failed:", e);
        }
      },
      seekTo: (t: number) => {
        const v = videoRef.current;
        if (!v) return;
        const next = clamp(t, 0, Number.isFinite(v.duration) ? v.duration : 0);
        v.currentTime = next;
      },
      toggleMute: () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
      },
      setVolume: (vol: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = clamp(vol, 0, 1);
        if (v.volume > 0) v.muted = false;
      },
      fullscreen: async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await v.requestFullscreen();
        } catch (e) {
          console.error("fullscreen failed:", e);
        }
      },
    }),
    [],
  );

  return (
    <VideoSurface>
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", display: "block" }}
        preload="metadata"
      />
      <ControlsOverlay state={state} commands={commands} />
    </VideoSurface>
  );
}

function VideoSurface({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  // You can later extend this with "active" (mouse move timeout), mobile touch, etc.

  return (
    <div
      style={{
        position: "relative",
        background: "black",
        borderRadius: 12,
        overflow: "hidden",
        userSelect: "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}

      {/* This is just a hint overlay layer hook; controls themselves also fade */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: hover ? 1 : 0,
          transition: "opacity 150ms ease",
        }}
      />
    </div>
  );
}

function ControlsOverlay({
  state,
  commands,
}: {
  state: PlayerState;
  commands: PlayerCommands;
}) {
  // Basic hover behavior inside overlay itself
  const [hover, setHover] = useState(false);

  const effectiveVolume = state.muted ? 0 : state.volume;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        opacity: hover ? 1 : 0,
        transition: "opacity 150ms ease",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.70), transparent 60%)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <TimeSlider
        current={state.current}
        duration={state.duration}
        onSeek={commands.seekTo}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          color: "white",
        }}
      >
        <IconButton
          title={state.playing ? "Pause" : "Play"}
          onClick={commands.togglePlay}
        >
          {state.playing ? "❚❚" : "▶"}
        </IconButton>

        <IconButton title={state.muted ? "Unmute" : "Mute"} onClick={commands.toggleMute}>
          {state.muted ? "🔇" : "🔊"}
        </IconButton>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.9 }}>Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVolume}
            onChange={(e) => commands.setVolume(Number(e.target.value))}
          />
        </label>

        <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.9 }}>
          {formatTime(state.current)} / {formatTime(state.duration)}
        </span>

        <div style={{ marginLeft: "auto" }} />

        <IconButton title="Fullscreen" onClick={commands.fullscreen}>
          ⛶
        </IconButton>
      </div>
    </div>
  );
}

function TimeSlider({
  current,
  duration,
  onSeek,
}: {
  current: number;
  duration: number;
  onSeek: (t: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={duration || 0}
      step={0.1}
      value={Math.min(current, duration || 0)}
      onChange={(e) => onSeek(Number(e.target.value))}
      aria-label="Seek"
      style={{
        width: "100%",
      }}
    />
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36,
        height: 32,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(0,0,0,0.25)",
        color: "white",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default App;
