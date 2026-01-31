import { useRef, useEffect, useState, useCallback } from "react";
import { socket } from "./socket";
import "./App.css";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("room1");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);

  const [history, setHistory] = useState([]);
  const lastRenderedIndex = useRef(0);
  const [remoteCursors, setRemoteCursors] = useState({});
  const activePaths = useRef({});

  const queuedOperations = useRef([]);

  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const bgCtx = useRef(null);
  const fgCtx = useRef(null);

  const isDrawing = useRef(false);
  const currentPath = useRef([]);
  const lastCursorEmit = useRef(0);
  const startPoint = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (joined && bgCanvasRef.current && fgCanvasRef.current) {
      try {
        bgCtx.current = bgCanvasRef.current.getContext("2d");
        fgCtx.current = fgCanvasRef.current.getContext("2d");

        bgCtx.current.fillStyle = "white";
        bgCtx.current.fillRect(0, 0, 800, 500);
      } catch (err) {
        setErrorMessage("Could not start canvas. Please refresh.");
      }
    }
  }, [joined]);

  const drawOperation = useCallback((ctx, op) => {
    if (!ctx || !op) return;

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

  const renderForeground = useCallback(() => {
    if (!fgCtx.current) return;
    const ctx = fgCtx.current;

    ctx.clearRect(0, 0, 800, 500);

    Object.values(activePaths.current).forEach(path => {
      drawOperation(ctx, path);
    });

    if (isDrawing.current) {
      const liveOp = {
        type: (tool === "pen" || tool === "eraser") ? "path" : tool,
        points: currentPath.current,
        start: startPoint.current,
        end: currentPath.current[currentPath.current.length - 1],
        color: tool === "eraser" ? "white" : color,
        width: size,
        tool: tool
      };
      drawOperation(ctx, liveOp);
    }
  }, [tool, color, size, drawOperation]);

  const renderForegroundRef = useRef(null);
  renderForegroundRef.current = renderForeground;

  useEffect(() => {
    socket.on("connect", () => {
      setIsOnline(true);
      setErrorMessage("");

      if (queuedOperations.current.length > 0) {
        queuedOperations.current.forEach(op => socket.emit("draw_op", op));
        queuedOperations.current = [];
      }
    });

    socket.on("disconnect", () => {
      setIsOnline(false);
    });

    socket.on("connect_error", (err) => {
      setIsOnline(false);
      setErrorMessage("Network issue. Trying to reconnect...");
    });

    socket.on("init_state", (serverHistory) => {
      setHistory(serverHistory);
      lastRenderedIndex.current = 0;
    });

    socket.on("new_op", (op) => {
      setHistory((prev) => [...prev, op]);
      delete activePaths.current[op.userId];
      if (renderForegroundRef.current) renderForegroundRef.current();
    });

    socket.on("undo_op", (opId) => {
      setHistory((prev) => {
        const newHistory = prev.filter(item => item.id !== opId);
        lastRenderedIndex.current = 0;
        return newHistory;
      });
    });

    socket.on("user_update", (updatedUsers) => {
      setUsers(updatedUsers);

      const currentIds = updatedUsers.map(u => u.id || u.userId);
      setRemoteCursors(prev => {
        const clean = { ...prev };
        Object.keys(clean).forEach(id => {
          if (!currentIds.includes(id)) delete clean[id];
        });
        return clean;
      });
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
        points: data.points,
        color: data.color,
        width: data.width,
        tool: data.tool
      };
      if (renderForegroundRef.current) renderForegroundRef.current();
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("init_state");
      socket.off("new_op");
      socket.off("undo_op");
      socket.off("user_update");
      socket.off("cursor_update");
      socket.off("draw_step");
    };
  }, []);

  useEffect(() => {
    if (!bgCtx.current) return;
    const ctx = bgCtx.current;

    if (lastRenderedIndex.current === 0) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 800, 500);
      history.forEach((op) => drawOperation(ctx, op));
      lastRenderedIndex.current = history.length;
    } else {
      for (let i = lastRenderedIndex.current; i < history.length; i++) {
        drawOperation(ctx, history[i]);
      }
      lastRenderedIndex.current = history.length;
    }
  }, [history, drawOperation]);

  const handleJoin = () => {
    if (!username.trim()) {
      setErrorMessage("Please enter a username!");
      return;
    }
    if (!roomId.trim()) {
      setErrorMessage("Please enter a room ID!");
      return;
    }

    try {
      socket.connect();
      socket.emit("join_room", { username, roomId });
      setJoined(true);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage("Could not join room. Try again.");
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

    const now = Date.now();
    if (now - lastCursorEmit.current > 60) {
      try {
        socket.emit("cursor_move", { x: coords.x, y: coords.y });
        lastCursorEmit.current = now;
      } catch (err) { }
    }

    if (!isDrawing.current) return;

    currentPath.current.push(coords);

    try {
      socket.emit("draw_step", {
        type: (tool === "pen" || tool === "eraser") ? "path" : tool,
        start: startPoint.current,
        end: coords,
        points: currentPath.current,
        color: tool === "eraser" ? "white" : color,
        width: size,
        tool: tool
      });
    } catch (err) { }

    renderForeground();
  };

  const handleMouseUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const coords = getCanvasCoordinates(e);

    const finalOp = {
      type: (tool === "pen" || tool === "eraser") ? "path" : tool,
      points: [...currentPath.current],
      start: startPoint.current,
      end: coords,
      color: color,
      width: size,
      tool: tool
    };

    if (socket.connected) {
      try {
        socket.emit("draw_op", finalOp);
      } catch (err) {
        queuedOperations.current.push(finalOp);
      }
    } else {
      queuedOperations.current.push(finalOp);
    }

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
        <p>Drawing fun for everyone!</p>

        {errorMessage && <div style={{ color: 'red', marginBottom: 10 }}>{errorMessage}</div>}

        <input
          placeholder="Your name"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ padding: 10, margin: 10, width: 250, borderRadius: 5, border: '1px solid #ccc' }}
        />
        <input
          placeholder="Room ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          style={{ padding: 10, margin: 10, width: 250, borderRadius: 5, border: '1px solid #ccc' }}
        />
        <button onClick={handleJoin} style={{ padding: 10, width: 270, backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          JOIN DRAWING ROOM
        </button>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="header" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <h3 style={{ margin: 0 }}>Room: {roomId}</h3>
          <span style={{ fontSize: '12px', color: isOnline ? 'green' : 'red' }}>
            {isOnline ? "● Online" : "● Offline (Trying to connect...)"}
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Artists here: {users.map(u => u.username).join(', ')}
        </div>
      </div>

      <div className="toolbar" style={{ padding: '10px', background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tool-group" style={{ display: 'flex', gap: 5 }}>
          <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} title="Draw lines">Pen</button>
          <button className={tool === "rectangle" ? "active" : ""} onClick={() => setTool("rectangle")} title="Draw rectangles">Rect</button>
          <button className={tool === "circle" ? "active" : ""} onClick={() => setTool("circle")} title="Draw circles">Circle</button>
          <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")} title="Erase parts">Eraser</button>
        </div>

        <div style={{ width: 1, height: 24, background: '#ccc' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <label>Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={tool === "eraser"}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <label>Size:</label>
          <input
            type="range"
            min="1"
            max="25"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span style={{ minWidth: "30px" }}>{size}px</span>
        </div>

        <div style={{ width: 1, height: 24, background: '#ccc' }} />

        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={handleUndo} title="Undo last action">Undo</button>
          <button onClick={handleRedo} title="Redo last action">Redo</button>
        </div>
      </div>

      {errorMessage && <div style={{ background: '#ffebee', color: '#c62828', padding: 10 }}>{errorMessage}</div>}

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 800,
        aspectRatio: '800 / 500',
        margin: '20px auto',
        border: '2px solid #333',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        backgroundColor: 'white'
      }}>
        <canvas
          ref={bgCanvasRef}
          width={800}
          height={500}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
        />

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

        {Object.values(remoteCursors).map(person => (
          <div key={person.userId} style={{
            position: 'absolute',
            top: `${(person.y / 500) * 100}%`,
            left: `${(person.x / 800) * 100}%`,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: person.color || 'red',
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
              transform: 'translate(-50%, -50%)',
              flexShrink: 0
            }} />
            <span style={{
              fontSize: 10,
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid #ccc',
              whiteSpace: 'nowrap',
              position: 'absolute',
              left: 12,
              top: 4,
              fontWeight: 'bold'
            }}>{person.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
