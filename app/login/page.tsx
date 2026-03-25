"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function LoginPage() {
  const { resolvedTheme, setTheme } = useTheme();

  async function loginWithTwitch() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "user:read:email",
      },
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="absolute top-4 right-4 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Collab Planner</h1>
          <p className="text-muted-foreground text-sm">
            Schedule stream collabs with your Twitch friends
          </p>
        </div>

        <button
          onClick={loginWithTwitch}
          className="w-full flex items-center justify-center gap-3 bg-[#9146FF] hover:bg-[#7d2ff7] active:bg-[#6b21e8] active:scale-95 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-100 shadow-lg hover:shadow-[#9146FF]/40 hover:shadow-xl cursor-pointer select-none"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-current"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          Login with Twitch
        </button>

        <p className="text-center text-xs text-muted-foreground">
          collab.deutschmark.online
        </p>
      </div>
    </div>
  );
}
