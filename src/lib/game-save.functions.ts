import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gameSaveSchema = z.object({
  completed: z.array(z.number().int().min(0).max(100)).max(200),
  bestAttempts: z.record(z.string(), z.number().int().min(1).max(9999)),
  prisms: z.number().int().min(0).max(999999999),
  ownedSkins: z.array(z.string().min(1).max(40)).max(100),
  equippedSkinId: z.string().min(1).max(40),
});

export type PersistedGameSave = z.infer<typeof gameSaveSchema>;

const fromRow = (row: any): PersistedGameSave => ({
  completed: row.completed ?? [],
  bestAttempts: row.best_attempts ?? {},
  prisms: row.prisms ?? 0,
  ownedSkins: row.owned_skins ?? ["default"],
  equippedSkinId: row.equipped_skin_id ?? "default",
});

export const getGameSave = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("game_saves")
      .select("completed,best_attempts,prisms,owned_skins,equipped_skin_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
  });

export const saveGameSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => gameSaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: saved, error } = await (supabase as any)
      .from("game_saves")
      .upsert(
        {
          user_id: userId,
          completed: data.completed,
          best_attempts: data.bestAttempts,
          prisms: data.prisms,
          owned_skins: data.ownedSkins,
          equipped_skin_id: data.equippedSkinId,
        },
        { onConflict: "user_id" },
      )
      .select("completed,best_attempts,prisms,owned_skins,equipped_skin_id")
      .single();

    if (error) throw new Error(error.message);
    return fromRow(saved);
  });