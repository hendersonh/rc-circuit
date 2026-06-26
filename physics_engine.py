# physics_engine.py
"""Pure math/state layer for RC circuit simulation.
Decoupled from all rendering — can be tested independently.
"""

import math


class PhysicsEngine:
    """Holds circuit parameters and updates capacitor voltage over time.

    State variables:
        R  — Resistance (ohms), clamped >= 100
        C  — Capacitance (farads), clamped >= 10e-6
        V0 — Source voltage (volts), fixed at 12
        VC — Capacitor voltage (volts), initial 0
        elapsed_time — simulation time (seconds)
    """

    MIN_R = 100.0       # ohms
    MIN_C = 10e-6       # farads (10 µF)
    V0 = 12.0           # source voltage
    MAX_DT = 0.1        # seconds — cap to prevent jumps

    def __init__(self, r: float = 1000.0, c: float = 100e-6):
        self._r = max(r, self.MIN_R)
        self._c = max(c, self.MIN_C)
        self._vc = 0.0
        self._elapsed = 0.0

    @property
    def R(self) -> float:
        return self._r

    @R.setter
    def R(self, value: float):
        self._r = max(value, self.MIN_R)

    @property
    def C(self) -> float:
        return self._c

    @C.setter
    def C(self, value: float):
        self._c = max(value, self.MIN_C)

    @property
    def VC(self) -> float:
        return self._vc

    @property
    def tau(self) -> float:
        """Time constant τ = R × C."""
        return self._r * self._c

    @property
    def elapsed_time(self) -> float:
        return self._elapsed

    @property
    def current(self) -> float:
        """Circuit current in amperes.
        Positive = charging flow, Negative = discharging flow.
        Caller sets mode — this calculates based on VC.
        """
        return (self.V0 - self._vc) / self._r

    @property
    def discharge_current(self) -> float:
        """Current during discharge mode: I = -VC / R."""
        return -self._vc / self._r

    def update_charge(self, dt: float):
        """Advance simulation in charging mode.
        Vc(t+dt) = Vc(t) + (V0 - Vc(t)) * (1 - e^(-dt/τ))
        """
        dt = min(dt, self.MAX_DT)
        if self.tau > 0:
            self._vc += (self.V0 - self._vc) * (1 - math.exp(-dt / self.tau))
        self._elapsed += dt

    def update_discharge(self, dt: float):
        """Advance simulation in discharging mode.
        Vc(t+dt) = Vc(t) * e^(-dt/τ)
        """
        dt = min(dt, self.MAX_DT)
        if self.tau > 0:
            self._vc *= math.exp(-dt / self.tau)
        self._elapsed += dt

    def reset(self):
        """Reset capacitor voltage and elapsed time to zero."""
        self._vc = 0.0
        self._elapsed = 0.0