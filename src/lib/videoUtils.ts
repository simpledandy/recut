export function isDirectVideo(u: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u);
}

export function getYouTubeId(u: string) {
  const m = u.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?]|$)/);
  return m ? m[1] : null;
}
