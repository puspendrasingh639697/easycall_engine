import { io } from 'socket.io-client';

/**
 * Signaling Server Connection Manager
 * @param {string} url - Signaling server ka URL
 */
export const createSignaling = (url) => {
  const socket = io(url, {
    transports: ['websocket'], // Fast P2P setup ke liye
    reconnectionAttempts: 5,   // Agar network gire, toh 5 baar try karega
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Signaling Connected with ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Signaling Connection Error:', err.message);
  });

  return socket;
};