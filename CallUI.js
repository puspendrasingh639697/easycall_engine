import React, { useEffect, useState, useRef } from 'react';
import { EasyCall } from './path/to/EasyCall';

const CallUI = ({ signalingUrl, targetId }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const easyCall = useRef(new EasyCall(signalingUrl));

  useEffect(() => {
    // 1. Microphone/Camera Permission
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      easyCall.current.addAudioStream(stream);
    };
    init();

    // 2. Incoming Call Listener
    easyCall.current.onIncomingCall((data) => {
      console.log("Call incoming from:", data.senderId);
      // Yahan UI par 'Accept Call' ka button dikhao
    });

    // 3. Setup Remote Audio
    easyCall.current.onRemoteAudio((stream) => {
      setRemoteStream(stream);
    });
  }, []);

  return (
    <div>
      <button onClick={() => easyCall.current.startCall(targetId)}>Start Call</button>
      <button onClick={() => easyCall.current.answerCall(targetId)}>Answer Call</button>
      <button onClick={() => easyCall.current.hangup()}>Hang Up</button>
      
      {/* Remote Audio Player */}
      {remoteStream && <audio autoPlay ref={el => el && (el.srcObject = remoteStream)} />}
    </div>
  );
};

export default CallUI;