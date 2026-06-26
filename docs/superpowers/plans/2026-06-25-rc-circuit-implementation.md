# RC Circuit Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive RC circuit charging/discharging simulator in Python/Pygame for students.

**Architecture:** Component-based with decoupled math/state (PhysicsEngine) from rendering (UIManager, RealTimeGraph, CircuitRenderer, CurrentVisualizer), orchestrated by SimulationApp. Plain Python 3 with pygame — no Tkinter/PyQt.

**Tech Stack:** Python 3.14+, pygame, math module, collections.deque

## Global Constraints

- No external GUI frameworks — all UI rendered via Pygame primitives
- R slider min = 100 Ω, C slider min = 10 µF (prevents div-by-zero)
- dt capped at 0.1s per frame to prevent jumps after minimize/sleep
- All physics/particle steps scale by actual delta time (dt) from `pygame.time.Clock.tick(60)`
- V0 = 12V source voltage (fixed)
- Window: 800×600, 60 FPS capped
- Dark mode color scheme
- Reference design: `docs/superpowers/specs/2026-06-25-rc-circuit-design.md`

---

### Task 1: PhysicsEngine

**Files:**
- Create: `physics_engine.py`

**Interfaces:**
- Consumes: nothing (standalone math module)
- Produces: `PhysicsEngine` class with `update_charge(dt)`, `update_discharge(dt)`, `reset()`, and properties `R`, `C`, `VC`, `current`, `discharge_current`, `tau`, `elapsed_time`

- [ ] **Step 1: Write PhysicsEngine class**

```python
# physics_engine.py
"""Pure math/state layer for RC circuit simulation.
Decoupled from all rendering — can be tested independently.
"""

import math


class PhysicsEngine:
    """Holds circuit parameters and updates capacitor voltage over time.

    State variables:
        R  — Resistance (ohms), clamped >= 100
        C  — Capacitance (farads), clamped >= 10e-6
        V0 — Source voltage (volts), fixed at 12
        VC — Capacitor voltage (volts), initial 0
        elapsed_time — simulation time (seconds)
    """

    MIN_R = 100.0       # ohms
    MIN_C = 10e-6       # farads (10 µF)
    V0 = 12.0           # source voltage
    MAX_DT = 0.1        # seconds — cap to prevent jumps

    def __init__(self, r: float = 1000.0, c: float = 100e-6):
        self._r = max(r, self.MIN_R)
        self._c = max(c, self.MIN_C)
        self._vc = 0.0
        self._elapsed = 0.0

    @property
    def R(self) -> float:
        return self._r

    @R.setter
    def R(self, value: float):
        self._r = max(value, self.MIN_R)

    @property
    def C(self) -> float:
        return self._c

    @C.setter
    def C(self, value: float):
        self._c = max(value, self.MIN_C)

    @property
    def VC(self) -> float:
        return self._vc

    @property
    def tau(self) -> float:
        """Time constant τ = R × C."""
        return self._r * self._c

    @property
    def elapsed_time(self) -> float:
        return self._elapsed

    @property
    def current(self) -> float:
        """Circuit current in amperes.
        Positive = charging flow, Negative = discharging flow.
        Caller sets mode — this calculates based on VC.
        """
        return (self.V0 - self._vc) / self._r

    @property
    def discharge_current(self) -> float:
        """Current during discharge mode: I = -VC / R."""
        return -self._vc / self._r

    def update_charge(self, dt: float):
        """Advance simulation in charging mode.
        Vc(t+dt) = Vc(t) + (V0 - Vc(t)) * (1 - e^(-dt/τ))
        """
        dt = min(dt, self.MAX_DT)
        if self.tau > 0:
            self._vc += (self.V0 - self._vc) * (1 - math.exp(-dt / self.tau))
        self._elapsed += dt

    def update_discharge(self, dt: float):
        """Advance simulation in discharging mode.
        Vc(t+dt) = Vc(t) * e^(-dt/τ)
        """
        dt = min(dt, self.MAX_DT)
        if self.tau > 0:
            self._vc *= math.exp(-dt / self.tau)
        self._elapsed += dt

    def reset(self):
        """Reset capacitor voltage and elapsed time to zero."""
        self._vc = 0.0
        self._elapsed = 0.0
```

- [ ] **Step 2: Write tests for PhysicsEngine**

```python
# tests/test_physics_engine.py
"""Tests for PhysicsEngine — all math/state, no rendering."""
import sys
import math
sys.path.insert(0, '..')

from physics_engine import PhysicsEngine

DELTA = 1e-9  # floating point tolerance


def test_initial_state():
    eng = PhysicsEngine(r=1000, c=100e-6)
    assert eng.R == 1000
    assert eng.C == 100e-6
    assert eng.VC == 0.0
    assert eng.elapsed_time == 0.0
    assert abs(eng.tau - 0.1) < DELTA  # 1000 * 100e-6 = 0.1


def test_clamping():
    eng = PhysicsEngine(r=1, c=1e-9)
    assert eng.R == PhysicsEngine.MIN_R
    assert eng.C == PhysicsEngine.MIN_C


def test_charge_tau_milestone():
    """At t = 1τ, Vc should be ~63.2% of V0."""
    eng = PhysicsEngine(r=1000, c=100e-6)  # τ = 0.1s
    steps = 100
    dt = eng.tau / steps  # simulate 1τ in 100 steps
    for _ in range(steps):
        eng.update_charge(dt)
    expected = eng.V0 * (1 - 1 / math.e)
    assert abs(eng.VC - expected) < 0.01, f"Vc={eng.VC}, expected={expected}"


def test_discharge_to_zero():
    """Discharge from full V0 should approach 0."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng._vc = eng.V0  # start fully charged
    for _ in range(500):
        eng.update_discharge(0.01)
    assert eng.VC < 0.01


def test_charge_plateau():
    """After 10τ, Vc should be very close to V0."""
    eng = PhysicsEngine(r=1000, c=100e-6)  # τ = 0.1s
    for _ in range(2000):  # way past 10τ
        eng.update_charge(0.01)
    assert abs(eng.VC - eng.V0) < 0.001


def test_dt_capping():
    """dt > MAX_DT should be clamped."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng.update_charge(10.0)  # massive dt
    # Should not jump to V0 instantly — dt was capped
    assert eng.VC < eng.V0, "dt capping failed, VC jumped to V0"


def test_current_charge():
    """Current during charging: I = (V0 - Vc) / R."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    assert abs(eng.current - (12.0 / 1000.0)) < DELTA
    eng.update_charge(0.05)
    # After some charging, current should decrease
    assert eng.current < 12.0 / 1000.0


def test_current_discharge():
    """Discharge current is negative and decays toward 0."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng._vc = eng.V0  # fully charged
    i = eng.discharge_current
    assert i < 0  # negative = discharging
    eng.update_discharge(0.05)
    assert eng.discharge_current > i  # approaching 0 from below


def test_reset():
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng.update_charge(0.1)
    eng.reset()
    assert eng.VC == 0.0
    assert eng.elapsed_time == 0.0


if __name__ == "__main__":
    test_initial_state()
    test_clamping()
    test_charge_tau_milestone()
    test_discharge_to_zero()
    test_charge_plateau()
    test_dt_capping()
    test_current_charge()
    test_current_discharge()
    test_reset()
    print("All PhysicsEngine tests passed!")
```

- [ ] **Step 3: Run tests to verify**

```bash
cd /home/ubuntu/projects/rc-circuit && python tests/test_physics_engine.py
```

Expected output: `All PhysicsEngine tests passed!`

- [ ] **Step 4: Install pygame if needed**

```bash
source .venv/bin/activate && pip install pygame
```

---

### Task 2: UIManager — Slider, Button, SPDT_Switch

**Files:**
- Create: `ui_manager.py`

**Interfaces:**
- Consumes: nothing standalone (uses pygame primitives)
- Produces: `Slider`, `Button`, `SPDT_Switch` classes with `handle_event(event)`, `update()`, `draw(surface)` methods

- [ ] **Step 1: Write UI components**

```python
# ui_manager.py
"""Custom native Pygame UI widgets — Slider, Button, SPDT_Switch.
No external GUI frameworks; all rendered via pygame.draw primitives.
"""

import pygame


# ── Color Palette (Dark Mode) ──────────────────────────────────────
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_RED = (220, 60, 60)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
TRACK_GRAY = (60, 62, 68)
HANDLE_LIGHT = (180, 185, 195)
WIRE_WHITE = (200, 200, 210)
YELLOW_GLOW = (255, 220, 80)


class Slider:
    """Draggable horizontal slider for R or C values.
    Updates value on release; shows tooltip during drag.
    """

    def __init__(self, x, y, width, label, min_val, max_val, initial, fmt=".0f", unit=""):
        self.rect = pygame.Rect(x, y, width, 30)
        self.label = label
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial
        self.fmt = fmt
        self.unit = unit
        self.dragging = False
        # Handle position (circular)
        self.handle_radius = 8
        self.handle_y = y + 15

    @property
    def handle_x(self):
        """Map current value to pixel position."""
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return self.rect.x + int(ratio * self.rect.width)

    def _value_from_x(self, x):
        """Map pixel position to value (clamped)."""
        ratio = max(0, min(1, (x - self.rect.x) / self.rect.width))
        return self.min_val + ratio * (self.max_val - self.min_val)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = event.pos
            # Check if click is on handle
            dx = mx - self.handle_x
            dy = my - self.handle_y
            if dx * dx + dy * dy <= (self.handle_radius + 5) ** 2:
                self.dragging = True
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            if self.dragging:
                self.dragging = False
                self.value = max(self.min_val, min(self.max_val, self.value))
                return True  # value committed
        elif event.type == pygame.MOUSEMOTION:
            if self.dragging:
                self.value = self._value_from_x(event.pos[0])
                self.value = max(self.min_val, min(self.max_val, self.value))
                return True
        return False

    def draw(self, surface, font):
        # Track line
        track_y = self.rect.y + 13
        pygame.draw.line(surface, TRACK_GRAY,
                         (self.rect.x, track_y),
                         (self.rect.x + self.rect.width, track_y), 3)
        # Filled portion (active)
        filled_end = self.handle_x
        if filled_end > self.rect.x:
            pygame.draw.line(surface, ACCENT_CYAN,
                             (self.rect.x, track_y),
                             (filled_end, track_y), 3)
        # Handle
        pygame.draw.circle(surface, HANDLE_LIGHT, (self.handle_x, self.handle_y), self.handle_radius)
        pygame.draw.circle(surface, ACCENT_CYAN, (self.handle_x, self.handle_y), self.handle_radius, 2)
        # Label
        label_surf = font.render(f"{self.label}:", True, TEXT_WHITE)
        surface.blit(label_surf, (self.rect.x, self.rect.y - 18))
        # Value display (right-aligned)
        val_str = f"{self.value:{self.fmt}}{self.unit}"
        val_surf = font.render(val_str, True, ACCENT_CYAN)
        surface.blit(val_surf, (self.rect.x + self.rect.width - val_surf.get_width(), self.rect.y - 18))
        # Tooltip during drag
        if self.dragging:
            tip = font.render(val_str, True, TEXT_WHITE)
            tip_rect = tip.get_rect(midbottom=(self.handle_x, self.handle_y - self.handle_radius - 4))
            pygame.draw.rect(surface, PANEL_DARK, tip_rect.inflate(8, 4), border_radius=3)
            surface.blit(tip, tip_rect)


class Button:
    """Clickable button with label and optional icon."""

    def __init__(self, x, y, width, height, label, color=ACCENT_CYAN, toggle=False):
        self.rect = pygame.Rect(x, y, width, height)
        self.label = label
        self.color = color
        self.toggle = toggle
        self.active = False if toggle else True
        self.pressed = False

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.pressed = True
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            if self.pressed and self.rect.collidepoint(event.pos):
                self.pressed = False
                if self.toggle:
                    self.active = not self.active
                return True  # button was clicked
            self.pressed = False
        return False

    def draw(self, surface, font):
        color = self.color if self.active else TRACK_GRAY
        if self.pressed:
            color = tuple(max(0, c - 40) for c in color)
        pygame.draw.rect(surface, color, self.rect, border_radius=5)
        if not self.active:
            pygame.draw.rect(surface, TEXT_GRAY, self.rect, 2, border_radius=5)
        text = font.render(self.label, True, TEXT_WHITE)
        text_rect = text.get_rect(center=self.rect.center)
        surface.blit(text, text_rect)


class SPDT_Switch:
    """Three-terminal toggle switch drawn in the circuit schematic.
    Click on the lever area to toggle between CHARGE and DISCHARGE.
    """

    MODE_CHARGE = "CHARGE"
    MODE_DISCHARGE = "DISCHARGE"

    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.mode = self.MODE_CHARGE
        # Terminal positions (relative to self.x, self.y)
        self.top_terminal = (x, y - 20)
        self.center_pivot = (x, y)
        self.bottom_terminal = (x, y + 20)
        # Lever extends right from center pivot
        self.lever_length = 25
        self.click_radius = 30

    @property
    def lever_end(self):
        """Lever points up when charging, down when discharging."""
        if self.mode == self.MODE_CHARGE:
            return (self.x + self.lever_length, self.y - 16)
        else:
            return (self.x + self.lever_length, self.y + 16)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = event.pos
            dx = mx - self.x
            dy = my - self.y
            if dx * dx + dy * dy <= self.click_radius * self.click_radius:
                self.mode = self.MODE_DISCHARGE if self.mode == self.MODE_CHARGE else self.MODE_CHARGE
                return True
        return False

    def draw(self, surface, font):
        # Terminal dots
        for pos in (self.top_terminal, self.center_pivot, self.bottom_terminal):
            pygame.draw.circle(surface, WIRE_WHITE, pos, 4)
        # Lever
        lever_color = ACCENT_ORANGE if self.mode == self.MODE_CHARGE else ACCENT_GREEN
        pygame.draw.line(surface, lever_color, self.center_pivot, self.lever_end, 4)
        pygame.draw.circle(surface, lever_color, self.lever_end, 6)
        # Label
        label = "CHG" if self.mode == self.MODE_CHARGE else "DCH"
        lbl = font.render(label, True, lever_color)
        surface.blit(lbl, (self.x + self.lever_length + 25, self.y - 8))
```

- [ ] **Step 2: Write a visual test script for UI components**

```python
# tests/test_ui_visual.py
"""Quick visual verification of UI components.
Run with: python tests/test_ui_visual.py
Click the window to see sliders, buttons, and switch in action.
"""
import sys
import pygame

sys.path.insert(0, '..')
from ui_manager import Slider, Button, SPDT_Switch

pygame.init()
screen = pygame.display.set_mode((600, 400))
pygame.display.set_caption("UI Visual Test")
clock = pygame.time.Clock()
font = pygame.font.SysFont("monospace", 14)

slider_r = Slider(50, 60, 300, "R", 100, 1_000_000, 1000, ".0f", " Ω")
slider_c = Slider(50, 110, 300, "C", 10e-6, 0.01, 100e-6, ".0e", " F")
btn_play = Button(50, 170, 80, 30, "▶/⏸", (0, 200, 220), toggle=True)
btn_reset = Button(150, 170, 80, 30, "↺ Reset", (240, 160, 40))
spdt = SPDT_Switch(400, 200)

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        slider_r.handle_event(event)
        slider_c.handle_event(event)
        if btn_play.handle_event(event):
            print(f"Play toggled: {'playing' if btn_play.active else 'paused'}")
        if btn_reset.handle_event(event):
            print("Reset clicked")
        spdt.handle_event(event)

    screen.fill((30, 30, 35))
    slider_r.draw(screen, font)
    slider_c.draw(screen, font)
    btn_play.draw(screen, font)
    btn_reset.draw(screen, font)
    spdt.draw(screen, font)
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
```

- [ ] **Step 3: Run visual test to verify UI works**

```bash
source .venv/bin/activate && python tests/test_ui_visual.py
```

---

### Task 3: InfoPanel — Numeric Readouts

**Files:**
- Create: `info_panel.py`

**Interfaces:**
- Consumes: physics engine state (VC, current, tau, elapsed_time)
- Produces: `InfoPanel` class with `update(physcis_data)` and `draw(surface)` methods

- [ ] **Step 1: Write InfoPanel**

```python
# info_panel.py
"""Numeric readout panel showing VC, I, τ, and elapsed time."""

import pygame

TEXT_WHITE = (220, 220, 230)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_RED = (220, 60, 60)
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)


class InfoPanel:
    """Displays four live readouts in a horizontal row."""

    def __init__(self, x, y, font):
        self.x = x
        self.y = y
        self.font = font
        self.values = {
            "vc": "0.00 V",
            "current": "0.00 mA",
            "tau": "0.00 s",
            "time": "0.0 s",
        }

    def update(self, vc, current, tau, elapsed_time):
        """Update displayed values from physics engine state."""
        self.values["vc"] = f"{vc:.2f} V"
        # Convert amps to milliamps for readability
        self.values["current"] = f"{current * 1000:.2f} mA"
        self.values["tau"] = f"{tau:.3f} s"
        self.values["time"] = f"{elapsed_time:.1f} s"

    def draw(self, surface):
        """Draw readouts left to right in a single row."""
        labels = [
            ("Vc =", self.values["vc"], ACCENT_CYAN),
            ("I =", self.values["current"], ACCENT_GREEN),
            ("τ =", self.values["tau"], ACCENT_ORANGE),
            ("t =", self.values["time"], TEXT_WHITE),
        ]
        x = self.x
        for label, value, color in labels:
            lbl = self.font.render(label, True, TEXT_WHITE)
            surface.blit(lbl, (x, self.y))
            x += lbl.get_width() + 2
            val = self.font.render(value, True, color)
            surface.blit(val, (x, self.y))
            x += val.get_width() + 20
```

---

### Task 4: RealTimeGraph — Stacked Vc/I Plot

**Files:**
- Create: `real_time_graph.py`

**Interfaces:**
- Consumes: physics engine state (VC, current)
- Produces: `RealTimeGraph` class with `push(vc, current)`, `reset()`, `draw(surface)` methods

- [ ] **Step 1: Write RealTimeGraph**

```python
# real_time_graph.py
"""Real-time stacked graph for Vc (top) and I (bottom)
using bounded deques for memory-safe rolling history.
"""

from collections import deque
import pygame

BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
GRID_GRAY = (55, 58, 62)
GRAPH_BG = (22, 24, 28)


class RealTimeGraph:
    """Stacked graph with Vc on top, I on bottom, shared X-axis."""

    def __init__(self, x, y, width, height_top, height_bottom, font, v0=12.0):
        self.x = x
        self.y = y
        self.width = width
        self.height_top = height_top
        self.height_bottom = height_bottom
        self.font = font
        self.v0 = v0

        # Data storage — rolling 300 points
        self.vc_data = deque(maxlen=300)
        self.i_data = deque(maxlen=300)

        # Margins for labels
        self.y_label_margin = 25  # left margin for Y-axis labels
        self.x_label_margin = 20  # bottom margin for X-axis label

        # Pre-compute grid line positions
        self._grid_lines_top = [int(height_top * i / 4) for i in range(5)]
        self._grid_lines_bot = [int(height_bottom * i / 4) for i in range(5)]

    def push(self, vc, current):
        """Append a data point (called each frame while unpaused)."""
        self.vc_data.append(vc)
        self.i_data.append(current)

    def reset(self):
        """Clear all graph data."""
        self.vc_data.clear()
        self.i_data.clear()

    def draw(self, surface):
        """Draw both stacked graphs."""
        plot_top_x = self.x + self.y_label_margin
        plot_top_y = self.y
        plot_width = self.width - self.y_label_margin - 5
        plot_height = self.height_top + self.height_bottom + self.x_label_margin

        # draw Vc graph
        self._draw_graph(surface, self.vc_data,
                         plot_top_x, plot_top_y, plot_width, self.height_top,
                         self.v0, "Vc (V)", ACCENT_CYAN,
                         grid_lines=self._grid_lines_top)

        # draw I graph (below Vc graph)
        i_y = self.y + self.height_top + 4
        # Auto-range I: find max absolute current from data
        i_max = 0.001  # avoid div-by-zero
        for val in self.i_data:
            i_max = max(i_max, abs(val))
        i_range = max(i_max * 1.2, 0.001)  # 20% headroom

        self._draw_graph(surface, self.i_data,
                         plot_top_x, i_y, plot_width, self.height_bottom,
                         i_range, "I (mA)", ACCENT_GREEN,
                         grid_lines=self._grid_lines_bot,
                         center_zero=True)

    def _draw_graph(self, surface, data, gx, gy, gw, gh, y_range, label, color,
                    grid_lines=None, center_zero=False):
        """Draw a single graph with background, grid, axis labels, and trace."""
        # Background
        bg_rect = pygame.Rect(gx, gy, gw, gh)
        pygame.draw.rect(surface, GRAPH_BG, bg_rect)
        pygame.draw.rect(surface, PANEL_DARK, bg_rect, 1)

        # Grid lines
        if grid_lines:
            for ly in grid_lines:
                y_pos = gy + ly
                pygame.draw.line(surface, GRID_GRAY, (gx, y_pos), (gx + gw, y_pos), 1)

        # Y-axis label
        lbl = self.font.render(label, True, color)
        surface.blit(lbl, (gx - self.y_label_margin + 2, gy + 2))

        # Y-axis tick labels (show min/mid/max)
        if center_zero:
            mid = gy + gh // 2
            self._draw_tick_label(surface, f"{y_range*1000:.1f}", gx - 2, gy)  # max
            self._draw_tick_label(surface, "0", gx - 2, mid)                  # zero
            self._draw_tick_label(surface, f"{-y_range*1000:.1f}", gx - 2, gy + gh - 5)  # -max
        else:
            self._draw_tick_label(surface, f"{y_range:.1f}", gx - 2, gy)
            mid = gy + gh // 2
            self._draw_tick_label(surface, f"{y_range/2:.1f}", gx - 2, mid)
            self._draw_tick_label(surface, "0", gx - 2, gy + gh - 5)

        # X-axis label (time)
        xlbl = self.font.render("time (s)", True, TEXT_GRAY)
        surface.blit(xlbl, (gx + gw - xlbl.get_width() - 4, gy + gh + 2))

        # Trace
        if len(data) < 2:
            return

        points = []
        for i, val in enumerate(data):
            px = gx + int((i / (len(data) - 1)) * gw)
            if center_zero:
                half = gh / 2
                # Map value to [0, gh] with 0 at center
                norm = val / y_range if y_range != 0 else 0
                norm = max(-1, min(1, norm))
                py = gy + int(half - norm * (half - 4))
            else:
                norm = val / y_range if y_range != 0 else 0
                norm = max(0, min(1, norm))
                py = gy + gh - 4 - int(norm * (gh - 8))
            points.append((px, py))

        if len(points) >= 2:
            pygame.draw.lines(surface, color, False, points, 2)

    def _draw_tick_label(self, surface, text, x, y):
        """Draw a small Y-axis tick label right-aligned to x."""
        lbl = self.font.render(text, True, TEXT_GRAY)
        lbl_rect = lbl.get_rect(right=x, centery=y)
        surface.blit(lbl, lbl_rect)
```

---

### Task 5: CircuitRenderer — Schematic Diagram

**Files:**
- Create: `circuit_renderer.py`

**Interfaces:**
- Consumes: `SPDT_Switch` from ui_manager (or switch mode as bool)
- Produces: `CircuitRenderer` class with `draw(surface, switch_mode)` method

- [ ] **Step 1: Write CircuitRenderer**

```python
# circuit_renderer.py
"""Draws the RC circuit schematic: battery, resistor, capacitor, wires, SPDT switch.
Wire paths are also used by CurrentVisualizer for particle animation."""

import pygame

# Colors
WIRE_WHITE = (200, 200, 210)
BATTERY_RED = (220, 60, 60)
BATTERY_BLACK = (60, 60, 60)
RESISTOR_BROWN = (180, 140, 80)
CAPACITOR_BLUE = (100, 180, 255)
TEXT_WHITE = (220, 220, 230)
TEXT_GRAY = (140, 140, 150)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_GREEN = (0, 220, 140)
PANEL_DARK = (40, 42, 48)
BG_DARK = (30, 30, 35)


class CircuitRenderer:
    """Draws the RC circuit schematic and provides wire paths for particle animation."""

    # Wire path waypoints — (x, y) coordinates defining the circuit loop
    # These form a continuous path: start → ... → end (back to start for wrap-around)
    PATH = [
        # Top wire: from left (battery +) to resistor
        (10, 30),    # 0: start (battery + terminal)
        (40, 30),    # 1: lead to resistor
        # Resistor zigzag (5 segments)
        (45, 20),    # 2: resistor zig
        (55, 40),    # 3: resistor zag
        (65, 20),    # 4
        (75, 40),    # 5
        (85, 20),    # 6
        (90, 30),    # 7: resistor out
        # Top-right wire: from resistor to switch
        (120, 30),   # 8
        (140, 30),   # 9: switch top terminal
        # Right wire: from switch down to capacitor
        (140, 60),   # 10
        (140, 80),   # 11: capacitor top
        # Capacitor gap (drawn as plates, not path)
        (140, 85),   # 12: capacitor bottom
        # Bottom-right wire: from capacitor to bottom loop
        (140, 110),  # 13
        (140, 130),  # 14
        # Bottom wire: back to left
        (100, 130),  # 15
        (60, 130),   # 16
        (20, 130),   # 17
        # Bottom-left wire: back to battery -
        (10, 130),   # 18: battery - terminal
        # Left wire: up battery to + (complete loop)
        (10, 100),   # 19
        (10, 60),    # 20
        (10, 30),    # 21: back to start
    ]

    # Switch position in local path coordinates (used by SPDT_Switch)
    SWITCH_CENTER = (140, 50)

    def __init__(self, x, y, width, height):
        self.rect = pygame.Rect(x, y, width, height)
        # Cache transform parameters for external coord conversion
        self.scale_x = (width - 40) / 150.0
        self.scale_y = (height - 40) / 160.0

    def transform_point(self, px, py):
        """Convert path-local coordinates to screen coordinates."""
        return (int(self.rect.x + 20 + px * self.scale_x),
                int(self.rect.y + 20 + py * self.scale_y))

    @property
    def switch_screen_pos(self):
        """Screen position of the SPDT switch center (for SPDT_Switch)."""
        return self.transform_point(*self.SWITCH_CENTER)

    def draw_schematic(self, surface, font, switch_mode, vc, v0, r_val, c_val):
        """Draw the full circuit schematic."""
        # Background
        pygame.draw.rect(surface, BG_DARK, self.rect)
        pygame.draw.rect(surface, PANEL_DARK, self.rect, 2)

        # Use cached transform
        tx = self.transform_point

        # Battery leads (left vertical)
        pygame.draw.line(surface, WIRE_WHITE, tx(10, 30), tx(10, 25), 2)

        # Battery: + terminal (top, red)
        pygame.draw.line(surface, BATTERY_RED, tx(5, 20), tx(15, 20), 3)
        pygame.draw.line(surface, BATTERY_RED, tx(3, 25), tx(17, 25), 2)
        lbl_plus = font.render("+", True, BATTERY_RED)
        surface.blit(lbl_plus, tx(20, 18))
        # Battery: - terminal (bottom, black)
        pygame.draw.line(surface, BATTERY_BLACK, tx(5, 35), tx(15, 35), 3)
        pygame.draw.line(surface, BATTERY_BLACK, tx(3, 30), tx(17, 30), 2)
        lbl_minus = font.render("−", True, BATTERY_BLACK)
        surface.blit(lbl_minus, tx(20, 28))

        # Draw main wire loop (all segments except resistor zigzag and capacitor gap)
        for i in range(len(self.PATH) - 1):
            p1 = self.PATH[i]
            p2 = self.PATH[i + 1]
            pygame.draw.line(surface, WIRE_WHITE, tx(*p1), tx(*p2), 2)
        # Close loop
        pygame.draw.line(surface, WIRE_WHITE, tx(*self.PATH[-1]), tx(*self.PATH[0]), 2)

        # Resistor (drawn on top of wire path)
        r_start = tx(40, 30)
        r_end = tx(90, 30)
        self._draw_resistor(surface, r_start, r_end, RESISTOR_BROWN, 5)
        lbl_r = font.render("R", True, RESISTOR_BROWN)
        surface.blit(lbl_r, tx(55, -5))

        # Capacitor (two parallel plates, replacing a wire segment)
        cap_top = tx(140, 75)
        cap_bot = tx(140, 90)
        pygame.draw.line(surface, CAPACITOR_BLUE, cap_top, tx(140, 78), 3)  # top plate
        pygame.draw.line(surface, CAPACITOR_BLUE, cap_bot, tx(140, 87), 3)  # bottom plate
        lbl_c = font.render("C", True, CAPACITOR_BLUE)
        surface.blit(lbl_c, tx(148, 76))

        # SPDT switch — just the wire connections (lever drawn by SPDT_Switch separately)
        switch_top = tx(140, 30)
        switch_center = tx(140, 50)
        switch_bot = tx(140, 70)

        # Terminal dots
        for pt in [switch_top, switch_center, switch_bot]:
            pygame.draw.circle(surface, WIRE_WHITE, pt, 4)

        # Right wire from switch to capacitor (drawn to match switch position)
        pygame.draw.line(surface, WIRE_WHITE, switch_center, tx(140, 76), 2)

        # Component labels
        lbl_v0 = font.render(f"V₀ = {v0:.1f}V", True, TEXT_GRAY)
        surface.blit(lbl_v0, tx(0, 55))

        # Values label
        val_text = f"R={r_val:.0f}Ω  C={c_val*1e6:.0f}µF  τ={(r_val*c_val):.3f}s"
        val_lbl = font.render(val_text, True, TEXT_GRAY)
        surface.blit(val_lbl, (self.rect.x + 10, self.rect.y + self.rect.height - 20))

    def _draw_resistor(self, surface, start, end, color, segments=5):
        """Draw a zigzag resistor between two points."""
        x1, y1 = start
        x2, y2 = end
        dx = (x2 - x1) / segments
        dy = 12  # zigzag amplitude
        points = [(x1, y1)]
        for i in range(1, segments):
            px = x1 + i * dx
            py = y1 + (dy if i % 2 == 1 else -dy)
            points.append((int(px), int(py)))
        points.append((x2, y2))
        pygame.draw.lines(surface, color, False, points, 2)
```

---

### Task 6: CurrentVisualizer — Wire Path Particles

**Files:**
- Create: `current_visualizer.py`

**Interfaces:**
- Consumes: `current` (signed float from PhysicsEngine), `dt`, wire path from CircuitRenderer
- Produces: `CurrentVisualizer` class with `update(current, dt)`, `reset()` and `draw(surface)` methods

- [ ] **Step 1: Write CurrentVisualizer**

```python
# current_visualizer.py
"""Animated dot particles moving along circuit wire paths.
Velocity scales with current — fast when I is high, slow near equilibrium,
reverses when switching charge/discharge."""

import pygame
import math

PARTICLE_COLOR = (255, 220, 80)   # yellow glow
PARTICLE_RADIUS = 4
NUM_PARTICLES = 20
MULTIPLIER = 80  # pixels per amp per second (tuning constant)


class CurrentVisualizer:
    """Distributes particles along a list of wire path waypoints."""

    def __init__(self, path_points):
        """path_points: list of (x, y) tuples defining the circuit loop."""
        self.path = path_points
        # Pre-compute segment lengths and total path length
        self.seg_lengths = []
        self.total_length = 0
        for i in range(len(self.path)):
            p1 = self.path[i]
            p2 = self.path[(i + 1) % len(self.path)]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.sqrt(dx * dx + dy * dy)
            self.seg_lengths.append(length)
            self.total_length += length

        # Distribute particles evenly along path
        self.particles = []
        spacing = self.total_length / NUM_PARTICLES
        for i in range(NUM_PARTICLES):
            pos = i * spacing
            self.particles.append(pos)

    def reset(self):
        """Redistribute particles evenly back to starting positions."""
        self.particles = []
        spacing = self.total_length / NUM_PARTICLES
        for i in range(NUM_PARTICLES):
            pos = i * spacing
            self.particles.append(pos)

    def update(self, current, dt):
        """Move particles along the path proportional to current × dt."""
        displacement = current * MULTIPLIER * dt
        for i in range(len(self.particles)):
            self.particles[i] = (self.particles[i] + displacement) % self.total_length
            if self.particles[i] < 0:
                self.particles[i] += self.total_length

    def draw(self, surface):
        """Draw particles at their current positions along the path."""
        for pos in self.particles:
            x, y = self._position_at_distance(pos)
            # Glow effect (larger, semi-transparent)
            glow_surf = pygame.Surface((PARTICLE_RADIUS * 4, PARTICLE_RADIUS * 4), pygame.SRCALPHA)
            glow_color = (*PARTICLE_COLOR, 60)
            pygame.draw.circle(glow_surf, glow_color,
                               (PARTICLE_RADIUS * 2, PARTICLE_RADIUS * 2),
                               PARTICLE_RADIUS * 2)
            surface.blit(glow_surf, (x - PARTICLE_RADIUS * 2, y - PARTICLE_RADIUS * 2))
            # Core dot
            pygame.draw.circle(surface, PARTICLE_COLOR, (int(x), int(y)), PARTICLE_RADIUS)
            # Bright center
            pygame.draw.circle(surface, (255, 255, 240), (int(x), int(y)), PARTICLE_RADIUS // 2)

    def position_at_distance(self, d):
        """Convert a distance along the total path to (x, y) coordinates."""
        d = d % self.total_length
        accumulated = 0
        for i in range(len(self.path)):
            seg_len = self.seg_lengths[i]
            if accumulated + seg_len >= d:
                frac = (d - accumulated) / seg_len if seg_len > 0 else 0
                x1, y1 = self.path[i]
                x2, y2 = self.path[(i + 1) % len(self.path)]
                x = x1 + (x2 - x1) * frac
                y = y1 + (y2 - y1) * frac
                return x, y
            accumulated += seg_len
        # Fallback to last point
        return self.path[-1]
```

---

### Task 7: Main Application — SimulationApp

**Files:**
- Create: `main.py`

**Interfaces:**
- Consumes: all prior components
- Produces: runnable application

- [ ] **Step 1: Write main.py**

```python
# main.py
"""RC Circuit Simulator — Main Application Entry Point.
Orchestrates PhysicsEngine, UIManager, InfoPanel, RealTimeGraph,
CircuitRenderer, and CurrentVisualizer in a 60 FPS game loop.
"""

import sys
import pygame

from physics_engine import PhysicsEngine
from ui_manager import Slider, Button, SPDT_Switch
from info_panel import InfoPanel
from real_time_graph import RealTimeGraph
from circuit_renderer import CircuitRenderer
from current_visualizer import CurrentVisualizer

# ── Window & Display ──────────────────────────────────────────────
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# ── Colors (Dark Mode) ────────────────────────────────────────────
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
TEXT_WHITE = (220, 220, 230)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)


class SimulationApp:
    """Main application orchestrator."""

    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("RC Circuit Simulator")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("monospace", 14)
        self.big_font = pygame.font.SysFont("monospace", 18)
        self.running = True
        self.paused = False

        # ── Component positions (left panel ~400px) ──
        left_x = 20
        right_x = 400
        slider_width = 280

        # ── Physics ──
        self.physics = PhysicsEngine(r=1000.0, c=100e-6)

        # ── Sliders ──
        self.slider_r = Slider(left_x, 55, slider_width, "R",
                               100, 1_000_000, 1000, ".0f", " Ω")
        self.slider_c = Slider(left_x, 105, slider_width, "C",
                               10e-6, 0.01, 100e-6, ".0e", " F")

        # ── Buttons (row below sliders) ──
        self.btn_play = Button(left_x, 140, 70, 28, "▶/⏸", ACCENT_CYAN, toggle=True)
        self.btn_play.active = True  # start playing
        self.btn_reset = Button(left_x + 80, 140, 80, 28, "↺ Reset", ACCENT_ORANGE)

        # ── Info panel ──
        self.info_panel = InfoPanel(left_x, 178, self.font)

        # ── Graph (left side, below info) ──
        self.graph = RealTimeGraph(left_x, 205, 360, 120, 120, self.font, v0=12.0)

        # ── Circuit schematic (right side) ──
        self.circuit = CircuitRenderer(right_x, 30, 380, 530)

        # ── SPDT Switch (aligned to circuit schematic) ──
        switch_pos = self.circuit.switch_screen_pos
        self.spdt = SPDT_Switch(switch_pos[0], switch_pos[1])

        # ── Current visualizer (uses schematic wire path) ──
        self.particles = CurrentVisualizer(CircuitRenderer.PATH)

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False

            # Sliders
            if self.slider_r.handle_event(event):
                self.physics.R = self.slider_r.value
            if self.slider_c.handle_event(event):
                self.physics.C = self.slider_c.value

            # SPDT switch
            self.spdt.handle_event(event)

            # Buttons
            if self.btn_play.handle_event(event):
                self.paused = not self.btn_play.active
            if self.btn_reset.handle_event(event):
                self.physics.reset()
                self.graph.reset()
                self.particles.reset()

    def update(self, dt):
        if not self.paused:
            # Update physics based on switch mode
            if self.spdt.mode == SPDT_Switch.MODE_CHARGE:
                self.physics.update_charge(dt)
            else:
                self.physics.update_discharge(dt)

            # Update graph
            current = (self.physics.current if self.spdt.mode == SPDT_Switch.MODE_CHARGE
                       else self.physics.discharge_current)
            self.graph.push(self.physics.VC, current)

            # Update particles
            self.particles.update(current, dt)

    def draw(self):
        self.screen.fill(BG_DARK)

        # Sliders
        self.slider_r.draw(self.screen, self.font)
        self.slider_c.draw(self.screen, self.font)

        # Buttons
        self.btn_play.draw(self.screen, self.font)
        self.btn_reset.draw(self.screen, self.font)

        # Info panel
        current = (self.physics.current if self.spdt.mode == SPDT_Switch.MODE_CHARGE
                   else self.physics.discharge_current)
        self.info_panel.update(self.physics.VC, current,
                               self.physics.tau, self.physics.elapsed_time)
        self.info_panel.draw(self.screen)

        # Graph
        self.graph.draw(self.screen)

        # Circuit schematic
        self.circuit.draw_schematic(self.screen, self.big_font,
                                    self.spdt.mode, self.physics.VC,
                                    self.physics.V0, self.physics.R, self.physics.C)

        # Particles (needs transformed coordinates — draw on circuit)
        self._draw_particles_on_circuit()
        # Draw SPDT switch on top
        self.spdt.draw(self.screen, self.big_font)

        # Paused indicator
        if self.paused:
            pause_text = self.big_font.render("PAUSED", True, ACCENT_ORANGE)
            self.screen.blit(pause_text, (SCREEN_WIDTH // 2 - 40, 5))

        # FPS / debug info
        fps_text = self.font.render(f"FPS: {self.clock.get_fps():.0f}", True, TEXT_WHITE)
        self.screen.blit(fps_text, (SCREEN_WIDTH - 80, 5))

        # ESC hint
        esc_text = self.font.render("ESC to exit", True, TEXT_WHITE)
        self.screen.blit(esc_text, (SCREEN_WIDTH - 100, SCREEN_HEIGHT - 20))

        pygame.display.flip()

    def _draw_particles_on_circuit(self):
        """Draw particles transformed to circuit panel coordinates.
        This is a simplified version — the particles path matches the
        CircuitRenderer.PATH waypoints which are in a "local" coordinate
        system. We transform them here to match the circuit panel position.
        """
        # Get the circuit panel's transform
        tx = self.circuit.transform_point

        # Draw particles using transformed positions
        for pos in self.particles.particles:
            px, py = self.particles.position_at_distance(pos)
            sx, sy = tx(px, py)
            pygame.draw.circle(self.screen, (255, 220, 80), (sx, sy), 4)
            pygame.draw.circle(self.screen, (255, 255, 200), (sx, sy), 2)

    def run(self):
        """Main game loop — 60 FPS, dt-scaled."""
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0  # convert ms to seconds
            self.handle_events()
            self.update(dt)
            self.draw()
        pygame.quit()
        sys.exit()


if __name__ == "__main__":
    app = SimulationApp()
    app.run()
```

---

### Task 8: Assembly & System Verification

**Files:**
- Modify: `main.py` (already created above)

- [ ] **Step 1: Run the application**

```bash
source .venv/bin/activate && python main.py
```

Verify:
- Window opens at 800×600
- Sliders are draggable and update values
- SPDT switch toggles between CHARGE/DISCHARGE
- Play/Pause freezes/unfreezes simulation
- Reset clears state
- Graph shows rolling curves for Vc and I
- Particles move along circuit wires
- ESC exits cleanly

- [ ] **Step 2: Run the 1τ diagnostic**

The charge curve should reach ~63.2% of V0 after 1τ. Open a Python shell:

```python
from physics_engine import PhysicsEngine
import math
eng = PhysicsEngine(r=1000, c=100e-6)  # τ = 0.1s
for _ in range(100):
    eng.update_charge(0.001)  # 100 × 1ms = 0.1s = 1τ
expected = eng.V0 * (1 - 1/math.e)
print(f"Vc = {eng.VC:.4f}V, expected = {expected:.4f}V, diff = {abs(eng.VC - expected):.6f}")
assert abs(eng.VC - expected) < 0.01, "1τ diagnostic FAILED"
print("1τ diagnostic PASSED ✓")
```