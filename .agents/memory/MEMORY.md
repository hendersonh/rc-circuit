# System Architecture & Purpose
RC Circuit Simulator is an interactive educational web application designed to visualize resistor-capacitor (RC) circuit charging and discharging behavior.
- **Decoupled Architecture**: Strictly separates the mathematical/state layer ([PhysicsEngine.ts](file:///home/ubuntu/projects/rc-circuit/src/physics/PhysicsEngine.ts)) from the GUI layout and rendering logic ([App.tsx](file:///home/ubuntu/projects/rc-circuit/src/App.tsx)).
- **Physics Core**: Tracks instantaneous capacitor voltage ($V_C$), time constant ($\tau = R \times C$), loop current ($I$), and elapsed simulation time.
- **GUI & Plotting**: Hosts a control sidebar on the left and a responsive layout on the right containing an interactive SVG circuit schematic and live-scrolling dual-axis line charts (via Chart.js).

# Immutable Coding & Style Conventions
- **Math Decoupling**: Do not embed physics calculations inside React component state loops. All state updates must flow through the ported `PhysicsEngine`.
- **Value Constraints**: Keep parameters within safe bounds to prevent numerical explosion:
  - Resistance: $100\ \Omega \le R \le 100\text{ k}\Omega$
  - Capacitance: $10\ \mu\text{F} \le C \le 4700\ \mu\text{F}$
  - Source Voltage: Fixed at $12.0\text{ V}$
- **Simulation Time Capping**: The time step ($dt$) processed in a single physics frame must be capped at $0.1\text{ s}$ to prevent state jumps if the browser window lags or loses focus.
- **Real-Time Numbers**: Real-time readouts on the schematic (e.g. $V_C$ and $I$) must be modified efficiently inside the rendering loop to avoid performance degradation.
- **UI Proportions**: Design with mobile-first and responsive desktop layouts. Keep the left control panel at a fixed width of 280px, letting the schematic and Chart.js canvas stretch to fill the remaining space.
- **Git Workflow**: Always create a new dedicated branch for major code changes using the format `feature/[task-slug]` or `fix/[bug-slug]`.

# Core Tech Stack & Environment
- **Runtime**: Node.js v18+.
- **Frontend Stack**: React 18, TypeScript, Vite.
- **Styling**: Vanilla CSS with custom dark cyber-physics aesthetics (Outfit typography, sharp corners, HSL gradients).
- **Plotting & Renderers**: 
  - Chart.js for real-time scrolling dual-axis graphs.
  - Native inline SVG with animated flow indicators for the circuit schematic.

# Active State & Immediate Roadmap
- **Active State**: 
  - Completed migration of the React/TS codebase from the subdirectory to the project root folder.
  - The legacy Pygame and PySide6/Python implementations have been completely deleted.
  - Interactive laboratory guide with six real-life exercises created in [rc_circuit_lab_guide.md](file:///home/ubuntu/projects/rc-circuit/docs/rc_circuit_lab_guide.md).
- **Roadmap / Future Features**:
  - Implement a CSV data export button to save simulation runs.
  - Deploy the root static page to Cloudflare Pages.
