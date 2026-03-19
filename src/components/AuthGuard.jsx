import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

/**
 * Simple auth gate: if not logged in, redirect to login with return URL.
 * Use this for pages that just require *any* authenticated user (role checks done separately by RoleGuard).
 */
export default function AuthGuard({ children }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(isAuth => {
      if (!isAuth) {
        base44.auth.redirectToLogin(window.location.href);
      } else {
        setChecked(true);
      }
    });
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return children;
}