"use client";

/**
 * Wordmark logo rendered as inline SVG (not via <img>) so hover reaches
 * the individual ring elements.
 *
 * Hover effect — "chain bloom":
 *   Both rings + the weave arc get a soft blurred duplicate layer sitting
 *   directly beneath the crisp base. On hover the bloom fades in and then
 *   breathes — a slow, single-rhythm opacity oscillation that reads as
 *   the chain-link "lighting up." No rotation, no translation, no traveling
 *   segments. Both rings pulse in sync (deliberate, not uncoordinated) so
 *   it looks like one animated object, not two independent spinners.
 *
 * Why not an animated arc: a short traveling stroke on a circle reads as
 * a loading spinner. A static ring with a breathing glow reads as
 * presence / depth / alive.
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
const WEAVE_D = "M 11.78 11.18 A 9 9 0 0 1 15.95 13.25";

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
          {animated && (
            // Soft symmetric bloom for the hover underlay. stdDeviation tuned
            // against the 1.75 base stroke so the glow reads as "halo" not
            // "blurry duplicate."
            <filter id={`bloom-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
          )}
        </defs>

        {/* Bloom underlay — rendered BEFORE the base so the crisp strokes
            always sit on top. Opacity is driven by hover state. */}
        {animated && (
          <g
            className="logo-bloom"
            filter={`url(#bloom-${uid})`}
            fill="none"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            <circle cx={CX1} cy={CY} r={R} stroke={`url(#lg-purple-${uid})`} />
            <circle cx={CX2} cy={CY} r={R} stroke={`url(#lg-teal-${uid})`} />
            <path d={WEAVE_D} stroke={`url(#lg-purple-${uid})`} />
          </g>
        )}

        {/* Base rings + weave — unchanged from public/logo.svg. */}
        <g fill="none" strokeWidth="1.75" strokeLinecap="round">
          <circle cx={CX1} cy={CY} r={R} stroke={`url(#lg-purple-${uid})`} />
          <circle cx={CX2} cy={CY} r={R} stroke={`url(#lg-teal-${uid})`} />
          <path d={WEAVE_D} stroke={`url(#lg-purple-${uid})`} />
        </g>

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
        /* Bloom is invisible until hover. Transition handles both the
           entrance (hover-in) and the exit (hover-out) smoothly. */
        .logo-root :global(.logo-bloom) {
          opacity: 0;
          transition: opacity 420ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* On hover, fade in and hand off to the breathing keyframe. The
           animation-delay matches the transition so the pulse begins only
           after the glow has fully materialized — prevents the "pop to
           mid-opacity" artifact a naive 0%-to-X keyframe would produce. */
        .logo-root:hover :global(.logo-bloom),
        .logo-root:focus-visible :global(.logo-bloom) {
          opacity: 1;
          animation: logoBloom 2.6s ease-in-out 420ms infinite;
        }

        /* Users with reduced-motion get the static halo, no breathing. */
        @media (prefers-reduced-motion: reduce) {
          .logo-root:hover :global(.logo-bloom),
          .logo-root:focus-visible :global(.logo-bloom) {
            animation: none;
            opacity: 0.85;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Single shared rhythm — both rings + weave pulse as one object.
           Peaks at 1 (matches the hover-in fade target) and dips to ~0.45
           so the glow stays present but softens rather than disappearing. */
        @keyframes logoBloom {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </span>
  );
}
