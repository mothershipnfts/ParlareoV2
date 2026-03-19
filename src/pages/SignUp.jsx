import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Loader2 } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role") || "student";
  const redirect = searchParams.get("redirect") || (roleParam === "teacher" ? createPageUrl("TeacherSignup") : createPageUrl("PlacementTest"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: roleParam,
            teacher_status: roleParam === "teacher" ? "pending_review" : null,
          },
        },
      });
      if (err) throw err;
      if (data?.user) {
        window.location.href = redirect.startsWith("http") ? redirect : window.location.origin + redirect;
      }
    } catch (err) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e1f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-[#f97066] flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Parlareo</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Sign up as {roleParam === "teacher" ? "Teacher" : "Student"}
          </h1>
          <p className="text-white/50 text-sm mb-6">Create your account</p>
          <form onSubmit={handleSignUp} className="space-y-4">
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder-white/30 h-12"
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder-white/30 h-12"
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder-white/30 h-12"
              minLength={6}
              required
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-[#f97066] hover:bg-[#e8605a] h-12 rounded-xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign up"}
            </Button>
          </form>
          <p className="text-center text-white/50 text-sm mt-6">
            Already have an account?{" "}
            <button onClick={() => navigate(createPageUrl("Login"))} className="text-[#f97066] hover:underline">
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
