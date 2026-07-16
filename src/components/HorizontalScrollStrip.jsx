import { useCallback, useEffect, useRef, useState } from "react";

export default function HorizontalScrollStrip({
  children,
  className = "",
  trackClassName = "",
  ariaLabel,
}) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    updateScrollState();

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, children]);

  const scrollBy = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(120, el.clientWidth * 0.65),
      behavior: "smooth",
    });
  };

  const rootClass = ["fp-hscroll", className].filter(Boolean).join(" ");
  const trackClass = ["fp-hscroll-track", trackClassName].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      {canScrollLeft && (
        <button
          type="button"
          className="fp-hscroll-btn fp-hscroll-btn-left"
          aria-label="Sola kaydır"
          onClick={() => scrollBy(-1)}
        >
          ‹
        </button>
      )}

      <div
        className={`fp-hscroll-fade fp-hscroll-fade-left${canScrollLeft ? " visible" : ""}`}
        aria-hidden="true"
      />

      <div
        ref={trackRef}
        className={trackClass}
        role="region"
        aria-label={ariaLabel}
      >
        {children}
      </div>

      <div
        className={`fp-hscroll-fade fp-hscroll-fade-right${canScrollRight ? " visible" : ""}`}
        aria-hidden="true"
      />

      {canScrollRight && (
        <button
          type="button"
          className="fp-hscroll-btn fp-hscroll-btn-right"
          aria-label="Sağa kaydır"
          onClick={() => scrollBy(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}
