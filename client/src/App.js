import { useRef, useEffect, useState, useCallback } from "react";
import { socket } from "./socket";
import "./App.css";

export default function App() {
  // --- My State Variables ---
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [roomId, setRoomId] = useState("room1");
  const [username, setUsername] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isServerOnline, setIsServerOnline] = useState(true);

  const [currentDrawingTool, setCurrentDrawingTool] = useState("pen"); // tool can be pen, rect, circle, or eraser
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [brushThickness, setBrushThickness] = useState(3);

  // This is where we can store everything drawn on the canvas so far
  const [globalDrawingHistory, setGlobalDrawingHistory] = useState([]);

  // We use this to keep track of what weve already painted on the background canvas
  const lastRenderedActionIndex = useRef(0);

  const [otherUserCursors, setOtherUserCursors] = useState({});
  const liveDrawingPathsFromOthers = useRef({});

  // If the internet disconnects, we can keep our drawings here and send them later
  const offlineDrawingQueue = useRef([]);

  // These are references to our two canvas elements
  const backgroundCanvasRef = useRef(null);
  const foregroundCanvasRef = useRef(null);
  const backgroundContext = useRef(null);
  const foregroundContext = useRef(null);

  // These help us track if we are currently clicking and moving the mouse
  const amIDrawingNow = useRef(false);
  const myCurrentPathPoints = useRef([]);
  const timeOfLastCursorSend = useRef(0);
  const startingClickPosition = useRef({ x: 0, y: 0 });

  // This runs when we join the room to setup the canvas contexts
  useEffect(() => {
    if (hasJoinedRoom && backgroundCanvasRef.current && foregroundCanvasRef.current) {
      try {
        backgroundContext.current = backgroundCanvasRef.current.getContext("2d");
        foregroundContext.current = foregroundCanvasRef.current.getContext("2d");

        // Set the background  to white initially
        backgroundContext.current.fillStyle = "white";
        backgroundContext.current.fillRect(0, 0, 800, 500);
      } catch (err) {
        setErrorMessage("Something went wrong with the canvas. Try refreshing!");
      }
    }
  }, [hasJoinedRoom]);

  // A helper function to draw a single shape or path onto a canvas
  const performDrawAction = useCallback((ctx, data) => {
    if (!ctx || !data) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = data.width;

    // If it's the eraser, we just use white color to "hide" what's underneath
    ctx.strokeStyle = data.tool === "eraser" ? "white" : data.color;
    ctx.fillStyle = data.tool === "eraser" ? "white" : data.color;

    if (data.type === "path") {
      if (data.points && data.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(data.points[0].x, data.points[0].y);
        for (let i = 1; i < data.points.length; i++) {
          ctx.lineTo(data.points[i].x, data.points[i].y);
        }
        ctx.stroke();
      }
    } else if (data.type === "rectangle") {
      ctx.strokeRect(data.start.x, data.start.y, data.end.x - data.start.x, data.end.y - data.start.y);
    } else if (data.type === "circle") {
      const radius = Math.sqrt(Math.pow(data.end.x - data.start.x, 2) + Math.pow(data.end.y - data.start.y, 2));
      ctx.beginPath();
      ctx.arc(data.start.x, data.start.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // I use this function to clear and redraw the 'preview' layer (foreground)
  const refreshOverlayCanvas = useCallback(() => {
    if (!foregroundContext.current) return;
    const ctx = foregroundContext.current;

    // Clear everything first
    ctx.clearRect(0, 0, 800, 500);

    // Draw what other people are currently drawing (but haven't finished yet)
    Object.values(liveDrawingPathsFromOthers.current).forEach(path => {
      performDrawAction(ctx, path);
    });

    // Draw what we are currently drawing right now
    if (amIDrawingNow.current) {
      const myLiveAction = {
        type: (currentDrawingTool === "pen" || currentDrawingTool === "eraser") ? "path" : currentDrawingTool,
        points: myCurrentPathPoints.current,
        start: startingClickPosition.current,
        end: myCurrentPathPoints.current[myCurrentPathPoints.current.length - 1],
        color: currentDrawingTool === "eraser" ? "white" : selectedColor,
        width: brushThickness,
        tool: currentDrawingTool
      };
      performDrawAction(ctx, myLiveAction);
    }
  }, [currentDrawingTool, selectedColor, brushThickness, performDrawAction]);

  // I need this ref so the socket listeners can call the latest version of refreshOverlayCanvas
  const refreshOverlayRef = useRef(null);
  refreshOverlayRef.current = refreshOverlayCanvas;

  // Setting up all the socket listeners when the component mounts
  useEffect(() => {
    socket.on("connect", () => {
      setIsServerOnline(true);
      setErrorMessage("");

      // If I had drawings saved while the internet was down, Let's send them now
      if (offlineDrawingQueue.current.length > 0) {
        offlineDrawingQueue.current.forEach(op => socket.emit("draw_op", op));
        offlineDrawingQueue.current = [];
      }
    });

    socket.on("disconnect", () => {
      setIsServerOnline(false);
    });

    socket.on("connect_error", () => {
      setIsServerOnline(false);
      setErrorMessage("Lost connection to server. Hang on...");
    });

    // The server sends the whole history when we join
    socket.on("init_state", (historyFromServer) => {
      setGlobalDrawingHistory(historyFromServer);
      lastRenderedActionIndex.current = 0; // Force a full redraw
    });

    // Someone finished a drawing!
    socket.on("new_op", (newShape) => {
      setGlobalDrawingHistory((prev) => [...prev, newShape]);

      // Since it's finished, Let's remove it from the "live" preview map
      delete liveDrawingPathsFromOthers.current[newShape.userId];
      if (refreshOverlayRef.current) refreshOverlayRef.current();
    });

    // Someone clicked undo
    socket.on("undo_op", (shapeIdToRemove) => {
      setGlobalDrawingHistory((prev) => {
        const updatedHistory = prev.filter(item => item.id !== shapeIdToRemove);
        lastRenderedActionIndex.current = 0; // Full redraw needed since an item in the middle might be gone
        return updatedHistory;
      });
    });

    // Updates for the user list in the top right
    socket.on("user_update", (newUsersList) => {
      setOnlineUsers(newUsersList);

      // Clean up cursors for people who left
      const activeUserIds = newUsersList.map(u => u.id || u.userId);
      setOtherUserCursors(prevCursors => {
        const cleanedCursors = { ...prevCursors };
        Object.keys(cleanedCursors).forEach(id => {
          if (!activeUserIds.includes(id)) delete cleanedCursors[id];
        });
        return cleanedCursors;
      });
    });

    // Movement for other people's cursors
    socket.on("cursor_update", (cursorData) => {
      setOtherUserCursors(prev => ({
        ...prev,
        [cursorData.userId]: cursorData
      }));
    });

    // Live drawing "steps" from other users
    socket.on("draw_step", (intermediateData) => {
      liveDrawingPathsFromOthers.current[intermediateData.userId] = {
        type: intermediateData.type,
        start: intermediateData.start,
        end: intermediateData.end,
        points: intermediateData.points,
        color: intermediateData.color,
        width: intermediateData.width,
        tool: intermediateData.tool
      };
      if (refreshOverlayRef.current) refreshOverlayRef.current();
    });

    // Cleaning up my listeners when I leave the page
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

  // Use this effect to draw persistent shapes onto the background canvas
  useEffect(() => {
    if (!backgroundContext.current) return;
    const ctx = backgroundContext.current;

    // If we need a full redraw
    if (lastRenderedActionIndex.current === 0) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 800, 500);
      globalDrawingHistory.forEach((shape) => performDrawAction(ctx, shape));
      lastRenderedActionIndex.current = globalDrawingHistory.length;
    } else {
      // Just draw the new shapes that were added
      for (let i = lastRenderedActionIndex.current; i < globalDrawingHistory.length; i++) {
        performDrawAction(ctx, globalDrawingHistory[i]);
      }
      lastRenderedActionIndex.current = globalDrawingHistory.length;
    }
  }, [globalDrawingHistory, performDrawAction]);

  // Function for the 'Join Room' button
  const handleJoinRoom = () => {
    if (!username.trim()) {
      setErrorMessage("Please type a username first!");
      return;
    }
    if (!roomId.trim()) {
      setErrorMessage("Please type a room ID!");
      return;
    }

    try {
      socket.connect();
      socket.emit("join_room", { username, roomId });
      setHasJoinedRoom(true);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage("Couldn't join. Is the server running?");
    }
  };

  // Helper to get mouse position relative to the canvas
  const calculateMouseCoords = (event) => {
    const canvas = foregroundCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const area = canvas.getBoundingClientRect();
    const ratioX = canvas.width / area.width;
    const ratioY = canvas.height / area.height;

    return {
      x: (event.clientX - area.left) * ratioX,
      y: (event.clientY - area.top) * ratioY
    };
  };

  const handleMouseDown = (e) => {
    const mousePos = calculateMouseCoords(e);
    amIDrawingNow.current = true;
    startingClickPosition.current = mousePos;
    myCurrentPathPoints.current = [mousePos];
    refreshOverlayCanvas();
  };

  const handleMouseMove = (e) => {
    const mousePos = calculateMouseCoords(e);

    // Send the cursor position to the server, but not TOO often (throttling)
    const currentTime = Date.now();
    if (currentTime - timeOfLastCursorSend.current > 50) {
      try {
        socket.emit("cursor_move", { x: mousePos.x, y: mousePos.y });
        timeOfLastCursorSend.current = currentTime;
      } catch (err) { }
    }

    if (!amIDrawingNow.current) return;

    myCurrentPathPoints.current.push(mousePos);

    // Tell the server about my "in-progress" drawing
    try {
      socket.emit("draw_step", {
        type: (currentDrawingTool === "pen" || currentDrawingTool === "eraser") ? "path" : currentDrawingTool,
        start: startingClickPosition.current,
        end: mousePos,
        points: myCurrentPathPoints.current,
        color: currentDrawingTool === "eraser" ? "white" : selectedColor,
        width: brushThickness,
        tool: currentDrawingTool
      });
    } catch (err) { }

    refreshOverlayCanvas();
  };

  const handleMouseUp = (e) => {
    if (!amIDrawingNow.current) return;
    amIDrawingNow.current = false;

    const mousePos = calculateMouseCoords(e);

    // Create the final shape object
    const finalizedAction = {
      type: (currentDrawingTool === "pen" || currentDrawingTool === "eraser") ? "path" : currentDrawingTool,
      points: [...myCurrentPathPoints.current],
      start: startingClickPosition.current,
      end: mousePos,
      color: selectedColor,
      width: brushThickness,
      tool: currentDrawingTool
    };

    // Send it to the server!
    if (socket.connected) {
      try {
        socket.emit("draw_op", finalizedAction);
      } catch (err) {
        offlineDrawingQueue.current.push(finalizedAction);
      }
    } else {
      offlineDrawingQueue.current.push(finalizedAction);
    }

    refreshOverlayCanvas();
  };

  const triggerUndo = () => {
    socket.emit("undo");
  };

  const triggerRedo = () => {
    socket.emit("redo");
  };

  // --- JSX for Login Screen ---
  if (!hasJoinedRoom) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Arial' }}>
        <h1 style={{ color: '#333' }}>My Shared Canvas</h1>
        <p>A fun project I made to draw with friends!</p>

        {errorMessage && <div style={{ color: 'red', marginBottom: '15px' }}>{errorMessage}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <input
            placeholder="What should I call you?"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ padding: '10px', width: '250px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <input
            placeholder="Room Name"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            style={{ padding: '10px', width: '250px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button
            onClick={handleJoinRoom}
            style={{ padding: '10px 20px', width: '272px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            START DRAWING
          </button>
        </div>
      </div>
    );
  }

  // --- JSX for Main Drawing App ---
  return (
    <div className="App">
      <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#343a40', color: 'white' }}>
        <div>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Room: {roomId}</span>
          <span style={{ marginLeft: '15px', fontSize: '12px', color: isServerOnline ? '#2ecc71' : '#e74c3c' }}>
            {isServerOnline ? "√ Connected" : "× Reconecting..."}
          </span>
        </div>
        <div style={{ fontSize: '13px' }}>
          Artists Online: {onlineUsers.map(u => u.username).join(', ')}
        </div>
      </div>

      <div className="toolbar" style={{ padding: '10px', background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button className={currentDrawingTool === "pen" ? "active" : ""} onClick={() => setCurrentDrawingTool("pen")}>Pen</button>
          <button className={currentDrawingTool === "rectangle" ? "active" : ""} onClick={() => setCurrentDrawingTool("rectangle")}>Rect</button>
          <button className={currentDrawingTool === "circle" ? "active" : ""} onClick={() => setCurrentDrawingTool("circle")}>Circle</button>
          <button className={currentDrawingTool === "eraser" ? "active" : ""} onClick={() => setCurrentDrawingTool("eraser")}>Eraser</button>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#ccc' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label>Color:</label>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            disabled={currentDrawingTool === "eraser"}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label>Size:</label>
          <input
            type="range"
            min="1"
            max="25"
            value={brushThickness}
            onChange={(e) => setBrushThickness(Number(e.target.value))}
          />
          <span>{brushThickness}px</span>
        </div>

        <div style={{ width: '1px', height: '20px', background: '#ccc' }} />

        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={triggerUndo}>Undo</button>
          <button onClick={triggerRedo}>Redo</button>
        </div>
      </div>

      {errorMessage && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px' }}>{errorMessage}</div>}

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '800 / 500',
        margin: '30px auto',
        border: '5px solid #222',
        background: 'white',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        cursor: 'crosshair'
      }}>
        {/* Background Layer: For finished drawings */}
        <canvas
          ref={backgroundCanvasRef}
          width={800}
          height={500}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
        />

        {/* Foreground Layer: For cursors and active drawing preview */}
        <canvas
          ref={foregroundCanvasRef}
          width={800}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}
        />

        {/* Floating User Cursors */}
        {Object.values(otherUserCursors).map(person => (
          <div key={person.userId} style={{
            position: 'absolute',
            top: `${(person.y / 500) * 100}%`,
            left: `${(person.x / 800) * 100}%`,
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              background: person.color || 'red',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 5px rgba(0,0,0,0.5)',
              transform: 'translate(-50%, -50%)'
            }} />
            <div style={{
              position: 'absolute',
              left: '10px',
              top: '5px',
              background: 'white',
              padding: '2px 5px',
              fontSize: '10px',
              border: '1px solid #333',
              borderRadius: '3px',
              whiteSpace: 'nowrap'
            }}>
              {person.username}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
