import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  src: string;
  title?: string;
}

export default function VideoPlayer({ src, title = "Live Stream" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const flvPlayerRef = useRef<any>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log("🎥 Loading video stream:", src);

    // Cleanup existing player
    if (flvPlayerRef.current) {
      flvPlayerRef.current.pause();
      flvPlayerRef.current.unload();
      flvPlayerRef.current.detachMediaElement();
      flvPlayerRef.current.destroy();
      flvPlayerRef.current = null;
    }

    // Determine stream type and setup player accordingly
    if (src.includes('.m3u8')) {
      // HLS stream
      console.log("📡 Setting up HLS stream");
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.load();
      } else {
        console.log("⚠️ HLS not supported natively");
        // Could load hls.js here if needed
      }
    } else {
      // Assume FLV stream - use dynamic import
      console.log("📡 Setting up FLV stream with flv.js");
      
      // Dynamic import for flv.js to avoid build issues
      import('flv.js').then((flvjs) => {
        if (flvjs.default.isSupported()) {
          const flvPlayer = flvjs.default.createPlayer({
            type: 'flv',
            url: src,
            isLive: true,
          }, {
            enableWorker: false,
            enableStashBuffer: false,
            stashInitialSize: 128,
            lazyLoad: false,
            lazyLoadMaxDuration: 3 * 60,
          });

          flvPlayer.attachMediaElement(video);
          flvPlayer.load();
          
          flvPlayer.on('error', (error: any) => {
            console.error('🚨 FLV Player error:', error);
          });

          flvPlayer.on('loadeddata', () => {
            console.log('✅ FLV stream loaded successfully');
            video.play().catch((e) => {
              console.error('Auto-play failed:', e);
            });
          });

          flvPlayerRef.current = flvPlayer;
        } else {
          console.error('⚠️ FLV.js is not supported in this browser');
          // Fallback to native video element
          video.src = src;
          video.load();
        }
      }).catch((error) => {
        console.error('Failed to load flv.js:', error);
        // Fallback to native video element
        video.src = src;
        video.load();
      });
    }

    const handleLoadStart = () => {
      console.log("📼 Video load started");
    };

    const handleCanPlay = () => {
      console.log("▶️ Video can play");
      if (!src.includes('.m3u8')) return; // FLV player handles play automatically
      video.play().catch(console.error);
    };

    const handleError = (e: Event) => {
      console.error("🚨 Video error:", e);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      
      // Cleanup FLV player
      if (flvPlayerRef.current) {
        flvPlayerRef.current.pause();
        flvPlayerRef.current.unload();
        flvPlayerRef.current.detachMediaElement();
        flvPlayerRef.current.destroy();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      controls
      autoPlay
      muted
      playsInline
      data-testid="video-element"
      aria-label={title}
    >
      {/* Video source is managed by JavaScript above */}
      Your browser does not support the video tag.
    </video>
  );
}
