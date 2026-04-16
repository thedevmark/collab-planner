"use client";

/**
 * Wordmark logo rendered as inline SVG (not via <img>) so hover reaches
 * the individual ring elements.
 *
 * Hover effect: a thin accent arc travels around each ring's circumference
 * — purely a stroke-dashoffset animation, no x/y translation. The two rings
 * rotate in opposite directions so the chain-link weave illusion holds
 * (the intersection points and weave overlay stay exactly put).
 *
 * Visual rationale: rotating a solid circle is invisible on its own. We
 * leave the base circles untouched and fade in a thin bright arc on hover
 * whose stroke-dashoffset animates forever — reads as "spin" without
 * disturbing the idle silhouette.
 *
 * Keep public/logo.svg in sync with this component — it's still loaded
 * directly in a few static routes (terms, privacy, OG previews).
 */

type LogoProps = {
  /** Render width in CSS px. Height scales to match the 72:40 viewBox. */
  width?: number;
  height?: number;
  className?: string;
  /** Pass false to render the idle version with no hover animation (e.g. in non-interactive contexts). */
  animated?: boolean;
};

// Ring geometry — must match public/logo.svg.
const CX1 = 10;
const CX2 = 18;
const CY = 20;
const R = 9;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 56.549

export function Logo({
  width = 144,
  height = 80,
  className,
  animated = true,
}: LogoProps) {
  const uid = animated ? "int" : "static";

  return (
    <span
      className={`logo-root inline-block ${className ?? ""}`}
      data-animated={animated ? "true" : undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 72 40"
        width={width}
        height={height}
        fill="none"
        aria-label="Collab Planner"
      >
        <defs>
          <linearGradient id={`lg-purple-${uid}`} x1="0" y1="11" x2="0" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id={`lg-teal-${uid}`} x1="0" y1="11" x2="0" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <filter id={`text-shadow-${uid}`} x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.4" floodColor="#000000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* Base rings + weave — unchanged from public/logo.svg. */}
        <g fill="none" strokeWidth="1.75" strokeLinecap="round">
          <circle cx={CX1} cy={CY} r={R} stroke={`url(#lg-purple-${uid})`} />
          <circle cx={CX2} cy={CY} r={R} stroke={`url(#lg-teal-${uid})`} />
          <path d="M 11.78 11.18 A 9 9 0 0 1 15.95 13.25" stroke={`url(#lg-purple-${uid})`} />
        </g>

        {/* Hover-only accent arcs. Same center/radius as base rings so they
            sit exactly on top. stroke-dasharray leaves ~20% visible; the
            dashoffset animation travels that segment around the ring. */}
        {animated && (
          <g fill="none" strokeWidth="1.5" strokeLinecap="round" className="logo-spin-layer">
            <circle
              cx={CX1}
              cy={CY}
              r={R}
              stroke="#e9d5ff"
              className="logo-spin logo-spin-cw"
            />
            <circle
              cx={CX2}
              cy={CY}
              r={R}
              stroke="#99f6e4"
              className="logo-spin logo-spin-ccw"
            />
          </g>
        )}

        {/* Wordmark */}
        <g
          fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          fill="#ffffff"
          filter={`url(#text-shadow-${uid})`}
        >
          <text x="33" y="19" fontSize="10.5" fontWeight="600" letterSpacing="0.35">
            Collab
          </text>
          <text x="33" y="32" fontSize="10.5" fontWeight="600" letterSpacing="-0.2">
            Planner
          </text>
        </g>
      </svg>

      <style jsx>{`
        .logo-root :global(.logo-spin) {
          stroke-dasharray: ${CIRCUMFERENCE * 0.22} ${CIRCUMFERENCE * 2};
          stroke-dashoffset: 0;
          opacity: 0;
          transition: opacity 320ms ease;
        }

        .logo-root:hover :global(.logo-spin),
        .logo-root:focus-visible :global(.logo-spin) {
          opacity: 0.85;
        }

        .logo-root:hover :global(.logo-spin-cw) {
          animation: logoSpinCW 2.8s linear infinite;
        }
        .logo-root:hover :global(.logo-spin-ccw) {
          animation: logoSpinCCW 2.8s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-root:hover :global(.logo-spin-cw),
          .logo-root:hover :global(.logo-spin-ccw) {
            animation: none;
          }
        }
      `}</style>

      <style jsx global>{`
        @keyframes logoSpinCW {
          to {
            stroke-dashoffset: ${-CIRCUMFERENCE};
          }
        }
        @keyframes logoSpinCCW {
          to {
            stroke-dashoffset: ${CIRCUMFERENCE};
          }
        }
      `}</style>
    </span>
  );
}
