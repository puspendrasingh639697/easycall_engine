import { EasyCall } from './src/index.js';

// 1. EasyCall ko initialize karo
const call = new EasyCall('http://localhost:3000'); // Tumhare server ka URL

async function startApp() {
  try {
    // Audio-Only: video false kar diya
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    
    // Local stream ko library mein add karo
    call.addAudioStream(stream);
    console.log("Mic access ready!");
  } catch (err) {
    console.error("Mic access denied:", err);
  }
}

// 2. Call lagane ka logic
document.getElementById('callBtn').addEventListener('click', () => {
  const targetId = document.getElementById('peerIdInput').value;
  if (targetId) {
    call.startCall(targetId);
    console.log("Calling...", targetId);
  }
});

// 3. Jab call aaye (Incoming Call)
call.onIncomingCall((data) => {
  console.log("Call aayi hai from:", data.from);
  
  // UI par Accept Button dikhao
  const acceptBtn = document.getElementById('acceptBtn');
  acceptBtn.style.display = 'block'; 
  
  acceptBtn.onclick = () => {
    call.answerCall(data.from);
    console.log("Call accepted!");
  };
});

// 4. Samne wale ki audio sunna
call.onRemoteAudio((remoteStream) => {
  const audio = new Audio();
  audio.srcObject = remoteStream;
  audio.play();
  console.log("Remote audio playing...");
});

// Start the app
startApp();