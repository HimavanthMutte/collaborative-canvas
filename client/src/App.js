import { useRef, useEffect, useState } from "react";

export default function App() {
  const canvasRef = useRef(null);

  const [tool, setTool] = useState("pen"); 
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    function MouseDownHandler(e) {
      isDrawing = true;
      startX = e.offsetX;
      startY = e.offsetY;

      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      switch (tool) {
        case "eraser":
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineWidth = size * 2;
        // eslint-disable-next-line
        case "pen":
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          break;
        case "rectangle":
          ctx.strokeStyle = color;
          break;
        case "circle":
          ctx.fillStyle = color;
          break;
        default:
          break;
        }
      }

    function MouseMoveHandler(e) {
      if (!isDrawing) return;

      const x = e.offsetX;
      const y = e.offsetY;

      switch (tool) {
        case "eraser":
        // eslint-disable-next-line
        case "pen":
          ctx.lineTo(x, y);
          ctx.stroke();
          break;

        case "rectangle":
          ctx.fillRect(startX, startY, x - startX, y - startY);
          break;

        case "circle":
          const dx = x - startX;
          const dy = y - startY;
          const radius = Math.sqrt(dx * dx + dy * dy);

          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          break;
      }
    }

    function MouseUpHandler() {
      isDrawing = false;
      ctx.beginPath(); 
      ctx.globalCompositeOperation = "source-over";
    }

    canvas.addEventListener("mousedown", MouseDownHandler);
    canvas.addEventListener("mousemove", MouseMoveHandler);
    canvas.addEventListener("mouseup", MouseUpHandler);
    canvas.addEventListener("mouseleave", MouseUpHandler);

    return () => {
      canvas.removeEventListener("mousedown", MouseDownHandler);
      canvas.removeEventListener("mousemove", MouseMoveHandler);
      canvas.removeEventListener("mouseup", MouseUpHandler);
      canvas.removeEventListener("mouseleave", MouseUpHandler);
    };
  },[tool, color, size]);

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
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          border: "1px solid black",
          cursor: "crosshair"
        }}
      />
    </div>
  );
}
