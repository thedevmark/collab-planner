"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Collab Planner</h1>
          <p className="text-zinc-400 text-sm">
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

        <p className="text-center text-xs text-zinc-600">
          collab.deutschmark.online
        </p>
      </div>
    </div>
  );
}
