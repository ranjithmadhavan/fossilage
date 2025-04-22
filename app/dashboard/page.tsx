"use client";
import { useAuth } from "../AuthContext";
import S3Dashboard from "../S3Dashboard";

export default function DashboardPage() {
  const { loggedIn, checkAuth } = useAuth();
  
  // We don't need to manually redirect here anymore
  // The AuthContext will handle redirections based on auth state
  
  // Show a loading state while checking authentication
  if (!loggedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <S3Dashboard />;
}
