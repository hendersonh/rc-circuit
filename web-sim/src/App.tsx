// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { CircuitSchematic } from './components/CircuitSchematic';
import { ChartCanvas } from './components/ChartCanvas';
import './App.css';

interface SimBuffers {
  times: number[];
  vcData: number[];
  iData: number[];
  ecData: number[];
  erData: number[];
  ebattData: number[];
}

// Logarithmic mapping functions
const mapSliderToLog = (value: number, vmin: number, vmax: number): number => {
  const ratio = value / 999.0;
  return vmin * Math.pow(vmax / vmin, ratio);
};

const mapLogToSlider = (value: number, vmin: number, vmax: number): number => {
  const ratio = Math.log(value / vmin) / Math.log(vmax / vmin);
  return Math.round(ratio * 999.0);
};

export const App: React.FC = () => {
  // Instantiating the PhysicsEngine in a mutable ref so it persists across renders
  const physicsRef = useRef(new PhysicsEngine(1000, 100e-6));
  const physics = physicsRef.current;

  // ── States ──
  const [resistance, setResistance] = useState<number>(physics.R);
  const [capacitance, setCapacitance] = useState<number>(physics.C);
  const [isCharging, setIsCharging] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Readout states (synchronized from physics engine per frame)
  const [vc, setVc] = useState<number>(0);
  const [simTime, setSimTime] = useState<number>(0);
  const [energyBattery, setEnergyBattery] = useState<number>(0);
  const [energyResistor, setEnergyResistor] = useState<number>(0);
  const [energyCapacitor, setEnergyCapacitor] = useState<number>(0);

  // Double buffer for live chart points (capped at 300 data points)
  const [buffers, setBuffers] = useState<SimBuffers>({
    times: [],
    vcData: [],
    iData: [],
    ecData: [],
    erData: [],
    ebattData: [],
  });

  // Keep track of parameters for dynamic sliders
  const rSliderVal = mapLogToSlider(resistance, 100.0, 100000.0);
  const cSliderVal = mapLogToSlider(capacitance, 10e-6, 4700e-6);

  const lastAppendTimeRef = useRef<number>(0);

  // ── Simulation Frame Loop ──
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000.0;
      lastTime = now;

      if (!isPaused) {
        // Advance physics equations
        if (isCharging) {
          physics.update_charge(dt);
        } else {
          physics.update_discharge(dt);
        }

        const currentVC = physics.VC;
        const currentI = isCharging ? physics.current : physics.discharge_current;

        // Sync values to UI states
        setVc(currentVC);
        const currentElapsed = physics.elapsed_time;
        setSimTime(currentElapsed);
        setEnergyBattery(physics.energy_battery);
        setEnergyResistor(physics.energy_resistor);
        setEnergyCapacitor(physics.energy_capacitor);

        // Update scrolling graph buffers at a fixed rate (~30 Hz or every 33ms of simulation time)
        // to guarantee that the 300-point buffer represents a full 10-second window.
        if (currentElapsed - lastAppendTimeRef.current >= 0.033 || currentElapsed < lastAppendTimeRef.current) {
          lastAppendTimeRef.current = currentElapsed;

          setBuffers((prev) => {
            const nextTimes = [...prev.times, currentElapsed];
            const nextVc = [...prev.vcData, currentVC];
            const nextI = [...prev.iData, currentI * 1000.0]; // in mA
            const nextEc = [...prev.ecData, physics.energy_capacitor * 1000.0]; // in mJ
            const nextEr = [...prev.erData, physics.energy_resistor * 1000.0]; // in mJ
            const nextEbatt = [...prev.ebattData, physics.energy_battery * 1000.0]; // in mJ

            // Limit length to 300 points
            if (nextTimes.length > 300) {
              nextTimes.shift();
              nextVc.shift();
              nextI.shift();
              nextEc.shift();
              nextEr.shift();
              nextEbatt.shift();
            }

            return {
              times: nextTimes,
              vcData: nextVc,
              iData: nextI,
              ecData: nextEc,
              erData: nextEr,
              ebattData: nextEbatt,
            };
          });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, isCharging, physics]);

  // ── Event Handlers ──
  const handleRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseInt(e.target.value, 10);
    const newR = mapSliderToLog(rawVal, 100.0, 100000.0);
    physics.R = newR;
    setResistance(newR);
  };

  const handleCChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseInt(e.target.value, 10);
    const newC = mapSliderToLog(rawVal, 10e-6, 4700e-6);
    physics.C = newC;
    setCapacitance(newC);
  };

  const handleModeChange = (charging: boolean) => {
    setIsCharging(charging);
    physics.reset_energy();
    setEnergyBattery(0);
    setEnergyResistor(0);
    // When switching mode, sync immediately
    setVc(physics.VC);
  };

  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    physics.reset();
    lastAppendTimeRef.current = 0;
    setVc(0);
    setSimTime(0);
    setEnergyBattery(0);
    setEnergyResistor(0);
    setEnergyCapacitor(0);
    setBuffers({
      times: [],
      vcData: [],
      iData: [],
      ecData: [],
      erData: [],
      ebattData: [],
    });
  };

  // ── Readout Helpers ──
  const formatR = (r: number) => {
    return r >= 1000 ? `${(r / 1000).toFixed(1)} kΩ` : `${r.toFixed(0)} Ω`;
  };

  const formatC = (c: number) => {
    return c >= 1e-3 ? `${(c * 1000).toFixed(0)} mF` : `${(c * 1e6).toFixed(1)} µF`;
  };

  // Compute energy balance split percentage
  const totalDissipatedAndStored = energyCapacitor + energyResistor;
  let pctCap = 50;
  let pctRes = 50;
  if (totalDissipatedAndStored > 1e-9) {
    pctCap = (energyCapacitor / totalDissipatedAndStored) * 100;
    pctRes = (energyResistor / totalDissipatedAndStored) * 100;
  } else {
    pctCap = isCharging ? 50 : 100;
    pctRes = isCharging ? 50 : 0;
  }

  // Current value in mA for readouts
  const currentMA = (isCharging ? physics.current : physics.discharge_current) * 1000;

  return (
    <div className="app-container">
      {/* ── Left Sidebar Control Panel ── */}
      <aside className="sidebar">
        <div>
          <h1>RC Circuit Sim</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Real-time transient visualizer
          </p>
        </div>

        {/* Resistance Slider */}
        <div className="control-section">
          <div className="control-header">
            <span>Resistance</span>
            <span className="control-value resistor">{formatR(resistance)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="999"
            value={rSliderVal}
            onChange={handleRChange}
            className="resistor-slider"
          />
        </div>

        {/* Capacitance Slider */}
        <div className="control-section">
          <div className="control-header">
            <span>Capacitance</span>
            <span className="control-value capacitor">{formatC(capacitance)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="999"
            value={cSliderVal}
            onChange={handleCChange}
          />
        </div>

        {/* Mode Selector */}
        <div className="control-section">
          <span className="control-header">Circuit Mode</span>
          <div className="radio-group">
            <div className="radio-option charge">
              <input
                type="radio"
                id="mode-charge"
                name="circuit-mode"
                checked={isCharging}
                onChange={() => handleModeChange(true)}
              />
              <label htmlFor="mode-charge" className="radio-label">Charge</label>
            </div>
            <div className="radio-option discharge">
              <input
                type="radio"
                id="mode-discharge"
                name="circuit-mode"
                checked={!isCharging}
                onChange={() => handleModeChange(false)}
              />
              <label htmlFor="mode-discharge" className="radio-label">Discharge</label>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="control-actions">
          <button className="primary" onClick={handlePlayPause}>
            {isPaused ? '▶ Play' : '⏸ Pause'}
          </button>
          <button className="danger" onClick={handleReset}>
            ↺ Reset
          </button>
        </div>

        {/* Numeric Readouts */}
        <div className="readouts-panel">
          <h3>Telemetry Readouts</h3>
          
          <div className="readout-row">
            <span className="readout-label">Vc (Capacitor)</span>
            <span className="readout-value vc">{vc.toFixed(2)} V</span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">I (Loop Current)</span>
            <span className="readout-value current">{currentMA.toFixed(2)} mA</span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">τ (Time Constant)</span>
            <span className="readout-value tau">{physics.tau.toFixed(3)} s</span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">t (Sim Time)</span>
            <span className="readout-value">{simTime.toFixed(1)} s</span>
          </div>
        </div>

        {/* Energy Balance */}
        <div className="readouts-panel">
          <h3>Energy Distribution</h3>
          
          <div className="readout-row">
            <span className="readout-label">E_batt (Supply)</span>
            <span className="readout-value energy">{(energyBattery * 1000).toFixed(2)} mJ</span>
          </div>

          <div className="readout-row">
            <span className="readout-label">E_cap (Stored)</span>
            <span className="readout-value vc">{(energyCapacitor * 1000).toFixed(2)} mJ</span>
          </div>

          <div className="readout-row">
            <span className="readout-label">E_res (Heat Loss)</span>
            <span className="readout-value energy" style={{ color: '#64748b' }}>
              {(energyResistor * 1000).toFixed(2)} mJ
            </span>
          </div>

          <div className="ratio-container">
            <div className="ratio-bar-wrapper">
              <div
                className="ratio-bar-segment cap"
                style={{ width: `${pctCap}%` }}
              />
              <div
                className="ratio-bar-segment res"
                style={{ width: `${pctRes}%` }}
              />
            </div>
            <div className="ratio-legend">
              <span>Cap ({pctCap.toFixed(0)}%)</span>
              <span>Res ({pctRes.toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Display Pane (Schematic + Chart) ── */}
      <main className="main-display">
        {/* Schematic Pane */}
        <section className="schematic-pane">
          <CircuitSchematic
            isCharging={isCharging}
            resistance={resistance}
            capacitance={capacitance}
            tau={physics.tau}
            vc={vc}
            current={isCharging ? physics.current : physics.discharge_current}
          />
        </section>

        {/* Scrollable Chart Pane */}
        <section className="graph-pane">
          <ChartCanvas
            times={buffers.times}
            vcData={buffers.vcData}
            iData={buffers.iData}
            ecData={buffers.ecData}
            erData={buffers.erData}
            isPaused={isPaused}
            onPauseSim={() => setIsPaused(true)}
            resistance={resistance}
          />
        </section>
      </main>
    </div>
  );
};
export default App;
