import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  LogOut, 
  Radio, 
  Copy, 
  RefreshCw, 
  BarChart3, 
  Pause, 
  Eye, 
  List,
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";

interface AdminDashboardProps {
  onLogout: () => void;
}

interface StreamConfig {
  stream: {
    id: string;
    streamKey: string;
    title: string;
    isLive: boolean;
    viewerCount: number;
    startedAt: string | null;
  };
  rtmpUrl: string;
  logs: Array<{
    id: string;
    level: string;
    message: string;
    timestamp: string;
    ipAddress?: string;
  }>;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();
  const [connectionLogs, setConnectionLogs] = useState<any[]>([]);

  const { data: streamConfig, isLoading } = useQuery<StreamConfig>({
    queryKey: ["/api/admin/stream"],
    refetchInterval: 10000
  });

  useEffect(() => {
    if (streamConfig) {
      setConnectionLogs(streamConfig.logs);
    }
  }, [streamConfig]);

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === "connection_log") {
        setConnectionLogs(prev => [lastMessage.data, ...prev.slice(0, 19)]);
      } else if (lastMessage.type === "stream_status") {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stream"] });
      }
    }
  }, [lastMessage, queryClient]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/logout", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Successfully logged out",
      });
      onLogout();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/stream/regenerate-key", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stream key regenerated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stream"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate stream key",
        variant: "destructive",
      });
    },
  });

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/stream/stop", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stream stopped successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stream"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to stop stream",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const formatUptime = (startedAt: string | null) => {
    if (!startedAt) return "Not streaming";
    
    const start = new Date(startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-dashboard">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!streamConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-dashboard">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Error Loading Dashboard</h2>
              <p className="text-muted-foreground mb-4">Failed to load stream configuration</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Stream Dashboard</h1>
          <p className="text-muted-foreground">Manage your streaming configuration</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="destructive"
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stream Configuration */}
        <Card className="bg-card" data-testid="card-stream-config">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Radio className="w-5 h-5 mr-2 text-primary" />
              Stream Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stream Key */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">Stream Key</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={streamConfig.stream.streamKey}
                  className="flex-1 font-mono text-sm bg-input"
                  readOnly
                  data-testid="input-stream-key"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(streamConfig.stream.streamKey, "Stream key")}
                  data-testid="button-copy-key"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => regenerateKeyMutation.mutate()}
                  disabled={regenerateKeyMutation.isPending}
                  data-testid="button-regenerate-key"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerateKeyMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* RTMP URL */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">RTMP URL</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={streamConfig.rtmpUrl}
                  className="flex-1 font-mono text-sm bg-input"
                  readOnly
                  data-testid="input-rtmp-url"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(streamConfig.rtmpUrl, "RTMP URL")}
                  data-testid="button-copy-rtmp"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* OBS Setup Instructions */}
            <Card className="bg-secondary">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-2">OBS Setup</h3>
                <ol className="text-sm text-muted-foreground space-y-1">
                  <li>1. Open OBS Studio</li>
                  <li>2. Go to Settings → Stream</li>
                  <li>3. Set Service to "Custom"</li>
                  <li>4. Copy RTMP URL above to Server field</li>
                  <li>5. Copy Stream Key above to Stream Key field</li>
                </ol>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Stream Status */}
        <Card className="bg-card" data-testid="card-stream-status">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <BarChart3 className="w-5 h-5 mr-2 text-green-500" />
              Stream Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Status Grid */}
            <div>
              <Card className="bg-secondary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Status</span>
                    <div className="flex items-center" data-testid="status-indicator">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        streamConfig.stream.isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                      <span className={`font-semibold ${
                        streamConfig.stream.isLive ? 'text-green-500' : 'text-gray-400'
                      }`}>
                        {streamConfig.stream.isLive ? 'Live' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
            </div>

            {/* Stream Metrics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="text-foreground" data-testid="text-uptime">
                  {formatUptime(streamConfig.stream.startedAt)}
                </span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex space-x-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => stopStreamMutation.mutate()}
                disabled={!streamConfig.stream.isLive || stopStreamMutation.isPending}
                data-testid="button-stop-stream"
              >
                <Pause className="w-4 h-4 mr-2" />
                {stopStreamMutation.isPending ? "Stopping..." : "Stop Stream"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open("/", "_blank")}
                data-testid="button-view-stream"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Stream
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Log */}
      <Card className="mt-6 bg-card" data-testid="card-connection-log">
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <List className="w-5 h-5 mr-2 text-purple-400" />
            Connection Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
            {connectionLogs.length > 0 ? (
              connectionLogs.map((log) => (
                <div key={log.id} className="flex items-center space-x-2 mb-1" data-testid={`log-entry-${log.id}`}>
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className={`font-semibold ${
                    log.level === 'INFO' ? 'text-green-500' :
                    log.level === 'WARN' ? 'text-yellow-500' :
                    log.level === 'ERROR' ? 'text-red-500' :
                    'text-blue-400'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-foreground">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No connection logs available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
