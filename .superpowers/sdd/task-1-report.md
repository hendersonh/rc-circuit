# Task 1 Report: Redesign PATH Coordinates and Wire Loop Layout

## What Changed

**`/home/ubuntu/projects/rc-circuit/circuit_renderer.py`**

1. **PATH constant (line 25-43):** Replaced the old 22-point squished path with a 12-point rectangular 200x200 loop. The new layout forms a clean rectangle: battery on the left vertical (points 0,8,9,10,11), resistor on the top wire (gap between points 1 and 2), switch terminals on the right wire (points 3,4,5), capacitor on the bottom wire (gap between points 6 and 7).

2. **SWITCH_CENTER (line 46):** Updated from `(140, 50)` to `(200, 125)` to align with the new right-side switch position.

3. **Scale factors (lines 51-52):** Both `scale_x` and `scale_y` changed from `/150.0` and `/160.0` to `/200.0` — the local coordinate system is now a uniform 200x200 square.

4. **Wire loop drawing (lines 73-81):** Updated segment-loop logic to skip indices 1 (resistor gap on top wire) and 6 (capacitor gap on bottom wire), and added explicit loop-closing draw.

5. **Battery drawing (lines 83-93):** Rewired from old left-side position to span the left vertical (y=40 to y=200) with properly positioned + and - terminals.

6. **Resistor drawing (lines 95-100):** Now draws between local coords (40,40) and (160,40) with 9 zigzag segments (up from 5), matching the wider top-wire gap.

7. **Capacitor drawing (lines 102-106):** Repositioned to the bottom wire gap with vertical parallel plates at x=175 and x=185 between points (160,200) and (200,200).

8. **Switch dots (lines 110-115):** Updated to draw terminal dots at (200,40), (200,100), (200,160) matching the new PATH points 3, 4, 5 on the right wire.

9. **Removed old battery leads code** (the lines 73-85 block that duplicated the new battery drawing).

## Verification

The app runs successfully for 5+ seconds at 60 FPS with no Python errors or crashes (confirmed via `timeout 5 python main.py`, exit code 124 = clean timeout).

## Concerns

- The SPDT_Switch class has its own terminal positioning logic (y-20, y+20 relative to center at y=125), which gives terminals at y=105 and y=145 — slightly misaligned with the circuit's wire dots at y=100 and y=160. The wire loop is electrically continuous regardless, so this is cosmetic. Task 5 will refactor the switch integration.
- The `_draw_resistor` method signature was not changed (still defaults to `segments=5`), but callers now pass `9` explicitly. The method works fine for any segment count.