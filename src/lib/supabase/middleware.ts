import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ถ้ายังไม่ตั้ง env (dev เปล่า) ให้ผ่านเลย — หน้าจะใช้ mock data
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPrefixes = ["/sell", "/chat"];
  const needsAuth = protectedPrefixes.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // บล็อกบัญชีโดนแบนตั้งแต่ middleware (กันคนแบนยังค้าง session)
  if (user) {
    const { data: member } = await supabase
      .from("member")
      .select("is_banned")
      .eq("member_id", user.id)
      .single();
    if (member?.is_banned) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "banned");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
