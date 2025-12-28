"use client";

import React from "react";
import type { Clip } from "../types";

type Props = {
  embedSrc: string | null;
  setEmbedSrc: (s: string | null) => void;
  isYouTube: boolean;
  youtubeThumbnail: string | null;
  previewSrc?: string | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

export default function PreviewPlayer({ embedSrc, isYouTube, youtubeThumbnail, previewSrc, videoRef }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14, color: "#444", marginBottom: 6 }}>Preview player</div>
      {embedSrc ? (
        <div style={{ position: "relative" }}>
          <iframe src={embedSrc} title="youtube-embed" style={{ width: "100%", height: 360, borderRadius: 10, border: 0 }} allow="autoplay; encrypted-media; picture-in-picture" />
        </div>
      ) : isYouTube && youtubeThumbnail ? (
        <div style={{ position: "relative" }}>
          <img src={youtubeThumbnail} alt="YouTube preview" style={{ width: "100%", borderRadius: 10, objectFit: "cover" }} />
        </div>
      ) : previewSrc ? (
        <video
          ref={videoRef}
          src={previewSrc}
          crossOrigin="anonymous"
          controls
          style={{ width: "100%", borderRadius: 10, background: "#000" }}
        />
      ) : null}
    </div>
  );
}
