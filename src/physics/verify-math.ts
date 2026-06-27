// verify-math.ts
import { PhysicsEngine } from './PhysicsEngine';

const DELTA = 1e-9;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test_initial_state() {
  const eng = new PhysicsEngine(1000, 100e-6);
  assert(eng.R === 1000, `R should be 1000, got ${eng.R}`);
  assert(eng.C === 100e-6, `C should be 100e-6, got ${eng.C}`);
  assert(eng.VC === 0.0, `VC should be 0.0, got ${eng.VC}`);
  assert(eng.elapsed_time === 0.0, `elapsed_time should be 0.0, got ${eng.elapsed_time}`);
  assert(Math.abs(eng.tau - 0.1) < DELTA, `tau should be 0.1, got ${eng.tau}`);
  console.log("✓ test_initial_state passed");
}

function test_clamping() {
  const eng = new PhysicsEngine(1, 1e-9);
  assert(eng.R === PhysicsEngine.MIN_R, `R was not clamped to MIN_R`);
  assert(eng.C === PhysicsEngine.MIN_C, `C was not clamped to MIN_C`);
  console.log("✓ test_clamping passed");
}

function test_charge_tau_milestone() {
  const eng = new PhysicsEngine(1000, 100e-6); // τ = 0.1s
  const steps = 100;
  const dt = eng.tau / steps; // simulate 1τ in 100 steps
  for (let i = 0; i < steps; i++) {
    eng.update_charge(dt);
  }
  const expected = PhysicsEngine.V0 * (1 - 1 / Math.E);
  assert(Math.abs(eng.VC - expected) < 0.01, `Vc=${eng.VC}, expected=${expected}`);
  console.log("✓ test_charge_tau_milestone passed");
}

function test_discharge_to_zero() {
  const eng = new PhysicsEngine(1000, 100e-6);
  eng.VC = PhysicsEngine.V0; // start fully charged
  for (let i = 0; i < 500; i++) {
    eng.update_discharge(0.01);
  }
  assert(eng.VC < 0.01, `VC should discharge to < 0.01, got ${eng.VC}`);
  console.log("✓ test_discharge_to_zero passed");
}

function test_charge_plateau() {
  const eng = new PhysicsEngine(1000, 100e-6); // τ = 0.1s
  for (let i = 0; i < 2000; i++) { // way past 10τ
    eng.update_charge(0.01);
  }
  assert(Math.abs(eng.VC - PhysicsEngine.V0) < 0.001, `VC did not reach plateau`);
  console.log("✓ test_charge_plateau passed");
}

function test_dt_capping() {
  const eng = new PhysicsEngine(1000, 100e-6);
  eng.update_charge(10.0); // massive dt
  assert(eng.VC < PhysicsEngine.V0, `dt capping failed, VC jumped directly to V0`);
  console.log("✓ test_dt_capping passed");
}

function test_current_charge() {
  const eng = new PhysicsEngine(1000, 100e-6);
  assert(Math.abs(eng.current - (12.0 / 1000.0)) < DELTA, `initial current wrong`);
  eng.update_charge(0.05);
  assert(eng.current < 12.0 / 1000.0, `current did not decrease during charge`);
  console.log("✓ test_current_charge passed");
}

function test_current_discharge() {
  const eng = new PhysicsEngine(1000, 100e-6);
  eng.VC = PhysicsEngine.V0; // fully charged
  const i = eng.discharge_current;
  assert(i < 0, `discharge current should be negative, got ${i}`);
  eng.update_discharge(0.05);
  assert(eng.discharge_current > i, `discharge current magnitude did not decay`);
  console.log("✓ test_current_discharge passed");
}

function test_reset() {
  const eng = new PhysicsEngine(1000, 100e-6);
  eng.update_charge(0.1);
  eng.reset();
  assert(eng.VC === 0.0, `reset failed to clear VC`);
  assert(eng.elapsed_time === 0.0, `reset failed to clear elapsed_time`);
  console.log("✓ test_reset passed");
}

function test_energy_conservation() {
  const eng = new PhysicsEngine(1000, 100e-6); // C = 100 µF, V0 = 12V
  // Stored energy at full charge = 0.5 * C * V0^2 = 7.2 mJ
  // Supplied energy = C * V0^2 = 14.4 mJ
  // Heat dissipated = 7.2 mJ

  assert(eng.energy_battery === 0.0, `battery energy not initialized`);
  assert(eng.energy_resistor === 0.0, `resistor energy not initialized`);
  assert(eng.energy_capacitor === 0.0, `capacitor energy not initialized`);

  const dt = 0.01;
  for (let i = 0; i < 1000; i++) {
    eng.update_charge(dt);
  }

  assert(Math.abs(eng.VC - PhysicsEngine.V0) < 0.001, `VC should be close to V0`);
  assert(Math.abs(eng.energy_battery - 0.0144) < 1e-4, `E_battery wrong: ${eng.energy_battery}`);
  assert(Math.abs(eng.energy_capacitor - 0.0072) < 1e-4, `E_capacitor wrong: ${eng.energy_capacitor}`);
  assert(Math.abs(eng.energy_resistor - 0.0072) < 1e-4, `E_resistor wrong: ${eng.energy_resistor}`);

  const diff = Math.abs(eng.energy_battery - (eng.energy_capacitor + eng.energy_resistor));
  assert(diff < DELTA, `energy conservation violated: diff=${diff}`);

  eng.reset_energy();
  eng.VC = PhysicsEngine.V0; // start fully charged
  assert(Math.abs(eng.energy_capacitor - 0.0072) < DELTA, `capacitor energy reset check failed`);

  for (let i = 0; i < 1000; i++) {
    eng.update_discharge(dt);
  }

  assert(eng.VC < 0.001, `should be fully discharged`);
  assert(eng.energy_battery === 0.0, `battery should supply no energy during discharge`);
  assert(Math.abs(eng.energy_resistor - 0.0072) < 1e-4, `E_resistor wrong on discharge: ${eng.energy_resistor}`);
  assert(Math.abs(eng.energy_capacitor) < 1e-6, `capacitor should be empty`);
  console.log("✓ test_energy_conservation passed");
}

function run_all_tests() {
  console.log("Running PhysicsEngine TS tests...");
  test_initial_state();
  test_clamping();
  test_charge_tau_milestone();
  test_discharge_to_zero();
  test_charge_plateau();
  test_dt_capping();
  test_current_charge();
  test_current_discharge();
  test_reset();
  test_energy_conservation();
  console.log("All PhysicsEngine TS tests passed successfully!");
}

run_all_tests();
