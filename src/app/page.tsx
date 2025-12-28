"use client";

import { useState, useRef, useEffect } from "react";
import type { Clip } from "../types";
import { isDirectVideo, getYouTubeId } from "../lib/videoUtils";
import useThumbnails from "../hooks/useThumbnails";
import PreviewPlayer from "../components/PreviewPlayer";
import ClipList from "../components/ClipList";
import { sanitizeFileName } from "../lib/fileUtils";

export default function Home() {
  const [url, setUrl] = useState("");
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localObjectUrl, setLocalObjectUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const ytId = isYouTube ? getYouTubeId(url) : null;
  const youtubeThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

  const previewSrc = url && (isDirectVideo(url) || (url || "").startsWith("blob:")) ? url : undefined;

  useEffect(() => {
    return () => {
      if (localObjectUrl) {
        try { URL.revokeObjectURL(localObjectUrl); } catch (e) {}
      }
    };
  }, [localObjectUrl]);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (localObjectUrl) {
      try { URL.revokeObjectURL(localObjectUrl); } catch (e) {}
    }
    const u = URL.createObjectURL(f);
    setLocalObjectUrl(u);
    setUrl(u);
    setEmbedSrc(null);
  }

  const thumbMap = useThumbnails(clips, previewSrc, isYouTube, ytId);

  const canPlay = (!!previewSrc) || (isYouTube && !!ytId);
  const canExport = !!url;

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
      setEmbedSrc(null);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function playClip(c: Clip) {
    if (isYouTube && ytId) {
      setEmbedSrc(`https://www.youtube.com/embed/${ytId}?start=${Math.floor(c.start)}&end=${Math.floor(c.end)}&autoplay=1&rel=0&controls=1`);
      return;
    }

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
    if (previewSrc) {
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
        try { a.download = sanitizeFileName(c.title || c.id, 'webm'); } catch { a.download = `${c.id}.webm`; }
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(u);
        setExporting(null);
      };

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
      return;
    }

    if (!url) return alert("Provide a source URL to use server export.");
    if (exporting) return;

    setExporting(c.id);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const res = await fetch("/api/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, start: c.start, end: c.end }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const err = await res.json();
          msg = err?.error || err?.detail || JSON.stringify(err);
        } catch (_) {
          try { msg = await res.text(); } catch (_) {}
        }
        alert("Server export failed: " + msg);
        return;
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      try { a.download = sanitizeFileName(c.title || `${c.id}_server`, 'mp4'); } catch { a.download = `${c.id}_server.mp4`; }
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      alert("Server export error: " + (isAbort ? "timed out (180s)" : String(e)));
    } finally {
      clearTimeout(timeout);
      setExporting(null);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 20px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 44, margin: 0 }}>RECUT — Quick lesson clips</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>
        Upload your lesson video or paste a link and RECUT will suggest short clips you can download and share with students.
      </p>

      <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
          <label style={{ display: "block", fontSize: 14, marginBottom: 8, color: "#555" }}>
          Video file or URL
        </label>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a video URL or upload your lesson file"
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontSize: 16,
            }}
          />

          <button type="button" onClick={handleUploadClick} style={smallBtn(true)}>
            Upload
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        <button disabled={loading} style={{ ...btnBase(!loading), marginTop: 12 }} onClick={analyze}>
          {loading ? "Finding clips..." : "Suggest clips"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 18, color: "#b00020" }}>Error: {error}</div>
      )}

      {clips && clips.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <PreviewPlayer embedSrc={embedSrc} setEmbedSrc={setEmbedSrc} isYouTube={isYouTube} youtubeThumbnail={youtubeThumbnail} previewSrc={previewSrc} videoRef={videoRef} />
          <ClipList clips={clips} thumbMap={thumbMap} isYouTube={isYouTube} youtubeThumbnail={youtubeThumbnail} playClip={playClip} exportClip={exportClip} canPlay={canPlay} canExport={canExport} exporting={exporting} />
        </section>
      )}

      <div style={{ height: 4 }} />

      <p style={{ marginTop: 24, color: "#666" }}>
        Tip for educators: Upload or paste your lesson, click "Suggest clips", then review each suggested clip. Click "Play clip" and wait for it to finish playing, then click "Export" to download a trimmed video named with the clip caption.
      </p>
    </main>
  );
}

