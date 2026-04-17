import http from 'http';
import { createApp } from './app';
import { NotificacionService } from './services/notificacion.service';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = createApp();
const server = http.createServer(app);

// Attach WebSocket server for real-time notifications
const notificacionService = new NotificacionService();
notificacionService.attachToServer(server);

server.listen(PORT, () => {
  console.log(`Biosur API running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}/ws`);
});

export default server;
