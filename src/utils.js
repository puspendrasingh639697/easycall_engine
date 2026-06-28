// // // utils.js
// // export const iceConfig = {
// //   iceServers: [
// //     {
// //       urls: [
// //         'stun:stun.l.google.com:19302',
// //         'stun:stun1.l.google.com:19302',
// //         'stun:stun2.l.google.com:19302',
// //         'stun:stun3.l.google.com:19302',
// //         'stun:stun4.l.google.com:19302'
// //       ]
// //     }
// //   ]
// // };

// // export const isBrowser = () => typeof window !== 'undefined';


// // utils.js - Complete with fallback support
// export const iceConfig = {
//   iceServers: [
//     {
//       urls: [
//         'stun:stun.l.google.com:19302',
//         'stun:stun1.l.google.com:19302',
//         'stun:stun2.l.google.com:19302',
//         'stun:stun3.l.google.com:19302',
//         'stun:stun4.l.google.com:19302'
//       ]
//     },
//     // ✅ Fallback STUN servers
//     {
//       urls: [
//         'stun:stun.ekiga.net',
//         'stun:stun.ideasip.com',
//         'stun:stun.iptel.org',
//         'stun:stun.rixtelecom.se',
//         'stun:stun.schlund.de'
//       ]
//     },
//     // ✅ TURN servers for NAT traversal (optional, free ones)
//     {
//       urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
//       username: 'webrtc',
//       credential: 'webrtc'
//     }
//   ],
//   iceTransportPolicy: 'all', // 'relay' for TURN only
//   bundlePolicy: 'max-bundle',
//   rtcpMuxPolicy: 'require',
//   iceCandidatePoolSize: 10
// };

// // ✅ Browser detection with fallbacks
// export const isBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

// // ✅ WebRTC support detection
// export const isWebRTCSupported = () => {
//   if (!isBrowser()) return false;
//   return !!(window.RTCPeerConnection || 
//             window.webkitRTCPeerConnection || 
//             window.mozRTCPeerConnection);
// };

// // ✅ Get best available media constraints
// export const getAudioConstraints = (options = {}) => {
//   const defaultConstraints = {
//     audio: {
//       echoCancellation: true,
//       noiseSuppression: true,
//       autoGainControl: true,
//       sampleRate: 48000,
//       sampleSize: 16,
//       channelCount: 1,
//       volume: 1.0
//     },
//     video: false
//   };

//   // Mobile optimization
//   if (navigator.userAgent && 
//       (navigator.userAgent.includes('Android') || 
//        navigator.userAgent.includes('iPhone'))) {
//     defaultConstraints.audio.sampleRate = 24000;
//     defaultConstraints.audio.sampleSize = 16;
//   }

//   return { ...defaultConstraints, ...options };
// };

// export default {
//   iceConfig,
//   isBrowser,
//   isWebRTCSupported,
//   getAudioConstraints
// };

// src/utils.js - Helper Functions
export const iceConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    {
      urls: [
        'stun:stun.ekiga.net',
        'stun:stun.ideasip.com'
      ]
    }
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

export const isBrowser = () => {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
};

export const isWebRTCSupported = () => {
  if (!isBrowser()) return false;
  return !!(window.RTCPeerConnection || 
            window.webkitRTCPeerConnection || 
            window.mozRTCPeerConnection);
};

export const getAudioConstraints = (options = {}) => {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 1,
      ...options.audio
    },
    video: false
  };
};

export default {
  iceConfig,
  isBrowser,
  isWebRTCSupported,
  getAudioConstraints
};