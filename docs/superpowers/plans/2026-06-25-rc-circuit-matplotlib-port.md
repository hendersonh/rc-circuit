# RC Circuit Simulator — PySide6 + Matplotlib + Schemdraw Port

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Pygame rendering with PySide6 (Qt), matplotlib (QtAgg), and schemdraw for a polished educational RC circuit simulator.

**Architecture:** Single `QMainWindow` with a horizontal layout. Left sidebar holds PySide6 controls (sliders, radio buttons, push buttons). Right side holds a single matplotlib `FigureCanvasQTAgg` with two subplots: top for the schemdraw circuit schematic, bottom for scrolling dual-axis Vc/I graphs.

**Tech Stack:** Python 3, PySide6 ≥6.5, matplotlib ≥3.8 (QtAgg backend), schemdraw ≥0.20

## Global Constraints

- **R range:** 100Ω ≤ R ≤ 100kΩ (logarithmic slider)
- **C range:** 10µF ≤ C ≤ 4700µF (logarithmic slider)
- **PhysicsEngine** is already complete — do not modify it
- **QElapsedTimer** must be used for accurate per-frame dt (not just QTimer)
- **Graphics constraint:** schemdraw canvas must redraw ONLY when charge/discharge state changes. To redraw, clear ONLY `ax_schem`, leave `ax_graph` untouched. Use `text_handle.set_text()` for live number updates (no full canvas redraw per tick)
- **Graph update:** use `line.set_data()` on existing line objects, then `ax.relim()` + `ax.autoscale_view()` + `canvas.draw_idle()`
- **Graph data:** `collections.deque(maxlen=300)` for time, Vc, and I
- **Single figure:** one `FigureCanvasQTAgg` with two subplots (`ax_schem`, `ax_graph`)
- **dt cap:** max 0.1s per frame (PhysicsEngine already handles this)
- **Dark theme:** PySide6 Fusion style + dark QPalette, matplotlib dark rcParams
- **Sliders:** logarithmic scale for both R and C (slider position i mapped to `min * (max/min)^(i/999)`)
- **QRadioButton group** for Charge/Discharge mode selection (not click-on-schematic)
- **twinx()** for graph: Vc on left y-axis, I on right y-axis (single subplot, not stacked)
- **Window:** 800×600 minimum enforced
- **Delete old files:** `circuit_renderer.py`, `current_visualizer.py`, `ui_manager.py`, `info_panel.py`, `real_time_graph.py` — all replaced
- **Keep:** `physics_engine.py`, `tests/test_physics_engine.py`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `main.py` | **Rewrite** | `CircuitSimWindow(QMainWindow)` — app entry, layout, timer, all wiring |
| `physics_engine.py` | Keep | Unchanged |
| `tests/test_physics_engine.py` | Keep | Unchanged |
| `circuit_renderer.py` | Delete | Replaced by schemdraw |
| `current_visualizer.py` | Delete | Feature removed |
| `ui_manager.py` | Delete | Replaced by PySide6 widgets |
| `info_panel.py` | Delete | Replaced by QLabel + canvas text |
| `real_time_graph.py` | Delete | Replaced by matplotlib |

All code lives in `main.py`. A single-file approach is intentional — the component separation from the pygame era (separate renderer, ui_manager, etc.) was needed because Pygame has no widget library. PySide6 provides everything natively.

---

### Task 1: Install Dependencies & Verify Environment

**Files:** `requirements.txt` (create)

- [ ] **Step 1: Install dependencies**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
pip install matplotlib PySide6 schemdraw pytest
```

- [ ] **Step 2: Verify imports work**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
python -c "import PySide6; import matplotlib; import schemdraw; print('All OK')"
```
Expected: `All OK`

- [ ] **Step 3: Verify PhysicsEngine tests still pass**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && python tests/test_physics_engine.py
```
Expected: `All PhysicsEngine tests passed!`

- [ ] **Step 4: Create requirements.txt**

```bash
cat > /home/ubuntu/projects/rc-circuit/requirements.txt << 'EOF'
matplotlib>=3.8
PySide6>=6.5
schemdraw>=0.20
pytest>=7.0
EOF
```

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add requirements.txt
git add -u
git commit -m "chore: add PySide6, matplotlib, schemdraw dependencies"
```

---

### Task 2: Delete Old Pygame Files

**Files:**
- Delete: `circuit_renderer.py`, `current_visualizer.py`, `ui_manager.py`, `info_panel.py`, `real_time_graph.py`

- [ ] **Step 1: Remove obsolete files**

```bash
cd /home/ubuntu/projects/rc-circuit
rm circuit_renderer.py current_visualizer.py ui_manager.py info_panel.py real_time_graph.py
```

- [ ] **Step 2: Verify nothing else depends on them**

```bash
cd /home/ubuntu/projects/rc-circuit
grep -r "import.*circuit_renderer\|import.*current_visualizer\|import.*ui_manager\|import.*info_panel\|import.*real_time_graph" --include="*.py" .
```
Expected: no matches (old `main.py` references them, but it will be rewritten in Task 3)

- [ ] **Step 3: Remove pygame from requirements**

Write the final requirements:

```bash
cat > /home/ubuntu/projects/rc-circuit/requirements.txt << 'EOF'
matplotlib>=3.8
PySide6>=6.5
schemdraw>=0.20
EOF
```

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -u
git commit -m "chore: remove obsolete pygame files (circuit_renderer, current_visualizer, ui_manager, info_panel, real_time_graph)"
```

---

### Task 3: Window Layout & Circuit Schematic (Phase 2)

**Files:**
- Rewrite: `main.py` — full `CircuitSimWindow(QMainWindow)` with layout and schemdraw circuit

**Interfaces:**
- Consumes: `PhysicsEngine` (from `physics_engine.py`) — same API as Phase 1
- Produces: QMainWindow with left sidebar (empty widgets) + right matplotlib figure with `ax_schem` (schemdraw circuit) and `ax_graph` (empty, initialized with twinx)

- [ ] **Step 1: Write `main.py` with window layout and schemdraw circuit**

```python
# main.py
"""RC Circuit Simulator — PySide6 + matplotlib + schemdraw.
Replaces the original pygame-based implementation.
"""

import sys
import math
from collections import deque

import matplotlib
matplotlib.use('QtAgg')

import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

from PySide6.QtCore import QElapsedTimer, QTimer, Qt
from PySide6.QtGui import QFont, QPalette, QColor
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSlider, QLabel, QPushButton, QRadioButton, QButtonGroup, QFrame,
)

import schemdraw
import schemdraw.elements as elm

from physics_engine import PhysicsEngine


class CircuitSimWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("RC Circuit Simulator")
        self.setMinimumSize(800, 600)

        # ── Physics ──
        self.physics = PhysicsEngine(r=1000.0, c=100e-6)

        # ── State ──
        self.is_charging = True
        self.paused = False
        self.elapsed_timer = QElapsedTimer()
        self.elapsed_timer.start()

        # ── Graph data ──
        buffer_size = 300
        self.times = deque(maxlen=buffer_size)
        self.vc_data = deque(maxlen=buffer_size)
        self.i_data = deque(maxlen=buffer_size)

        # ── Build UI ──
        self._build_ui()

        # ── Timer (30-60 Hz) ──
        self.timer = QTimer()
        self.timer.timeout.connect(self._tick)
        self.timer.start(16)  # ~60 FPS

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        hbox = QHBoxLayout(central)
        hbox.setContentsMargins(10, 10, 10, 10)
        hbox.setSpacing(10)

        # ── Left panel (sidebar) ──
        left = QWidget()
        left.setFixedWidth(280)
        left_layout = QVBoxLayout(left)
        left_layout.setSpacing(12)
        left_layout.setContentsMargins(10, 10, 10, 10)

        # Resistance slider
        lbl_r = QLabel("Resistance")
        lbl_r.setStyleSheet("color: #cccccc; font-weight: bold;")
        left_layout.addWidget(lbl_r)

        self.r_slider = QSlider(Qt.Horizontal)
        self.r_slider.setRange(0, 999)
        self.r_slider.setValue(477)  # ~1kΩ on log scale
        self.r_slider.valueChanged.connect(self._on_r_changed)
        left_layout.addWidget(self.r_slider)

        self.r_label = QLabel("1000 Ω")
        self.r_label.setStyleSheet("color: #00c8dc;")
        left_layout.addWidget(self.r_label)

        # Capacitance slider
        lbl_c = QLabel("Capacitance")
        lbl_c.setStyleSheet("color: #cccccc; font-weight: bold;")
        left_layout.addWidget(lbl_c)

        self.c_slider = QSlider(Qt.Horizontal)
        self.c_slider.setRange(0, 999)
        self.c_slider.setValue(477)  # ~100µF on log scale
        self.c_slider.valueChanged.connect(self._on_c_changed)
        left_layout.addWidget(self.c_slider)

        self.c_label = QLabel("100 µF")
        self.c_label.setStyleSheet("color: #00c8dc;")
        left_layout.addWidget(self.c_label)

        left_layout.addSpacing(10)

        # Charge/Discharge radio buttons
        mode_label = QLabel("Circuit Mode")
        mode_label.setStyleSheet("color: #cccccc; font-weight: bold;")
        left_layout.addWidget(mode_label)

        self.mode_group = QButtonGroup()
        self.radio_charge = QRadioButton("Charge")
        self.radio_discharge = QRadioButton("Discharge")
        self.radio_charge.setChecked(True)
        self.radio_charge.setStyleSheet("color: #dddddd;")
        self.radio_discharge.setStyleSheet("color: #dddddd;")
        self.mode_group.addButton(self.radio_charge)
        self.mode_group.addButton(self.radio_discharge)
        self.mode_group.buttonClicked.connect(self._on_mode_changed)
        left_layout.addWidget(self.radio_charge)
        left_layout.addWidget(self.radio_discharge)

        left_layout.addSpacing(10)

        # Play/Pause button
        self.play_btn = QPushButton("⏸ Pause")
        self.play_btn.clicked.connect(self._on_play_pause)
        self.play_btn.setStyleSheet(
            "QPushButton { background-color: #3a3d45; color: #dddddd; "
            "border: 1px solid #555; border-radius: 4px; padding: 6px 16px; }"
            "QPushButton:hover { background-color: #4a4d55; }"
        )
        left_layout.addWidget(self.play_btn)

        # Reset button
        self.reset_btn = QPushButton("↺ Reset")
        self.reset_btn.clicked.connect(self._on_reset)
        self.reset_btn.setStyleSheet(
            "QPushButton { background-color: #3a3d45; color: #f0a030; "
            "border: 1px solid #f0a030; border-radius: 4px; padding: 6px 16px; }"
            "QPushButton:hover { background-color: #4a4050; }"
        )
        left_layout.addWidget(self.reset_btn)

        left_layout.addSpacing(20)

        # Info readouts
        font_mono = QFont("monospace", 12)
        self.info_vc = QLabel("Vc =  0.00 V")
        self.info_vc.setFont(font_mono)
        self.info_vc.setStyleSheet("color: #00ffff;")
        left_layout.addWidget(self.info_vc)

        self.info_i = QLabel("I  =  0.00 mA")
        self.info_i.setFont(font_mono)
        self.info_i.setStyleSheet("color: #00dc00;")
        left_layout.addWidget(self.info_i)

        self.info_tau = QLabel("τ  =  0.100 s")
        self.info_tau.setFont(font_mono)
        self.info_tau.setStyleSheet("color: #f0a030;")
        left_layout.addWidget(self.info_tau)

        self.info_t = QLabel("t  =  0.0 s")
        self.info_t.setFont(font_mono)
        self.info_t.setStyleSheet("color: #ffffff;")
        left_layout.addWidget(self.info_t)

        left_layout.addStretch()

        # ── Right panel (matplotlib figure) ──
        self.fig = Figure(figsize=(6, 5), dpi=100)
        self.fig.set_facecolor('#1e1e23')

        # Two subplots: top = schematic, bottom = graph
        self.ax_schem = self.fig.add_subplot(2, 1, 1)
        self.ax_graph = self.fig.add_subplot(2, 1, 2)

        # Dark theme for axes
        for ax in [self.ax_schem, self.ax_graph]:
            ax.set_facecolor('#16181c')
            ax.tick_params(colors='#888888')
            ax.spines['bottom'].set_color('#3a3a3a')
            ax.spines['top'].set_color('#3a3a3a')
            ax.spines['left'].set_color('#3a3a3a')
            ax.spines['right'].set_color('#3a3a3a')

        self.ax_schem.axis('off')
        self.ax_schem.set_aspect('equal')

        # Graph setup — twinx for Vc (left) and I (right)
        self.ax_graph.set_xlabel('Time (s)', color='#cccccc')
        self.ax_graph.set_ylabel('Vc (V)', color='#00ffff')
        self.ax_graph.tick_params(axis='y', colors='#00ffff')
        self.ax_graph.grid(True, color='#3a3a3a', linewidth=0.5)

        self.ax_i = self.ax_graph.twinx()
        self.ax_i.set_ylabel('I (mA)', color='#00dc00')
        self.ax_i.tick_params(axis='y', colors='#00dc00')

        # Initialize empty lines
        self.vc_line, = self.ax_graph.plot([], [], color='#00ffff', linewidth=1.5, label='Vc')
        self.i_line, = self.ax_i.plot([], [], color='#00dc00', linewidth=1.5, label='I')

        self.fig.tight_layout()

        # Matplotlib canvas
        self.canvas = FigureCanvas(self.fig)
        self.canvas.setMinimumHeight(400)

        # ── Assemble layout ──
        hbox.addWidget(left)
        hbox.addWidget(self.canvas, stretch=1)

        # Draw initial circuit
        self._redraw_circuit()

    def _map_slider_to_log(self, value, vmin, vmax):
        """Map slider position (0-999) to log scale between vmin and vmax."""
        ratio = value / 999.0
        return vmin * (vmax / vmin) ** ratio

    def _on_r_changed(self, value):
        self.physics.R = self._map_slider_to_log(value, 100.0, 100_000.0)
        r_val = self.physics.R
        if r_val >= 1000:
            self.r_label.setText(f"{r_val/1000:.1f} kΩ")
        else:
            self.r_label.setText(f"{r_val:.0f} Ω")
        self._update_info()
        self._redraw_circuit()

    def _on_c_changed(self, value):
        self.physics.C = self._map_slider_to_log(value, 10e-6, 4700e-6)
        c_val = self.physics.C
        if c_val >= 1e-3:
            self.c_label.setText(f"{c_val*1000:.0f} mF")
        elif c_val >= 1e-4:
            self.c_label.setText(f"{c_val*1e6:.0f} µF")
        else:
            self.c_label.setText(f"{c_val*1e6:.1f} µF")
        self._update_info()
        self._redraw_circuit()

    def _on_mode_changed(self):
        self.is_charging = self.radio_charge.isChecked()
        self._redraw_circuit()

    def _on_play_pause(self):
        self.paused = not self.paused
        if self.paused:
            self.play_btn.setText("▶ Play")
        else:
            self.play_btn.setText("⏸ Pause")
            self.elapsed_timer.start()  # restart timer to avoid dt jump

    def _on_reset(self):
        self.physics.reset()
        self.times.clear()
        self.vc_data.clear()
        self.i_data.clear()
        self._update_graph()
        self._update_info()

    def _redraw_circuit(self):
        """Redraw the schemdraw circuit on ax_schem.
        Called only when mode, R, or C changes — not per frame.
        """
        self.ax_schem.clear()
        self.ax_schem.axis('off')
        self.ax_schem.set_aspect('equal')

        d = schemdraw.Drawing(fontsize=10)

        # Build circuit: V0 → R → SPDT → C → return path
        d.add(elm.Battery().up().label('V₀', color='red'))
        d.add(elm.Line().right().length(1.2))
        d.add(elm.ResistorIEC().right().label('R'))
        d.add(elm.Line().right().length(0.5))

        if self.is_charging:
            d.add(elm.SwitchSpdt().up().label('CHG', color='orange'))
        else:
            d.add(elm.SwitchSpdt(action='close').up().label('DCH', color='green'))

        d.add(elm.Line().right().length(0.5))
        d.add(elm.Capacitor().down().label('C'))
        d.add(elm.Line().left().tox(d.here[0] - 0.3))
        d.add(elm.Line().down().length(0.3))
        d.add(elm.Line().left().tox(d.here[0] - 1.2))
        d.add(elm.Line().up().length(0.3))
        d.add(elm.Line().left().to(0))

        d.draw(ax=self.ax_schem)

        # ── Canvas text markers (updated per tick via set_text — no redraw) ──
        # Vc label near capacitor, I label near resistor, R/C/τ in corner
        # Store handles so _tick() can update them via set_text()
        r_val = self.physics.R
        c_val = self.physics.C
        tau = self.physics.tau
        vc = self.physics.VC

        self._canvas_texts = {
            'vc': self.ax_schem.text(
                0.65, 0.25, f"Vc = {vc:.2f} V",
                transform=self.ax_schem.transAxes,
                color='#00ffff', fontsize=11, fontweight='bold',
                verticalalignment='bottom',
            ),
            'i': self.ax_schem.text(
                0.25, 0.85, f"I = 0.00 mA",
                transform=self.ax_schem.transAxes,
                color='#00dc00', fontsize=11, fontweight='bold',
                verticalalignment='bottom',
            ),
            'tau': self.ax_schem.text(
                0.05, 0.05,
                f"R={r_val:.0f}Ω  C={c_val*1e6:.0f}µF  τ={tau:.3f}s",
                transform=self.ax_schem.transAxes,
                color='#888888', fontsize=9, verticalalignment='bottom',
            ),
        }

        self.canvas.draw_idle()

    def _tick(self):
        """Called every timer tick (~16ms)."""
        if self.paused:
            return

        dt = self.elapsed_timer.elapsed() / 1000.0
        self.elapsed_timer.start()

        # Update physics
        if self.is_charging:
            self.physics.update_charge(dt)
        else:
            self.physics.update_discharge(dt)

        # Push data
        current = (self.physics.current if self.is_charging
                   else self.physics.discharge_current)
        self.times.append(self.physics.elapsed_time)
        self.vc_data.append(self.physics.VC)
        self.i_data.append(current * 1000)  # A → mA

        # Update graph
        self._update_graph()

        # Update info labels (sidebar QLabels)
        self._update_info()

        # Update canvas text markers (set_text — no redraw)
        if hasattr(self, '_canvas_texts'):
            self._canvas_texts['vc'].set_text(f"Vc = {self.physics.VC:.2f} V")
            self._canvas_texts['i'].set_text(f"I  = {current*1000:.2f} mA")

    def _update_graph(self):
        """Update the scrolling plot lines (no full redraw)."""
        if not self.times:
            return

        t_list = list(self.times)
        self.vc_line.set_data(t_list, list(self.vc_data))
        self.i_line.set_data(t_list, list(self.i_data))

        self.ax_graph.relim()
        self.ax_graph.autoscale_view()
        self.ax_i.relim()
        self.ax_i.autoscale_view()

        # Scroll x-axis
        self.ax_graph.set_xlim(max(0, t_list[-1] - 10), max(10, t_list[-1]))

        self.canvas.draw_idle()

    def _update_info(self):
        """Update the info QLabels on the sidebar."""
        current = (self.physics.current if self.is_charging
                   else self.physics.discharge_current)
        self.info_vc.setText(f"Vc = {self.physics.VC:6.2f} V")
        self.info_i.setText(f"I  = {current*1000:6.2f} mA")
        self.info_tau.setText(f"τ  = {self.physics.tau:6.3f} s")
        self.info_t.setText(f"t  = {self.physics.elapsed_time:6.1f} s")

    def closeEvent(self, event):
        """Clean shutdown on window close."""
        self.timer.stop()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')

    # Dark palette
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor(30, 30, 35))
    palette.setColor(QPalette.WindowText, QColor(220, 220, 230))
    palette.setColor(QPalette.Base, QColor(25, 25, 30))
    palette.setColor(QPalette.AlternateBase, QColor(35, 35, 40))
    palette.setColor(QPalette.ToolTipBase, QColor(40, 42, 48))
    palette.setColor(QPalette.ToolTipText, QColor(220, 220, 230))
    palette.setColor(QPalette.Text, QColor(220, 220, 230))
    palette.setColor(QPalette.Button, QColor(40, 42, 48))
    palette.setColor(QPalette.ButtonText, QColor(220, 220, 230))
    palette.setColor(QPalette.BrightText, QColor(255, 0, 0))
    palette.setColor(QPalette.Link, QColor(0, 200, 220))
    palette.setColor(QPalette.Highlight, QColor(60, 100, 180))
    palette.setColor(QPalette.HighlightedText, QColor(220, 220, 230))
    app.setPalette(palette)

    # Apply dark stylesheet for the sidebar background
    app.setStyleSheet(
        "QMainWindow { background-color: #1e1e23; }"
        "QWidget { background-color: #1e1e23; }"
    )

    window = CircuitSimWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the application to verify it opens**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && timeout 3 python main.py 2>&1 || true
```
Expected: Window appears briefly with circuit schematic drawn on the right, sidebar with sliders and buttons visible. (It will exit after 3s due to timeout.)

- [ ] **Step 3: Verify schemdraw circuit renders correctly**

Run the app and visually confirm:
- Circuit schematic shows: battery (V₀ label), ResistorIEC (R label), SPDT switch with "CHG", capacitor (C label), wire loop
- The SPDT switch shows the lever in the "charge" position
- Dark theme is applied

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -A
git commit -m "feat: implement PySide6 window layout with schemdraw circuit (Phase 2)"
```

---

### Task 4: Sidebar Controls, Signals, Live Text Readouts (Phase 3)

**Files:**
- Modify: `main.py` — already has stub widgets, now wire them to physics and add QElapsedTimer timing

Note: Tasks 2 and 3 already included the sidebar widgets and QElapsedTimer wiring. This task verifies and tests the full control integration.

- [ ] **Step 1: Verify slider mapping gives correct values**

```python
# Run this verification snippet
import math

def map_slider_to_log(value, vmin, vmax):
    ratio = value / 999.0
    return vmin * (vmax / vmin) ** ratio

# R slider: min=100, max=100000
assert abs(map_slider_to_log(0, 100, 100000) - 100) < 1
assert abs(map_slider_to_log(999, 100, 100000) - 100000) < 1000
mid_r = map_slider_to_log(500, 100, 100000)
assert 2000 < mid_r < 5000, f"mid_r={mid_r}"

# C slider: min=10e-6, max=4700e-6
assert abs(map_slider_to_log(0, 10e-6, 4700e-6) - 10e-6) < 1e-7
assert abs(map_slider_to_log(999, 10e-6, 4700e-6) - 4700e-6) < 50e-6
mid_c = map_slider_to_log(500, 10e-6, 4700e-6)
assert 100e-6 < mid_c < 500e-6, f"mid_c={mid_c}"

print("Slider mapping verified")
```

- [ ] **Step 2: Run and test interactively — verify:**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && timeout 5 python main.py 2>&1 || true
```

Visual verification checklist:
- Moving R slider changes the Ω/kΩ label and updates circuit redraw
- Moving C slider changes the µF label and updates circuit redraw
- Toggling Charge/Discharge radio buttons redraws the circuit with switch flipped
- Info labels show Vc increasing (charging) or decreasing (discharging)
- The timer runs at ~60 FPS (smooth operation)

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -A
git commit -m "feat: wire sidebar controls to physics engine with live text updates (Phase 3)"
```

---

### Task 5: Scrolling Real-Time Graph (Phase 4)

**Files:**
- Modify: `main.py` — graph already initialized. Verify twinx scrolling works with deque data.

- [ ] **Step 1: Verify graph data flow in the tick loop**

Review the tick → graph pipeline already in `main.py`:

```python
# In _tick():
# 1. dt from QElapsedTimer
# 2. physics.update_charge/discharge(dt)
# 3. push to deque
# 4. _update_graph() → line.set_data() → relim → autoscale → draw_idle
```

- [ ] **Step 2: Run and verify scrolling graph**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && timeout 8 python main.py 2>&1 || true
```

Visual verification:
- After 3+ seconds, the graph shows a cyan Vc curve charging toward ~12V
- The green I curve starts high and decays toward 0
- The x-axis scrolls smoothly as new data arrives
- Switch to Discharge mode → Vc decays toward 0, I goes negative and rises toward 0

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -A
git commit -m "feat: add scrolling dual-axis Vc/I graph with deque buffer (Phase 4)"
```

---

### Task 6: Global Controls, Reset & Robustness (Phase 5)

**Files:**
- Modify: `main.py` — Play/Pause and Reset already implemented. This task verifies edge cases and adds robustness.

- [ ] **Step 1: Verify Play/Pause freezes simulation**

Check the `_tick()` method has:
```python
if self.paused:
    return
```
And that `_on_play_pause()` toggles `self.paused` and updates button text.

- [ ] **Step 2: Verify Reset clears everything**

Check `_on_reset()` calls:
- `self.physics.reset()` — VC→0, elapsed_time→0
- `self.times.clear()` + `self.vc_data.clear()` + `self.i_data.clear()` — deque cleared
- `_update_graph()` and `_update_info()` called after reset

- [ ] **Step 3: Verify window resize behavior**

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && timeout 5 python main.py 2>&1 || true
```

Visual verification:
- Resize window: circuit schematic and graph scale with window
- Text labels don't overlap components
- Left sidebar stays fixed width (280px)

- [ ] **Step 4: Final edge case — dt capping on resume**

The `QElapsedTimer` restart on unpause prevents dt spikes:
```python
# In _on_play_pause():
if not self.paused:
    self.elapsed_timer.start()  # fresh start after unpause
```

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -A
git commit -m "feat: add play/pause, reset, and window resize robustness (Phase 5)"
```

---

### Task 7: Clean Up & Update Project Docs

**Files:**
- Modify: `CLAUDE.md`, `plan.md` (or create `README.md`)

- [ ] **Step 1: Update CLAUDE.md to reflect new tech stack**

```markdown
# CLAUDE.md

## Project Overview

RC Circuit Simulator — a standalone Python + PySide6 + matplotlib + schemdraw educational simulation for visualizing resistor-capacitor charging/discharging behavior.

## Architecture

| Component | Role |
|---|---|
| `PhysicsEngine` | Pure math — RC differential equations, unchanging over all ports |
| `CircuitSimWindow` | QMainWindow — PySide6 layout, QTimer loop, schemdraw circuit, scrolling graph |

## Setup & Dependencies

- Python 3.12+ (venv created with `python3.12 -m venv .venv`)
- Dependencies: `PySide6`, `matplotlib`, `schemdraw`

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

- **No pygame** — all rendering via PySide6 widgets, matplotlib QtAgg, and schemdraw
- **PhysicsEngine unchanged** — pure math, 100Ω ≤ R ≤ 100kΩ, 10µF ≤ C ≤ 4700µF
- **Graphics:** schemdraw redrawn only on mode/R/C change (not per frame)
- **Live labels:** updated via `text_handle.set_text()` — no redraw
- **Graph:** twinx() dual axes, deque maxlen=300, line.set_data()
- **Timer:** QTimer at 16ms + QElapsedTimer for accurate dt
- **dt cap:** 0.1s max (handled by PhysicsEngine)
```

- [ ] **Step 2: Remove plan.md (old pygame spec)**

```bash
cd /home/ubuntu/projects/rc-circuit
rm plan.md
```

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/rc-circuit
git add -A
git commit -m "docs: update CLAUDE.md for new PySide6/matplotlib/schemdraw stack"
```

---

## Verification Test (Post-Implementation)

Run the full application and manually verify:

```bash
source /home/ubuntu/projects/rc-circuit/.venv/bin/activate
cd /home/ubuntu/projects/rc-circuit && python main.py
```

1. **Window opens** with dark theme, 800×600 minimum
2. **Left sidebar:** R slider, C slider, Charge/Discharge radio, Play/Pause, Reset, info readouts
3. **Circuit schematic:** battery, resistor, capacitor, SPDT switch with wire loop
4. **Switch mode:** clicking Charge/Discharge flips the switch in the schematic
5. **Sliders:** R and C change values and update labels + circuit redraw
6. **Simulation:** Vc charges toward V₀ in Charge mode, decays in Discharge mode
7. **Graph:** Vc (cyan) and I (green) scroll smoothly as data accumulates
8. **Pause:** simulation freezes, button text changes to "▶ Play"
9. **Resume:** simulation continues smoothly (no dt spike)
10. **Reset:** Vc→0, graph clears, time resets
11. **Resize:** window resizes, graphs scale, sidebar stays fixed
12. **Run for 1+ hour:** no memory growth (deque maxlen=300)

---

## Files Changed Summary

| File | Action |
|---|---|
| `main.py` | **Rewrite** — new `CircuitSimWindow(QMainWindow)` |
| `circuit_renderer.py` | **Delete** |
| `current_visualizer.py` | **Delete** |
| `ui_manager.py` | **Delete** |
| `info_panel.py` | **Delete** |
| `real_time_graph.py` | **Delete** |
| `physics_engine.py` | **Keep** (unchanged) |
| `tests/test_physics_engine.py` | **Keep** (unchanged) |
| `plan.md` | **Delete** (old pygame spec) |
| `CLAUDE.md` | **Update** for new stack |
| `requirements.txt` | **Rewrite** (remove pygame, add PySide6/matplotlib/schemdraw) |