import { NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import { promises as fs } from "fs";

function tmpFileName(ext = ".mp4") {
  const name = randomBytes(6).toString("hex") + ext;
  return join(tmpdir(), name);
}

function runCommand(cmd: string, args: string[], opts: any = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((res) => {
    const p = spawn(cmd, args, opts);
    let out = "";
    let err = "";
    p.stdout?.on("data", (d) => (out += d.toString()));
    p.stderr?.on("data", (d) => (err += d.toString()));
    p.on("close", (c) => res({ code: c ?? 1, stdout: out, stderr: err }));
    p.on("error", (e) => res({ code: 1, stdout: out, stderr: String(e) }));
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, start, end } = body || {};
    console.log("/api/trim POST", { url, start, end });
    if (!url || typeof start !== "number" || typeof end !== "number") {
      return new NextResponse(JSON.stringify({ error: "invalid payload" }), { status: 400 });
    }

    let inputSource = String(url);
    const out = tmpFileName(".mp4");
    const duration = Math.max(0.1, end - start);

    const isYouTube = /youtube\.com|youtu\.be/.test(inputSource);

    // Fast path: for YouTube try to get a direct media URL and run ffmpeg copy
    // Use yt-dlp JSON output to obtain any required HTTP headers and pass them to ffmpeg
    if (isYouTube) {
      try {
        const v = await runCommand("yt-dlp", ["--version"]);
        if (v.code === 0) {
          const info = await runCommand("yt-dlp", ["-f", "best[ext=mp4]/best", "-J", inputSource]);
          let meta: any = {};
          try {
            meta = JSON.parse(info.stdout || "{}");
          } catch (e) {
            meta = {};
          }

          // prefer requested_formats (yt-dlp newer output) then formats[] then top-level url
          let direct: string | null = null;
          let headersObj: Record<string, string> | null = null;
          if (meta.requested_formats && meta.requested_formats.length) {
            direct = meta.requested_formats[0].url || null;
            headersObj = meta.requested_formats[0].http_headers || meta.http_headers || null;
          } else if (meta.formats && meta.formats.length) {
            const f = meta.formats.find((x: any) => x.ext === 'mp4') || meta.formats[meta.formats.length - 1];
            direct = f?.url || null;
            headersObj = f?.http_headers || meta.http_headers || null;
          } else if (meta.url) {
            direct = meta.url;
            headersObj = meta.http_headers || null;
          }

          if (direct) {
            const args: string[] = ["-y", "-ss", String(start)];
            // if headers are provided by yt-dlp include them for ffmpeg to avoid 403
            if (headersObj && Object.keys(headersObj).length) {
              const headerLines = Object.entries(headersObj)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n');
              args.push("-headers", headerLines);
            }
            args.push("-i", String(direct), "-t", String(duration), "-c", "copy", "-movflags", "frag_keyframe+empty_moov", out);

            const ff = await runCommand("ffmpeg", args, { stdio: "pipe" });
            if (ff.code === 0) {
              const data = await fs.readFile(out);
              await fs.unlink(out).catch(() => {});
              return new NextResponse(data, {
                status: 200,
                headers: {
                  "Content-Type": "video/mp4",
                  "Content-Length": String(data.length),
                  "Content-Disposition": `attachment; filename="clip.mp4"`,
                },
              });
            }
            console.error("fast ffmpeg failed:", ff.stderr?.substring?.(0, 400) || ff.stderr);
            // fall through to download fallback
          }
        }
      } catch (e) {
        console.error("fast path error", e);
      }
    }

    // Fallback: for YouTube try a targeted yt-dlp section download (faster than full download)
    // If that fails, fall back to full download then ffmpeg processing
    let downloaded: string | null = null;
    if (isYouTube) {
      // download and force mp4 output to a known temp filename
      try {
        const check = await runCommand("yt-dlp", ["--version"]);
        if (check.code !== 0) throw new Error("yt-dlp not available");
      } catch (e) {
        console.error("yt-dlp availability check failed:", e);
        return new NextResponse(JSON.stringify({ error: "yt-dlp not installed on server" }), { status: 500 });
      }
      // try downloading only the requested section (fast for many hosts)
      downloaded = tmpFileName(".mp4");
      const sectionArg = `*${Math.floor(start)}-${Math.floor(end)}`;
      const dlSectionArgs = [
        "--download-sections",
        sectionArg,
        "-f",
        "best[ext=mp4]/best",
        "-o",
        downloaded,
        inputSource,
      ];

      const dlSection = await runCommand("yt-dlp", dlSectionArgs);
      if (dlSection.code === 0) {
        console.log("yt-dlp section download succeeded", { section: sectionArg });
        // returned file is the clipped section
        const data = await fs.readFile(downloaded);
        await fs.unlink(downloaded).catch(() => {});
        return new NextResponse(data, {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(data.length),
            "Content-Disposition": `attachment; filename="clip.mp4"`,
          },
        });
      }

      console.warn("yt-dlp section download failed, falling back to full download", dlSection.stderr?.substring?.(0,400) || dlSection.stderr);

      // full download fallback
      downloaded = tmpFileName(".mp4");
      const dlArgs = [
        "-f",
        "best[ext=mp4]/best",
        "--recode-video",
        "mp4",
        "-o",
        downloaded,
        inputSource,
      ];

      const dl = await runCommand("yt-dlp", dlArgs);
      if (dl.code !== 0) {
        console.error("yt-dlp download failed:", dl.stderr.substring(0, 400));
        return new NextResponse(JSON.stringify({ error: "yt-dlp download failed", detail: dl.stderr?.substring?.(0,400) }), { status: 500 });
      }

      inputSource = downloaded;
    }

    // Use ffmpeg to extract: prefer copy for speed, but fall back to encode if needed
    const args = [
      "-y",
      "-ss",
      String(start),
      "-i",
      String(inputSource),
      "-t",
      String(duration),
      "-c",
      "copy",
      "-movflags",
      "frag_keyframe+empty_moov",
      out,
    ];

    let ff = await runCommand("ffmpeg", args);
    if (ff.code !== 0) {
      // try encoded fallback if copy failed
      console.error("ffmpeg copy failed, trying encode: ", ff.stderr?.substring?.(0, 400) || ff.stderr);
      const encArgs = [
        "-y",
        "-ss",
        String(start),
        "-i",
        String(inputSource),
        "-t",
        String(duration),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "veryfast",
        "-movflags",
        "frag_keyframe+empty_moov",
        out,
      ];
      ff = await runCommand("ffmpeg", encArgs);
      if (ff.code !== 0) {
        console.error("ffmpeg encode failed:", ff.stderr?.substring?.(0, 400) || ff.stderr);
        try { await fs.unlink(out); } catch {};
        if (downloaded) await fs.unlink(downloaded).catch(() => {});
        return new NextResponse(JSON.stringify({ error: "ffmpeg failed", detail: (ff.stderr || '').substring(0, 400) }), { status: 500 });
      }
    }

    const data = await fs.readFile(out);
    await fs.unlink(out).catch(() => {});
    if (downloaded) await fs.unlink(downloaded).catch(() => {});

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="clip.mp4"`,
      },
    });
  } catch (err) {
    console.error("trim route error:", err);
    return new NextResponse(JSON.stringify({ error: "server error" }), { status: 500 });
  }
}

// Simple GET health-check to confirm the route is deployed
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/trim", note: "POST only for trimming; GET is a health-check" });
}
