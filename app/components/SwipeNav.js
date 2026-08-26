'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const TABS = ['/', '/work', '/personal'];
const SWIPE_THRESHOLD = 60;

export default function SwipeNav({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const currentIndex = TABS.indexOf(pathname);
  const isTabbedRoute = currentIndex !== -1;

  function handleTouchStart(e) {
    if (!isTabbedRoute) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setDragging(true);
  }

  function handleTouchMove(e) {
    if (!isTabbedRoute || touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx)) return;
    setDragX(dx);
  }

  function handleTouchEnd() {
    if (!isTabbedRoute) {
      touchStartX.current = null;
      setDragging(false);
      setDragX(0);
      return;
    }
    if (dragX <= -SWIPE_THRESHOLD && currentIndex < TABS.length - 1) {
      router.push(TABS[currentIndex + 1]);
    } else if (dragX >= SWIPE_THRESHOLD && currentIndex > 0) {
      router.push(TABS[currentIndex - 1]);
    }
    touchStartX.current = null;
    setDragging(false);
    setDragX(0);
  }

  return (
    <div
      className="swipe-viewport"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="swipe-track"
        style={{
          transform: `translateX(${dragging ? dragX : 0}px)`,
          transition: dragging ? 'none' : 'transform 0.15s ease',
        }}
      >
        {children}
      </div>
      {isTabbedRoute && (
        <div className="swipe-dots">
          {TABS.map((tab) => (
            <span key={tab} className={`swipe-dot ${tab === pathname ? 'active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
