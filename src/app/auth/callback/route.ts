import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isUpMail } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {}
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // ตรวจโดเมน @up.ac.th — ไม่ใช่ → ตัด session ทันที
      if (user && !isUpMail(user.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=domain`);
      }
      // ตรวจแบน
      if (user) {
        const { data: m } = await supabase
          .from("member")
          .select("is_banned")
          .eq("member_id", user.id)
          .single();
        if (m?.is_banned) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=banned`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=domain`);
}
