'use client';

/**
 * =============================================================================
 * AGORA WEB RTC (User App)
 * =============================================================================
 * SETUP:
 * 1. https://console.agora.io → Create project → copy App ID
 * 2. Enable Primary Certificate → put certificate on CoinCall SERVER only
 *    (AGORA_APP_CERTIFICATE). Never ship certificate in Next.js.
 * 3. NEXT_PUBLIC_AGORA_APP_ID in Luma `.env.local`
 * 4. Join ONLY with tokens from POST/GET `/api/calls/:id/token`
 * =============================================================================
 */

type LiveSession = {
  client: import('agora-rtc-sdk-ng').IAgoraRTCClient;
  mic: import('agora-rtc-sdk-ng').IMicrophoneAudioTrack | null;
  cam: import('agora-rtc-sdk-ng').ICameraVideoTrack | null;
  remoteAudio: import('agora-rtc-sdk-ng').IRemoteAudioTrack[];
  speakerOn: boolean;
  audioOnly: boolean;
  joinOpts?: {
    appId: string;
    channel: string;
    token: string;
    uid: number;
    localVideoEl: HTMLElement;
    remoteVideoEl: HTMLElement;
    audioOnly?: boolean;
  };
};

let session: LiveSession | null = null;
let reconnecting = false;

function prep(el: HTMLElement) {
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.minHeight = '120px';
  el.style.background = '#000';
  el.style.overflow = 'hidden';
  el.replaceChildren();
}

export async function startUserAgoraCall(options: {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  localVideoEl: HTMLElement;
  remoteVideoEl: HTMLElement;
  audioOnly?: boolean;
}) {
  await stopUserAgoraCall();
  prep(options.localVideoEl);
  prep(options.remoteVideoEl);

  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  AgoraRTC.setLogLevel(4);
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  const remoteAudio: import('agora-rtc-sdk-ng').IRemoteAudioTrack[] = [];
  const audioOnly = Boolean(options.audioOnly);
  let speakerOn = true;

  const playRemote = async (
    user: import('agora-rtc-sdk-ng').IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video',
  ) => {
    if (audioOnly && mediaType === 'video') return;
    await client.subscribe(user, mediaType);
    if (mediaType === 'video' && user.videoTrack) {
      user.videoTrack.play(options.remoteVideoEl, { fit: 'cover' });
    }
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play();
      remoteAudio.push(user.audioTrack);
      user.audioTrack.setVolume(speakerOn ? 100 : 30);
    }
  };

  client.on('user-published', playRemote);
  client.on('connection-state-change', (cur, prev, reason) => {
    if (
      cur === 'DISCONNECTED' &&
      prev === 'CONNECTED' &&
      !reconnecting &&
      session?.joinOpts
    ) {
      void attemptAgoraReconnect();
      console.warn('[agora] disconnected', reason);
    }
  });

  await client.join(
    options.appId,
    options.channel,
    options.token,
    options.uid,
  );

  for (const user of client.remoteUsers) {
    if (user.hasVideo && !audioOnly) await playRemote(user, 'video');
    if (user.hasAudio) await playRemote(user, 'audio');
  }

  const mic = await AgoraRTC.createMicrophoneAudioTrack();
  let cam: import('agora-rtc-sdk-ng').ICameraVideoTrack | null = null;
  if (!audioOnly) {
    try {
      cam = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "480p_1",
        facingMode: "user",
      });
    } catch {
      // Retry once — common Android WebView race on first permission grant
      await new Promise((r) => setTimeout(r, 350));
      cam = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "480p_1",
        facingMode: "user",
      });
    }
    cam.play(options.localVideoEl, { fit: "cover" });
    await client.publish([mic, cam]);
  } else {
    await client.publish([mic]);
    options.localVideoEl.replaceChildren();
    options.localVideoEl.insertAdjacentHTML(
      'beforeend',
      '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#fff;font:600 12px/1.2 system-ui">Audio call</div>',
    );
  }

  session = {
    client,
    mic,
    cam,
    remoteAudio,
    get speakerOn() {
      return speakerOn;
    },
    set speakerOn(v: boolean) {
      speakerOn = v;
    },
    audioOnly,
    joinOpts: options,
  };
  return session;
}

async function attemptAgoraReconnect() {
  if (!session?.joinOpts || reconnecting) return;
  reconnecting = true;
  const opts = { ...session.joinOpts };
  try {
    // Refresh token before rejoin — stale tokens cause black screen / freeze
    const callIdMatch = opts.channel?.match(/call[_-]?(.+)/i);
    try {
      const { requireApiBase } = await import("@/config/apiConfig");
      const { getDeviceUserId } = await import("@/lib/walletApi");
      const qs = new URLSearchParams({
        role: "user",
        channel: opts.channel,
        uid: String(opts.uid),
      });
      // Prefer call-id token endpoint when channel embeds call id
      let tokenUrl = `${requireApiBase()}/agora/token?${qs}`;
      if (callIdMatch?.[1]) {
        tokenUrl = `${requireApiBase()}/calls/${encodeURIComponent(callIdMatch[1])}/token?role=user`;
      }
      const res = await fetch(tokenUrl, {
        headers: { "X-User-Id": getDeviceUserId() },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          token?: string;
          agoraToken?: string;
          uid?: number;
        };
        const fresh = data.token || data.agoraToken;
        if (fresh) opts.token = fresh;
        if (typeof data.uid === "number") opts.uid = data.uid;
      }
    } catch {
      /* keep previous token */
    }
    await startUserAgoraCall(opts);
  } catch (err) {
    console.warn("[agora] reconnect failed", err);
  } finally {
    reconnecting = false;
  }
}

/** Recover frozen/black local camera without leaving the channel. */
export async function recoverUserCamera() {
  if (!session?.client || session.audioOnly) return;
  try {
    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
    if (session.cam) {
      try {
        await session.client.unpublish([session.cam]);
      } catch {
        /* ignore */
      }
      try {
        session.cam.stop();
        session.cam.close();
      } catch {
        /* ignore */
      }
    }
    const cam = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: "480p_1",
      facingMode: "user",
    });
    if (session.joinOpts?.localVideoEl) {
      cam.play(session.joinOpts.localVideoEl, { fit: "cover" });
    }
    await session.client.publish([cam]);
    session.cam = cam;
  } catch (err) {
    console.warn("[agora] camera recover failed", err);
  }
}

export async function setUserMuted(muted: boolean) {
  if (!session?.mic) return;
  await session.mic.setEnabled(!muted);
}

export async function setUserCameraOff(off: boolean) {
  if (!session?.cam) return;
  await session.cam.setEnabled(!off);
}

/** Flip between front/back camera when multiple devices exist. */
export async function switchUserCamera() {
  if (!session?.cam) return;
  try {
    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
    const cams = await AgoraRTC.getCameras();
    if (cams.length < 2) return;
    const current = session.cam.getTrackLabel();
    const next = cams.find((c) => c.label !== current) || cams[0];
    if (next?.deviceId) await session.cam.setDevice(next.deviceId);
  } catch {
    /* ignore */
  }
}

/** Speaker vs quieter earpiece-like volume (web/Android WebView). */
export async function setUserSpeaker(on: boolean) {
  if (!session) return;
  session.speakerOn = on;
  for (const track of session.remoteAudio) {
    try {
      track.setVolume(on ? 100 : 30);
    } catch {
      /* ignore */
    }
  }
  // Prefer device sink when browser supports it (Chrome Android).
  try {
    const anyNav = navigator as Navigator & {
      mediaDevices?: { selectAudioOutput?: () => Promise<{ deviceId: string }> };
    };
    if (on && anyNav.mediaDevices?.selectAudioOutput) {
      await anyNav.mediaDevices.selectAudioOutput();
    }
  } catch {
    /* user cancelled or unsupported */
  }
}

export async function stopUserAgoraCall() {
  if (!session) return;
  const { client, mic, cam } = session;
  session = null;
  try {
    if (mic) {
      mic.stop();
      mic.close();
    }
    if (cam) {
      cam.stop();
      cam.close();
    }
    const pubs = [mic, cam].filter(Boolean) as (
      | import('agora-rtc-sdk-ng').IMicrophoneAudioTrack
      | import('agora-rtc-sdk-ng').ICameraVideoTrack
    )[];
    if (pubs.length) await client.unpublish(pubs);
    client.removeAllListeners();
    await client.leave();
  } catch {
    // ignore
  }
}

/** Host-Only Live: viewer joins as subscriber (no local mic/cam publish). */
type LiveViewerSession = {
  client: import("agora-rtc-sdk-ng").IAgoraRTCClient;
};

let liveViewer: LiveViewerSession | null = null;

export async function startUserAgoraLiveViewer(options: {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  remoteVideoEl: HTMLElement;
  onRemoteVideo?: () => void;
  onRemoteAudio?: () => void;
}) {
  await stopUserAgoraLiveViewer();
  await stopUserAgoraCall();
  prep(options.remoteVideoEl);

  const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
  AgoraRTC.setLogLevel(3);
  // Host broadcasts in RTC mode — viewers must use the same mode (subscribe only).
  const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  const playRemote = async (
    user: import("agora-rtc-sdk-ng").IAgoraRTCRemoteUser,
    mediaType: "audio" | "video",
  ) => {
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && user.videoTrack) {
        user.videoTrack.play(options.remoteVideoEl, { fit: "cover" });
        options.onRemoteVideo?.();
      }
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
        options.onRemoteAudio?.();
      }
    } catch (err) {
      console.warn("[agora live viewer] subscribe failed", err);
    }
  };

  client.on("user-published", playRemote);
  client.on("user-unpublished", (user, mediaType) => {
    if (mediaType === "video") {
      // keep placeholder until republish
    }
  });

  await client.join(
    options.appId,
    options.channel,
    options.token,
    options.uid,
  );

  // Host may already be publishing when we join
  for (const user of client.remoteUsers) {
    if (user.hasVideo) await playRemote(user, "video");
    if (user.hasAudio) await playRemote(user, "audio");
  }

  liveViewer = { client };
  return liveViewer;
}

export async function stopUserAgoraLiveViewer() {
  if (!liveViewer) return;
  const { client } = liveViewer;
  liveViewer = null;
  try {
    client.removeAllListeners();
    await client.leave();
  } catch {
    // ignore
  }
}
