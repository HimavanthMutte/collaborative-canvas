import { useRef, useEffect, useState } from "react";

export default function App() {
  const canvasRef = useRef(null);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    let isDrawing = false;

    function onMouseDown(e) {
      isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
      ctx.lineWidth = size;
    }

    function onMouseMove(e) {
      if (!isDrawing) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }

    function onMouseUp() {
      isDrawing = false;
      ctx.beginPath();
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    };
  }, [color,size]); 

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <span style={{ marginLeft: 10 }}>{color}</span>
      </div>
      {["#000000", "#ff0000", "#00ff00", "#0000ff"].map(c => (
      <button
        key={c}
        onClick={() => setColor(c)}
        style={{
          background: c,
          width: 24,
          height: 24,
          marginRight: 5,
          border: c === color ? "2px solid black" : "1px solid #ccc"
        }}
      />
    ))}
      <input type="range" min="1" max="10" value={size} onChange={e=>setSize(e.target.value)}/>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{ border: "1px solid black", cursor: "crosshair" }}
      />
    </div>
  );
}
