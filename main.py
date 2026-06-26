# main.py
"""RC Circuit Simulator — PySide6 + matplotlib + schemdraw.
Replaces the original pygame-based implementation.
"""

import sys
from collections import deque

import matplotlib
matplotlib.use('QtAgg')

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
import matplotlib.pyplot as plt

from PySide6.QtCore import QElapsedTimer, QTimer, Qt
from PySide6.QtGui import QFont, QPalette, QColor
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSlider, QLabel, QPushButton, QRadioButton, QButtonGroup,
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
        self._sim_time = 0.0  # elapsed simulation time (seconds)
        self.elapsed_timer = QElapsedTimer()
        self.elapsed_timer.start()

        # ── Graph data buffers ──
        buffer_size = 300
        self.times = deque(maxlen=buffer_size)
        self.vc_data = deque(maxlen=buffer_size)
        self.i_data = deque(maxlen=buffer_size)

        # ── Build UI ──
        self._build_ui()

        # ── Timer (~60 FPS) ──
        self.timer = QTimer()
        self.timer.timeout.connect(self._tick)
        self.timer.start(16)

    # ──────────────────────────────────────────
    # UI Construction
    # ──────────────────────────────────────────

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        hbox = QHBoxLayout(central)
        hbox.setContentsMargins(10, 10, 10, 10)
        hbox.setSpacing(10)

        # ── Left sidebar ──
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
        self.r_slider.setValue(477)  # ~1kΩ
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
        self.c_slider.setValue(477)  # ~100µF
        self.c_slider.valueChanged.connect(self._on_c_changed)
        left_layout.addWidget(self.c_slider)

        self.c_label = QLabel("100 µF")
        self.c_label.setStyleSheet("color: #00c8dc;")
        left_layout.addWidget(self.c_label)

        left_layout.addSpacing(10)

        # Mode radio buttons
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
        btn_style = (
            "QPushButton { background-color: #3a3d45; color: #dddddd; "
            "border: 1px solid #555; border-radius: 4px; padding: 6px 16px; }"
            "QPushButton:hover { background-color: #4a4d55; }"
        )
        self.play_btn.setStyleSheet(btn_style)
        left_layout.addWidget(self.play_btn)

        # Reset button
        self.reset_btn = QPushButton("↺ Reset")
        self.reset_btn.clicked.connect(self._on_reset)
        reset_style = (
            "QPushButton { background-color: #3a3d45; color: #f0a030; "
            "border: 1px solid #f0a030; border-radius: 4px; padding: 6px 16px; }"
            "QPushButton:hover { background-color: #4a4050; }"
        )
        self.reset_btn.setStyleSheet(reset_style)
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

        # ── Right panel — matplotlib figure ──
        # Use pyplot for figure creation so schemdraw's internal show() works
        self.fig, (self.ax_schem, self.ax_graph) = plt.subplots(
            2, 1, figsize=(6, 5), facecolor='#1e1e23'
        )

        # Dark styling for axes
        for ax in [self.ax_schem, self.ax_graph]:
            ax.set_facecolor('#16181c')
            ax.tick_params(colors='#888888')
            for spine in ax.spines.values():
                spine.set_color('#3a3a3a')

        self.ax_schem.axis('off')
        self.ax_schem.set_aspect('equal')

        # Graph — twinx dual axes
        self.ax_graph.set_xlabel('Time (s)', color='#cccccc')
        self.ax_graph.set_ylabel('Vc (V)', color='#00ffff')
        self.ax_graph.tick_params(axis='y', colors='#00ffff')
        self.ax_graph.grid(True, color='#3a3a3a', linewidth=0.5)

        self.ax_i = self.ax_graph.twinx()
        self.ax_i.set_ylabel('I (mA)', color='#00dc00')
        self.ax_i.tick_params(axis='y', colors='#00dc00')

        # Empty plot lines
        self.vc_line, = self.ax_graph.plot([], [], color='#00ffff', linewidth=1.5)
        self.i_line, = self.ax_i.plot([], [], color='#00dc00', linewidth=1.5)

        # Set initial y-axis ranges
        self.ax_graph.set_ylim(0, 13)
        self.ax_i.set_ylim(0, 130)

        self.fig.tight_layout()

        # Matplotlib canvas
        self.canvas = FigureCanvas(self.fig)

        # ── Assemble ──
        hbox.addWidget(left)
        hbox.addWidget(self.canvas, stretch=1)

        # Draw initial circuit
        self._redraw_circuit()

    # ──────────────────────────────────────────
    # Slider Logic
    # ──────────────────────────────────────────

    @staticmethod
    def _map_slider_to_log(value, vmin, vmax):
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

    # ──────────────────────────────────────────
    # Mode / Controls
    # ──────────────────────────────────────────

    def _on_mode_changed(self):
        self.is_charging = self.radio_charge.isChecked()
        self._redraw_circuit()

    def _on_play_pause(self):
        self.paused = not self.paused
        if self.paused:
            self.play_btn.setText("▶ Play")
        else:
            self.play_btn.setText("⏸ Pause")
            self.elapsed_timer.start()

    def _on_reset(self):
        self.physics.reset()
        self._sim_time = 0.0
        self.times.clear()
        self.vc_data.clear()
        self.i_data.clear()
        self._update_graph()
        self._update_info()

    # ──────────────────────────────────────────
    # Circuit Schematic (schemdraw)
    # ──────────────────────────────────────────

    def _redraw_circuit(self):
        """Redraw the schemdraw circuit on ax_schem.

        Called only when mode, R, or C changes — not per frame.
        """
        self.ax_schem.clear()
        self.ax_schem.axis('off')
        self.ax_schem.set_aspect('equal')

        # ── Rectangular loop (schemdraw) ──
        d = schemdraw.Drawing(fontsize=12)

        # Left branch: Battery
        d.add(elm.Battery().up().at((0, 0)).color('#ffffff'))
        d.add(elm.Label().at((-0.7, 1.5)).label('12.0 V', halign='right', valign='center', color='#ffffff'))

        # Top-left wire: from battery top (0,3) to terminal 'a' (3,3)
        d.add(elm.Line().right().at((0, 3)).to((3, 3)).color('#ffffff'))

        # Dot and label at terminal 'a'
        d.add(elm.Dot().at((3, 3)).color('#cccccc'))
        d.add(elm.Label().at((3.0, 3.25)).label('a', halign='center', valign='center', color='#cccccc', fontsize=9))

        # Dot and label at terminal 'b'
        d.add(elm.Dot().at((4.5, 1.5)).color('#cccccc'))
        d.add(elm.Label().at((4.2, 1.5)).label('b', halign='center', valign='center', color='#cccccc', fontsize=9))

        # Vertical stub for 'b' from bottom return wire (4.5, 0) to (4.5, 1.5)
        d.add(elm.Line().up().at((4.5, 0)).to((4.5, 1.5)).color('#888888'))

        # Dot at switch pivot (6,3)
        d.add(elm.Dot().at((6, 3)).color('#ffbb33'))

        # Draw switch arm based on state
        if self.is_charging:
            d.add(elm.Line().at((6, 3)).to((3, 3)).color('#ffbb33').linewidth(2.5))
        else:
            d.add(elm.Line().at((6, 3)).to((4.5, 1.5)).color('#ffbb33').linewidth(2.5))

        # Resistor starting at pivot (6,3) to (9,3)
        d.add(elm.ResistorIEC().right().at((6, 3)).label('R', loc='top', color='#00dc00').color('#00dc00'))

        # Wire from Resistor to Capacitor top (9,3) to (12,3)
        d.add(elm.Line().right().at((9, 3)).to((12, 3)).color('#ffffff'))

        # Capacitor going down from (12,3) to (12,0)
        d.add(elm.Capacitor().down().at((12, 3)).label('C', loc='left', color='#00ffff').color('#00ffff'))

        # Bottom wire returning from (12,0) to (0,0)
        d.add(elm.Line().left().at((12, 0)).to((0, 0)).color('#ffffff'))

        # Draw drawing elements to the canvas
        d.draw(canvas=self.ax_schem, show=False)

        # Set axes limit with margins to prevent cut-offs
        self.ax_schem.set_xlim(-1.5, 14.5)
        self.ax_schem.set_ylim(-0.8, 4.2)

        # ── Dynamic text markers — created AFTER ax.clear(), stored for
        #     per-tick updates via set_text() in _tick(). ──
        r_val = self.physics.R
        c_val = self.physics.C
        tau = self.physics.tau
        vc = self.physics.VC

        # Get initial current
        current = (self.physics.current if self.is_charging
                   else self.physics.discharge_current)

        self._canvas_texts = {
            'vc': self.ax_schem.text(
                12.8, 1.5, f"Vc = {vc:.2f} V",
                color='#00ffff', fontsize=11, fontweight='bold',
                ha='left', va='center',
            ),
            'i': self.ax_schem.text(
                7.5, 2.1, f"I = {current*1000:.2f} mA",
                color='#00dc00', fontsize=11, fontweight='bold',
                ha='center', va='center',
            ),
            'params': self.ax_schem.text(
                6.0, -0.5,
                f"R={r_val:.0f}Ω  C={c_val*1e6:.0f}µF  τ={tau:.3f}s",
                color='#888888', fontsize=9,
                ha='center', va='center',
            ),
        }

        self.canvas.draw_idle()


    # ──────────────────────────────────────────
    # Simulation Tick
    # ──────────────────────────────────────────

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

        self._sim_time += dt

        # Current (A → mA for display)
        current = (self.physics.current if self.is_charging
                   else self.physics.discharge_current)

        # Push to graph buffers
        self.times.append(self._sim_time)
        self.vc_data.append(self.physics.VC)
        self.i_data.append(current * 1000.0)

        # Update graph
        self._update_graph()

        # Update sidebar QLabels
        self._update_info()

        # Update canvas text markers via set_text (no redraw)
        if hasattr(self, '_canvas_texts'):
            self._canvas_texts['vc'].set_text(f"Vc = {self.physics.VC:.2f} V")
            self._canvas_texts['i'].set_text(f"I = {current*1000:.2f} mA")

    # ──────────────────────────────────────────
    # Graph Update
    # ──────────────────────────────────────────

    def _update_graph(self):
        """Update the scrolling plot lines (no full redraw)."""
        if not self.times:
            return

        t = list(self.times)
        self.vc_line.set_data(t, list(self.vc_data))
        self.i_line.set_data(t, list(self.i_data))

        # Vc — autoscale normally (0 → V₀ range is well-behaved)
        self.ax_graph.relim()
        self.ax_graph.autoscale_view()

        # Current — scale axis to actual R so the exponential decay is
        # clearly visible.  I_max = V₀ / R, with 20% headroom and a
        # floor of ±1 mA so the axes remain readable at high R values.
        v0 = 12.0
        i_scale = (v0 / self.physics.R) * 1000 * 1.2   # mA, 20% margin
        i_scale = max(i_scale, 1.0)                      # minimum ±1 mA
        self.ax_i.set_ylim(-i_scale, i_scale)

        # Scroll window: show last 10s of data
        window = 10.0
        now = t[-1]
        self.ax_graph.set_xlim(max(0, now - window), max(window, now))

        self.canvas.draw_idle()

    # ──────────────────────────────────────────
    # Info Readouts
    # ──────────────────────────────────────────

    def _update_info(self):
        """Update sidebar QLabels."""
        current = (self.physics.current if self.is_charging
                   else self.physics.discharge_current)
        self.info_vc.setText(f"Vc = {self.physics.VC:6.2f} V")
        self.info_i.setText(f"I  = {current*1000:6.2f} mA")
        self.info_tau.setText(f"τ  = {self.physics.tau:6.3f} s")
        self.info_t.setText(f"t  = {self._sim_time:6.1f} s")

    # ──────────────────────────────────────────
    # Cleanup
    # ──────────────────────────────────────────

    def closeEvent(self, event):
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

    app.setStyleSheet(
        "QMainWindow { background-color: #1e1e23; }"
        "QWidget { background-color: #1e1e23; }"
    )

    window = CircuitSimWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()