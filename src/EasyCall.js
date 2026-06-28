// import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';
// import { iceConfig } from './utils.js';

// export class EasyCall {
//   constructor(signalingUrl) {
//     this.socket = io(signalingUrl, { 
//       transports: ['websocket'],
//       reconnection: true, // Auto-reconnect if server drops
//       reconnectionAttempts: 5 
//     });
    
//     this.peer = new RTCPeerConnection(iceConfig);
//     this.iceQueue = [];
//     this.isRemoteDescSet = false; // Flag to track state

//     // Robust ICE Candidate Handling
//     this.peer.onicecandidate = (e) => {
//       if (e.candidate) {
//         this.socket.emit('ice-candidate', { candidate: e.candidate });
//       }
//     };

//     this.socket.on('ice-candidate', async (data) => {
//       try {
//         if (this.isRemoteDescSet) {
//           await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
//         } else {
//           this.iceQueue.push(data.candidate);
//         }
//       } catch (err) {
//         console.error("Error adding ICE candidate:", err);
//       }
//     });
//   }

//   async startCall(targetId) {
//     try {
//       const offer = await this.peer.createOffer({ offerToReceiveAudio: true });
//       await this.peer.setLocalDescription(offer);
//       this.socket.emit('call-offer', { targetId, offer });
//     } catch (err) {
//       console.error("Start Call Error:", err);
//     }
//   }

//   onIncomingCall(callback) {
//     this.socket.on('call-offer', async (data) => {
//       try {
//         await this.peer.setRemoteDescription(new RTCSessionDescription(data.offer));
//         this.isRemoteDescSet = true;
        
//         // Process queued candidates
//         while (this.iceQueue.length > 0) {
//           await this.peer.addIceCandidate(new RTCIceCandidate(this.iceQueue.shift()));
//         }
//         callback(data);
//       } catch (err) {
//         console.error("Failed to handle offer:", err);
//       }
//     });
//   }

//   async answerCall(targetId) {
//     try {
//       const answer = await this.peer.createAnswer();
//       await this.peer.setLocalDescription(answer);
//       this.isRemoteDescSet = true;
//       this.socket.emit('call-answer', { targetId, answer });
//     } catch (err) {
//       console.error("Answer Call Error:", err);
//     }
//   }

//   addAudioStream(stream) {
//     stream.getTracks().forEach(track => this.peer.addTrack(track, stream));
//   }

//   onRemoteAudio(callback) {
//     this.peer.ontrack = (e) => {
//       if (e.streams && e.streams[0]) {
//         callback(e.streams[0]);
//       }
//     };
//   }

//   // Proper Cleanup to prevent Memory Leaks
//   hangup() {
//     this.peer.ontrack = null;
//     this.peer.onicecandidate = null;
//     this.peer.close();
//     this.socket.disconnect();
//     this.isRemoteDescSet = false;
//     console.log("Call Terminated Cleanly");
//   }
// }

// src/EasyCall.js - Complete Fixed Version
// import { io } from 'socket.io-client';
// import { iceConfig } from './utils.js';

// export class EasyCall {
//   constructor(signalingUrl) {
//     // Connection management with retry
//     this.socket = io(signalingUrl, {
//       transports: ['websocket'],
//       reconnection: true,
//       reconnectionAttempts: 10,
//       reconnectionDelay: 1000,
//       timeout: 10000
//     });

//     this.peer = null;
//     this.iceQueue = [];
//     this.isRemoteDescSet = false;
//     this.isInitialized = false;
//     this.eventListeners = new Map(); // Track listeners for cleanup
//     this.localStream = null;
//     this.remoteStream = null;
//     this.callState = 'idle'; // idle, calling, ringing, connected, ended

//     // Initialize peer connection
//     this.initPeerConnection();
    
//     // Setup socket listeners with cleanup
//     this.setupSocketListeners();
//   }

//   initPeerConnection() {
//     if (this.peer) {
//       this.peer.close();
//     }
    
//     this.peer = new RTCPeerConnection(iceConfig);
//     this.iceQueue = [];
//     this.isRemoteDescSet = false;

//     // ICE candidate handling
//     this.peer.onicecandidate = (event) => {
//       if (event.candidate && this.callState === 'connected') {
//         this.socket.emit('ice-candidate', {
//           candidate: event.candidate,
//           targetId: this.currentTargetId
//         });
//       }
//     };

//     // Track remote streams
//     this.peer.ontrack = (event) => {
//       if (event.streams && event.streams[0]) {
//         this.remoteStream = event.streams[0];
//         if (this.onRemoteStreamCallback) {
//           this.onRemoteStreamCallback(this.remoteStream);
//         }
//       }
//     };

//     // Connection state monitoring
//     this.peer.onconnectionstatechange = () => {
//       console.log('Connection state:', this.peer.connectionState);
//       if (this.peer.connectionState === 'failed' || 
//           this.peer.connectionState === 'disconnected') {
//         this.handleDisconnect();
//       }
//     };
//   }

//   setupSocketListeners() {
//     // Clean up old listeners
//     this.cleanupSocketListeners();

//     // ICE candidate listener
//     const iceHandler = async (data) => {
//       try {
//         if (!data.candidate) return;
        
//         if (this.isRemoteDescSet && this.peer) {
//           await this.peer.addIceCandidate(
//             new RTCIceCandidate(data.candidate)
//           );
//         } else {
//           this.iceQueue.push(data.candidate);
//         }
//       } catch (err) {
//         console.warn('ICE candidate add error:', err);
//       }
//     };
//     this.socket.on('ice-candidate', iceHandler);
//     this.eventListeners.set('ice-candidate', iceHandler);

//     // Call answer listener
//     const answerHandler = async (data) => {
//       try {
//         if (this.peer && data.answer) {
//           await this.peer.setRemoteDescription(
//             new RTCSessionDescription(data.answer)
//           );
//           this.isRemoteDescSet = true;
//           this.callState = 'connected';
//           this.processIceQueue();
//         }
//       } catch (err) {
//         console.error('Answer handling error:', err);
//         this.handleError('answer_failed');
//       }
//     };
//     this.socket.on('call-answer', answerHandler);
//     this.eventListeners.set('call-answer', answerHandler);

//     // Error handling
//     const errorHandler = (error) => {
//       console.error('Socket error:', error);
//       this.handleError('socket_error');
//     };
//     this.socket.on('error', errorHandler);
//     this.eventListeners.set('error', errorHandler);

//     // Disconnect handling
//     const disconnectHandler = () => {
//       console.log('Socket disconnected');
//       if (this.callState === 'connected' || this.callState === 'calling') {
//         this.handleDisconnect();
//       }
//     };
//     this.socket.on('disconnect', disconnectHandler);
//     this.eventListeners.set('disconnect', disconnectHandler);
//   }

//   cleanupSocketListeners() {
//     for (const [event, handler] of this.eventListeners) {
//       this.socket.off(event, handler);
//     }
//     this.eventListeners.clear();
//   }

//   async processIceQueue() {
//     while (this.iceQueue.length > 0 && this.peer) {
//       try {
//         const candidate = this.iceQueue.shift();
//         await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
//       } catch (err) {
//         console.warn('Queue candidate error:', err);
//       }
//     }
//   }

//   // ✅ IMPROVED: With error handling and state management
//   async startCall(targetId) {
//     try {
//       if (!targetId) {
//         throw new Error('Target ID is required');
//       }

//       if (!this.peer) {
//         this.initPeerConnection();
//       }

//       this.currentTargetId = targetId;
//       this.callState = 'calling';

//       const offer = await this.peer.createOffer({
//         offerToReceiveAudio: true,
//         offerToReceiveVideo: false
//       });
      
//       await this.peer.setLocalDescription(offer);
//       this.isRemoteDescSet = true;

//       this.socket.emit('call-offer', {
//         targetId,
//         offer,
//         from: this.socket.id
//       });

//       console.log(`📞 Call initiated to ${targetId}`);
//       return true;
//     } catch (err) {
//       console.error('Start call error:', err);
//       this.callState = 'idle';
//       this.handleError('start_call_failed');
//       throw err;
//     }
//   }

//   // ✅ IMPROVED: With better callback handling
//   onIncomingCall(callback) {
//     const handler = async (data) => {
//       try {
//         if (!data.offer) return;

//         this.currentTargetId = data.from;
//         this.callState = 'ringing';

//         if (!this.peer) {
//           this.initPeerConnection();
//         }

//         await this.peer.setRemoteDescription(
//           new RTCSessionDescription(data.offer)
//         );
//         this.isRemoteDescSet = true;
        
//         await this.processIceQueue();

//         // Call callback with call data
//         callback({
//           from: data.from,
//           offer: data.offer,
//           accept: () => this.answerCall(data.from)
//         });
//       } catch (err) {
//         console.error('Incoming call error:', err);
//         this.handleError('incoming_call_failed');
//       }
//     };

//     this.socket.on('call-offer', handler);
//     this.eventListeners.set('call-offer', handler);
//   }

//   async answerCall(targetId) {
//     try {
//       if (!this.peer) {
//         throw new Error('No peer connection');
//       }

//       this.callState = 'connected';
//       const answer = await this.peer.createAnswer();
//       await this.peer.setLocalDescription(answer);
//       this.isRemoteDescSet = true;

//       this.socket.emit('call-answer', {
//         targetId: targetId || this.currentTargetId,
//         answer
//       });

//       console.log('📞 Call answered');
//       return true;
//     } catch (err) {
//       console.error('Answer call error:', err);
//       this.callState = 'idle';
//       this.handleError('answer_call_failed');
//       throw err;
//     }
//   }

//   // ✅ IMPROVED: Better stream handling
//   addAudioStream(stream) {
//     try {
//       if (!stream || !this.peer) return;
      
//       this.localStream = stream;
//       stream.getTracks().forEach(track => {
//         this.peer.addTrack(track, stream);
//       });
      
//       console.log('🎤 Audio stream added');
//     } catch (err) {
//       console.error('Add stream error:', err);
//     }
//   }

//   onRemoteAudio(callback) {
//     this.onRemoteStreamCallback = callback;
//   }

//   // ✅ IMPROVED: Cleanup with memory leak prevention
//   hangup() {
//     console.log('📞 Hanging up call...');
    
//     // Stop local tracks
//     if (this.localStream) {
//       this.localStream.getTracks().forEach(track => track.stop());
//       this.localStream = null;
//     }

//     // Stop remote tracks
//     if (this.remoteStream) {
//       this.remoteStream.getTracks().forEach(track => track.stop());
//       this.remoteStream = null;
//     }

//     // Cleanup peer connection
//     if (this.peer) {
//       this.peer.ontrack = null;
//       this.peer.onicecandidate = null;
//       this.peer.onconnectionstatechange = null;
//       this.peer.close();
//       this.peer = null;
//     }

//     // Cleanup socket listeners
//     this.cleanupSocketListeners();

//     // Reset state
//     this.iceQueue = [];
//     this.isRemoteDescSet = false;
//     this.callState = 'idle';
//     this.currentTargetId = null;
//     this.onRemoteStreamCallback = null;

//     console.log('✅ Call terminated cleanly');
//   }

//   handleDisconnect() {
//     console.warn('⚠️ Connection lost');
//     this.callState = 'ended';
//     // Auto reconnect logic
//     if (this.peer) {
//       this.peer.restartIce();
//     }
//   }

//   handleError(errorType) {
//     console.error('❌ Error:', errorType);
//     // Emit error event
//     if (this.onErrorCallback) {
//       this.onErrorCallback(errorType);
//     }
//   }

//   onError(callback) {
//     this.onErrorCallback = callback;
//   }

//   // ✅ NEW: Get connection status
//   getStatus() {
//     return {
//       callState: this.callState,
//       isConnected: this.callState === 'connected',
//       socketId: this.socket.id,
//       hasLocalStream: !!this.localStream,
//       hasRemoteStream: !!this.remoteStream
//     };
//   }

//   // ✅ NEW: Reconnect logic
//   reconnect() {
//     if (this.socket.disconnected) {
//       this.socket.connect();
//     }
//     if (!this.peer || this.peer.connectionState === 'closed') {
//       this.initPeerConnection();
//     }
//   }
// }

// export default EasyCall;

import { io } from 'socket.io-client';
import { iceConfig } from './utils.js';

export class EasyCall {
  constructor(signalingUrl) {
    // ✅ FIX 1: Socket.IO URL should work with both formats
    this.socket = io(signalingUrl, {
      transports: ['websocket', 'polling'], // ✅ Added polling fallback
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true // ✅ Added autoConnect
    });

    this.peer = null;
    this.iceQueue = [];
    this.isRemoteDescSet = false;
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.localStream = null;
    this.remoteStream = null;
    this.callState = 'idle';
    this.currentTargetId = null; // ✅ Added missing variable
    this.onRemoteStreamCallback = null; // ✅ Added missing variable
    this.onErrorCallback = null; // ✅ Added missing variable

    // Initialize peer connection
    this.initPeerConnection();
    this.setupSocketListeners();
  }

  initPeerConnection() {
    if (this.peer) {
      this.peer.close();
    }
    
    // ✅ FIX 2: Better ICE configuration with fallback
    this.peer = new RTCPeerConnection({
      ...iceConfig,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });
    
    this.iceQueue = [];
    this.isRemoteDescSet = false;

    // ICE candidate handling - ✅ FIX 3: Send candidates even when connecting
    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE Candidate:', event.candidate.type);
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: this.currentTargetId
        });
      }
    };

    // Track remote streams - ✅ FIX 4: Better stream handling
    this.peer.ontrack = (event) => {
      console.log('📡 Track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };

    // Connection state monitoring - ✅ FIX 5: Better state handling
    this.peer.onconnectionstatechange = () => {
      const state = this.peer.connectionState;
      console.log('🔄 Connection state:', state);
      
      if (state === 'connected') {
        this.callState = 'connected';
        console.log('✅ Call connected!');
      } else if (state === 'failed' || state === 'disconnected') {
        this.callState = 'ended';
        console.warn('⚠️ Connection lost');
        if (this.peer) {
          this.peer.restartIce();
        }
      }
    };

    // ✅ FIX 6: ICE gathering state
    this.peer.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering:', this.peer.iceGatheringState);
    };
  }

  setupSocketListeners() {
    this.cleanupSocketListeners();

    // ✅ FIX 7: Socket connect handler
    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    // ICE candidate listener - ✅ FIX 8: Better error handling
    const iceHandler = async (data) => {
      try {
        if (!data || !data.candidate) return;
        
        console.log('📥 ICE candidate received');
        
        if (this.isRemoteDescSet && this.peer) {
          await this.peer.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log('✅ ICE candidate added');
        } else {
          this.iceQueue.push(data.candidate);
          console.log('📦 ICE candidate queued');
        }
      } catch (err) {
        console.warn('⚠️ ICE candidate add error:', err.message);
      }
    };
    this.socket.on('ice-candidate', iceHandler);
    this.eventListeners.set('ice-candidate', iceHandler);

    // Call offer listener - ✅ FIX 9: Better incoming call handling
    const offerHandler = async (data) => {
      try {
        if (!data || !data.offer) return;

        console.log('📞 Incoming call from:', data.from);
        this.currentTargetId = data.from;
        this.callState = 'ringing';

        if (!this.peer) {
          this.initPeerConnection();
        }

        await this.peer.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        this.isRemoteDescSet = true;
        
        await this.processIceQueue();

        // Emit incoming call event
        this.socket.emit('incoming-call-ack', { from: this.socket.id });
        
        if (this.onIncomingCallback) {
          this.onIncomingCallback({
            from: data.from,
            offer: data.offer,
            accept: () => this.answerCall(data.from)
          });
        }
      } catch (err) {
        console.error('❌ Incoming call error:', err.message);
        this.handleError('incoming_call_failed');
      }
    };
    this.socket.on('call-offer', offerHandler);
    this.eventListeners.set('call-offer', offerHandler);

    // Call answer listener
    const answerHandler = async (data) => {
      try {
        if (!this.peer || !data || !data.answer) return;

        console.log('📞 Call answer received');
        await this.peer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        this.isRemoteDescSet = true;
        this.callState = 'connected';
        console.log('✅ Call connected!');
        this.processIceQueue();
      } catch (err) {
        console.error('❌ Answer handling error:', err.message);
        this.handleError('answer_failed');
      }
    };
    this.socket.on('call-answer', answerHandler);
    this.eventListeners.set('call-answer', answerHandler);

    // Error handling
    const errorHandler = (error) => {
      console.error('❌ Socket error:', error);
      this.handleError('socket_error');
    };
    this.socket.on('error', errorHandler);
    this.eventListeners.set('error', errorHandler);

    // Disconnect handling
    const disconnectHandler = () => {
      console.log('🔌 Socket disconnected');
      if (this.callState === 'connected' || this.callState === 'calling') {
        this.callState = 'ended';
        if (this.peer) {
          this.peer.restartIce();
        }
      }
    };
    this.socket.on('disconnect', disconnectHandler);
    this.eventListeners.set('disconnect', disconnectHandler);
  }

  cleanupSocketListeners() {
    for (const [event, handler] of this.eventListeners) {
      this.socket.off(event, handler);
    }
    this.eventListeners.clear();
  }

  async processIceQueue() {
    console.log('📦 Processing ICE queue, size:', this.iceQueue.length);
    while (this.iceQueue.length > 0 && this.peer) {
      try {
        const candidate = this.iceQueue.shift();
        await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ Queued ICE candidate added');
      } catch (err) {
        console.warn('⚠️ Queue candidate error:', err.message);
      }
    }
  }

  // ✅ FIX 10: Start call with better error handling
  async startCall(targetId) {
    try {
      if (!targetId) {
        throw new Error('Target ID is required');
      }

      console.log('📞 Starting call to:', targetId);
      this.currentTargetId = targetId;
      this.callState = 'calling';

      if (!this.peer) {
        this.initPeerConnection();
      }

      const offer = await this.peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await this.peer.setLocalDescription(offer);
      this.isRemoteDescSet = true;

      this.socket.emit('call-offer', {
        targetId,
        offer,
        from: this.socket.id
      });

      console.log(`✅ Call initiated to ${targetId}`);
      return true;
    } catch (err) {
      console.error('❌ Start call error:', err.message);
      this.callState = 'idle';
      this.handleError('start_call_failed');
      throw err;
    }
  }

  // ✅ FIX 11: Incoming call with better callback
  onIncomingCall(callback) {
    this.onIncomingCallback = callback;
  }

  // ✅ FIX 12: Answer call with better flow
  async answerCall(targetId) {
    try {
      if (!this.peer) {
        this.initPeerConnection();
      }

      console.log('📞 Answering call to:', targetId);
      this.callState = 'connected';
      
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.isRemoteDescSet = true;

      this.socket.emit('call-answer', {
        targetId: targetId || this.currentTargetId,
        answer
      });

      console.log('✅ Call answered');
      return true;
    } catch (err) {
      console.error('❌ Answer call error:', err.message);
      this.callState = 'idle';
      this.handleError('answer_call_failed');
      throw err;
    }
  }

  // ✅ FIX 13: Add audio stream with better handling
  addAudioStream(stream) {
    try {
      if (!stream) {
        console.warn('⚠️ No stream provided');
        return;
      }
      
      if (!this.peer) {
        this.initPeerConnection();
      }
      
      this.localStream = stream;
      stream.getTracks().forEach(track => {
        this.peer.addTrack(track, stream);
        console.log('🎤 Track added:', track.kind);
      });
      
      console.log('✅ Audio stream added');
    } catch (err) {
      console.error('❌ Add stream error:', err.message);
    }
  }

  // ✅ FIX 14: Remote audio callback
  onRemoteAudio(callback) {
    this.onRemoteStreamCallback = callback;
  }

  // ✅ FIX 15: Hangup with complete cleanup
  hangup() {
    console.log('📞 Hanging up call...');
    
    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Local track stopped:', track.kind);
      });
      this.localStream = null;
    }

    // Stop remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Remote track stopped:', track.kind);
      });
      this.remoteStream = null;
    }

    // Cleanup peer connection
    if (this.peer) {
      this.peer.ontrack = null;
      this.peer.onicecandidate = null;
      this.peer.onconnectionstatechange = null;
      this.peer.onicegatheringstatechange = null;
      this.peer.close();
      this.peer = null;
    }

    // Cleanup socket listeners
    this.cleanupSocketListeners();

    // Reset state
    this.iceQueue = [];
    this.isRemoteDescSet = false;
    this.callState = 'idle';
    this.currentTargetId = null;
    this.onRemoteStreamCallback = null;
    this.onIncomingCallback = null;

    console.log('✅ Call terminated cleanly');
  }

  handleDisconnect() {
    console.warn('⚠️ Connection lost');
    this.callState = 'ended';
    if (this.peer) {
      this.peer.restartIce();
    }
  }

  handleError(errorType) {
    console.error('❌ Error:', errorType);
    if (this.onErrorCallback) {
      this.onErrorCallback(errorType);
    }
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  // ✅ FIX 16: Better status
  getStatus() {
    return {
      callState: this.callState,
      isConnected: this.callState === 'connected',
      socketId: this.socket.id,
      socketConnected: this.socket.connected,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      peerState: this.peer ? this.peer.connectionState : 'closed',
      iceGatheringState: this.peer ? this.peer.iceGatheringState : 'closed'
    };
  }

  // ✅ FIX 17: Reconnect logic
  reconnect() {
    console.log('🔄 Reconnecting...');
    if (this.socket.disconnected) {
      this.socket.connect();
    }
    if (!this.peer || this.peer.connectionState === 'closed') {
      this.initPeerConnection();
    }
  }
}

export default EasyCall;