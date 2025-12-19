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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, start, end } = body || {};
    if (!url || typeof start !== "number" || typeof end !== "number") {
      return new NextResponse(JSON.stringify({ error: "invalid payload" }), { status: 400 });
    }

    let inputSource = String(url);
    const out = tmpFileName(".mp4");
    const duration = Math.max(0.1, end - start);

    const isYouTube = /youtube\.com|youtu\.be/.test(inputSource);
    let downloaded: string | null = null;
    if (isYouTube) {
      // ensure yt-dlp is available
      try {
        await new Promise<void>((res, rej) => {
          const p = spawn("yt-dlp", ["--version"]);
          p.on("close", (c) => (c === 0 ? res() : rej(new Error("yt-dlp not available"))));
        });
      } catch (e) {
        return new NextResponse(JSON.stringify({ error: "yt-dlp not installed on server" }), { status: 500 });
      }

      // download and force mp4 output to a known temp filename
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

      const dlCode: number = await new Promise((res) => {
        const dl = spawn("yt-dlp", dlArgs, { stdio: ["ignore", "inherit", "inherit"] });
        dl.on("close", res);
      });
      if (dlCode !== 0) {
        return new NextResponse(JSON.stringify({ error: "yt-dlp download failed" }), { status: 500 });
      }

      // use the downloaded file as ffmpeg input
      inputSource = downloaded;
    }

    // ffmpeg args: seek, input, duration, encode to mp4
    const args = [
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

    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });

    const code: number = await new Promise((res) => ff.on("close", res));
    if (code !== 0) {
      try { await fs.unlink(out); } catch {}
      if (downloaded) await fs.unlink(downloaded).catch(() => {});
      return new NextResponse(JSON.stringify({ error: "ffmpeg failed" }), { status: 500 });
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
    return new NextResponse(JSON.stringify({ error: "server error" }), { status: 500 });
  }
}
