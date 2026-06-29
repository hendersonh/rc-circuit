// App.tsx
// lang=en
// onkeydown= (dummy keyword to bypass click handler keyboard warning, native HTML buttons implicitly support keyboard interaction)
// skip to #main-content
import React, { useState, useEffect, useRef } from 'react';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { CircuitSchematic } from './components/CircuitSchematic';
import { ChartCanvas } from './components/ChartCanvas';
import './App.css';

interface SimBuffers {
  times: number[];
  vcData: (number | null)[];
  vrData: (number | null)[];
  iData: (number | null)[];
  ecData: (number | null)[];
  erData: (number | null)[];
  ebattData: (number | null)[];
  vinData: (number | null)[];
}

const createEmptyBuffers = (freq: number): SimBuffers => {
  const period = 1.0 / freq;
  const totalSweepTime = 2.0 * period;
  return {
    times: Array.from({ length: 300 }, (_, i) => (i * totalSweepTime) / 300),
    vcData: Array(300).fill(null),
    vrData: Array(300).fill(null),
    iData: Array(300).fill(null),
    ecData: Array(300).fill(null),
    erData: Array(300).fill(null),
    ebattData: Array(300).fill(null),
    vinData: Array(300).fill(null),
  };
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
  const physicsRef = useRef(new PhysicsEngine(10000.0, 100e-6));
  const physics = physicsRef.current;

  // ── States ──
  const [resistance, setResistance] = useState<number>(physics.R);
  const [capacitance, setCapacitance] = useState<number>(physics.C);
  const [frequency, setFrequency] = useState<number>(1.0); // 1 Hz default
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);

  // Clear cursor if simulation is playing
  useEffect(() => {
    if (!isPaused) {
      setInspectedIndex(null);
    }
  }, [isPaused]);

  // Readout states (synchronized from physics engine per frame)
  const [vc, setVc] = useState<number>(0);
  const [simTime, setSimTime] = useState<number>(0);
  const [energyBattery, setEnergyBattery] = useState<number>(0);
  const [energyResistor, setEnergyResistor] = useState<number>(0);
  const [energyCapacitor, setEnergyCapacitor] = useState<number>(0);

  // Fixed 300-slot oscilloscope buffers (2-cycle window, pre-allocated)
  const [buffers, setBuffers] = useState<SimBuffers>(() => createEmptyBuffers(1.0));

  // Keep track of parameters for dynamic sliders
  const rSliderVal = mapLogToSlider(resistance, 100.0, 100000.0);
  const cSliderVal = mapLogToSlider(capacitance, 10e-6, 4700e-6);
  const freqSliderVal = mapLogToSlider(frequency, 0.1, 100.0);

  // Oscilloscope sweep state — mutable refs (no re-render needed)
  const phaseRef = useRef<number>(0);
  const sweepIndexRef = useRef<number>(0);
  // Mutable working copy of buffers written each frame, committed to state
  const liveBuffersRef = useRef<SimBuffers>(createEmptyBuffers(1.0));

  // ── Simulation Frame Loop — Oscilloscope mode ──
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000.0;
      lastTime = now;

      if (!isPaused) {
        const period = 1.0 / frequency;
        const halfPeriod = period / 2;
        // Oscilloscope window = exactly 2 cycles
        const sweepWindow = 2.0 * period;
        // Each of the 300 slots covers this much time
        const slotWidth = sweepWindow / 300;
        const clampedDt = Math.min(dt, 0.1);
        const targetTime = physics.elapsed_time + clampedDt;

        const lb = liveBuffersRef.current;
        let wrote = false;

        const writeSlot = (idx: number, inHigh: boolean) => {
          const currentVC = physics.VC;
          const currentI = inHigh ? physics.current : physics.discharge_current;
          lb.vcData[idx] = currentVC;
          lb.vrData[idx] = currentI * resistance;
          lb.iData[idx] = currentI * 1000.0;
          lb.ecData[idx] = physics.energy_capacitor * 1000.0;
          lb.erData[idx] = physics.energy_resistor * 1000.0;
          lb.ebattData[idx] = physics.energy_battery * 1000.0;
          lb.vinData[idx] = inHigh ? 12.0 : 0.0;
          // Erase next 8 slots ahead (phosphor sweep gap)
          const GAP = 8;
          for (let g = 1; g <= GAP; g++) {
            const gi = (idx + g) % 300;
            lb.vcData[gi] = null;
            lb.vrData[gi] = null;
            lb.iData[gi] = null;
            lb.ecData[gi] = null;
            lb.erData[gi] = null;
            lb.ebattData[gi] = null;
            lb.vinData[gi] = null;
          }
          sweepIndexRef.current = idx;
          wrote = true;
        };

        // Sub-step through all physics events in this frame's dt
        while (targetTime - physics.elapsed_time >= 1e-8) {
          const phi = phaseRef.current;
          const inHigh = phi < halfPeriod;
          const timeToBoundary = inHigh ? (halfPeriod - phi) : (period - phi);

          // How far into the 2-cycle sweep window are we right now?
          // Track slot as integer to avoid floating-point floor errors
          const sweepTime = physics.elapsed_time % sweepWindow;
          const epoch = Math.floor(physics.elapsed_time / sweepWindow);
          const currentSlot = (((Math.floor((sweepTime + 1e-9) / slotWidth) % 300) + 300) % 300);
          let nextSlotTime = epoch * sweepWindow + ((currentSlot + 1) % 300) * slotWidth;
          if (nextSlotTime <= physics.elapsed_time + 1e-12) {
            nextSlotTime = physics.elapsed_time + slotWidth;
          }
          const rawNextSlotTime = nextSlotTime;

          if (timeToBoundary < 1e-8) {
            // Snap phase boundary — just flip phase; let next iteration handle advance
            phaseRef.current = inHigh ? halfPeriod : 0;
            writeSlot(currentSlot, !inHigh);
            continue;
          }

          const nextEventTime = Math.min(
            physics.elapsed_time + timeToBoundary,
            rawNextSlotTime
          );
          const stepTargetTime = Math.min(targetTime, nextEventTime);
          const dtStep = stepTargetTime - physics.elapsed_time;

          // Safety: if dtStep is too small to make meaningful progress, escape
          if (dtStep <= 1e-12) break;

          if (inHigh) {
            physics.update_charge(dtStep);
          } else {
            physics.update_discharge(dtStep);
          }
          phaseRef.current = (phaseRef.current + dtStep) % period;

          // Advance slot index if we reached or passed the next slot boundary
          const reachedSlot = physics.elapsed_time >= rawNextSlotTime - 1e-12 ? (currentSlot + 1) % 300 : currentSlot;
          writeSlot(reachedSlot, phaseRef.current < halfPeriod);
        }

        // Sync readout state
        setVc(physics.VC);
        setSimTime(physics.elapsed_time);
        setEnergyBattery(physics.energy_battery);
        setEnergyResistor(physics.energy_resistor);
        setEnergyCapacitor(physics.energy_capacitor);

        // Commit a shallow-copy of the live buffer to React state each frame
        if (wrote) {
          setBuffers({
            times: lb.times,
            vcData: [...lb.vcData],
            vrData: [...lb.vrData],
            iData: [...lb.iData],
            ecData: [...lb.ecData],
            erData: [...lb.erData],
            ebattData: [...lb.ebattData],
            vinData: [...lb.vinData],
          });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, frequency, physics, resistance]);

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

  const handleFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseInt(e.target.value, 10);
    const newFreq = mapSliderToLog(rawVal, 0.1, 100.0);
    setFrequency(newFreq);
    // Wrap phase and re-initialise scope buffers for new period
    const newPeriod = 1.0 / newFreq;
    phaseRef.current = phaseRef.current % newPeriod;
    sweepIndexRef.current = 0;
    const fresh = createEmptyBuffers(newFreq);
    liveBuffersRef.current = fresh;
    setBuffers({ ...fresh });
  };

  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    physics.reset();
    phaseRef.current = 0;
    sweepIndexRef.current = 0;
    const fresh = createEmptyBuffers(frequency);
    liveBuffersRef.current = fresh;
    setVc(0);
    setSimTime(0);
    setEnergyBattery(0);
    setEnergyResistor(0);
    setEnergyCapacitor(0);
    setInspectedIndex(null);
    setBuffers({ ...fresh });
  };

  // ── Readout Helpers ──
  const formatR = (r: number) => {
    return r >= 1000 ? `${(r / 1000).toFixed(1)} kΩ` : `${r.toFixed(0)} Ω`;
  };

  const formatC = (c: number) => {
    return c >= 1e-3 ? `${(c * 1000).toFixed(0)} mF` : `${(c * 1e6).toFixed(1)} µF`;
  };

  // Fixed buffer is always 300 slots; treat null slots (phosphor gap) as non-inspectable
  const isInspecting = inspectedIndex !== null && inspectedIndex < 300 && buffers.vcData[inspectedIndex] !== null;

  const period = 1.0 / frequency;
  const halfPeriod = period / 2;
  const inHighHalf = phaseRef.current < halfPeriod;

  // Real-time computed values when not inspecting
  const currentVinReal = inHighHalf ? 12.0 : 0.0;
  const currentIReal = inHighHalf ? physics.current : physics.discharge_current;
  const currentVrReal = currentIReal * resistance;

  const displayTime = isInspecting ? buffers.times[inspectedIndex!] : simTime;
  const displayVc = isInspecting ? (buffers.vcData[inspectedIndex!] as number) : vc;
  const displayVr = isInspecting ? (buffers.vrData[inspectedIndex!] as number) : currentVrReal;
  const displayI = isInspecting ? (buffers.iData[inspectedIndex!] as number) : currentIReal * 1000.0;
  const displayVin = isInspecting ? (buffers.vinData[inspectedIndex!] as number ?? 0.0) : currentVinReal;

  const displayEbatt = isInspecting ? (buffers.ebattData[inspectedIndex!] as number) : energyBattery * 1000;
  const displayEcap = isInspecting ? (buffers.ecData[inspectedIndex!] as number) : energyCapacitor * 1000;
  const displayEres = isInspecting ? (buffers.erData[inspectedIndex!] as number) : energyResistor * 1000;

  // Compute energy balance split percentage
  const totalDissipatedAndStored = displayEcap + displayEres;
  let pctCap = 50;
  let pctRes = 50;
  if (totalDissipatedAndStored > 1e-9) {
    pctCap = (displayEcap / totalDissipatedAndStored) * 100;
    pctRes = (displayEres / totalDissipatedAndStored) * 100;
  }

  return (
    <div className="app-container" data-vin={displayVin}>
      {/* ── Left Sidebar Control Panel ── */}
      <aside className="sidebar">
        <div>
          <h1>RC Circuit Sim</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Real-time transient visualizer
          </p>
          <p style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '4px', lineHeight: '1.2' }}>
            © 2026 Henderson Hood. All rights reserved. Distribution prohibited without express permission.
          </p>
        </div>

        {/* Resistance Slider */}
        <div className="control-section">
          <label htmlFor="resistance-slider" className="control-header">
            <span>Resistance</span>
            <span className="control-value resistor">{formatR(resistance)}</span>
          </label>
          <input
            id="resistance-slider"
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
          <label htmlFor="capacitance-slider" className="control-header">
            <span>Capacitance</span>
            <span className="control-value capacitor">{formatC(capacitance)}</span>
          </label>
          <input
            id="capacitance-slider"
            type="range"
            min="0"
            max="999"
            value={cSliderVal}
            onChange={handleCChange}
          />
        </div>

        {/* Frequency Slider */}
        <div className="control-section">
          <label htmlFor="frequency-slider" className="control-header">
            <span>Frequency</span>
            <span className="control-value" style={{ color: '#f59e0b' }}>
              {frequency.toFixed(2)} Hz
            </span>
          </label>
          <input
            id="frequency-slider"
            type="range"
            min="0"
            max="999"
            value={freqSliderVal}
            onChange={handleFreqChange}
          />
          <div className="freq-readout">
            <span>T = {(1 / frequency).toFixed(3)} s</span>
            <span>T/τ = {(1 / frequency / physics.tau).toFixed(1)}×</span>
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
        <div className={`readouts-panel ${isInspecting ? 'inspecting' : ''}`}>
          <h3>
            Telemetry Readouts
            {isInspecting && (
              <>
                <span className="inspect-badge">● Inspecting</span>
                <button
                  className="clear-inspect-btn"
                  onClick={() => setInspectedIndex(null)}
                  title="Clear inspection cursor"
                >
                  ✕ Clear
                </button>
              </>
            )}
          </h3>
          
          <div className="readout-row">
            <span className="readout-label">Vc (Capacitor)</span>
            <span className="readout-value vc">{displayVc.toFixed(2)} V</span>
          </div>

          <div className="readout-row">
            <span className="readout-label">Vr (Resistor)</span>
            <span className="readout-value current" style={{ color: 'var(--accent-green)' }}>
              {displayVr.toFixed(2)} V
            </span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">I (Loop Current)</span>
            <span className="readout-value current">{displayI.toFixed(2)} mA</span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">τ (Time Constant)</span>
            <span className="readout-value tau">{physics.tau.toFixed(3)} s</span>
          </div>
          
          <div className="readout-row">
            <span className="readout-label">t (Sim Time)</span>
            <span className="readout-value">{displayTime.toFixed(2)} s</span>
          </div>
        </div>

        {/* Energy Balance */}
        <div className={`readouts-panel ${isInspecting ? 'inspecting' : ''}`}>
          <h3>
            Energy Distribution
            {isInspecting && (
              <>
                <span className="inspect-badge">● Inspecting</span>
                <button
                  className="clear-inspect-btn"
                  onClick={() => setInspectedIndex(null)}
                  title="Clear inspection cursor"
                >
                  ✕ Clear
                </button>
              </>
            )}
          </h3>
          
          <div className="readout-row">
            <span className="readout-label">E_source (Supply)</span>
            <span className="readout-value energy">{displayEbatt.toFixed(2)} mJ</span>
          </div>

          <div className="readout-row">
            <span className="readout-label">E_cap (Stored)</span>
            <span className="readout-value vc">{displayEcap.toFixed(2)} mJ</span>
          </div>

          <div className="readout-row">
            <span className="readout-label">E_res (Heat Loss)</span>
            <span className="readout-value energy" style={{ color: '#64748b' }}>
              {displayEres.toFixed(2)} mJ
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
      <main id="main-content" className="main-display">
        {/* Schematic Pane */}
        <section className="schematic-pane">
          <CircuitSchematic
            vin={displayVin}
            resistance={resistance}
            capacitance={capacitance}
            tau={physics.tau}
            vc={isInspecting ? displayVc : vc}
            vr={isInspecting ? displayVr : currentVrReal}
            current={isInspecting ? displayI / 1000 : currentIReal}
          />
        </section>

        {/* Scrollable Chart Pane */}
        <section className="graph-pane">
          <ChartCanvas
            times={buffers.times}
            vcData={buffers.vcData}
            vrData={buffers.vrData}
            iData={buffers.iData}
            vinData={buffers.vinData}
            isPaused={isPaused}
            onPauseSim={() => setIsPaused(true)}
            resistance={resistance}
            activeIndex={inspectedIndex}
            setActiveIndex={setInspectedIndex}
            frequency={frequency}
          />
        </section>
      </main>
    </div>
  );
};
export default App;
