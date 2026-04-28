import { Server } from 'socket.io';

let io: Server | null = null;

export function setIO(server: Server) {
  io = server;
}

export function emitHeatmapUpdate() {
  io?.emit('heatmap:update');
}

export function emitBlockingUpdate(blockingId: string) {
  io?.emit('blocking:update', { blockingId });
}
