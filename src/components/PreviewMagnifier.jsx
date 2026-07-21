import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LOUPE_PX = 88;
const ZOOM = 5;
const POINTER_GAP = 16;

export default function PreviewMagnifier({ children, previewRef, className = "" }) {
  const rootRef = useRef(null);
  const loupeCanvasRef = useRef(null);
  const [loupe, setLoupe] = useState({ visible: false, x: 0, y: 0 });
  const rafRef = useRef(0);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const hideLoupe = useCallback(() => {
    setLoupe((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const paintLoupe = useCallback((clientX, clientY) => {
    const loupeCanvas = loupeCanvasRef.current;
    if (!loupeCanvas) return;

    const painted = previewRef?.current?.paintLoupe?.(loupeCanvas, LOUPE_PX, ZOOM, clientX, clientY);
    if (!painted) {
      hideLoupe();
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;

    let x = clientX + POINTER_GAP;
    let y = clientY - LOUPE_PX - POINTER_GAP;

    if (x + LOUPE_PX + pad > vw) {
      x = clientX - LOUPE_PX - POINTER_GAP;
    }
    if (y < pad) {
      y = clientY + POINTER_GAP;
    }
    if (y + LOUPE_PX + pad > vh) {
      y = vh - LOUPE_PX - pad;
    }
    x = Math.max(pad, Math.min(vw - LOUPE_PX - pad, x));

    setLoupe({ visible: true, x, y });
  }, [previewRef, hideLoupe]);

  const handleMouseMove = (event) => {
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      const { x, y } = lastPointRef.current;
      paintLoupe(x, y);
    });
  };

  const handleMouseLeave = () => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    hideLoupe();
  };

  useEffect(() => () => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
  }, []);

  const loupePortal = createPortal(
    <div
      className={`fp-preview-loupe-portal${loupe.visible ? " is-visible" : ""}`}
      style={{ left: loupe.x, top: loupe.y, width: LOUPE_PX, height: LOUPE_PX }}
      aria-hidden
    >
      <canvas ref={loupeCanvasRef} className="fp-preview-loupe-canvas" />
    </div>,
    document.body,
  );

  return (
    <div
      ref={rootRef}
      className={`fp-preview-magnifier ${className}`.trim()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {loupePortal}
    </div>
  );
}
