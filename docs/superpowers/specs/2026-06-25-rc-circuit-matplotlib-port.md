# RC Circuit Simulator — PySide6 + matplotlib + Schemdraw Port

**Date:** 2026-06-25
**Based on:** Prior pygame design at `2026-06-25-rc-circuit-design.md`

---

## 1. Goal

Replace pygame with **PySide6** (GUI), **matplotlib QtAgg** (real-time graph), and **schemdraw** (circuit schematic). Produce a polished educational app with publication-quality schematic rendering, native-looking widgets, and a responsive real-time graph.

---

## 2. Architecture

```
PhysicsEngine (unchanged — pure math)
        │
        ▼
SimulationApp (QMainWindow)
  ├── QTimer (60 FPS) — drives simulation tick
  ├── Left Panel (QVBoxLayout)
  │   ├── R Slider (QSlider + label)
  │   ├── C Slider (QSlider + label)
  │   ├── Play/Pause + Reset buttons (QPushButton)
  │   └── Info readouts (QLabel — Vc, I, τ, t)
  ├── Right Panel, Top (matplotlib FigureCanvas — schemdraw renders here)
  │   └── Circuit schematic via schemdraw (Battery, ResistorIEC, Capacitor, SwitchSpdt)
  └── Right Panel, Bottom (matplotlib FigureCanvas)
      └── Stacked Vc/I real-time plot (blitting, deque maxlen=300)
```

Data flow each tick (60 FPS):
1. `QTimer` fires → `SimulationApp._tick()` called
2. `PhysicsEngine.update_charge/discharge(dt)` — pure math, unchanged
3. New (Vc, I) pushed to graph deque
4. Graph figure blitted with new data point
5. Circuit figure redrawn only when switch toggles or R/C changes

---

## 3. Window Layout (800×600)

```
┌──────────────────────────────────────────────────────────────┐
│  RC Circuit Simulator                                [─][□][×]│
├───────────────────────────┬──────────────────────────────────┤
│  Resistance:  ○──────●──  │                                  │
│  Capacitance: ○──●──────  │     Circuit Schematic            │
│                           │   ┌──────────────────────┐       │
│  [▶ Play/Pause] [↺ Reset] │   │  ┌───┐               │       │
│                           │   │ ─┤+  ├──[R]──o─o──[C]│       │
│  Vc = 5.23 V              │   │  └─┬─┘  ║            │       │
│  I  = 12.34 mA            │   │    │    ║ CHG         │       │
│  τ  = 0.100 s             │   │  ──┘    ║/            │       │
│  t  = 2.50 s              │   └──────────────────────┘       │
│                           │                                   │
│  ┌───────────────────┐    │   ┌──────────────────────┐       │
│  │ Vc (V) ────────┐  │    │   │ I (mA)               │       │
│  │          ╱╲    ╱│  │    │   │  ╱╲        ╱╲       │       │
│  │  ╱╲    ╱  ╲  ╱ │  │    │   │ ╱  ╲  ╱╲╱  ╲      │       │
│  │ ╱  ╲  ╱    ╲╱  │  │    │   │╱    ╲╱      ╲     │       │
│  │╱    ╲╱          │  │    │   └──────────────────────┘       │
│  └───────────────────┘  │                                   │
│                           │   R=1000Ω  C=100µF  τ=0.100s    │
├───────────────────────────┴──────────────────────────────────┤
│  ESC to exit                                                  │
└──────────────────────────────────────────────────────────────┘
```

- Left panel: 340px fixed width
- Right panel: 460px — circuit (top, ~240px) + graph (bottom, ~260px)
- 10px margins between panels and border

---

## 4. Component Details

### 4.1 PhysicsEngine (unchanged)

Exact same file at `physics_engine.py`. No modifications.

### 4.2 SimulationApp (QMainWindow)

New `main.py`:

```python
class SimulationApp(QMainWindow):
    def __init__(self):
        self.physics = PhysicsEngine(r=1000.0, c=100e-6)
        self.paused = False
        self.switch_mode = SPDT_Switch.MODE_CHARGE
        self._build_ui()
        self._build_circuit()
        self._build_graph()
        self.timer = QTimer()
        self.timer.timeout.connect(self._tick)
        self.timer.start(16)  # ~60 FPS
```

Callbacks:
- `_tick()` — dt = time since last tick, clamp to 0.1s, update physics, push graph data, update info labels, blit graph canvas
- `_on_R_changed(value)` — map log slider position to R, update physics.R, redraw circuit label
- `_on_C_changed(value)` — map log slider position to C, update physics.C, redraw circuit label
- `_on_play_pause()` — toggle self.paused
- `_on_reset()` — physics.reset(), graph.clear()
- `_on_switch_toggle()` — toggle switch_mode, redraw circuit schematic

### 4.3 Sliders (QSlider)

- R: 100Ω – 1MΩ, logarithmic scale (slider position `i` mapped to `100 * (1M/100)^(i/999)`)
- C: 10µF – 10,000µF, logarithmic scale
- Horizontal orientation, dark-themed
- Current value shown in a QLabel beside the slider
- `valueChanged` signal connected to `_on_R_changed` / `_on_C_changed`

### 4.4 Buttons (QPushButton)

- Play/Pause — toggle button, text toggles between "▶ Pause" and "▶ Play" depending on paused state
- Reset — emits clicked signal, triggers physics + graph reset
- Dark themed via stylesheet

### 4.5 Info Readouts (QLabel)

Four formatted lines in a QVBoxLayout:
- `Vc = X.XX V` (cyan)
- `I  = X.XX mA` (green)
- `τ  = X.XXX s` (orange)
- `t  = X.X s` (white)

Updated each tick by calling `.setText()` on each QLabel. Monospace font.

### 4.6 Circuit Schematic (schemdraw on matplotlib FigureCanvas)

**No hand-drawn patches.** The entire schematic is built with schemdraw elements and rendered onto a matplotlib Axes embedded in a `FigureCanvasQWidget` (PySide6 variant of FigureCanvasQTAgg).

```python
import schemdraw
import schemdraw.elements as elm

def _build_circuit(self):
    self.circuit_canvas = FigureCanvas(Figure(figsize=(5, 3)))
    self.circuit_ax = self.circuit_canvas.figure.subplots()
    self._redraw_circuit()

def _redraw_circuit(self):
    self.circuit_ax.clear()
    d = schemdraw.Drawing(fontsize=11)
    d.add(elm.Battery().up().label('V₀', color='red'))
    d.add(elm.ResistorIEC().right().label('R'))
    d.add(elm.SwitchSpdt().right().label('CHG', color='orange'))
    d.add(elm.Capacitor().down().label('C'))
    d.add(elm.Line().left())
    d.add(elm.Line().left())
    d.add(elm.Line().down())
    d.add(elm.Line().left())
    d.draw(ax=self.circuit_ax)
    self.circuit_ax.axis('off')
    self.circuit_canvas.draw()
```

**Components used:**
| schemdraw element | Circuit part |
|---|---|
| `Battery()` | Voltage source (multi-cell symbol) |
| `ResistorIEC()` | Rectangular box resistor (matching user's preference) |
| `Capacitor()` | Standard parallel-plate capacitor |
| `SwitchSpdt()` | Three-terminal SPDT toggle |
| `Line()` | Wire segments between components |
| `Dot()` | Junction dots at connections |
| `.label()` on elements | Component labels (R, C, V₀) |

**Switch interactivity:**
- `SwitchSpdt()` produces a matplotlib artist we can connect a `pick_event` to
- On click → toggle switch_mode from CHARGE to DISCHARGE
- The switch element's `.color()` changes based on mode
- Active path highlighted by coloring relevant wire segments

**Redraw strategy:**
- Full `_redraw_circuit()` called only on: switch toggle, R slider release, C slider release
- Between changes, the circuit canvas is static — no per-frame redraw
- This means zero per-frame cost for the schematic

### 4.7 Real-Time Graph (matplotlib FigureCanvas)

One `FigureCanvas` with two vertically stacked subplots:

```python
def _build_graph(self):
    self.graph_fig = Figure(figsize=(5, 3))
    self.graph_ax_v = self.graph_fig.subplots(2, 1, sharex=True)
    self.vc_line, = self.graph_ax_v[0].plot([], [], color='cyan', linewidth=1.5)
    self.i_line, = self.graph_ax_v[1].plot([], [], color='lime', linewidth=1.5)
    # Dark styling, grid, labels
    self.graph_fig.tight_layout()
    self.graph_canvas = FigureCanvas(self.graph_fig)
```

Update each tick:

```python
def _update_graph(self):
    self.vc_line.set_data(self.t_data, self.vc_data)
    self.i_line.set_data(self.t_data, self.i_data)
    self.graph_ax_v[0].relim()
    self.graph_ax_v[0].autoscale_view()
    self.graph_ax_v[1].relim()
    self.graph_ax_v[1].autoscale_view()
    self.graph_canvas.draw_idle()
```

Or with blitting for performance:

```python
def _init_graph(self):
    self.graph_canvas.draw()
    self._bg = self.graph_canvas.copy_from_bbox(self.graph_fig.bbox)

def _update_graph_blit(self):
    self.graph_canvas.restore_region(self._bg)
    self.graph_ax_v[0].draw_artist(self.vc_line)
    self.graph_ax_v[1].draw_artist(self.i_line)
    self.graph_canvas.blit(self.graph_fig.bbox)
```

Rolling window: `collections.deque(maxlen=300)` for Vc and I, converted to lists for plotting against a derived time axis.

### 4.8 SPDT Switch

| Aspect | Approach |
|---|---|
| Rendering | `schemdraw.elements.SwitchSpdt()` drawn on circuit axes |
| Event handling | `mpl_connect('pick_event', self._on_switch_pick)` on the switch artist |
| Mode state | `self.switch_mode` string in SimulationApp |
| Visual feedback | Full `_redraw_circuit()` call with new mode — lever repositions, color changes |
| Active path | Colored wire segment from switch to capacitor (set via schemdraw `.color()` on relevant lines) |

---

## 5. Dark Theme

PySide6 stylesheet:

```python
app.setStyle('Fusion')
dark_palette = QPalette()
dark_palette.setColor(QPalette.Window, QColor(30, 30, 35))
dark_palette.setColor(QPalette.WindowText, QColor(220, 220, 230))
dark_palette.setColor(QPalette.Button, QColor(40, 42, 48))
dark_palette.setColor(QPalette.ButtonText, QColor(220, 220, 230))
# ... etc
app.setPalette(dark_palette)
```

Matplotlib rcParams:

```python
plt.rcParams.update({
    'figure.facecolor': '#1e1e23',
    'axes.facecolor': '#16181c',
    'axes.edgecolor': '#555555',
    'axes.labelcolor': '#cccccc',
    'text.color': '#cccccc',
    'grid.color': '#3a3a3a',
})
```

Schemdraw inherits the matplotlib axes appearance.

---

## 6. Dependencies

```
matplotlib>=3.8
PySide6>=6.5
schemdraw>=0.20
```

Install:
```bash
source .venv/bin/activate
pip install matplotlib PySide6 schemdraw
```

All other libraries (collections, math, sys) are standard library.

---

## 7. Files Changed

| Action | File | Notes |
|---|---|---|
| **Delete** | `circuit_renderer.py` | Replaced by schemdraw circuit |
| **Delete** | `current_visualizer.py` | Feature removed (user approved) |
| **Delete** | `ui_manager.py` | Replaced by PySide6 QSlider/QPushButton |
| **Delete** | `info_panel.py` | Replaced by QLabel widgets |
| **Delete** | `real_time_graph.py` | Replaced by matplotlib graph FigureCanvas |
| **Keep** | `tests/test_physics_engine.py` | Unchanged — PhysicsEngine untouched |
| **Rewrite** | `main.py` | New `SimulationApp(QMainWindow)` with PySide6 + matplotlib + schemdraw |
| **Keep** | `physics_engine.py` | Unchanged |

---

## 8. Edge Cases

| Case | Handling |
|---|---|
| Window minimized 10s | QTimer pauses when hidden → dt capped at 0.1s on resume (PhysicsEngine handles it) |
| R slider at minimum (100Ω) | Floor enforced by slider limits |
| C slider at minimum (10µF) | Floor enforced by slider limits |
| Switch toggle mid-cycle | PhysicsEngine handles smooth transition natively |
| Running for hours | deque(maxlen=300) prevents memory growth |
| Circuit figure redraw frequency | Only redrawn on switch toggle or R/C change — not per frame |
| Graph blit on first frame | First frame full draw, subsequent frames blit for performance |
| V₀ value display | Updated on circuit redraw via schemdraw `.label()`