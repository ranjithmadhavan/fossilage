"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import Login from "./Login";

export default function Home() {
  const { loggedIn, setLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (loggedIn) {
      router.push("/dashboard");
    }
  }, [loggedIn, router]);

  // Handle successful login
  const handleLogin = () => {
    setLoggedIn(true);
    router.push("/dashboard");
  };

  // If already logged in, don't render anything while redirecting
  if (loggedIn) {
    return null;
  }

  return <Login onLogin={handleLogin} />;
}

