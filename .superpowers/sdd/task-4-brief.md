### Task 4: Redraw Capacitor with Parallel Plates

**Files:**
- Modify: `circuit_renderer.py:118-123` (capacitor drawing)

**Interfaces:**
- Consumes: Capacitor position from PATH[6] and PATH[7], `CAPACITOR_BLUE` color
- Produces: Two vertical plates on bottom wire, right plate slightly curved (IEC)

- [ ] **Step 1: Replace capacitor drawing code**

Replace lines 117-123. Capacitor sits on the bottom wire between PATH[7] (160,200) and PATH[6] (200,200), but rotated to be drawn vertically in the bottom-right corner — actually no, the capacitor should be horizontal on the bottom wire.

Looking at the PATH: bottom wire goes from (200,200) at PATH[6] (right lead) to (160,200) at PATH[7] (left lead), then (0,200) at PATH[8] (battery -). The capacitor sits between PATH[6] and PATH[7], so it's horizontal along the bottom.

But looking at the spec diagram more carefully:
```
Battery(+) ──── R ────┬──── Switch(CHG)
   │                    │          │
   │                    │          ● (pivot)
   │                    │          │
Battery(-) ────────────┴──── Switch(DCH)
   │                              │
   │                              │
   └──────────────── C ───────────┘
```

The capacitor is on the bottom wire, vertical plates. So it's drawn horizontally with plates perpendicular to the wire.

Actually, let me reconsider. In circuit schematics, the capacitor symbol is two parallel lines perpendicular to the wire. So on a horizontal wire, the plates are vertical.

```python
# ── Capacitor (bottom wire, centered between x=40 and x=160) ──
cap_left_x, cap_y = self.transform_point(80, 200)
cap_right_x, _ = self.transform_point(120, 200)

# Plate dimensions
plate_height = 28  # vertical height of each plate (pixels)
plate_gap = 8      # horizontal gap between plates

# Lead wires
pygame.draw.line(surface, WIRE_WHITE, (cap_left_x, cap_y), (cap_left_x - 20, cap_y), 2)
pygame.draw.line(surface, WIRE_WHITE, (cap_right_x, cap_y), (cap_right_x + 20, cap_y), 2)

# Left plate (straight vertical line)
pygame.draw.line(surface, CAPACITOR_BLUE,
                 (cap_left_x, cap_y - plate_height // 2),
                 (cap_left_x, cap_y + plate_height // 2), 3)

# Right plate (slightly curved outward — IEC convention)
# Draw as short line segments forming a shallow arc
arc_segments = 8
arc_radius = 30  # radius of the arc curve
for i in range(arc_segments):
    t1 = i / arc_segments
    t2 = (i + 1) / arc_segments
    angle1 = -0.4 + t1 * 0.8  # ~-23° to +23°
    angle2 = -0.4 + t2 * 0.8
    x1 = cap_right_x + arc_radius * (1 - math.cos(angle1)) * 0.3
    y1 = cap_y - plate_height // 2 + plate_height * t1
    x2 = cap_right_x + arc_radius * (1 - math.cos(angle2)) * 0.3
    y2 = cap_y - plate_height // 2 + plate_height * t2
    pygame.draw.line(surface, CAPACITOR_BLUE, (int(x1), int(y1)), (int(x2), int(y2)), 3)

# Junction dots
for pt in [(cap_left_x, cap_y), (cap_right_x, cap_y)]:
    pygame.gfxdraw.filled_circle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)
    pygame.gfxdraw.aacircle(surface, int(pt[0]), int(pt[1]), 3, WIRE_WHITE)

# Label
lbl_c = font.render("C", True, CAPACITOR_BLUE)
surface.blit(lbl_c, (cap_right_x + 25, cap_y - 10))
```

Add `import math` at the top of the file if not already present.

- [ ] **Step 2: Run and verify**

```bash
source .venv/bin/activate && python main.py
```

**Verify:** Capacitor on the bottom wire shows two vertical blue plates. Left plate is straight, right plate has a slight outward curve (IEC convention). White junction dots at wire connections. Label "C" appears to the right.

- [ ] **Step 3: Commit**

```bash
git add circuit_renderer.py
git commit -m "feat(circuit): redraw capacitor with parallel plates + IEC curve

Replace 2-line stub with proper parallel-plate capacitor. Left plate
straight, right plate uses IEC outward curve (8-segment arc). Taller
plates (28px), wider gap (8px), junction dots, C label."
```

---

