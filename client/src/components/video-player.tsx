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

    if (flvPlayerRef.current) {
      flvPlayerRef.current.pause();
      flvPlayerRef.current.unload();
      flvPlayerRef.current.detachMediaElement();
      flvPlayerRef.current.destroy();
      flvPlayerRef.current = null;
    }

    if (src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.load();
      }
    } else {
      
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
          });
          flvPlayer.on('loadeddata', () => {
            video.play().catch((e) => {
            });
          });
          flvPlayerRef.current = flvPlayer;
        } else {
          video.src = src;
          video.load();
        }
      }).catch((error) => {
        video.src = src;
        video.load();
      });
    }

    const handleLoadStart = () => {
    };

    const handleCanPlay = () => {
      if (!src.includes('.m3u8')) return;
      video.play().catch(console.error);
    };

    const handleError = (e: Event) => {
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      
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
      playsInline
      data-testid="video-element"
      aria-label={title}
    >
      Your browser does not support the video tag.
    </video>
  );
}