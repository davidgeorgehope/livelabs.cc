"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RefreshCw, Square } from "lucide-react";

interface InteractiveTerminalProps {
  enrollmentId: number;
  token: string;
  onClose?: () => void;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function InteractiveTerminal({
  enrollmentId,
  token,
  onClose,
}: InteractiveTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");

    // Determine WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiHost = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : window.location.host;
    const wsUrl = `${protocol}//${apiHost}/api/terminal/ws/${enrollmentId}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ready") {
          terminalInstance.current?.write("\r\n\x1b[32mTerminal connected.\x1b[0m\r\n\r\n");
        } else if (data.type === "error") {
          terminalInstance.current?.write(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
          setStatus("error");
        }
      } catch {
        // Raw terminal output
        terminalInstance.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      terminalInstance.current?.write("\r\n\x1b[33mTerminal disconnected.\x1b[0m\r\n");
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [enrollmentId, token]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "close" }));
        wsRef.current.close();
      } catch {
        // Ignore errors
      }
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendResize = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && terminalInstance.current) {
      const dims = {
        type: "resize",
        rows: terminalInstance.current.rows,
        cols: terminalInstance.current.cols,
      };
      wsRef.current.send(JSON.stringify(dims));
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    terminalInstance.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      sendResize();
    };
    window.addEventListener("resize", handleResize);

    // Initial connection
    connect();

    return () => {
      window.removeEventListener("resize", handleResize);
      disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refit when fullscreen changes
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        sendResize();
      }, 100);
    }
  }, [isFullscreen, sendResize]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const statusColor = {
    disconnected: "text-gray-400",
    connecting: "text-yellow-400",
    connected: "text-green-400",
    error: "text-red-400",
  };

  return (
    <div
      className={`flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50" : "h-full"
      }`}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Terminal</span>
          <span className={`text-xs ${statusColor[status]}`}>
            {status === "connected" && "Connected"}
            {status === "connecting" && "Connecting..."}
            {status === "disconnected" && "Disconnected"}
            {status === "error" && "Connection Error"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "disconnected" || status === "error" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={connect}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reconnect
            </Button>
          ) : status === "connected" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              className="text-gray-400 hover:text-white"
            >
              <Square className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="flex-1 p-2"
        style={{ minHeight: isFullscreen ? "calc(100vh - 48px)" : "300px" }}
      />
    </div>
  );
}
