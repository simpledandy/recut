"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip } from "../types";

export default function useThumbnails(
  clips: Clip[] | null,
  previewSrc: string | undefined,
  isYouTube: boolean,
  ytId: string | null
) {
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const thumbUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    // revoke any previously created blob urls
    if (thumbUrlsRef.current.length) {
      for (const u of thumbUrlsRef.current) {
        try {
          URL.revokeObjectURL(u);
        } catch (e) {}
      }
      thumbUrlsRef.current = [];
    }

    if (!clips || !previewSrc) {
      setThumbMap({});
      return;
    }

    if (isYouTube && ytId) {
      setThumbMap({});
      return;
    }

    let cancelled = false;
    const results: Record<string, string> = {};

    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.muted = true;
    v.src = previewSrc as string;
    v.style.position = "fixed";
    v.style.left = "-9999px";
    v.style.width = "1px";
    v.style.height = "1px";
    document.body.appendChild(v);

    const captureCanvas = document.createElement("canvas");

    const run = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            v.removeEventListener("error", onErr);
            resolve();
          };
          const onErr = () => {
            v.removeEventListener("loadedmetadata", onLoaded);
            reject(new Error("video load error"));
          };
          v.addEventListener("loadedmetadata", onLoaded);
          v.addEventListener("error", onErr);
        });

        for (const c of clips) {
          if (cancelled) break;
          const seekTime = Math.min(c.start, Math.max(0, v.duration - 0.05));
          await new Promise<void>((res) => {
            const onSeeked = () => {
              v.removeEventListener("seeked", onSeeked);
              res();
            };
            v.addEventListener("seeked", onSeeked);
            try {
              v.currentTime = seekTime;
            } catch (e) {
              res();
            }
          });

          try {
            const cw = v.videoWidth || 320;
            const ch = v.videoHeight || 180;
            captureCanvas.width = cw;
            captureCanvas.height = ch;
            const ctx = captureCanvas.getContext("2d");
            if (!ctx) continue;
            ctx.drawImage(v, 0, 0, cw, ch);
            const blob = await new Promise<Blob | null>((resolve) =>
              captureCanvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
            );
            if (!blob) continue;
            const obj = URL.createObjectURL(blob);
            thumbUrlsRef.current.push(obj);
            results[c.id] = obj;
            setThumbMap({ ...results });
          } catch (e) {
            // ignore individual failures
          }
        }
      } catch (e) {
        // overall failure: ignore
      }
    };

    run().finally(() => {
      try {
        v.remove();
      } catch (e) {}
    });

    return () => {
      cancelled = true;
      try {
        v.remove();
      } catch (e) {}
      if (thumbUrlsRef.current.length) {
        for (const u of thumbUrlsRef.current) {
          try {
            URL.revokeObjectURL(u);
          } catch (e) {}
        }
        thumbUrlsRef.current = [];
      }
      setThumbMap({});
    };
  }, [clips, previewSrc, isYouTube, ytId]);

  return thumbMap;
}
