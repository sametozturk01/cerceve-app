import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LOUPE_DESKTOP_PX = 88;
const LOUPE_TOUCH_PX = 100;
const ZOOM_DESKTOP = 5;
const ZOOM_TOUCH = 4;
const POINTER_GAP = 16;

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}

export default function PreviewMagnifier({ children, previewRef, className = "" }) {
  const rootRef = useRef(null);
  const loupeCanvasRef = useRef(null);
  const [loupe, setLoupe] = useState({ visible: false, x: 0, y: 0 });
  const rafRef = useRef(0);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const coarsePointer = useCoarsePointer();

  const loupePx = coarsePointer ? LOUPE_TOUCH_PX : LOUPE_DESKTOP_PX;
  const zoom = coarsePointer ? ZOOM_TOUCH : ZOOM_DESKTOP;

  const hideLoupe = useCallback(() => {
    setLoupe((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const paintLoupe = useCallback((clientX, clientY) => {
    const loupeCanvas = loupeCanvasRef.current;
    if (!loupeCanvas) return;

    const painted = previewRef?.current?.paintLoupe?.(loupeCanvas, loupePx, zoom, clientX, clientY);
    if (!painted) {
      hideLoupe();
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = Math.max(12, coarsePointer ? 16 : 12);

    let x = clientX + POINTER_GAP;
    let y = clientY - loupePx - POINTER_GAP;

    if (x + loupePx + pad > vw) {
      x = clientX - loupePx - POINTER_GAP;
    }
    if (y < pad) {
      y = clientY + POINTER_GAP;
    }
    if (y + loupePx + pad > vh) {
      y = vh - loupePx - pad;
    }
    x = Math.max(pad, Math.min(vw - loupePx - pad, x));

    setLoupe({ visible: true, x, y });
  }, [previewRef, hideLoupe, loupePx, zoom, coarsePointer]);

  const schedulePaint = useCallback((clientX, clientY) => {
    lastPointRef.current = { x: clientX, y: clientY };
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      const { x, y } = lastPointRef.current;
      paintLoupe(x, y);
    });
  }, [paintLoupe]);

  const handleMouseMove = (event) => {
    schedulePaint(event.clientX, event.clientY);
  };

  const handleMouseLeave = () => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    hideLoupe();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      const t = event.touches[0];
      schedulePaint(t.clientX, t.clientY);
    };

    const onTouchMove = (event) => {
      if (event.touches.length !== 1) return;
      event.preventDefault();
      const t = event.touches[0];
      schedulePaint(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      hideLoupe();
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [schedulePaint, hideLoupe]);

  useEffect(() => () => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
  }, []);

  const loupePortal = createPortal(
    <div
      className={`fp-preview-loupe-portal${loupe.visible ? " is-visible" : ""}`}
      style={{ left: loupe.x, top: loupe.y, width: loupePx, height: loupePx }}
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
