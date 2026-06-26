# RC Circuit Simulator — Design Specification

**Date:** 2026-06-25
**Status:** Approved design, pending implementation

---

## 1. Overview

A standalone Python + Pygame interactive RC circuit simulator for students to learn about charging and discharging behavior of capacitors through resistors. Single-window desktop application, 800×600, 60 FPS.

---

## 2. Architecture

Component-based, decoupled math/state from rendering:

```
SimulationApp (main loop, event dispatch, orchestration)
  ├── PhysicsEngine       # Pure math — RC equations, no rendering
  ├── UIManager           # Sliders, buttons, switch — native Pygame
  ├── InfoPanel           # Numeric readouts (Vc, I, τ, time)
  ├── RealTimeGraph       # Stacked Vc/I plot, deque(maxlen=300)
  ├── CurrentVisualizer   # Animated particles on wire paths
  └── CircuitRenderer     # Schematic diagram (R, C, battery, SPDT)
```

Each frame:
1. Poll UI events (drags, clicks, toggle, ESC)
2. If unpaused → `PhysicsEngine.update(dt)` with dt capped at 0.1s
3. Update graph deque, info panel text, particle positions
4. Render all components in z-order

---

## 3. Screen Layout (800×600)

```
┌──────────────────────────────────────────────────────────────┐
│  Controls bar                    R, C sliders + readouts     │  y:0–90
│  Action bar       [⚡][🔋]  [▶/⏸] [↺]  Vc I τ t values     │  y:90–130
├────────────────────────────────┬────────────────────────────┤
│                                │                            │
│  Vc Graph (stacked top)        │  Circuit Schematic         │  y:130–370
│  ┌─ Y axis: Volts             │  with SPDT lever           │
│  │  shared X: time (s)        │  Animated current dots     │
│  ├─ I Graph (stacked bottom)  │  ● ● ● → flow             │
│  │  Y axis: mA                │                            │
│                                │                            │
├────────────────────────────────┴────────────────────────────┤
│  Status bar                      [ESC to exit]              │  y:570–600
└──────────────────────────────────────────────────────────────┘
```

Left panel: ~400px wide. Right panel: ~400px wide.

---

## 4. Components — Detailed

### 4.1 PhysicsEngine

**State:**
- `R` — Resistance (Ω), clamped to [100, ∞)
- `C` — Capacitance (µF converted to F), clamped to [10 µF, ∞)
- `V0` — Source voltage (fixed, e.g. 12V)
- `VC` — Capacitor voltage (V), initial 0
- `elapsed_time` — simulation time (s)

**Constants:**
- `τ = R × C`

**Methods:**
- `charge_mode(dt)` → $V_C(t+dt) = V_C(t) + (V_0 - V_C(t)) \times (1 - e^{-dt / \tau})$
- `discharge_mode(dt)` → $V_C(t+dt) = V_C(t) \times e^{-dt / \tau}$
- `current()` → $(V_0 - V_C) / R$ when charging, $-V_C / R$ when discharging
- `reset()` → VC = 0, elapsed_time = 0

**Safety:**
- dt capped at 0.1s each frame (prevents jumps after minimize/sleep)
- R slider min = 100 Ω, C slider min = 10 µF (prevents div-by-zero)

### 4.2 UIManager

**Slider (R):**
- Horizontal track, draggable handle
- Range: 100 Ω – 1 MΩ, logarithmic scale
- Updates value on release; during drag shows tooltip with current value
- Label: "R" with unit suffix

**Slider (C):**
- Range: 10 µF – 10,000 µF, logarithmic scale
- Same behavior as R slider

**SPDT_Switch:**
- Drawn as a three-terminal toggle lever inside the circuit schematic
- Click to toggle between CHARGE and DISCHARGE
- Visual feedback: lever physically flips, active path highlighted
- The switch is part of the CircuitRenderer but separately clickable

**PlayPause button:**
- Toggle button, icon changes: ▶ for paused, ⏸ for playing
- Stops → physics, particles, and graph are all frozen
- Default: playing

**Reset button (↺):**
- Resets: PhysicsEngine (VC=0, t=0), RealTimeGraph (clear deques), particles (reset positions)
- Does NOT change: slider positions (R, C values), play/pause state

### 4.3 InfoPanel

Four readouts in a single row below the action buttons:
- `Vc = X.XX V` — capacitor voltage, 2 decimal places
- `I = X.XX mA` — circuit current, converted to mA for readability
- `τ = X.XX s` — time constant
- `t = X.X s` — elapsed simulation time

### 4.4 RealTimeGraph

**Data storage:**
- Two `collections.deque(maxlen=300)` — one for Vc, one for I
- Appended every frame while unpaused
- Time axis derived from deque index × dt (assumes ~60 fps ≈ 5 seconds of history)

**Rendering:**
- Two stacked canvases: top ~110px for Vc, bottom ~110px for I
- Shared horizontal time axis (seconds)
- Each has its own Y-axis with label and unit (V for top, mA for bottom)
- Draw curves with `pygame.draw.lines()` in a bright trace color
- Y-axis auto-ranges to [0, V0] for Vc, and [-Imax, Imax] for I (symmetric to show signed current during discharge)
- Grid lines at major intervals for readability

**Clearing:**
- On reset → `deque.clear()` on both

### 4.5 CircuitRenderer

Draws the RC circuit schematic on the right panel. Components rendered as Pygame primitives:

- **Battery:** Vertical parallel lines (thin | thick | thick | thin) with +/− labels at top/bottom
- **Resistor:** Zigzag line (series of V-shaped segments, or a rectangle with leads)
- **Capacitor:** Two vertical parallel plates connected to wires (═ symbol)
- **SPDT switch:** Three wire terminals with a toggle lever drawn as a movable line; lever position indicates Charge (connected to battery) or Discharge (loop back to resistor)

**Layout inside the 400×240 panel:**
```
          ┌───┐
    + ────┤ R ├────┐
          └───┘    │           Switch lever drawn here
    V0             ═ C         ● → particle flow
                   │
    ───────────────┘
```

### 4.6 CurrentVisualizer

**Particle system:**
- N equally-spaced dots distributed along the wire path coordinates
- Wire path = a list of (x, y) waypoints forming the circuit loop
- Each cycle: `particle.position += current_I * multiplier * dt`
- When current is positive (charging): particles flow in one direction
- When current is negative (discharging): particles flow in reverse
- Fast current → fast particles; near-equilibrium → crawling; zero → stopped

**Edge cases:**
- dt capped at 0.1s prevents particle teleportation
- On switch toggle, direction reverses smoothly (velocity sign flips)
- Particles wrap around when they reach the end of the path
- On reset: particles redistribute evenly back to starting positions

---

## 5. Theme / Visual Style

- **Dark mode** background (dark gray/charcoal)
- Neon-colored traces for graphs (e.g., cyan for Vc, green for I)
- Circuit wires in white/light gray
- Particles in a bright accent color with a subtle glow
- SPDT lever in a contrasting color
- Clean sans-serif font for all labels

---

## 6. Interaction Map

| Action | Result |
|---|---|
| Drag R slider | Adjust resistance, update τ, show tooltip |
| Release R slider | Commit value, resume live physics |
| Drag C slider | Adjust capacitance, update τ, show tooltip |
| Release C slider | Commit value, resume live physics |
| Click SPDT lever | Toggle charge/discharge mode, particles reverse |
| Click Play/Pause | Toggle freeze on physics + graph + particles |
| Click Reset | Clear all state, keep slider positions |
| Press ESC | Exit application |

---

## 7. Edge Cases

| Case | Handling |
|---|---|
| Window minimized 10s | dt capped at 0.1s → smooth catch-up |
| R set to minimum | 100 Ω floor, τ ≈ 0.001s (very fast charge) |
| C set to minimum | 10 µF floor |
| Flip switch mid-cycle | Smooth math transition, particles reverse direction |
| Slider dragged during pause | Value updates, physics applies on unpause |
| Running for hours | deque(maxlen=300) prevents memory growth |
| Vc reaches V0 (charged) | Current → 0, particles stop, graph plateaus |

---

## 8. File Structure

```
rc-circuit/
├── main.py                 # Entry point, creates SimulationApp, runs loop
├── physics_engine.py       # PhysicsEngine class
├── ui_manager.py           # Slider, Button, SPDT_Switch classes
├── circuit_renderer.py     # CircuitRenderer — draws the schematic
├── real_time_graph.py      # RealTimeGraph — stacked Vc/I plot
├── current_visualizer.py   # CurrentVisualizer — particles
├── info_panel.py           # InfoPanel — numeric readouts
└── plan.md                 # Original specification
```

---

## 9. Implementation Order

1. `main.py` — Pygame window, game loop, dt calculation, event dispatch
2. `physics_engine.py` — RC equations, reset, dt clamping
3. `ui_manager.py` — Slider, Button, SPDT_Switch
4. `info_panel.py` — Numeric readouts
5. `real_time_graph.py` — Stacked graph with deques
6. `circuit_renderer.py` — Schematic with SPDT toggle lever
7. `current_visualizer.py` — Particles on wire paths
8. Wire everything into SimulationApp, test, verify 63.2% at 1τ diagnostic