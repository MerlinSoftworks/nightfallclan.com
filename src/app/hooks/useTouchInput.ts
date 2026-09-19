"use client";

import { useEffect, useState } from "react";

/**
 * Whether the visitor is using a touchscreen, going by their latest pointer input: a finger (or a
 * pen on the screen) turns it on and a mouse or trackpad turns it off, so a laptop with both
 * follows whichever is in use right now. Until the first pointer event it goes by the device's
 * primary pointer, which is coarse on a touchscreen.
 */
export function useTouchInput() {
  // The prerendered page assumes a mouse; the client corrects that on mount, before anything can be pinned.
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const onPointer = (e: PointerEvent) => setTouch(e.pointerType !== "mouse");
    // Capture phase, so nothing that stops an event's propagation can keep it from here.
    const options = { capture: true, passive: true };
    window.addEventListener("pointerdown", onPointer, options);
    window.addEventListener("pointermove", onPointer, options);
    return () => {
      window.removeEventListener("pointerdown", onPointer, options);
      window.removeEventListener("pointermove", onPointer, options);
    };
  }, []);

  return touch;
}
