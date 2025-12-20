"use client";

import { useState, useRef, useEffect } from "react";

type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  thumbnail: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const sampleVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  function isDirectVideo(u: string) {
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u);
  }

  function getYouTubeId(u: string) {
    const m = u.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?]|$)/);
    return m ? m[1] : null;
  }

  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const ytId = isYouTube ? getYouTubeId(url) : null;
  const youtubeThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

  const previewSrc = url && isDirectVideo(url) ? url : sampleVideo;

  const canPlay = !isYouTube && !!previewSrc;
  const canServerExport = !!url;
  const canExport = canPlay && (typeof HTMLVideoElement !== "undefined") && typeof (HTMLVideoElement.prototype as any).captureStream !== "undefined";

  const btnBase = (enabled = true) => ({
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: enabled ? "white" : "#f5f5f5",
    color: enabled ? "#111" : "#888",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.7,
  });

  const smallBtn = (enabled = true) => ({
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: enabled ? "white" : "#f5f5f5",
    color: enabled ? "#111" : "#888",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.7,
    marginRight: 8,
  });

  async function analyze() {
    setError(null);
    setClips(null);
    setLoading(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setClips(data.clips || []);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function playClip(c: Clip) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = Math.max(0, c.start);
    } catch (e) {}
    const onTime = () => {
      if (v.currentTime >= c.end - 0.12) {
        v.pause();
        v.removeEventListener("timeupdate", onTime);
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.play().catch(() => {});
  }

  async function exportClip(c: Clip) {
    const v = videoRef.current;
    if (!v) return alert("No preview player available");
    if (exporting) return;
    if (!('captureStream' in v)) return alert('Recording not supported in this browser');

    setExporting(c.id);
    const stream = (v as any).captureStream();
    let mime = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    recorder.onerror = () => {
      setExporting(null);
      alert('Recording failed (CORS or unsupported).');
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `${c.id}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      setExporting(null);
    };

    // start recording just before playback
    try {
      v.currentTime = Math.max(0, c.start);
    } catch (e) {}
    recorder.start();
    const onTime = () => {
      if (v.currentTime >= c.end - 0.12) {
        v.pause();
        v.removeEventListener('timeupdate', onTime);
        try { recorder.stop(); } catch (e) { setExporting(null); }
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.play().catch((e) => {
      recorder.stop();
      setExporting(null);
      alert('Playback failed: ' + String(e));
    });
  }

  async function serverExportClip(c: Clip) {
    if (!url) return alert("Provide a source URL (direct video URL recommended) to use server export.");
    try {
      const res = await fetch("/api/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, start: c.start, end: c.end }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return alert("Server export failed: " + (err?.error || res.statusText));
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `${c.id}_server.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch (e: any) {
      alert("Server export error: " + String(e));
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 20px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 44, margin: 0 }}>RECUT</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>
        Paste a YouTube link or any video URL. RECUT will suggest a few high-density clips (mocked demo).
      </p>

      <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 8, color: "#555" }}>
          Video URL
        </label>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://.../sample.mp4"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />

        <button disabled={loading} style={{ ...btnBase(!loading), marginTop: 12 }} onClick={analyze}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 18, color: "#b00020" }}>Error: {error}</div>
      )}

      {clips && clips.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: "#444", marginBottom: 6 }}>Preview player</div>
            {isYouTube && youtubeThumbnail ? (
              <div style={{ position: "relative" }}>
                <img src={youtubeThumbnail} alt="YouTube preview" style={{ width: "100%", borderRadius: 10, objectFit: "cover" }} />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={previewSrc}
                crossOrigin="anonymous"
                controls
                style={{ width: "100%", borderRadius: 10, background: "#000" }}
              />
            )}
          </div>
          <h2 style={{ fontSize: 20, margin: "6px 0 12px" }}>Suggested Clips</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {clips.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                <img src={c.thumbnail} alt={c.title} width={240} height={135} style={{ borderRadius: 8, objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <div style={{ color: "#666", marginTop: 6 }}>
                    {formatTime(c.start)} — {formatTime(c.end)} ({c.end - c.start}s)
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {canServerExport ? (
                      <a href={url} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>Open source</a>
                    ) : (
                      <span style={{ marginRight: 12, color: "#999" }}>Open source</span>
                    )}

                    <button onClick={() => playClip(c)} disabled={!canPlay} style={smallBtn(canPlay)}>
                      Play clip
                    </button>

                    <button onClick={() => exportClip(c)} disabled={!canExport || !!exporting} style={smallBtn(!(!canExport || !!exporting))}>
                      {exporting === c.id ? "Exporting…" : "Export"}
                    </button>

                    <button onClick={() => serverExportClip(c)} disabled={!canServerExport} style={smallBtn(!!canServerExport)}>
                      Server Export
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 4 }} />

      <p style={{ marginTop: 24, color: "#666" }}>
        Tip: This demo uses a mocked backend that returns timestamped clips. For a production demo we can integrate transcription and FFmpeg trimming.
      </p>

      <a href="https://ruxsoraxon.uz" style={{ display: "inline-block", marginTop: 18 }}>
        ← Back to personal site
      </a>
    </main>
  );
}

function formatTime(s: number) {
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}
