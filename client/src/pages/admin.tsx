import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLogin from "@/components/admin-login";
import AdminDashboard from "@/components/admin-dashboard";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status
  const { data: authStatus, error } = useQuery({
    queryKey: ["/api/admin/auth"],
    retry: false
  });

  useEffect(() => {
    setIsLoading(false);
    if (authStatus) {
      setIsAuthenticated(true);
    } else if (error) {
      setIsAuthenticated(false);
    }
  }, [authStatus, error]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-admin">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="admin-page">
      {isAuthenticated ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : (
        <AdminLogin onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
