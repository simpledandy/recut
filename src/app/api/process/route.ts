import { NextResponse } from "next/server";

function placeholder(thumbnailText: string, w = 320, h = 180) {
  const t = encodeURIComponent(thumbnailText);
  return `https://via.placeholder.com/${w}x${h}.png?text=${t}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body?.url || "";

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 700));

    // Simple heuristic: return different mock clips if youtube link
    const isYoutube = /youtube\.com|youtu\.be/.test(url);

    function getYouTubeId(u: string) {
      const m = u.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?]|$)/);
      return m ? m[1] : null;
    }

    const baseClips = isYoutube
      ? [
          { id: "c1", title: "Key insight: Definition", start: 30, end: 48 },
          { id: "c2", title: "Example explained", start: 210, end: 235 },
          { id: "c3", title: "Practical tip", start: 420, end: 440 },
        ]
      : [
          { id: "c1", title: "Overview", start: 10, end: 28 },
          { id: "c2", title: "Deep dive", start: 95, end: 122 },
          { id: "c3", title: "Conclusion", start: 240, end: 260 },
        ];

    const ytId = isYoutube ? getYouTubeId(url) : null;
    const clips = baseClips.map((c) => {
      if (ytId) {
        // Use YouTube hosted thumbnail for YouTube sources
        return { ...c, thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` };
      }
      return { ...c, thumbnail: placeholder(c.title) };
    });

    return NextResponse.json({ clips });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "invalid request" }), { status: 400 });
  }
}
