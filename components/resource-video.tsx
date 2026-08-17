export function ResourceVideo({ src }: { src: string }) {
  return (
    <video
      aria-label="Resource video"
      className="w-full max-w-3xl"
      controls
      playsInline
      preload="metadata"
      src={src}
    >
      Your browser cannot play this video.
    </video>
  );
}
