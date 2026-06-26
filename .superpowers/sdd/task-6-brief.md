### Task 6: Anti-Aliasing and Final Polish

**Files:**
- Modify: `circuit_renderer.py` (AA for all circles, clean up imports)

**Interfaces:**
- Consumes: All existing CircuitRenderer methods
- Produces: Smoother rendering across the schematic

- [ ] **Step 1: Replace all `pygame.draw.circle` calls with gfxdraw AA circles**

In `circuit_renderer.py`, replace every `pygame.draw.circle` used for terminal dots, junction dots, etc. with the gfxdraw pair:

```python
# Instead of:
pygame.draw.circle(surface, color, center, radius)
# Use:
pygame.gfxdraw.filled_circle(surface, int(center[0]), int(center[1]), radius, color)
pygame.gfxdraw.aacircle(surface, int(center[0]), int(center[1]), radius, color)
```

Check in `draw_schematic` for any remaining raw `pygame.draw.circle` calls.

- [ ] **Step 2: Clean up imports in circuit_renderer.py**

Ensure `import pygame.gfxdraw` and `import math` are at the top:

```python
import pygame
import pygame.gfxdraw
import math
```

- [ ] **Step 3: Verify no old SPDT_Switch draw call remains**

Double-check `main.py` has no remaining `self.spdt.draw()` call.

- [ ] **Step 4: Final visual verification**

```bash
source .venv/bin/activate && python main.py
```

**Verify end-to-end:**
- Rectangular wire loop with proper spacing
- Multi-cell battery on the left (3 pairs, red/black, +/− labels)
- 9-segment resistor on top with junction dots and "R" label
- Parallel-plate capacitor on bottom with IEC curve and "C" label
- Knife switch on the right with lever, pivot, handle knob
- Clicking switch toggles charge/discharge with lever flipping
- Active path has subtle glow
- All circles are smooth (anti-aliased)
- Particles flow along the updated wire path
- No old SPDT drawing artifacts
- ESC still exits

- [ ] **Step 5: Commit**

```bash
git add circuit_renderer.py main.py
git commit -m "polish(circuit): anti-aliased circles and final cleanup

Replace raw pygame.draw.circle with gfxdraw AA circle pair for all
junction dots, terminals, and other circular elements. Ensure imports
are clean. Remove any remaining old SPDT draw calls."
```

---

## Summary

| Task | Files Changed | Deliverable |
|---|---|---|
| 1: PATH and wire loop | `circuit_renderer.py` | Rectangular circuit layout |
| 2: Battery symbol | `circuit_renderer.py` | Multi-cell battery |
| 3: Resistor zigzag | `circuit_renderer.py` | 9-segment ANSI resistor |
| 4: Capacitor plates | `circuit_renderer.py` | Parallel-plate capacitor |
| 5: Knife switch | `circuit_renderer.py`, `ui_manager.py`, `main.py` | Integrated SPDT knife switch |
| 6: AA polish | `circuit_renderer.py` | Anti-aliased circles + cleanup |
