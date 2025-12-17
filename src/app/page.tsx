"use client";

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 20px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 44, margin: 0 }}>RECUT</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>
        Paste a YouTube link. RECUT will suggest 3–5 high-density clips (MVP demo).
      </p>

      <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 8, color: "#555" }}>
          YouTube URL
        </label>

        <input
          placeholder="https://www.youtube.com/watch?v=..."
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />

        <button
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
          onClick={() => alert("Day 2: wire this to /api/analyze")}
        >
          Analyze
        </button>
      </div>

      <p style={{ marginTop: 24, color: "#666" }}>
        Tip: For UzCombinator demo, this page just needs to show workflow — transcript → chunks → ranked clips.
      </p>

      <a href="https://ruxsoraxon.uz" style={{ display: "inline-block", marginTop: 18 }}>
        ← Back to personal site
      </a>
    </main>
  );
}
