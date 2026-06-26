### Task 1: Redesign PATH Coordinates and Wire Loop Layout

**Files:**
- Modify: `circuit_renderer.py:24-57` (PATH constant)
- Modify: `circuit_renderer.py:62-73` (transform, constructor, SWITCH_CENTER)
- Modify: `circuit_renderer.py:101-108` (wire loop drawing)

**Interfaces:**
- Consumes: existing `CircuitRenderer` class signature unchanged
- Produces: new `PATH` list of waypoints forming a rectangular circuit; updated `SWITCH_CENTER`; updated `transform_point()` scale factors

- [ ] **Step 1: Replace PATH waypoints with new rectangular layout**

The new layout uses local coordinates ~200×200 forming a clear rectangle:

```
(0, 40)            battery_t → (40, 40) → resistor → (160, 40) → (200, 40)        [top wire]
(200, 40)                                  → (200, 75)  → (200, 100)                [right upper]
(200, 100) → sw_top → (200, 125) → sw_pivot → (200, 150) → sw_bot → (200, 175)   [right: 3 terminals]
(200, 200)                                         → (160, 200) → (40, 200) → (0, 200) [bottom wire]
(0, 200) → (0, 160) → (0, 80) → (0, 40)                                            [left: battery return]
```

Replace the PATH constant:

```python
PATH = [
    # Top wire: battery(+) → resistor → switch_top
    (0, 40),      # 0: battery + terminal
    (40, 40),     # 1: resistor left lead
    # Resistor zigzag (9 segments, drawn by _draw_resistor)
    (160, 40),    # 2: resistor right lead
    (200, 40),    # 3: switch top terminal
    # Right wire: switch → capacitor
    (200, 100),   # 4: switch center terminal (pivot)
    (200, 160),   # 5: switch bottom terminal
    (200, 200),   # 6: capacitor right lead
    # Bottom wire: capacitor → battery(-)
    (160, 200),   # 7: capacitor left lead
    (0, 200),     # 8: battery - terminal
    # Left wire: battery return path
    (0, 160),     # 9
    (0, 80),      # 10
    (0, 40),      # 11: back to start
]
```

Line 62 — update `SWITCH_CENTER`:

```python
SWITCH_CENTER = (200, 125)
```

- [ ] **Step 2: Update scale factors and constructor**

In `__init__`, the scale factors divide the panel interior by local coord extents:

```python
def __init__(self, x, y, width, height):
    self.rect = pygame.Rect(x, y, width, height)
    # Local coords span 0-200 in both X and Y
    self.scale_x = (width - 40) / 200.0
    self.scale_y = (height - 40) / 200.0
```

- [ ] **Step 3: Update wire loop drawing**

Replace the current segment-loop drawing (lines 101-108). The resistor occupies the top wire gap between index 1 and 2. The capacitor occupies the bottom wire gap between index 6 and 7. Draw all segments except those gaps:

```python
# Draw wire loop — skip resistor gap (segment 1→2) and capacitor gap (segment 6→7)
for i in range(len(self.PATH) - 1):
    if i == 1 or i == 6:  # resistor gap or capacitor gap
        continue
    p1 = self.PATH[i]
    p2 = self.PATH[i + 1]
    pygame.draw.line(surface, WIRE_WHITE, tx(*p1), tx(*p2), 2)
# Close the loop
pygame.draw.line(surface, WIRE_WHITE, tx(*self.PATH[-1]), tx(*self.PATH[0]), 2)
```

- [ ] **Step 4: Run the app and verify the wire loop**

```bash
source .venv/bin/activate && python main.py
```

**Verify:** Wires form a clean rectangular loop: top wire from left to right, right wire down, bottom wire left, left wire up. No wire segments overlap or go off-panel. Wire color is white/light gray (200,200,210).

- [ ] **Step 5: Commit**

```bash
git add circuit_renderer.py
git commit -m "refactor(circuit): redesign PATH layout to rectangular circuit loop

Replace squished coordinate system with proper 200×200 local coords
forming a rectangular circuit: battery left, resistor top, switch right,
capacitor bottom. Update scale factors and wire loop drawing to skip
component gaps."
```

---

