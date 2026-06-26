# Task 4 Report: Capacitor Parallel Plates + IEC Curve

## What Changed

- **`/home/ubuntu/projects/rc-circuit/circuit_renderer.py`**
  - Added `import math` at the top (needed for `math.cos` in the curved plate arc).
  - Replaced lines 117-123 (old 2-line capacitor stub at x=175/185) with a full parallel-plate capacitor drawn between path-local coordinates (80,200) and (120,200):
    - Lead wires (20px each) connecting into the circuit.
    - **Left plate**: straight vertical line, 28px tall, 3px thick.
    - **Right plate**: IEC-style outward curve built from 8 short line segments forming a shallow arc (arc_radius=30, angle sweep ~-23 to +23 degrees, scaled by 0.3).
    - White junction dots at both wire connections (filled circle + anti-aliased circle).
    - "C" label positioned 25px to the right of the right plate.

## App Runs

Yes. `python main.py` exited cleanly after the 3-second timeout with no errors, warnings, or import failures.

## Concerns

None. The capacitor draws at (80,200)-(120,200) in local coords, which is well within the bottom wire segment (0,200)-(200,200). The label position (cap_right_x + 25, cap_y - 10) may need a minor vertical nudge if it overlaps the bottom-edge component values label, but the values label is at `self.rect.y + self.rect.height - 20`, which is well below the capacitor area.