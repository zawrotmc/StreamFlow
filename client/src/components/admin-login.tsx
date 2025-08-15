import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/admin/login", { password });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Successfully logged in to admin panel",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Invalid password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      loginMutation.mutate(password);
    }
  };

  const handleBackToStream = () => {
    setLocation("/");
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50" data-testid="admin-login">
      <Card className="w-full max-w-md mx-4 bg-card">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <div className="bg-secondary rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Admin Access</h2>
            <p className="text-muted-foreground">Enter password to access dashboard</p>
          </div>

          <form onSubmit={handleSubmit} data-testid="form-admin-login">
            <div className="mb-6">
              <Label htmlFor="adminPassword" className="block text-sm font-medium text-foreground mb-2">
                Password
              </Label>
              <div className="relative">
                <Input
                  type="password"
                  id="adminPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground pr-10"
                  placeholder="Enter admin password"
                  required
                  data-testid="input-admin-password"
                />
                <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? "Logging in..." : "Access Dashboard"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={handleBackToStream}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200"
              data-testid="button-back-to-stream"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Stream
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
