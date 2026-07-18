/**
 * ============================================================================
 * AGORA WEBRTC — USER APP (PRODUCTION)
 * ============================================================================
 * SETUP
 * 1. https://console.agora.io → Create Project → Enable App Certificate
 * 2. Client: NEXT_PUBLIC_AGORA_APP_ID in .env.local
 * 3. Server: AGORA_APP_ID + AGORA_APP_CERTIFICATE on CoinCall API
 * 4. Tokens: always fetch from GET /api/calls/:id/token?role=user
 *    Never generate tokens in the browser with the certificate.
 *
 * Party Room / PK Battle: reuse startUserAgoraCall with channel =
 *   party_{roomId} or pk_{battleId} and roles from the same token API.
 * ============================================================================
 */

'use client';

type LiveSession = {
  client: import('agora-rtc-sdk-ng').IAgoraRTCClient;
  mic: import('agora-rtc-sdk-ng').IMicrophoneAudioTrack | null;
  cam: import('agora-rtc-sdk-ng').ICameraVideoTrack | null;
};

let session: LiveSession | null = null;

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
}) {
  await stopUserAgoraCall();
  prep(options.localVideoEl);
  prep(options.remoteVideoEl);

  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  AgoraRTC.setLogLevel(4);
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  const playRemote = async (
    user: import('agora-rtc-sdk-ng').IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video',
  ) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'video' && user.videoTrack) {
      user.videoTrack.play(options.remoteVideoEl, { fit: 'cover' });
    }
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play();
    }
  };

  client.on('user-published', playRemote);

  await client.join(
    options.appId,
    options.channel,
    options.token,
    options.uid,
  );

  for (const user of client.remoteUsers) {
    if (user.hasVideo) await playRemote(user, 'video');
    if (user.hasAudio) await playRemote(user, 'audio');
  }

  const [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks(
    {},
    { encoderConfig: '480p_1' },
  );
  cam.play(options.localVideoEl, { fit: 'cover' });
  await client.publish([mic, cam]);

  session = { client, mic, cam };
  return session;
}

export async function setUserMuted(muted: boolean) {
  if (!session?.mic) return;
  await session.mic.setEnabled(!muted);
}

export async function setUserCameraOff(off: boolean) {
  if (!session?.cam) return;
  await session.cam.setEnabled(!off);
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
    if (mic && cam) {
      await client.unpublish([mic, cam]);
    }
    await client.leave();
  } catch {
    // ignore
  }
}
