"use client";

import { createClient } from "@/lib/supabase/client";

/** หาหรือสร้างห้องคุย (buyer × item) — กันห้องซ้ำด้วย UNIQUE(item_id, member_id) */
export async function getOrCreateConversation(
  itemId: string,
  sellerId: string,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนทักแชท");

  // ห้ามทักหาของตัวเอง
  if (user.id === sellerId) throw new Error("นี่คือประกาศของคุณเอง");

  // หาห้องเดิมก่อน
  const { data: existing } = await supabase
    .from("conversation")
    .select("conversation_id")
    .eq("item_id", itemId)
    .eq("member_id", user.id)
    .maybeSingle();
  if (existing) return existing.conversation_id;

  const { data, error } = await supabase
    .from("conversation")
    .insert({ item_id: itemId, member_id: user.id })
    .select("conversation_id")
    .single();
  if (error) throw error;
  return data.conversation_id;
}
