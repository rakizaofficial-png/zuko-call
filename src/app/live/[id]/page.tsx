"use client";

import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Gem, Gift as GiftIcon, MoreHorizontal, Plus, Send, X } from "lucide-react";
import { gifts, type Gift } from "@/lib/data";
import { useApp } from "@/lib/store";
import { GiftSheet } from "@/components/GiftSheet";
import { PremiumLiveLockOverlay } from "@/components/live/PremiumLiveLockOverlay";
import { LiveChatBubble } from "@/components/live/LiveChatBubble";
import { HostAvatarImg } from "@/components/host/HostAvatarImg";
import { TopUpSheet } from "@/components/TopUpSheet";
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
import {
  giftMeetsUnlock,
  hasUnlockedLive,
  markLiveUnlocked,
  pickUnlockGift,
} from "@/lib/liveLock";
import { playGiftChime, playUnlockChime } from "@/lib/liveGiftSound";
import { getDeviceUserId } from "@/lib/walletApi";
import { getRealtimeClient } from "@/lib/realtime/websocket";
import { requireApiBase } from "@/config/apiConfig";

export default function HostOnlyLiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceLock =
    searchParams.get("locked") === "1" ||
    searchParams.get("premium") === "1";
  const {
    following,
    toggleFollow,
    coins,
    pushToast,
    syncWallet,
    displayName,
    avatarUrl,
    userId: storeUserId,
  } = useApp();
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
  const [unlocked, setUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [giftTimer, setGiftTimer] = useState(5 * 60 + 40);

  const userId = storeUserId || getDeviceUserId();
  const userName = displayName || "Fan";

  const unlockCoins = room?.unlockCoins || 199;
  const unlockGift =
    (room?.unlockGiftId && gifts.find((g) => g.id === room.unlockGiftId)) ||
    pickUnlockGift(unlockCoins);
  const needsUnlock = Boolean(room?.locked) && !unlocked;
  const chatEnabled = Boolean(
    room?.id && (status === "live" || status === "loading") && !needsUnlock,
  );

  const applyUnlock = useCallback(
    (gift?: Gift) => {
      if (!room) return;
      if (gift && !giftMeetsUnlock(gift.coins, unlockCoins)) {
        pushToast?.(
          `Send a gift of ${unlockCoins}+ coins to unlock this Premium live`,
        );
        return;
      }
      markLiveUnlocked(room.id, userId);
      setUnlocked(true);
      playUnlockChime();
      pushToast?.("Premium live unlocked");
    },
    [room, unlockCoins, userId, pushToast],
  );

  const loadRoom = useCallback(async () => {
    const next = await fetchHostOnlyLiveRoom(id);
    if (!next || !next.isLive) {
      setStatus("ended");
      setRoom(next);
      return null;
    }
    const titlePremium = /premium|locked/i.test(next.title || "");
    const locked = next.locked || forceLock || titlePremium;
    const roomNext = {
      ...next,
      locked,
      unlockCoins: next.unlockCoins || 199,
      mode: locked ? next.mode || "premium" : next.mode,
    };
    setRoom(roomNext);
    setStatus("live");
    setUnlocked(hasUnlockedLive(roomNext.id, userId) || !locked);
    return roomNext;
  }, [id, userId, forceLock]);

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
  }, [id, loadRoom, userId, userName]);

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

    const rt = getRealtimeClient(userId, {
      displayName: userName,
      avatarUrl,
    });
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
  }, [room?.id, room?.hostId, status, userId, userName, avatarUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Lightweight gift-box countdown (visual only — matches modern live apps)
  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => {
      setGiftTimer((s) => (s > 0 ? s - 1 : 5 * 60 + 40));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

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

  const sendUnlockGift = async () => {
    if (!room || unlockBusy) return;
    if (userId === room.hostId) {
      pushToast?.("Hosts cannot gift themselves!");
      return;
    }
    if (coins < unlockGift.coins) {
      pushToast?.("Not enough coins — recharge to unlock");
      setGiftOpen(true);
      return;
    }
    setUnlockBusy(true);
    try {
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
          giftId: unlockGift.id,
          roomId: room.id,
          purpose: "live_unlock",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unlock gift failed");
      await syncWallet?.();
      playGiftChime(unlockGift.coins);
      applyUnlock(unlockGift);
      const fid = `${Date.now()}`;
      setFloating((f) => [...f.slice(-8), { id: fid, emoji: unlockGift.emoji }]);
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== fid)), 1400);
    } catch (err) {
      // Fallback: open gift sheet so user can pick any qualifying gift
      pushToast?.(
        err instanceof Error
          ? `${err.message} — pick an unlock gift`
          : "Pick an unlock gift",
      );
      setGiftOpen(true);
    } finally {
      setUnlockBusy(false);
    }
  };

  const sendQuickGift = async (giftId: string) => {
    if (!room) return;
    if (needsUnlock) {
      setGiftOpen(true);
      return;
    }
    if (userId === room.hostId) {
      pushToast?.("Hosts cannot gift themselves!");
      return;
    }
    const g = gifts.find((x) => x.id === giftId);
    if (!g) return;
    try {
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
      playGiftChime(g.coins);
      if (room.locked && giftMeetsUnlock(g.coins, unlockCoins)) {
        applyUnlock(g);
      }
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
        className={`absolute inset-0 z-0 bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
          needsUnlock ? "scale-110 blur-2xl brightness-50" : ""
        }`}
      />

      {/* Cover while connecting — lightweight, no long blocking load */}
      {!streamReady && status === "live" && !needsUnlock && (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <HostAvatarImg
            src={avatar}
            hostId={room?.hostId || id}
            name={room?.hostName}
            alt=""
            fill
            className="opacity-55"
          />
          <div className="absolute inset-x-0 bottom-28 flex justify-center">
            <p className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/90">
              {videoError ? "Chat ready · waiting for camera" : "Connecting…"}
            </p>
          </div>
        </div>
      )}

      {needsUnlock ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <HostAvatarImg
            src={avatar}
            hostId={room?.hostId || id}
            name={room?.hostName}
            alt=""
            fill
            className="scale-110 opacity-55 blur-xl"
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/50 via-transparent to-black/80" />

      <div className="relative z-10 flex min-h-dvh flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Header */}
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-black/35 py-1 pl-1 pr-2 shadow-lg backdrop-blur-md">
            <HostAvatarImg
              src={avatar}
              hostId={room?.hostId || id}
              name={room?.hostName}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-2 ring-amber-300/70"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-white">
                {room?.hostName || "Host"}
              </p>
              <p className="text-[10px] font-semibold text-rose-300">
                {needsUnlock
                  ? "🔒 PREMIUM"
                  : status === "live"
                    ? "● LIVE"
                    : status.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => room && toggleFollow(room.hostId)}
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full ${
                room && following.includes(room.hostId)
                  ? "bg-white/20"
                  : "bg-[#3b82f6]"
              }`}
              aria-label="Follow"
            >
              <Plus className="h-4 w-4 text-white" strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-2 py-1 shadow-lg backdrop-blur-md">
              <span className="text-xs font-bold tabular-nums text-white">
                👁 {room?.viewers?.toLocaleString() || "0"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push("/live")}
              className="rounded-full border border-white/20 bg-black/35 p-2 shadow-lg backdrop-blur-md"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none mt-2 flex justify-start">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/15 px-2.5 py-1 backdrop-blur-md">
            <Gem className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold tabular-nums text-amber-100">
              {(room?.giftCoins || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right action rail — modern live apps */}
        <div className="pointer-events-auto absolute right-3 top-[22%] z-20 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setTopUpOpen(true)}
            className="w-[58px] overflow-hidden rounded-xl bg-gradient-to-b from-rose-500 to-red-700 px-1 py-1.5 text-center shadow-lg"
          >
            <p className="text-[8px] font-extrabold leading-tight text-amber-200">
              DRAGON
            </p>
            <p className="text-[9px] font-bold text-white">COINS</p>
          </button>
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="relative flex flex-col items-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-md ring-1 ring-white/25">
              🎁
            </span>
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              3
            </span>
            <span className="mt-1 text-[9px] font-bold tabular-nums text-white/90">
              {formatTimer(giftTimer)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-500 text-white shadow-[0_8px_24px_rgba(244,63,94,0.45)]"
            aria-label="Send gift"
          >
            <GiftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md"
            aria-label="More"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-auto">
          {/* Modern chat — username + level badge pills */}
          <div className="pointer-events-none mb-3 max-h-[38vh] w-[min(72%,280px)] space-y-1.5 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {comments.length === 0 && (
              <div className="inline-flex rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] text-white/75 backdrop-blur-md">
                Say hi — chat appears here
              </div>
            )}
            {comments.map((m) => (
              <div key={m.id} className="block">
                <LiveChatBubble m={m} />
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <div className="pointer-events-auto flex items-end gap-2 pr-[4.5rem]">
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
                className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/35 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/45 shadow-lg backdrop-blur-md disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sendingChat || !draft.trim() || !chatEnabled}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {needsUnlock && room && status === "live" ? (
          <PremiumLiveLockOverlay
            hostName={room.hostName}
            unlockGift={unlockGift}
            unlockCoins={unlockCoins}
            busy={unlockBusy}
            onUnlock={() => void sendUnlockGift()}
          />
        ) : null}
      </AnimatePresence>

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
          highlightMinCoins={needsUnlock ? unlockCoins : undefined}
          onSent={(emoji, gift) => {
            const fid = `${Date.now()}`;
            setFloating((f) => [...f.slice(-8), { id: fid, emoji }]);
            setTimeout(
              () => setFloating((f) => f.filter((x) => x.id !== fid)),
              1400,
            );
            if (gift) playGiftChime(gift.coins);
            if (room.locked && gift && giftMeetsUnlock(gift.coins, unlockCoins)) {
              applyUnlock(gift);
            }
          }}
        />
      )}

      <TopUpSheet open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </main>
  );
}
