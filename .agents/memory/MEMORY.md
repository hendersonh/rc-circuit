# System Architecture & Purpose
RC Circuit Simulator is an interactive educational desktop application designed to visualize resistor-capacitor (RC) circuit charging and discharging behavior.
- **Decoupled Architecture**: Strictly separates the mathematical/state layer ([physics_engine.py](file:///home/ubuntu/projects/rc-circuit/physics_engine.py)) from the GUI layout and rendering logic ([main.py](file:///home/ubuntu/projects/rc-circuit/main.py)).
- **Physics Core**: Tracks instantaneous capacitor voltage ($V_C$), time constant ($\tau = R \times C$), loop current ($I$), and elapsed simulation time.
- **GUI & Plotting**: Hosts a control sidebar on the left and a matplotlib canvas on the right containing a schemdraw circuit schematic and live-scrolling dual-axis line charts.

# Immutable Coding & Style Conventions
- **Math Decoupling**: Do not embed physics calculations inside GUI callbacks. All state updates must flow through `PhysicsEngine`.
- **Value Constraints**: Keep parameters within safe bounds to prevent division by zero or numerical explosion:
  - Resistance: $100\ \Omega \le R \le 100\text{ k}\Omega$
  - Capacitance: $10\ \mu\text{F} \le C \le 4700\ \mu\text{F}$
  - Source Voltage: Fixed at $12.0\text{ V}$
- **Simulation Time Capping**: The time step ($dt$) processed in a single physics frame must be capped at $0.1\text{ s}$ to prevent state jumps if the UI lags or resumes from pause/minimization.
- **Schematic Redraw Rule**: Redraw the schemdraw schematic ONLY when parameters ($R, C$) change or when toggling between Charge/Discharge modes. Do not redraw the schematic canvas on every frame tick.
- **Real-Time Numbers**: Real-time readouts on the schematic axes (e.g. $V_C$ and $I$) must be modified in-place using `text_handle.set_text()` to avoid full redraw performance degradation.
- **Plot Performance**: Real-time charts must be updated by calling `.set_data()` on existing matplotlib `Line2D` objects, followed by `canvas.draw_idle()`.
- **UI Proportions**: Enforce a minimum window size of 800x600. Keep the left sidebar at a fixed width of 280px, allowing the matplotlib figure on the right to auto-stretch.
- **Git Workflow**: Always create a new dedicated branch for major code changes using the format `feature/[task-slug]` or `fix/[bug-slug]`.

# Core Tech Stack & Environment
- **Runtime**: Python 3.12+ (managed in a `.venv/` virtual environment).
- **GUI Framework**: PySide6 (Qt for Python) running the Fusion style theme with custom dark `QPalette` colors.
- **Plotting & Renderers**: 
  - Matplotlib (QtAgg backend) using a dark theme style.
  - Schemdraw for high-quality, vector-drawn schematics.
- **Virtual Environment Management**: Automatic activation and env export via `direnv` and `.envrc`.

# Active State & Immediate Roadmap
- **Active State**: 
  - Completed translation of legacy Pygame codebase to PySide6 and Matplotlib. All obsolete Pygame components have been deleted.
  - Interactive controls (sliders, radios, play/pause, reset) and dual-axis scrolling charts are fully implemented and functional.
  - Added a global `ag-init` command to the user's `~/.bashrc` to easily initialize new Antigravity Kit project folders.
- **Roadmap / Future Features**:
  - Implement additional math simulation properties (e.g., energy stored in the capacitor).
  - Add data export options (e.g., saving simulation runs to CSV).
