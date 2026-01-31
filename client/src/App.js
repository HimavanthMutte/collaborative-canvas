import { useRef, useEffect, useState, useCallback } from "react";
import { socket } from "./socket";
import "./App.css";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("room1");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);

  const canvasRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);

  const [history, setHistory] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [activePaths, setActivePaths] = useState({});

  const isDrawing = useRef(false);
  const currentPath = useRef([]);
  const lastCursorEmit = useRef(0);
  const startPoint = useRef({ x: 0, y: 0 });

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected");
    });

    socket.on("init_state", (serverHistory) => {
      setHistory(serverHistory);
    });

    socket.on("new_op", (op) => {
      setHistory((prev) => [...prev, op]);
      setActivePaths((prev) => {
        const next = { ...prev };
        delete next[op.userId];
        return next;
      });
    });

    socket.on("undo_op", (opId) => {
      setHistory((prev) => prev.filter(op => op.id !== opId));
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
      if (data.type === "path") {
        setActivePaths(prev => {
          const userPath = prev[data.userId] || { points: [data.start] };
          return {
            ...prev,
            [data.userId]: {
              ...userPath,
              points: [...userPath.points, data.end],
              color: data.color,
              width: data.width
            }
          };
        });
      }
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

  const drawOperation = useCallback((ctx, op) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = op.width;
    ctx.strokeStyle = op.color;
    ctx.fillStyle = op.color;

    if (op.tool === "eraser") {
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
    }

    if (op.type === "path") {
      if (op.points.length > 0) {
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

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    history.forEach((op) => {
      drawOperation(ctx, op);
    });

    Object.values(activePaths).forEach(path => {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = path.width;
      ctx.strokeStyle = path.color;
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    });

    if (isDrawing.current && (tool === "pen" || tool === "eraser") && currentPath.current.length > 0) {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = tool === "eraser" ? "white" : color;
      ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
      for (let i = 1; i < currentPath.current.length; i++) {
        ctx.lineTo(currentPath.current[i].x, currentPath.current[i].y);
      }
      ctx.stroke();
    }
  }, [history, activePaths, tool, color, size, drawOperation]);

  const handleJoin = () => {
    if (username && roomId) {
      socket.connect();
      socket.emit("join_room", { username, roomId });
      setJoined(true);
    }
  };

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
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

    if (tool === "pen" || tool === "eraser") {
      currentPath.current = [coords];
    }
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

    if (tool === "pen" || tool === "eraser") {
      const lastPoint = currentPath.current[currentPath.current.length - 1];
      currentPath.current.push(coords);

      const ctx = canvasRef.current.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = tool === "eraser" ? "white" : color;

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      socket.emit("draw_step", {
        type: "path",
        start: lastPoint,
        end: coords,
        color: tool === "eraser" ? "white" : color,
        width: size
      });

    } else if (tool === "rectangle" || tool === "circle") {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      history.forEach(op => drawOperation(ctx, op));

      ctx.lineWidth = size;
      ctx.strokeStyle = color;

      if (tool === "rectangle") {
        ctx.strokeRect(startPoint.current.x, startPoint.current.y, x - startPoint.current.x, y - startPoint.current.y);
      } else if (tool === "circle") {
        const radius = Math.sqrt(Math.pow(x - startPoint.current.x, 2) + Math.pow(y - startPoint.current.y, 2));
        ctx.beginPath();
        ctx.arc(startPoint.current.x, startPoint.current.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const coords = getCanvasCoordinates(e);
    let op = null;

    if (tool === "pen" || tool === "eraser") {
      if (currentPath.current.length > 0) {
        op = {
          type: "path",
          points: [...currentPath.current],
          color: color,
          width: size,
          tool: tool
        };
      }
    } else if (tool === "rectangle") {
      op = {
        type: "rectangle",
        start: startPoint.current,
        end: coords,
        color: color,
        width: size,
        tool: tool
      };
    } else if (tool === "circle") {
      op = {
        type: "circle",
        start: startPoint.current,
        end: coords,
        color: color,
        width: size,
        tool: tool
      };
    }

    if (op) {
      socket.emit("draw_op", op);
    }
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
        <h3>Room: {roomId}</h3>
        <div>Users: {users.map(u => u.username).join(', ')}</div>
      </div>

      <div className="toolbar" style={{ marginBottom: 10 }}>
        <button onClick={() => setTool("pen")}>Pen</button>
        <button onClick={() => setTool("rectangle")}>Rectangle</button>
        <button onClick={() => setTool("circle")}>Circle</button>
        <button onClick={() => setTool("eraser")}>Eraser</button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ marginLeft: 10 }}
        />

        <input
          type="range"
          min="1"
          max="20"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ marginLeft: 10 }}
        />
        <span>{size}px</span>

        <button onClick={handleUndo} style={{ marginLeft: 20 }}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
      </div>

      <div style={{ position: 'relative', width: 800, height: 500, margin: '0 auto', border: '1px solid black' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: 'crosshair', display: 'block' }}
        />

        {Object.values(remoteCursors).map(cursor => (
          <div key={cursor.userId} style={{
            position: 'absolute',
            top: cursor.y,
            left: cursor.x,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: cursor.color || 'red'
            }} />
            <span style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.7)', padding: 2 }}>{cursor.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
