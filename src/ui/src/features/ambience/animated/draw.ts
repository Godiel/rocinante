import type { Shape } from "./scenes";

/** Puts one shape on the canvas. */
export function draw(context: CanvasRenderingContext2D, shape: Shape): void {
  switch (shape.kind) {
    case "line":
      context.strokeStyle = shape.colour;
      context.lineWidth = shape.width;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(shape.x1, shape.y1);
      context.lineTo(shape.x2, shape.y2);
      context.stroke();
      return;
    case "dot":
      context.fillStyle = shape.colour;
      context.beginPath();
      context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
      context.fill();
      return;
    case "blob":
      context.fillStyle = shape.colour;
      context.beginPath();
      context.ellipse(shape.x, shape.y, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      context.fill();
      return;
    case "glow": {
      const gradient = context.createRadialGradient(
        shape.x,
        shape.y,
        0,
        shape.x,
        shape.y,
        shape.radius,
      );
      gradient.addColorStop(0, shape.inner);
      gradient.addColorStop(1, shape.outer);
      context.fillStyle = gradient;
      context.fillRect(
        shape.x - shape.radius,
        shape.y - shape.radius,
        shape.radius * 2,
        shape.radius * 2,
      );
    }
  }
}
