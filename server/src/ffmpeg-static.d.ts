// ffmpeg-static ships no TypeScript types; the default export is the absolute
// path to the bundled ffmpeg binary (or null on unsupported platforms).
declare module 'ffmpeg-static' {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
