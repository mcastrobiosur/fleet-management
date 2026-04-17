import WebSocket, { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ReporteFalla, Ticket, EventoTicket, Rol } from '@biosur/shared';

/**
 * Abstraction for push notification delivery (mobile).
 * Implement this interface with FCM, APNs, or any push provider.
 */
export interface PushProvider {
  send(userId: string, payload: PushPayload): Promise<void>;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Message sent over WebSocket or push channels */
export interface NotificacionMessage {
  tipo: 'alerta_critica' | 'ticket_evento';
  payload: Record<string, unknown>;
  timestamp: string;
}

interface ClientConnection {
  userId: string;
  rol: Rol;
  canal: 'websocket' | 'push';
  ws?: WebSocket;
}

export class NotificacionService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection[]> = new Map();
  private pushProvider: PushProvider | null;

  constructor(pushProvider?: PushProvider) {
    this.pushProvider = pushProvider ?? null;
  }

  /**
   * Attach WebSocket server to an existing HTTP server.
   */
  attachToServer(server: HttpServer): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      // Clients must send an auth message to register: { userId, rol }
      ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'auth' && msg.userId && msg.rol) {
            this.registerWebSocket(msg.userId, msg.rol as Rol, ws);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.removeWebSocket(ws);
      });
    });
  }

  /**
   * Send a critical alert to all connected Administrador users.
   * Must be delivered within ≤30s of report generation.
   */
  async enviarAlertaCritica(reporteFalla: ReporteFalla): Promise<void> {
    const message: NotificacionMessage = {
      tipo: 'alerta_critica',
      payload: {
        reporteFallaId: reporteFalla.id,
        unidadId: reporteFalla.unidadId,
        codigoVerificacionId: reporteFalla.codigoVerificacionId,
        semaforoRiesgo: reporteFalla.semaforoRiesgo,
        descripcion: reporteFalla.descripcion,
      },
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message);

    // Broadcast to all admin WebSocket connections
    for (const [, connections] of this.clients) {
      for (const conn of connections) {
        if (conn.rol === Rol.ADMINISTRADOR) {
          if (conn.canal === 'websocket' && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(serialized);
          }
          if (conn.canal === 'push' && this.pushProvider) {
            await this.pushProvider.send(conn.userId, {
              title: 'Alerta Crítica',
              body: `Falla crítica reportada en unidad ${reporteFalla.unidadId}`,
              data: {
                reporteFallaId: reporteFalla.id,
                unidadId: reporteFalla.unidadId,
              },
            });
          }
        }
      }
    }
  }

  /**
   * Send a ticket event notification to the assigned maintenance user.
   */
  async enviarNotificacionTicket(ticket: Ticket, evento: EventoTicket): Promise<void> {
    const targetUserId = ticket.asignadoA;
    if (!targetUserId) return;

    const message: NotificacionMessage = {
      tipo: 'ticket_evento',
      payload: {
        ticketId: ticket.id,
        unidadId: ticket.unidadId,
        estado: ticket.estado,
        evento,
      },
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message);
    const connections = this.clients.get(targetUserId) ?? [];

    for (const conn of connections) {
      if (conn.canal === 'websocket' && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(serialized);
      }
      if (conn.canal === 'push' && this.pushProvider) {
        await this.pushProvider.send(targetUserId, {
          title: `Ticket ${evento}`,
          body: `Ticket ${ticket.id} — estado: ${ticket.estado}`,
          data: {
            ticketId: ticket.id,
            unidadId: ticket.unidadId,
          },
        });
      }
    }
  }

  /**
   * Subscribe a user to a notification channel.
   */
  suscribir(userId: string, canal: 'websocket' | 'push', rol?: Rol): void {
    const existing = this.clients.get(userId) ?? [];
    // Avoid duplicate subscriptions for the same canal
    if (!existing.some((c) => c.canal === canal)) {
      existing.push({ userId, rol: rol ?? Rol.CONDUCTOR, canal });
      this.clients.set(userId, existing);
    }
  }

  /** Get the number of connected clients (for testing/monitoring) */
  getConnectedCount(): number {
    let count = 0;
    for (const [, connections] of this.clients) {
      count += connections.length;
    }
    return count;
  }

  /** Get connections for a specific user (for testing) */
  getClientConnections(userId: string): ClientConnection[] {
    return this.clients.get(userId) ?? [];
  }

  /** Close the WebSocket server */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }

  // --- Private helpers ---

  private registerWebSocket(userId: string, rol: Rol, ws: WebSocket): void {
    const existing = this.clients.get(userId) ?? [];
    // Replace existing websocket connection or add new one
    const wsIndex = existing.findIndex((c) => c.canal === 'websocket');
    if (wsIndex >= 0) {
      existing[wsIndex].ws = ws;
      existing[wsIndex].rol = rol;
    } else {
      existing.push({ userId, rol, canal: 'websocket', ws });
    }
    this.clients.set(userId, existing);
  }

  private removeWebSocket(ws: WebSocket): void {
    for (const [userId, connections] of this.clients) {
      const filtered = connections.filter((c) => c.ws !== ws);
      if (filtered.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filtered);
      }
    }
  }
}
