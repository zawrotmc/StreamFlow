import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Settings, Eye, VideoOff } from "lucide-react";
import VideoPlayer from "@/components/video-player";
import { useWebSocket } from "@/hooks/use-websocket";

interface StreamStatus {
  isLive: boolean;
  viewerCount: number;
  title: string;
  streamUrl: string | null;
}

export default function StreamPage() {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    viewerCount: 0,
    title: "Live Stream",
    streamUrl: null
  });

  const { lastMessage } = useWebSocket();

  const { data: initialStatus } = useQuery({
    queryKey: ["/api/stream/status"],
    refetchInterval: 5000
  });

  useEffect(() => {
    if (initialStatus) {
      setStreamStatus(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    if (lastMessage && lastMessage.type === "stream_status") {
      setStreamStatus(prev => ({
        ...prev,
        isLive: lastMessage.data.isLive,
        viewerCount: lastMessage.data.viewerCount
      }));
    }
  }, [lastMessage]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" data-testid="stream-page">

      <div className="absolute inset-0">
        {streamStatus.isLive && streamStatus.streamUrl ? (
          <VideoPlayer 
            src={streamStatus.streamUrl} 
            title={streamStatus.title}
            data-testid="video-player"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-900" data-testid="no-stream-placeholder">
            <div className="text-center">
              <VideoOff className="mx-auto text-6xl text-gray-400 mb-4 w-16 h-16" />
              <h2 className="text-2xl font-semibold text-gray-300 mb-2">No Stream Active</h2>
              <p className="text-gray-400">Start streaming from OBS to begin</p>
            </div>
          </div>
        )}
      </div>


      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-50">
        <div className="flex items-center space-x-3">

          <div className="flex items-center bg-black bg-opacity-60 backdrop-blur-sm rounded-full px-4 py-2" data-testid="live-status">
            <div 
              className={`w-3 h-3 rounded-full mr-2 ${
                streamStatus.isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm font-medium text-white">
              {streamStatus.isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          
        </div>
      </div>


      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50">
        <Link href="/admin">
          <button 
            className="bg-black bg-opacity-60 backdrop-blur-sm hover:bg-opacity-80 transition-all duration-200 rounded-full p-3"
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5 md:w-6 md:h-6 text-gray-300 hover:text-white" />
          </button>
        </Link>
      </div>
    </div>
  );
}