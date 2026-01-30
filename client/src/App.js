import { useRef, useEffect, useState } from "react";

export default function App() {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  const historyRef = useRef([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    saveHistory(canvas);

  }, []);

  const saveHistory = (canvas) => {
    const dataUrl = canvas.toDataURL();

    const newHistory = historyRef.current.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    historyRef.current = newHistory;
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = historyRef.current[newStep];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const redo = () => {
    if (historyStep < historyRef.current.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = historyRef.current[newStep];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let snapshot = null;



    const MouseDownHandler = (e) => {
      isDrawing = true;
      startX = e.offsetX;
      startY = e.offsetY;

      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.fillStyle = color;
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

      switch (tool) {
        case "eraser":
          ctx.strokeStyle = "white";
          ctx.lineWidth = size * 2;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          break;
        case "pen":
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          break;
        default:
          break;
      }
    };

    const MouseMoveHandler = (e) => {
      if (!isDrawing) return;

      const x = e.offsetX;
      const y = e.offsetY;

      switch (tool) {
        case "eraser":
        case "pen":
          ctx.lineTo(x, y);
          ctx.stroke();
          break;

        case "rectangle":
          if (snapshot) ctx.putImageData(snapshot, 0, 0);
          ctx.beginPath();
          ctx.strokeRect(startX, startY, x - startX, y - startY);
          break;

        case "circle":
          if (snapshot) ctx.putImageData(snapshot, 0, 0);
          const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          break;
      }
    };

    const MouseUpHandler = () => {
      if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
        saveHistory(canvas);
      }
    };

    const MouseLeaveHandler = () => {
      if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
        saveHistory(canvas);
      }
    }

    canvas.addEventListener("mousedown", MouseDownHandler);
    canvas.addEventListener("mousemove", MouseMoveHandler);
    canvas.addEventListener("mouseup", MouseUpHandler);
    canvas.addEventListener("mouseleave", MouseLeaveHandler);

    return () => {
      canvas.removeEventListener("mousedown", MouseDownHandler);
      canvas.removeEventListener("mousemove", MouseMoveHandler);
      canvas.removeEventListener("mouseup", MouseUpHandler);
      canvas.removeEventListener("mouseleave", MouseLeaveHandler);
    };
    // eslint-disable-next-line
  }, [tool, color, size, historyStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === "pen") {
      canvas.style.cursor = `url('/cursors/pen.png') 0 24, auto`;
    } else if (tool === "eraser") {
      canvas.style.cursor = `url('/cursors/eraser.png') 0 24, auto`;
    } else {
      canvas.style.cursor = "crosshair";
    }
  }, [tool]);

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
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

        <button onClick={undo} style={{ marginLeft: 20 }}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          border: "1px solid black"
        }}
      />
    </div>
  );
}
