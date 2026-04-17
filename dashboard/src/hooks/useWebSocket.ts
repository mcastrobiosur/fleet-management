import { useEffect, useRef, useCallback, useState } from 'react';

export interface WSMessage {
  type: string;
  payload: unknown;
}

interface UseWebSocketOptions {
  /** Auto-reconnect on close (default: true) */
  reconnect?: boolean;
  /** Max reconnect delay in ms (default: 30000) */
  maxDelay?: number;
}

/**
 * WebSocket hook for real-time notifications.
 * Connects to the backend WS endpoint with JWT auth and
 * implements exponential backoff reconnection.
 */
export function useWebSocket(
  onMessage: (msg: WSMessage) => void,
  options: UseWebSocketOptions = {},
) {
  const { reconnect = true, maxDelay = 30_000 } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);

  // Keep callback ref fresh without re-triggering effect
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (reconnect) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, maxDelay);
        retriesRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [reconnect, maxDelay]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, send };
}
