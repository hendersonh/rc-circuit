// PhysicsEngine.ts
/**
 * Pure math/state layer for RC circuit simulation in TypeScript.
 * Decoupled from all rendering — can be tested independently.
 */

export class PhysicsEngine {
  public static readonly MIN_R = 100.0; // ohms
  public static readonly MIN_C = 10e-6; // farads (10 µF)
  public static readonly V0 = 12.0;    // source voltage
  public static readonly MAX_DT = 0.1;  // seconds — cap to prevent jumps

  private _r: number;
  private _c: number;
  private _vc: number;
  private _elapsed: number;

  public energy_battery: number;
  public energy_resistor: number;

  constructor(r = 1000.0, c = 100e-6) {
    this._r = Math.max(r, PhysicsEngine.MIN_R);
    this._c = Math.max(c, PhysicsEngine.MIN_C);
    this._vc = 0.0;
    this._elapsed = 0.0;
    this.energy_battery = 0.0;
    this.energy_resistor = 0.0;
  }

  public get R(): number {
    return this._r;
  }

  public set R(value: number) {
    this._r = Math.max(value, PhysicsEngine.MIN_R);
  }

  public get C(): number {
    return this._c;
  }

  public set C(value: number) {
    this._c = Math.max(value, PhysicsEngine.MIN_C);
  }

  public get VC(): number {
    return this._vc;
  }

  public set VC(value: number) {
    this._vc = value;
  }

  public get energy_capacitor(): number {
    // Energy stored in the capacitor: E = 0.5 * C * VC^2 (Joules)
    return 0.5 * this._c * Math.pow(this._vc, 2);
  }

  public get tau(): number {
    // Time constant τ = R × C
    return this._r * this._c;
  }

  public get elapsed_time(): number {
    return this._elapsed;
  }

  public get current(): number {
    // Circuit current in amperes. Positive = charging flow.
    return (PhysicsEngine.V0 - this._vc) / this._r;
  }

  public get discharge_current(): number {
    // Current during discharge mode: I = -VC / R.
    return -this._vc / this._r;
  }

  public update_charge(dt: number): void {
    const cappedDt = Math.min(dt, PhysicsEngine.MAX_DT);
    const tau = this.tau;

    if (tau > 0) {
      const exp_dt = Math.exp(-cappedDt / tau);
      const exp_2dt = Math.exp(-2.0 * cappedDt / tau);

      const d_energy_batt = this._c * PhysicsEngine.V0 * (PhysicsEngine.V0 - this._vc) * (1.0 - exp_dt);
      const d_energy_res = 0.5 * this._c * Math.pow(PhysicsEngine.V0 - this._vc, 2) * (1.0 - exp_2dt);

      this.energy_battery += d_energy_batt;
      this.energy_resistor += d_energy_res;

      this._vc += (PhysicsEngine.V0 - this._vc) * (1.0 - exp_dt);
    }
    this._elapsed += cappedDt;
  }

  public update_discharge(dt: number): void {
    const cappedDt = Math.min(dt, PhysicsEngine.MAX_DT);
    const tau = this.tau;

    if (tau > 0) {
      const exp_dt = Math.exp(-cappedDt / tau);
      const exp_2dt = Math.exp(-2.0 * cappedDt / tau);

      const d_energy_res = 0.5 * this._c * Math.pow(this._vc, 2) * (1.0 - exp_2dt);

      this.energy_resistor += d_energy_res;

      this._vc *= exp_dt;
    }
    this._elapsed += cappedDt;
  }

  public reset_energy(): void {
    this.energy_battery = 0.0;
    this.energy_resistor = 0.0;
  }

  public reset(): void {
    this._vc = 0.0;
    this._elapsed = 0.0;
    this.reset_energy();
  }
}
