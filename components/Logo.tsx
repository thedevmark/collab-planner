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
          fill="currentColor"
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
        /* Asymmetric transitions — the defaults here govern the HOVER-OUT
           path (longer, standard ease-out) so the glow + bounce release
           gently. The :hover rules below override with faster, spring-eased
           values for a snappier, tactile entrance. */
        .logo-root {
          display: inline-block;
          transform: translateZ(0); /* promote to own layer — smoother scale */
          transition: transform 620ms cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
        }

        /* Ambient breath — the bloom is always faintly present at idle,
           breathing slowly so the rings read as alive rather than static.
           Hover lifts the bloom to full strength with a faster pulse. */
        .logo-root :global(.logo-bloom) {
          opacity: 0.35;
          animation: logoBloomIdle 5.6s ease-in-out infinite;
          transition: opacity 620ms cubic-bezier(0.4, 0, 0.2, 1),
                      animation-duration 380ms ease;
        }

        /* Hover IN — spring easing on scale gives a subtle overshoot bounce
           (~1.5% scale). Bloom fades up faster on hover so the halo is
           already present as the bounce settles. */
        .logo-root:hover,
        .logo-root:focus-visible {
          transform: scale(1.018);
          transition: transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .logo-root:hover :global(.logo-bloom),
        .logo-root:focus-visible :global(.logo-bloom) {
          opacity: 1;
          transition: opacity 380ms cubic-bezier(0.4, 0, 0.2, 1);
          animation: logoBloomActive 2.6s ease-in-out infinite;
        }

        /* Users with reduced-motion get the static halo and no scale. */
        @media (prefers-reduced-motion: reduce) {
          .logo-root,
          .logo-root:hover,
          .logo-root:focus-visible {
            transform: none;
            transition: none;
          }
          .logo-root :global(.logo-bloom),
          .logo-root:hover :global(.logo-bloom),
          .logo-root:focus-visible :global(.logo-bloom) {
            animation: none;
            opacity: 0.55;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Idle — slow, low-amplitude breath. Reads as ambient presence,
           not as a distracting pulse. */
        @keyframes logoBloomIdle {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.55; }
        }
        /* Active (hover) — same single shared rhythm as before. Both rings
           + weave pulse as one object, peaks at 1, dips to ~0.45. */
        @keyframes logoBloomActive {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </span>
  );
}
