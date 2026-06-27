// CircuitSchematic.tsx
import React from 'react';

interface CircuitSchematicProps {
  isCharging: boolean;
  resistance: number;
  capacitance: number;
  tau: number;
  vc: number;
  vr: number;
  current: number;
}

export const CircuitSchematic: React.FC<CircuitSchematicProps> = ({
  isCharging,
  resistance,
  capacitance,
  tau,
  vc,
  vr,
  current,
}) => {
  // Format current to mA for display
  const currentMA = current * 1000;

  // Format parameter readouts
  const formatR = (r: number) => {
    return r >= 1000 ? `${(r / 1000).toFixed(1)} kΩ` : `${r.toFixed(0)} Ω`;
  };

  const formatC = (c: number) => {
    return c >= 1e-3 ? `${(c * 1000).toFixed(0)} mF` : `${(c * 1e6).toFixed(1)} µF`;
  };

  return (
    <div className="schematic-svg-wrapper">
      <svg
        viewBox="0 0 800 300"
        width="100%"
        height="100%"
        style={{ background: 'transparent' }}
      >
        {/* Define arrow marker for current flow indicators */}
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
          </marker>
        </defs>

        {/* ── Outer Rectangular Wire Frame ── */}
        {/* Top-left wire: Battery top (100, 80) to Terminal a (300, 80) */}
        <line x1="100" y1="80" x2="300" y2="80" stroke="#ffffff" strokeWidth="2" />
        
        {/* Switch to Resistor wire: Switch Pivot (480, 80) to Resistor Start (510, 80) */}
        <line x1="480" y1="80" x2="510" y2="80" stroke="#ffffff" strokeWidth="2" />

        {/* Resistor End (560, 80) to Capacitor Top (680, 80) */}
        <line x1="560" y1="80" x2="680" y2="80" stroke="#ffffff" strokeWidth="2" />

        {/* Bottom wire: Left-bottom (100, 220) to Right-bottom (680, 220) */}
        <line x1="100" y1="220" x2="680" y2="220" stroke="#ffffff" strokeWidth="2" />

        {/* ── Battery Branch (Left) ── */}
        {/* Wire from top line (100, 80) to Battery Top Plate (100, 130) */}
        <line x1="100" y1="80" x2="100" y2="130" stroke="#ffffff" strokeWidth="2" />
        {/* Wire from Battery Bottom Plate (100, 170) to bottom line (100, 220) */}
        <line x1="100" y1="170" x2="100" y2="220" stroke="#ffffff" strokeWidth="2" />

        {/* Battery plates (alternating long/short horizontal plates) */}
        <line x1="75" y1="130" x2="125" y2="130" stroke="#ec4899" strokeWidth="3" /> {/* Long + */}
        <line x1="85" y1="140" x2="115" y2="140" stroke="#ec4899" strokeWidth="5" /> {/* Short - */}
        <line x1="75" y1="150" x2="125" y2="150" stroke="#ec4899" strokeWidth="3" /> {/* Long + */}
        <line x1="85" y1="160" x2="115" y2="160" stroke="#ec4899" strokeWidth="5" /> {/* Short - */}

        {/* Battery Labels */}
        <text x="60" y="155" fill="#ec4899" fontSize="13" fontWeight="bold" textAnchor="end">12.0 V</text>
        <text x="110" y="115" fill="#ec4899" fontSize="14" fontWeight="600">+</text>
        <text x="110" y="195" fill="#ec4899" fontSize="14" fontWeight="600">-</text>


        {/* ── Switch Contacts & Nodes ── */}
        {/* Terminal a (Charging side contact) */}
        <circle cx="300" cy="80" r="5" fill="#94a3b8" stroke="#000" strokeWidth="1" />
        <text x="300" y="65" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">a</text>

        {/* Terminal b (Discharging side contact) */}
        <line x1="400" y1="220" x2="400" y2="150" stroke="#64748b" strokeWidth="2" /> {/* Connection wire */}
        <circle cx="400" cy="150" r="5" fill="#94a3b8" stroke="#000" strokeWidth="1" />
        <text x="385" y="154" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="end">b</text>

        {/* Switch Pivot */}
        <circle cx="480" cy="80" r="5" fill="#f59e0b" stroke="#000" strokeWidth="1" />

        {/* Switch Arm (Dynamic) */}
        {isCharging ? (
          /* Connected to a (Charging) */
          <line
            x1="480"
            y1="80"
            x2="300"
            y2="80"
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          /* Connected to b (Discharging) */
          <line
            x1="480"
            y1="80"
            x2="400"
            y2="150"
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}


        {/* ── Resistor (IEC Box Style) ── */}
        {/* Resistor body (Rectangle from 510 to 560, height 20 centered around Y=80) */}
        <rect
          x="510"
          y="70"
          width="50"
          height="20"
          fill="#0a0c10"
          stroke="#10b981"
          strokeWidth="2.5"
        />
        {/* Resistor label & Vr voltage readout */}
        <text x="535" y="63" fill="#10b981" fontSize="11" fontWeight="600" textAnchor="middle">R</text>
        <text
          x="535"
          y="48"
          fill="#10b981"
          fontSize="11.5"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          Vr = {vr.toFixed(2)} V
        </text>


        {/* ── Capacitor ── */}
        {/* Wire from top line (680, 80) to Capacitor Top Plate (680, 140) */}
        <line x1="680" y1="80" x2="680" y2="140" stroke="#ffffff" strokeWidth="2" />
        {/* Wire from Capacitor Bottom Plate (680, 160) to bottom line (680, 220) */}
        <line x1="680" y1="160" x2="680" y2="220" stroke="#ffffff" strokeWidth="2" />

        {/* Capacitor plates (parallel horizontal bars) */}
        <line x1="655" y1="140" x2="705" y2="140" stroke="#06b6d4" strokeWidth="3" />
        <line x1="655" y1="160" x2="705" y2="160" stroke="#06b6d4" strokeWidth="3" />

        {/* Capacitor label */}
        <text x="640" y="154" fill="#06b6d4" fontSize="12" fontWeight="bold" textAnchor="end">C</text>


        {/* ── Dynamic Text Readouts & Indicators ── */}
        {/* Resistor current label */}
        <text
          x="535"
          y="112"
          fill="#10b981"
          fontSize="11.5"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          I = {currentMA.toFixed(2)} mA
        </text>

        {/* Capacitor voltage label */}
        <text
          x="715"
          y="154"
          fill="#06b6d4"
          fontSize="11.5"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="start"
        >
          Vc = {vc.toFixed(2)} V
        </text>

        {/* Live current arrows */}
        {Math.abs(current) > 1e-5 && (
          <>
            {isCharging ? (
              // Charging current arrow (left to right)
              <path
                d="M 200 68 L 220 68"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            ) : (
              // Discharging current arrow (right to left)
              <path
                d="M 620 68 L 600 68"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            )}
          </>
        )}

        {/* Parameters footer */}
        <text
          x="400"
          y="275"
          fill="#64748b"
          fontSize="11.5"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          R = {formatR(resistance)} &nbsp; | &nbsp; C = {formatC(capacitance)} &nbsp; | &nbsp; τ = {tau.toFixed(3)} s
        </text>
      </svg>
    </div>
  );
};
export default CircuitSchematic;
