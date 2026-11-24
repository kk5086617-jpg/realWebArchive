import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'node:events';

export const chatEvents = new EventEmitter();

export function attachChatSocket(server) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    if (req.url !== '/ws/chat' || req.headers.origin !== `${protocol}://${req.headers.host}`) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    sockets.handleUpgrade(req, socket, head, connection => sockets.emit('connection', connection));
  });
  sockets.on('connection', socket => {
    socket.alive = true;
    socket.on('error', () => {});
    socket.on('pong', () => { socket.alive = true; });
  });
  const broadcast = post => {
    const payload = JSON.stringify({ type: 'message', post });
    for (const socket of sockets.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (socket.bufferedAmount > 1024 * 1024) { socket.close(1013, 'Reconnect'); continue; }
      socket.send(payload);
    }
  };
  chatEvents.on('message', broadcast);
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.alive) { socket.terminate(); continue; }
      socket.alive = false; socket.ping();
    }
  }, 30000);
  heartbeat.unref();
  server.on('close', () => { clearInterval(heartbeat); chatEvents.off('message', broadcast); sockets.close(); });
  return sockets;
}
