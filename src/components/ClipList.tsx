"use client";

import React from "react";
import type { Clip } from "../types";
import { formatTime } from "../lib/formatTime";

type Props = {
  clips: Clip[];
  thumbMap: Record<string, string>;
  isYouTube: boolean;
  youtubeThumbnail: string | null;
  playClip: (c: Clip) => void;
  exportClip: (c: Clip) => void;
  canPlay: boolean;
  canExport: boolean;
  exporting: string | null;
};

export default function ClipList({ clips, thumbMap, isYouTube, youtubeThumbnail, playClip, exportClip, canPlay, canExport, exporting }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: "6px 0 12px" }}>Suggested Clips</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {clips.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <img
              src={thumbMap[c.id] || (isYouTube && youtubeThumbnail ? youtubeThumbnail : c.thumbnail)}
              alt={c.title}
              width={240}
              height={135}
              style={{ borderRadius: 8, objectFit: "cover" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{c.title}</div>
              <div style={{ color: "#666", marginTop: 6 }}>
                {formatTime(c.start)} {formatTime(c.end)} ({c.end - c.start}s)
              </div>
              <div style={{ marginTop: 10 }}>
                {canPlay ? (
                  <button onClick={() => playClip(c)} disabled={!canPlay} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: canPlay ? "white" : "#f5f5f5", color: canPlay ? "#111" : "#888", cursor: canPlay ? "pointer" : "default", opacity: canPlay ? 1 : 0.7, marginRight: 8 }}>
                    Play clip
                  </button>
                ) : (
                  <button disabled style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#f5f5f5", color: "#888", cursor: "default", opacity: 0.7, marginRight: 8 }}>Play clip</button>
                )}

                <button onClick={() => exportClip(c)} disabled={!canExport || !!exporting} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: !(!canExport || !!exporting) ? "white" : "#f5f5f5", color: !(!canExport || !!exporting) ? "#111" : "#888", cursor: !(!canExport || !!exporting) ? "pointer" : "default", opacity: !(!canExport || !!exporting) ? 1 : 0.7 }}>
                  {exporting === c.id ? "Exporting" : "Export"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
