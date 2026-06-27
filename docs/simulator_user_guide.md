# RC Circuit Simulator Quick-Start Guide

This guide explains how to use the simulator to complete your lab exercises.

---

## 1. The Controls (Left Sidebar)
* **Resistance ($R$):** Drag the slider to change the resistor size ($100\ \Omega$ to $100\text{ k}\Omega$).
* **Capacitance ($C$):** Drag the slider to change the capacitor size ($10\ \mu\text{F}$ to $4700\ \mu\text{F}$).
* **Circuit Mode:** 
  * **Charge:** Connects the battery to charge the capacitor.
  * **Discharge:** Disconnects the battery to discharge the capacitor.
* **Control Buttons:**
  * **Play / Pause:** Starts or pauses the simulation.
  * **Reset:** Resets time back to $0$ seconds, clears the graph, and resets the capacitor.

---

## 2. Reading Telemetry (Left Sidebar)
* **Telemetry Readouts:** Shows real-time values of capacitor voltage ($V_C$), resistor voltage ($V_R$), current ($I$), and elapsed time ($t$).
* **Time Constant ($\tau$):** Displays the calculated time constant ($\tau = R \times C$). The simulation automatically pauses when it reaches $10\tau$.
* **Energy Distribution:** Shows the energy supplied by the battery, stored in the capacitor, and lost as heat in the resistor.
* **Ratio Bar:** Visualizes the percentage split of energy between the capacitor (blue) and resistor (grey).

---

## 3. Visuals & Interactive Chart (Right Panel)
* **Schematic:** Displays the circuit layout. The moving dashed lines represent current flow (faster speed = more current).
* **Graph:** Tracks Capacitor Voltage (blue curve) and Current (green/red curve) over time.
* **Data Inspector:** Click and drag on the graph. An amber dashed vertical line will track your pointer, and the sidebar panels will update to show the exact values at that specific moment (indicated by a **● Inspecting** badge in the sidebar panel headers).

---

## 4. Basic Walkthrough
1. Select **Charge** mode. Set $R = 10\text{ k}\Omega$ and $C = 100\ \mu\text{F}$ (giving $\tau = 1.0\text{ s}$).
2. Click **Reset**, then click **Play**.
3. Once the simulation reaches steady state ($10.0\text{ s}$) and pauses, **click and drag** on the graph until the vertical line is at $t = 1.0\text{ s}$ ($1\tau$).
4. Check the sidebar readouts: the capacitor voltage should read approximately $7.59\text{ V}$ ($63.2\%$ of the source voltage).
5. Switch to **Discharge** mode, click **Reset**, and click **Play** to observe discharging.
