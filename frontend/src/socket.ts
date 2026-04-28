import { io } from 'socket.io-client';

// In dev: falls back to localhost:4000 directly
// In prod: connects to the Render backend URL
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});

export default socket;
