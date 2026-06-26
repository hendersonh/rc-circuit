"""Tests for PhysicsEngine — all math/state, no rendering."""
import os
import sys
import math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from physics_engine import PhysicsEngine

DELTA = 1e-9  # floating point tolerance


def test_initial_state():
    eng = PhysicsEngine(r=1000, c=100e-6)
    assert eng.R == 1000
    assert eng.C == 100e-6
    assert eng.VC == 0.0
    assert eng.elapsed_time == 0.0
    assert abs(eng.tau - 0.1) < DELTA  # 1000 * 100e-6 = 0.1


def test_clamping():
    eng = PhysicsEngine(r=1, c=1e-9)
    assert eng.R == PhysicsEngine.MIN_R
    assert eng.C == PhysicsEngine.MIN_C


def test_charge_tau_milestone():
    """At t = 1τ, Vc should be ~63.2% of V0."""
    eng = PhysicsEngine(r=1000, c=100e-6)  # τ = 0.1s
    steps = 100
    dt = eng.tau / steps  # simulate 1τ in 100 steps
    for _ in range(steps):
        eng.update_charge(dt)
    expected = eng.V0 * (1 - 1 / math.e)
    assert abs(eng.VC - expected) < 0.01, f"Vc={eng.VC}, expected={expected}"


def test_discharge_to_zero():
    """Discharge from full V0 should approach 0."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng._vc = eng.V0  # start fully charged
    for _ in range(500):
        eng.update_discharge(0.01)
    assert eng.VC < 0.01


def test_charge_plateau():
    """After 10τ, Vc should be very close to V0."""
    eng = PhysicsEngine(r=1000, c=100e-6)  # τ = 0.1s
    for _ in range(2000):  # way past 10τ
        eng.update_charge(0.01)
    assert abs(eng.VC - eng.V0) < 0.001


def test_dt_capping():
    """dt > MAX_DT should be clamped."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng.update_charge(10.0)  # massive dt
    # Should not jump to V0 instantly — dt was capped
    assert eng.VC < eng.V0, "dt capping failed, VC jumped to V0"


def test_current_charge():
    """Current during charging: I = (V0 - Vc) / R."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    assert abs(eng.current - (12.0 / 1000.0)) < DELTA
    eng.update_charge(0.05)
    # After some charging, current should decrease
    assert eng.current < 12.0 / 1000.0


def test_current_discharge():
    """Discharge current is negative and decays toward 0."""
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng._vc = eng.V0  # fully charged
    i = eng.discharge_current
    assert i < 0  # negative = discharging
    eng.update_discharge(0.05)
    assert eng.discharge_current > i  # approaching 0 from below


def test_reset():
    eng = PhysicsEngine(r=1000, c=100e-6)
    eng.update_charge(0.1)
    eng.reset()
    assert eng.VC == 0.0
    assert eng.elapsed_time == 0.0


if __name__ == "__main__":
    test_initial_state()
    test_clamping()
    test_charge_tau_milestone()
    test_discharge_to_zero()
    test_charge_plateau()
    test_dt_capping()
    test_current_charge()
    test_current_discharge()
    test_reset()
    print("All PhysicsEngine tests passed!")