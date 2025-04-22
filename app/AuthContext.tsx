"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication status
  const checkAuth = (): boolean => {
    const authCookie = getCookie("auth");
    return !!authCookie;
  };

  // Initialize auth state and set up listener for changes
  useEffect(() => {
    const isAuthenticated = checkAuth();
    setLoggedIn(isAuthenticated);
    setInitialized(true);

    // Add event listener to check auth on focus (when user returns to tab)
    const handleFocus = () => {
      const currentAuthState = checkAuth();
      if (loggedIn !== currentAuthState) {
        setLoggedIn(currentAuthState);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (!initialized) return;

    if (loggedIn && pathname === "/") {
      router.push("/dashboard");
    } else if (!loggedIn && pathname === "/dashboard") {
      router.push("/");
    }
  }, [loggedIn, pathname, initialized, router]);

  const logout = () => {
    document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setLoggedIn(false);
    router.push("/");
  };

  // Only render children once we've checked for the auth cookie
  if (!initialized) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
