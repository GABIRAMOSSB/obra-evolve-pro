import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Notification = {
  id: string;
  company_id: string;
  user_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid(), limit: z.number().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("company_id", data.companyId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw error;
    return (rows ?? []) as Notification[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("company_id", data.companyId)
      .is("read_at", null)
      .or(`user_id.is.null,user_id.eq.${userId}`);
    if (error) throw error;
    return { ok: true };
  });

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        companyId: z.string().uuid(),
        userId: z.string().uuid().nullable().optional(),
        kind: z.string().min(1).max(64),
        title: z.string().min(1).max(200),
        body: z.string().max(2000).optional().nullable(),
        link: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("notifications")
      .insert({
        company_id: data.companyId,
        user_id: data.userId ?? null,
        kind: data.kind,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row as Notification;
  });
