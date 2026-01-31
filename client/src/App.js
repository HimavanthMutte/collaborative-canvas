import { useRef, useEffect, useState, useCallback } from "react";
import { socket } from "./socket";
import "./App.css";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("room1");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);

  // Multi-Canvas Refs
  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const bgCtx = useRef(null);
  const fgCtx = useRef(null);

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);

  const [history, setHistory] = useState([]);
  const lastRenderedIndex = useRef(0);
  const [remoteCursors, setRemoteCursors] = useState({});
  const activePaths = useRef({}); // Using ref for active paths to avoid React re-renders on every point

  const isDrawing = useRef(false);
  const currentPath = useRef([]);
  const lastCursorEmit = useRef(0);
  const startPoint = useRef({ x: 0, y: 0 });

  // Initialize contexts
  useEffect(() => {
    if (bgCanvasRef.current && fgCanvasRef.current) {
      bgCtx.current = bgCanvasRef.current.getContext("2d");
      fgCtx.current = fgCanvasRef.current.getContext("2d");

      // Initial background fill
      bgCtx.current.fillStyle = "white";
      bgCtx.current.fillRect(0, 0, bgCanvasRef.current.width, bgCanvasRef.current.height);
    }
  }, [joined]);

  const drawOperation = useCallback((ctx, op) => {
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = op.width;
    ctx.strokeStyle = op.tool === "eraser" ? "white" : op.color;
    ctx.fillStyle = op.tool === "eraser" ? "white" : op.color;

    if (op.type === "path") {
      if (op.points && op.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(op.points[0].x, op.points[0].y);
        for (let i = 1; i < op.points.length; i++) {
          ctx.lineTo(op.points[i].x, op.points[i].y);
        }
        ctx.stroke();
      }
    } else if (op.type === "rectangle") {
      ctx.strokeRect(op.start.x, op.start.y, op.end.x - op.start.x, op.end.y - op.start.y);
    } else if (op.type === "circle") {
      const radius = Math.sqrt(Math.pow(op.end.x - op.start.x, 2) + Math.pow(op.end.y - op.start.y, 2));
      ctx.beginPath();
      ctx.arc(op.start.x, op.start.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // Foreground Rendering (Active Drawing & Previews)
  const renderForeground = useCallback(() => {
    if (!fgCtx.current) return;
    const ctx = fgCtx.current;
    ctx.clearRect(0, 0, fgCanvasRef.current.width, fgCanvasRef.current.height);

    // 1. Draw remote active paths (Previews)
    Object.values(activePaths.current).forEach(path => {
      drawOperation(ctx, path);
    });

    // 2. Draw local active path
    if (isDrawing.current) {
      const currentOp = {
        type: (tool === "pen" || tool === "eraser") ? "path" : tool,
        points: currentPath.current,
        start: startPoint.current,
        end: currentPath.current[currentPath.current.length - 1],
        color: tool === "eraser" ? "white" : color,
        width: size,
        tool: tool
      };
      drawOperation(ctx, currentOp);
    }
  }, [tool, color, size, drawOperation]);

  // Use ref for renderForeground to satisfy ESLint dependency rules without re-binding sockets
  const renderForegroundRef = useRef(null);
  renderForegroundRef.current = renderForeground;

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected");
    });

    socket.on("init_state", (serverHistory) => {
      setHistory(serverHistory);
      lastRenderedIndex.current = 0; // Trigger full redraw
    });

    socket.on("new_op", (op) => {
      setHistory((prev) => [...prev, op]);
      delete activePaths.current[op.userId];
      if (renderForegroundRef.current) renderForegroundRef.current();
    });

    socket.on("undo_op", (opId) => {
      setHistory((prev) => {
        const newHistory = prev.filter(op => op.id !== opId);
        lastRenderedIndex.current = 0; // Trigger full redraw on background
        return newHistory;
      });
    });

    socket.on("user_update", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("cursor_update", (data) => {
      setRemoteCursors(prev => ({
        ...prev,
        [data.userId]: data
      }));
    });

    socket.on("draw_step", (data) => {
      activePaths.current[data.userId] = {
        type: data.type,
        start: data.start,
        end: data.end,
        points: data.points, // For path tools
        color: data.color,
        width: data.width,
        tool: data.tool
      };
      if (renderForegroundRef.current) renderForegroundRef.current();
    });

    return () => {
      socket.off("connect");
      socket.off("init_state");
      socket.off("new_op");
      socket.off("undo_op");
      socket.off("user_update");
      socket.off("cursor_update");
      socket.off("draw_step");
    };
  }, []);

  // Background Rendering (Persistence)
  useEffect(() => {
    if (!bgCtx.current) return;
    const ctx = bgCtx.current;

    // If history was reset (undo/init), clear and redraw all
    if (lastRenderedIndex.current === 0) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, bgCanvasRef.current.width, bgCanvasRef.current.height);
      history.forEach((op) => drawOperation(ctx, op));
      lastRenderedIndex.current = history.length;
    } else {
      // Incremental render
      for (let i = lastRenderedIndex.current; i < history.length; i++) {
        drawOperation(ctx, history[i]);
      }
      lastRenderedIndex.current = history.length;
    }
  }, [history, drawOperation]);

  const handleJoin = () => {
    if (username && roomId) {
      socket.connect();
      socket.emit("join_room", { username, roomId });
      setJoined(true);
    }
  };

  const getCanvasCoordinates = (event) => {
    const canvas = fgCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    const coords = getCanvasCoordinates(e);
    isDrawing.current = true;
    startPoint.current = coords;
    currentPath.current = [coords];
    renderForeground();
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoordinates(e);
    const { x, y } = coords;

    const now = Date.now();
    if (now - lastCursorEmit.current > 50) {
      socket.emit("cursor_move", { x, y });
      lastCursorEmit.current = now;
    }

    if (!isDrawing.current) return;

    currentPath.current.push(coords);

    // Emit live preview step
    socket.emit("draw_step", {
      type: (tool === "pen" || tool === "eraser") ? "path" : tool,
      start: startPoint.current,
      end: coords,
      points: currentPath.current, // Only for path
      color: tool === "eraser" ? "white" : color,
      width: size,
      tool: tool
    });

    renderForeground();
  };

  const handleMouseUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const coords = getCanvasCoordinates(e);
    let op = {
      type: (tool === "pen" || tool === "eraser") ? "path" : tool,
      points: [...currentPath.current],
      start: startPoint.current,
      end: coords,
      color: color,
      width: size,
      tool: tool
    };

    socket.emit("draw_op", op);
    renderForeground();
  };

  const handleUndo = () => {
    socket.emit("undo");
  };

  const handleRedo = () => {
    socket.emit("redo");
  };

  if (!joined) {
    return (
      <div className="login-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100 }}>
        <h1>Collaborative Canvas</h1>
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ padding: 10, margin: 10 }}
        />
        <input
          placeholder="Room ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          style={{ padding: 10, margin: 10 }}
        />
        <button onClick={handleJoin} style={{ padding: 10, width: 200 }}>Join Room</button>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="header" style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Room: {roomId}</h3>
        <div style={{ fontSize: '14px', color: '#666' }}>Users: {users.map(u => u.username).join(', ')}</div>
      </div>

      <div className="toolbar" style={{ padding: '10px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div className="tool-group">
          <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}>Pen</button>
          <button className={tool === "rectangle" ? "active" : ""} onClick={() => setTool("rectangle")}>Rect</button>
          <button className={tool === "circle" ? "active" : ""} onClick={() => setTool("circle")}>Circle</button>
          <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>Eraser</button>
        </div>

        <div className="divider" style={{ width: 1, height: 24, background: '#ccc' }} />

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={tool === "eraser"}
        />

        <input
          type="range"
          min="1"
          max="20"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
        <span style={{ minWidth: "35px" }}>{size}px</span>

        <div className="divider" style={{ width: 1, height: 24, background: '#ccc' }} />

        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 800,
        aspectRatio: '800 / 500',
        margin: '20px auto',
        border: '1px solid #ccc',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        backgroundColor: 'white'
      }}>
        {/* Background Canvas: Static history */}
        <canvas
          ref={bgCanvasRef}
          width={800}
          height={500}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
        />

        {/* Foreground Canvas: Active drawing, previews, and mouse events */}
        <canvas
          ref={fgCanvasRef}
          width={800}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, cursor: 'crosshair' }}
        />

        {Object.values(remoteCursors).map(cursor => (
          <div key={cursor.userId} style={{
            position: 'absolute',
            top: `${(cursor.y / 500) * 100}%`,
            left: `${(cursor.x / 800) * 100}%`,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: cursor.color || 'red',
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
              transform: 'translate(-50%, -50%)',
              flexShrink: 0
            }} />
            <span style={{
              fontSize: 10,
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '2px 4px',
              borderRadius: 4,
              border: '1px solid #ccc',
              whiteSpace: 'nowrap',
              position: 'absolute',
              left: 10,
              top: 5
            }}>{cursor.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
