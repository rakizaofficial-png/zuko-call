"use client";

import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Gem, Plus, Send, X } from "lucide-react";
import { gifts } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";
import {
  startUserAgoraLiveViewer,
  stopUserAgoraLiveViewer,
} from "@/lib/agora";
import {
  bumpLiveViewers,
  fetchHostOnlyLiveRoom,
  fetchLiveAgoraToken,
  resolveAgoraAppId,
  type HostOnlyLiveRoom,
  type LiveComment,
} from "@/lib/liveApi";
import {
  listenLiveComments,
  listenRoomGiftCoins,
  makeOptimisticComment,
  sendLiveComment,
} from "@/lib/liveChat";
import { getDeviceUserId } from "@/lib/walletApi";
import { getRealtimeClient } from "@/lib/realtime/websocket";

const NAME_COLORS = [
  "text-cyan-300",
  "text-pink-300",
  "text-amber-300",
  "text-lime-300",
  "text-violet-300",
];

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % NAME_COLORS.length;
  return NAME_COLORS[h]!;
}

export default function HostOnlyLiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { following, toggleFollow, coins, pushToast, syncWallet } = useApp();
  const videoRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<HostOnlyLiveRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "ended" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [floating, setFloating] = useState<{ id: string; emoji: string }[]>([]);
  const [streamReady, setStreamReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const userId = useMemo(() => getDeviceUserId(), []);
  const userName = "Luma Fan";

  const remoteImg = Boolean(
    room?.hostAvatar &&
      (room.hostAvatar.includes("pravatar") ||
        room.hostAvatar.includes("dicebear") ||
        !room.hostAvatar.includes("unsplash")),
  );

  const chatEnabled = Boolean(room?.id && (status === "live" || status === "loading"));

  const loadRoom = useCallback(async () => {
    const next = await fetchHostOnlyLiveRoom(id);
    if (!next || !next.isLive) {
      setStatus("ended");
      setRoom(next);
      return null;
    }
    setRoom(next);
    setStatus("live");
    return next;
  }, [id]);

  // Resolve room + join Agora as viewer (video failure must NOT kill chat)
  useEffect(() => {
    let cancelled = false;
    let joinedRoomId: string | null = null;

    const waitForVideoEl = async () => {
      for (let i = 0; i < 40; i++) {
        if (videoRef.current) return videoRef.current;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    };

    (async () => {
      try {
        const next = await loadRoom();
        if (cancelled || !next) return;

        joinedRoomId = next.id;
        void bumpLiveViewers({
          roomId: next.id,
          delta: 1,
          userId,
          userName,
        });

        try {
          const el = await waitForVideoEl();
          if (cancelled) return;
          if (!el) throw new Error("Video mount missing");

          const channel = next.channel || `live_${next.hostId}`;
          const uid = 300000 + Math.floor(Math.random() * 90000);
          const token = await fetchLiveAgoraToken(channel, uid);
          const appId = token.appId || resolveAgoraAppId();
          if (!appId) throw new Error("Agora App ID missing");

          await startUserAgoraLiveViewer({
            appId,
            channel: token.channel || channel,
            token: token.token,
            uid: token.uid || uid,
            remoteVideoEl: el,
            onRemoteVideo: () => {
              if (!cancelled) {
                setStreamReady(true);
                setVideoError(null);
              }
            },
          });
        } catch (ve) {
          if (!cancelled) {
            setVideoError(
              ve instanceof Error ? ve.message : "Video unavailable",
            );
            // Keep status=live so chat/gifts still work
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not join live");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopUserAgoraLiveViewer();
      if (joinedRoomId) {
        void bumpLiveViewers({
          roomId: joinedRoomId,
          delta: -1,
          userId,
          userName,
        });
      }
    };
  }, [id, loadRoom, userId]);

  // Chat + diamonds + end detection — keep listening while room is known
  useEffect(() => {
    if (!room?.id || status === "ended" || status === "error") return;

    const offChat = listenLiveComments(room.id, userId, setComments);
    const offGift = listenRoomGiftCoins(room.id, (giftCoins, viewers) => {
      setRoom((r) =>
        r
          ? {
              ...r,
              giftCoins,
              viewers: viewers ?? r.viewers,
            }
          : r,
      );
    });

    const rt = getRealtimeClient(userId);
    rt.connect();
    const offRt = rt.subscribe((ev) => {
      if (ev.type === "live:ended" && ev.payload.id === room.id) {
        setStatus("ended");
        void stopUserAgoraLiveViewer();
      }
      if (ev.type === "live:viewers" && ev.payload.roomId === room.id) {
        setRoom((r) => (r ? { ...r, viewers: ev.payload.viewers } : r));
      }
      if (ev.type === "live:comment") {
        const p = ev.payload;
        if (!p.comment) return;
        const rid = p.roomId;
        if (
          rid &&
          rid !== room.id &&
          rid !== `live_${room.hostId}` &&
          !String(rid).includes(room.hostId)
        ) {
          return;
        }
        setComments((prev) => {
          if (prev.some((c) => c.id === p.comment.id)) return prev;
          return [
            ...prev,
            {
              id: p.comment.id,
              userId: p.comment.userId,
              userName: p.comment.userName,
              text: p.comment.text,
              createdAt: p.comment.createdAt,
              kind: (p.comment.kind as LiveComment["kind"]) || "comment",
              giftEmoji: p.comment.giftEmoji,
              giftCoins: p.comment.giftCoins,
            },
          ].slice(-80);
        });
      }
      if (ev.type === "gift:received") {
        const p = ev.payload;
        if (p.roomId && p.roomId !== room.id && p.roomId !== `live_${room.hostId}`)
          return;
        if (p.toHostId && p.toHostId !== room.hostId) return;
        setRoom((r) =>
          r ? { ...r, giftCoins: r.giftCoins + Number(p.coins || 0) } : r,
        );
        const emoji = p.giftEmoji || "🎁";
        const fid = `${Date.now()}-${Math.random()}`;
        setFloating((f) => [...f.slice(-8), { id: fid, emoji }]);
        setTimeout(
          () => setFloating((f) => f.filter((x) => x.id !== fid)),
          1400,
        );
      }
    });

    const poll = setInterval(() => {
      void fetchHostOnlyLiveRoom(room.hostId).then((n) => {
        if (!n || !n.isLive) {
          setStatus("ended");
          void stopUserAgoraLiveViewer();
        } else {
          setRoom((r) =>
            r
              ? {
                  ...r,
                  viewers: n.viewers,
                  giftCoins: n.giftCoins,
                  title: n.title,
                }
              : n,
          );
        }
      });
    }, 10000);

    return () => {
      offChat();
      offGift();
      offRt();
      clearInterval(poll);
    };
  }, [room?.id, room?.hostId, status, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const onSendChat = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !room || sendingChat) return;
    setDraft("");
    setSendingChat(true);
    const optimistic = makeOptimisticComment({ userId, userName, text });
    setComments((prev) => [...prev, optimistic]);
    try {
      const saved = await sendLiveComment({
        roomId: room.id,
        hostId: room.hostId,
        userId,
        userName,
        text,
      });
      setComments((prev) => {
        const withoutLocal = prev.filter((c) => c.id !== optimistic.id);
        if (withoutLocal.some((c) => c.id === saved.id)) return withoutLocal;
        return [...withoutLocal, saved];
      });
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      pushToast?.(err instanceof Error ? err.message : "Message failed");
      setDraft(text);
    } finally {
      setSendingChat(false);
    }
  };

  const sendQuickGift = async (giftId: string) => {
    if (!room) return;
    if (userId === room.hostId) {
      pushToast?.("Hosts cannot gift themselves!");
      return;
    }
    const g = gifts.find((x) => x.id === giftId);
    if (!g) return;
    try {
      const { requireApiBase } = await import("@/config/apiConfig");
      const res = await fetch(`${requireApiBase()}/gifts/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          userId,
          userName,
          hostId: room.hostId,
          giftId: g.id,
          roomId: room.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gift failed");
      await syncWallet?.();
      const fid = `${Date.now()}`;
      setFloating((f) => [...f.slice(-8), { id: fid, emoji: g.emoji }]);
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== fid)), 1400);
    } catch (err) {
      pushToast?.(err instanceof Error ? err.message : "Gift failed");
    }
  };

  const avatar =
    room?.hostAvatar ||
    `https://i.pravatar.cc/150?u=${encodeURIComponent(id)}`;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      {/* Agora remote video plane */}
      <div
        ref={videoRef}
        id="agora-live-remote"
        className="absolute inset-0 z-0 bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />

      {/* Cover while connecting / waiting for host video */}
      {!streamReady && (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <Image
            src={avatar}
            alt=""
            fill
            priority
            className="object-cover opacity-70"
            unoptimized={remoteImg || true}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              {status === "ended"
                ? "Live ended"
                : videoError
                  ? "Chat ready · waiting for host camera"
                  : "Connecting to host…"}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-transparent to-black/85" />

      <div className="relative z-10 flex min-h-dvh flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Header — floating glass */}
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/12 py-1 pl-1 pr-2 shadow-lg backdrop-blur-xl">
            <Image
              src={avatar}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-white/30"
              unoptimized
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-white drop-shadow">
                {room?.hostName || "Host"}
              </p>
              <p className="text-[10px] font-semibold text-rose-300">
                {status === "live" ? "● LIVE" : status.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => room && toggleFollow(room.hostId)}
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full ${
                room && following.includes(room.hostId)
                  ? "bg-white/20"
                  : "bg-[#ff2d55]"
              }`}
              aria-label="Follow"
            >
              <Plus className="h-4 w-4 text-white" strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/12 px-2 py-1 shadow-lg backdrop-blur-xl">
              <span className="flex -space-x-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-5 w-5 rounded-full border border-white/30 bg-white/20"
                    style={{
                      backgroundImage: `url(https://i.pravatar.cc/40?u=v${i}${id})`,
                      backgroundSize: "cover",
                    }}
                  />
                ))}
              </span>
              <span className="pl-1 text-xs font-bold tabular-nums text-white">
                {room?.viewers?.toLocaleString() || "0"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push("/live")}
              className="rounded-full border border-white/20 bg-white/12 p-2 shadow-lg backdrop-blur-xl"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none mt-3 flex justify-start">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/15 px-2.5 py-1 backdrop-blur-xl">
            <Gem className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold tabular-nums text-amber-100">
              {(room?.giftCoins || 0).toLocaleString()} diamonds
            </span>
          </div>
        </div>

        <div className="mt-auto">
          {/* Chat overlay — bottom left */}
          <div className="pointer-events-none mb-3 max-h-[36vh] w-[min(78%,300px)] space-y-1.5 overflow-y-auto pr-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {comments.length === 0 && (
              <p className="text-xs text-white/55 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                Say hi — chat floats here
              </p>
            )}
            {comments.map((m) =>
              m.kind === "gift" ? (
                <div
                  key={m.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-violet-300/30 bg-[#7b2cff]/55 px-2.5 py-1 text-xs text-white shadow-lg backdrop-blur-md"
                >
                  <span>{m.giftEmoji || "🎁"}</span>
                  <span className="font-bold">{m.userName}</span>
                  <span className="opacity-90">{m.text}</span>
                </div>
              ) : m.kind === "join" ? (
                <p
                  key={m.id}
                  className="text-xs text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                >
                  <span className={`font-bold ${nameColor(m.userName)}`}>
                    {m.userName}
                  </span>{" "}
                  joined
                </p>
              ) : (
                <p
                  key={m.id}
                  className="text-[13px] leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span className={`font-bold ${nameColor(m.userName)}`}>
                    {m.userName}
                  </span>{" "}
                  {m.text}
                </p>
              ),
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer + floating circular actions */}
          <div className="pointer-events-auto flex items-end gap-2">
            <form
              onSubmit={onSendChat}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Say something…"
                maxLength={200}
                enterKeyHint="send"
                autoComplete="off"
                disabled={sendingChat || !chatEnabled}
                className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/12 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/45 shadow-lg backdrop-blur-xl disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sendingChat || !draft.trim() || !chatEnabled}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur-xl disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGiftOpen(true)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-500 text-lg shadow-[0_8px_28px_rgba(244,63,94,0.45)]"
                aria-label="Gifts"
              >
                🎁
              </button>
              <div className="-mx-1 flex max-w-[3.25rem] flex-col gap-1.5 overflow-hidden">
                {gifts.slice(0, 3).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => void sendQuickGift(g.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-base backdrop-blur-xl"
                    title={`${g.name} · ${g.coins}`}
                  >
                    {g.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {floating.map((f) => (
          <motion.span
            key={f.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -120, scale: 1.4 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute bottom-40 right-6 z-20 text-3xl"
          >
            {f.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      {status === "ended" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
          <div>
            <p className="font-display text-2xl font-bold text-white">
              Live ended
            </p>
            <p className="mt-2 text-sm text-white/70">
              {error || "This host is no longer streaming."}
            </p>
            <Link
              href="/live"
              className="mt-5 inline-flex rounded-full bg-[#ff2d55] px-5 py-2.5 text-sm font-bold text-white"
            >
              Back to Live
            </Link>
          </div>
        </div>
      )}

      {status === "error" && !room && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
          <div>
            <p className="font-display text-2xl font-bold text-white">
              Can&apos;t join
            </p>
            <p className="mt-2 text-sm text-white/70">
              {error || "Live room unavailable."}
            </p>
            <Link
              href="/live"
              className="mt-5 inline-flex rounded-full bg-[#ff2d55] px-5 py-2.5 text-sm font-bold text-white"
            >
              Back to Live
            </Link>
          </div>
        </div>
      )}

      {room && (
        <GiftSheet
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          hostId={room.hostId}
          roomId={room.id}
          onSent={(emoji) => {
            const fid = `${Date.now()}`;
            setFloating((f) => [...f.slice(-8), { id: fid, emoji }]);
            setTimeout(
              () => setFloating((f) => f.filter((x) => x.id !== fid)),
              1400,
            );
          }}
        />
      )}
    </main>
  );
}
