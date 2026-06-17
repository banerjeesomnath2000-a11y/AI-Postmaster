import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  textSize?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "gradient";
}

export default function Logo({
  className = "h-16 w-16",
  showText = true,
  textSize = "md",
  variant = "gradient"
}: LogoProps) {
  // Setup font sizing classes
  const sizeClasses = {
    sm: "text-base tracking-wider",
    md: "text-2xl tracking-widest",
    lg: "text-4xl tracking-widest",
    xl: "text-5xl tracking-widest"
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* SVG Vector Graphic representing the AI Postmaster logo */}
      <svg
        id="ai-postmaster-logo-vector"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-w-full drop-shadow-sm select-none"
      >
        <defs>
          {/* Main Circuit Stream Gradient (Purple to Gold-Orange) */}
          <linearGradient id="streamGrad" x1="140" y1="200" x2="330" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4A1E63" />
            <stop offset="35%" stopColor="#8A2576" />
            <stop offset="70%" stopColor="#D55E2B" />
            <stop offset="100%" stopColor="#E6A125" />
          </linearGradient>

          {/* Top Branch Gradient */}
          <linearGradient id="topBranchGrad" x1="160" y1="200" x2="260" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4A1E63" />
            <stop offset="50%" stopColor="#AA356E" />
            <stop offset="100%" stopColor="#DB6D2C" />
          </linearGradient>

          {/* Connected Network Nodes Gradient */}
          <linearGradient id="nodesGrad" x1="80" y1="120" x2="210" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3E1A68" />
            <stop offset="50%" stopColor="#311B60" />
            <stop offset="100%" stopColor="#431E64" />
          </linearGradient>
          
          {/* Subtle Outer Glow */}
          <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- LEFT HAND CLIENTS/NODES GRID (Connected Network) --- */}
        <g id="network-topology-mesh" stroke="#4a2574" strokeWidth="3" strokeLinecap="round" opacity="0.95">
          {/* Connection Lines between main nodes */}
          <line x1="100" y1="190" x2="160" y2="150" />
          <line x1="100" y1="190" x2="120" y2="270" />
          <line x1="120" y1="270" x2="195" y2="270" />
          <line x1="195" y1="270" x2="165" y2="200" />
          <line x1="165" y1="200" x2="160" y2="150" />
          <line x1="100" y1="190" x2="165" y2="200" />
          <line x1="120" y1="270" x2="165" y2="200" />
          <line x1="160" y1="150" x2="217" y2="245" />
          <line x1="195" y1="270" x2="217" y2="245" stroke="#4a2574" strokeWidth="4" />
        </g>

        {/* Network Nodes (Circles) */}
        <g id="network-nodes">
          {/* Leftest Node */}
          <circle cx="100" cy="190" r="14" fill="url(#nodesGrad)" stroke="#5D2085" strokeWidth="2.5" />
          
          {/* Top Node */}
          <circle cx="160" cy="150" r="13" fill="url(#nodesGrad)" stroke="#5D2085" strokeWidth="2.5" />
          
          {/* Bottom Left Node */}
          <circle cx="120" cy="270" r="13" fill="url(#nodesGrad)" stroke="#5D2085" strokeWidth="2.5" />
          
          {/* Bottom Right Node */}
          <circle cx="195" cy="270" r="14" fill="url(#nodesGrad)" stroke="#5D2085" strokeWidth="2.5" />
        </g>


        {/* --- MAIN ROOT INTEGRATING JUNCTION (Center Port) --- */}
        <g id="central-hub-junction">
          <circle cx="165" cy="200" r="17" fill="#42125F" stroke="url(#streamGrad)" strokeWidth="3" />
        </g>


        {/* --- RIGHT-SPREADING CIRCUIT PATHS & DIGITAL STREAMS --- */}
        {/* Horizontal Direct Streams */}
        <g id="horizontal-streams" stroke="url(#streamGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none">
          {/* Stream 1 - Top Center Horizontal */}
          <path d="M 165 200 C 220 200, 240 205, 290 205" />
          {/* Stream 2 - Mid Horizontal */}
          <path d="M 165 200 C 210 207, 240 215, 305 210" />
          {/* Stream 3 - Low Horizontal branching off */}
          <path d="M 175 202 C 205 214, 230 225, 285 225" />
          {/* Stream 4 - Furthest Low Branch */}
          <path d="M 175 205 C 225 235, 245 240, 290 240" strokeWidth="4.5" />
        </g>

        {/* Horizontal Stream Ends (Circuit Dot terminology) */}
        <g id="horizontal-terminals" fill="#DB6D2C">
          <circle cx="290" cy="205" r="5" />
          <circle cx="305" cy="210" r="5.5" />
          <circle cx="285" cy="225" r="4.5" />
          <circle cx="290" cy="240" r="4.5" />
        </g>

        {/* Horizontal Tech Highlights (Square circuit detail bits) */}
        <rect x="250" y="221" width="6" height="6" fill="#D55E2B" transform="rotate(15 250 221)" />
        <rect x="272" y="235" width="5" height="5" fill="#E6A125" transform="rotate(45 272 235)" />
        <rect x="230" y="202" width="7" height="4" fill="#8A2576" />


        {/* --- UPWARD LEAPING FIBER SPROUTS (Organic Digital Growth) --- */}
        <g id="upward-sprouts" stroke="url(#topBranchGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none">
          {/* Sprout A - High Curve */}
          <path d="M 165 200 C 180 140, 185 110, 195 90" />
          {/* Sprout B - Medium Upper Curve */}
          <path d="M 165 200 C 190 145, 192 120, 215 105" />
          {/* Sprout C - Right Leaning High */}
          <path d="M 165 200 C 205 155, 222 135, 258 115" strokeWidth="5" />
          {/* Sprout D - Wide Fan out */}
          <path d="M 165 200 C 215 160, 240 148, 275 130" />
          {/* Sprout E - Low Fan */}
          <path d="M 165 200 C 215 170, 250 162, 282 150" strokeWidth="4" />
        </g>

        {/* Upward Terminals / Contact Blocks */}
        <g id="upward-terminals">
          <circle cx="195" cy="90" r="4.5" fill="#DB6D2C" />
          <circle cx="215" cy="105" r="4.5" fill="#E6A125" />
          <circle cx="258" cy="115" r="5" fill="#E6A125" />
          <circle cx="275" cy="130" r="4" fill="#DB6D2C" />
          
          {/* Segment Blocks */}
          <rect x="189" y="98" width="4" height="12" fill="#AA356E" transform="rotate(-10 189 98)" />
          <rect x="207" y="113" width="4" height="10" fill="#AA356E" transform="rotate(-30 207 113)" />
          <rect x="235" y="121" width="8" height="4" fill="#DB6D2C" transform="rotate(35 235 121)" />
          <rect x="248" y="131" width="7" height="4" fill="#E6A125" transform="rotate(35 248 131)" />
        </g>


        {/* --- FLOATING DECORATIONS & CHIP ACCENTS --- */}
        <g id="accent-details">
          {/* Back plate semi-circles */}
          <path d="M 210 178 A 12 12 0 0 1 230 192 L 210 192 Z" fill="#8A2576" opacity="0.6" />
          <path d="M 168 125 A 14 14 0 0 1 185 138 L 168 138 Z" fill="#4A1E63" opacity="0.6" />
          
          {/* Small Digital Sparks */}
          <circle cx="205" cy="170" r="2.5" fill="#DB6D2C" />
          <circle cx="150" cy="225" r="2" fill="#8A2576" />
        </g>
      </svg>

      {showText && (
        <div className="mt-4 text-center select-none font-sans">
          <div className={`font-black uppercase tracking-widest ${sizeClasses[textSize]} flex items-center justify-center gap-1.5`}>
            {/* AI Word - Dark Purple */}
            <span className="text-purple-950 dark:text-white">AI</span>
            {/* POSTMASTER word with gorgeous premium metallic gradient */}
            <span className="bg-linear-to-r from-purple-750 via-purple-650 to-amber-600 bg-clip-text text-transparent">
              Postmaster
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
