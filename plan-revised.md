# Role & Objective
You are an expert Python developer specializing in PySide6 and physics-based educational simulations. Your objective is to build a standalone, interactive RC (Resistor-Capacitor) circuit simulator application.

To minimize errors, you must implement this application incrementally across 5 testable phases. Do not proceed to a subsequent phase until the current phase is fully functional and passes its specific verification test.

---

## Technical Specifications

- **Tech Stack:** Python 3, PySide6 (Qt for Python), matplotlib, and schemdraw.
- **Architecture:** Component-based, signal-driven architecture. Math/physics logic must be fully decoupled from UI widgets.
- **Performance:** 30–60 Hz refresh rate driven by a QTimer. Utilize QElapsedTimer for accurate frame delta-time (dt) calculations to avoid simulation time drift.
- **Graphics Constraint:** The schemdraw schematic canvas must remain static and only redraw ONCE when the charge/discharge state changes. To redraw the switch, you must clear ONLY the schematic subplot (ax_schem.clear()), leaving the graph subplot completely untouched. Real-time numbers must modify existing canvas text elements (text_handle.set_text), and graph lines must update via line.set_data to ensure zero lag.

---

## The Core Physics Equations (Pseudocode Format)
- Time Constant: tau = R * C
- Charging State:
    Vc_new = Vc_old + (V0 - Vc_old) * (1 - exp(-dt / tau))
    Current_I = (V0 - Vc_new) / R
- Discharging State:
    Vc_new = Vc_old * exp(-dt / tau)
    Current_I = -Vc_new / R

---

## Scope

- **In:** A single PySide6 desktop window. Left side: Sidebar control panel (Sliders for R and C, Radio buttons for Charge/Discharge selection, Pause/Resume button, and a Reset button). Right side: Embedded Matplotlib canvas drawing a textbook-quality circuit via schemdraw, live updated text labels on the components, and scrolling dual-axis plots for Vc and I underneath.
- **Out:** Moving current particle animations inside the wires, custom circuit layout building (drag-and-drop), and external database connections.

---

## Phased Implementation & Verification Plan

### Phase 1: Pure Physics Core & Terminal Validation
- **Goal:** Build the independent math engine without any user interface or graphics.
- **Action Items:**
  - [ ] Create a PhysicsEngine class holding variables for R, C, V0, and Vc.
  - [ ] Implement methods for update_charging(dt) and update_discharging(dt) using the continuous exponential formulas.
  - [ ] Add slider-mapping logic that restricts values safely to: 100 Ohms <= R <= 100 kOhms and 10 uF <= C <= 4700 uF to prevent division by zero.
- **Verification Test:** Write a short terminal script script that instantiates the engine, runs a loop simulating 1 full time constant (t = tau) using a mock fixed dt, and prints an assertion confirming that charging Vc reaches exactly ~63.2% of V0.

### Phase 2: PySide6 Window Layout & Isolated Subplots
- **Goal:** Establish the desktop layout shell and render the high-quality circuit canvas.
- **Action Items:**
  - [ ] Create a CircuitSimWindow subclassing QMainWindow with a enforced minimum size of 800x600.
  - [ ] Set up a horizontal layout (QHBoxLayout): PySide6 control widgets go on the left panel, an embedded Matplotlib FigureCanvasQTAgg goes on the right panel.
  - [ ] Divide the Matplotlib figure into two subplots: top subplot (ax_schem) for the circuit, bottom subplot (ax_graph) for the charts.
  - [ ] Draw a standard loop RC circuit schematic inside ax_schem using schemdraw.
- **Verification Test:** Run the script. A modern desktop window should open seamlessly. The left side must feature empty placeholders for controls, and the right side must display a crisp, vector-quality schematic diagram.

### Phase 3: Sidebar Controls, Signals, and Live Text Readouts
- **Goal:** Connect interactive sidebar widgets to the math core and implement dynamic canvas text updates.
- **Action Items:**
  - [ ] Instantiate QSlider widgets for R and C, and a QRadioButton group for "Circuit Mode: Charge / Discharge" on the PySide6 left sidebar. Connect Qt slots to pass changes instantly to the PhysicsEngine.
  - [ ] Place permanent Matplotlib text markers (ax_schem.text) onto the schematic canvas adjacent to the capacitor and resistor icons.
  - [ ] Start a PySide6 QTimer paired with a QElapsedTimer. Every tick, calculate precise dt, update the physics engine state, and update the text metrics dynamically (e.g., "Vc = 4.12 V", "I = 1.22 mA").
  - [ ] When the Radio Button changes state, clear ONLY ax_schem and redraw the schemdraw circuit with the switch flipped to its new configuration.
- **Verification Test:** Run the application. Moving the sliders should alter variables instantly. Flipping the radio buttons should visually toggle the schematic switch position, and the text metrics should immediately start counting up or down in real-time.

### Phase 4: Scrolling Dual-Axis Real-Time Graphing
- **Goal:** Layer on smooth, scrolling line plots beneath the schematic canvas without causing application lag.
- **Action Items:**
  - [ ] Configure the lower subplot (ax_graph) with dual axes using ax_graph.twinx() (left axis for Voltage, right axis for Current).
  - [ ] Implement three collections.deque(maxlen=300) queues to store historical values for Time, Vc, and I.
  - [ ] Initialize two plot line objects. On every QTimer tick, append data to the deques, pass data to the lines using line.set_data(), and dynamically shift the horizontal view frame using ax_graph.set_xlim(min(time_deque), max(time_deque)).
- **Verification Test:** Run the application and select Charge. The lower plot window must show two distinct, color-coded curves tracking across a smoothly moving timeline. The UI window must remain highly responsive.

### Phase 5: Global Controls, Reset Actions & Robustness
- **Goal:** Finish the application with utility control features and window stability guards.
- **Action Items:**
  - [ ] Add a QPushButton to toggle a global simulation Play/Pause flag. When paused, stop the QTimer physics updates.
  - [ ] Add a "Reset Simulation" QPushButton that sets Vc back to 0, clears all data deques, and resets the elapsed time tracker to zero.
  - [ ] Set strict layouts so resizing the window scales the Matplotlib subplots evenly without stretching the text labels or overlapping components.
- **Verification Test:** Toggle the pause button mid-charge to confirm data freezes instantly. Click the reset button to verify that the graph history clears instantly and returns to zero.

---

## Expected Output
Provide a fully written, modular, and extensively commented Python script containing all finalized classes. The codebase must execute straight out of the box with zero missing dependencies outside of standard PySide6, Matplotlib, and Schemdraw library installations.
