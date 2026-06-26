# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RC Circuit Simulator — a standalone Python + PySide6 + matplotlib + schemdraw educational simulation for visualizing resistor-capacitor charging/discharging behavior.

## Architecture

Single-file application with decoupled math layer:

| Component | Role |
|---|---|
| `PhysicsEngine` (unchanged) | Pure math — RC differential equations, $\tau = R \times C$, $V_C(t)$, $I(t)$ |
| `CircuitSimWindow` (QMainWindow) | PySide6 layout, QTimer loop, schemdraw circuit, scrolling matplotlib graph |

The entire UI and rendering lives in `main.py`. PySide6 provides native widgets (sliders, buttons, radio groups). schemdraw renders the circuit schematic onto a matplotlib Axes. The graph uses a twinx() dual-axis plot for simultaneous Vc/I display.

## Setup & Dependencies

- Python 3.12+ (venv created with `python3.12 -m venv .venv`)
- Dependencies: `PySide6`, `matplotlib`, `schemdraw`
- Virtual environment at `.venv/` (activate: `source .venv/bin/activate`)

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
source .venv/bin/activate
python main.py
```

## Key Constraints

- **Tech stack:** PySide6 (Qt for Python), matplotlib (QtAgg backend), schemdraw — **no pygame**
- **PhysicsEngine** is unchanged and fully tested — do not modify
- **R range:** $100\Omega \le R \le 100\text{k}\Omega$ (logarithmic slider)
- **C range:** $10\mu\text{F} \le C \le 4700\mu\text{F}$ (logarithmic slider)
- **dt cap** — delta time clamped to 0.1s per frame (handled by PhysicsEngine)
- **Graphics:** schemdraw redrawn ONLY on mode/R/C change. Clear only `ax_schem`, leave `ax_graph` untouched
- **Live labels:** updated via `text_handle.set_text()` on canvas text objects, plus QLabels in sidebar
- **Graph:** `twinx()` dual axes, `collections.deque(maxlen=300)`, `line.set_data()`, `canvas.draw_idle()`
- **Timer:** QTimer at ~16ms (60 FPS) + QElapsedTimer for accurate per-frame dt
- **Window:** 800×600 minimum enforced, left sidebar 280px fixed width, right panel stretches

## Reference Files

- `docs/superpowers/plans/2026-06-25-rc-circuit-matplotlib-port.md` — implementation plan with phased tasks and verification steps

## Session State Preservation

This project uses `.remember/remember.md` to preserve context between Claude Code sessions.

**Proactive handoff:** When the session is winding down (the user wraps up, says goodbye, or signals end of work), **always write a remember handoff to `.remember/remember.md`** before the final response. Use the `remember` skill to do this — it produces the right format (State / Next / Context).

**Safety net:** A `Stop` hook in `.claude/settings.local.json` logs a timestamp to `.remember/hook-trail.log` whenever the session ends — evidence the hook fired, and a cue that a full handoff may be needed next session.