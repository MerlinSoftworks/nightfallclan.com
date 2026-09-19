import { useId } from "react";

/**
 * A push pin that can be struck through. The slash (`[data-slash]`) and the gap it cuts in the
 * pin (`[data-slash-gap]`, a mask) both start fully retracted along the diagonal; a stylesheet
 * eases their `stroke-dashoffset` to 0 to draw them in, e.g. while an unpin button is hovered.
 */
export default function PinIcon({ className }: { className?: string }) {
  const maskId = `pin-slash-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="#fff" />
        <path
          d="M2 2 22 22"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray="29 60"
          strokeDashoffset="32"
          data-slash-gap=""
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <line x1="12" x2="12" y1="17" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </g>
      <path d="M2 2 22 22" strokeDasharray="29 60" strokeDashoffset="32" data-slash="" />
    </svg>
  );
}
