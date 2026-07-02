import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient, useServerFn } from "@tanstack/react-query";
import { useServerFn as useSFn } from "@tanstack/react-start";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCompany } from "@/hooks/use-company";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications.functions";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationBell() {
  const { company } = useCompany();
  const companyId = company?.id;
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useSFn(listNotifications);
  const markOne = useSFn(markNotificationRead);
  const markAll = useSFn(markAllNotificationsRead);

  const { data } = useQuery({
    queryKey: ["notifications", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = (data ?? []) as Notification[];
  const unread = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  const mReadOne = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", companyId] }),
  });

  const mReadAll = useMutation({
    mutationFn: () => markAll({ data: { companyId: companyId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", companyId] }),
  });

  if (!companyId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.06]"
          aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
          title="Notificações"
        >
          <Bell className="w-3.5 h-3.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#C83E4D] text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notificações</div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => mReadAll.mutate()}
              disabled={mReadAll.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sem notificações
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const content = (
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C8A66A] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight truncate">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  </div>
                );
                const onClick = () => {
                  if (!n.read_at) mReadOne.mutate(n.id);
                  if (n.link) setOpen(false);
                };
                return (
                  <li key={n.id} className="hover:bg-muted/40">
                    {n.link ? (
                      <Link to={n.link} onClick={onClick} className="block px-3 py-2.5">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={onClick} className="w-full text-left px-3 py-2.5">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
