# main.py
"""RC Circuit Simulator — Main Application Entry Point.
Orchestrates PhysicsEngine, UIManager, InfoPanel, RealTimeGraph,
CircuitRenderer, and CurrentVisualizer in a 60 FPS game loop.
"""

import sys
import pygame

from physics_engine import PhysicsEngine
from ui_manager import Slider, Button, SPDT_Switch
from info_panel import InfoPanel
from real_time_graph import RealTimeGraph
from circuit_renderer import CircuitRenderer
from current_visualizer import CurrentVisualizer

# ── Window & Display ──────────────────────────────────────────────
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# ── Colors (Dark Mode) ────────────────────────────────────────────
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)
TEXT_WHITE = (220, 220, 230)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)


class SimulationApp:
    """Main application orchestrator."""

    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("RC Circuit Simulator")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("monospace", 14)
        self.big_font = pygame.font.SysFont("monospace", 18)
        self.running = True
        self.paused = False

        # ── Component positions (left panel ~400px) ──
        left_x = 20
        right_x = 400
        slider_width = 280

        # ── Physics ──
        self.physics = PhysicsEngine(r=1000.0, c=100e-6)

        # ── Sliders ──
        self.slider_r = Slider(left_x, 55, slider_width, "R",
                               100, 1_000_000, 1000, ".0f", " Ω")
        self.slider_c = Slider(left_x, 105, slider_width, "C",
                               10e-6, 0.01, 100e-6, ".0e", " F")

        # ── Buttons (row below sliders) ──
        self.btn_play = Button(left_x, 140, 70, 28, "▶/⏸", ACCENT_CYAN, toggle=True)
        self.btn_play.active = True  # start playing
        self.btn_reset = Button(left_x + 80, 140, 80, 28, "↺ Reset", ACCENT_ORANGE)

        # ── Info panel ──
        self.info_panel = InfoPanel(left_x, 178, self.font)

        # ── Graph (left side, below info) ──
        self.graph = RealTimeGraph(left_x, 205, 360, 120, 120, self.font, v0=12.0)

        # ── Circuit schematic (right side) ──
        self.circuit = CircuitRenderer(right_x, 30, 380, 530)

        # ── SPDT Switch (state only, drawing handled by CircuitRenderer) ──
        self.spdt = SPDT_Switch(self.circuit.get_switch_hitbox)

        # ── Current visualizer (uses schematic wire path) ──
        self.particles = CurrentVisualizer(CircuitRenderer.PATH)

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False

            # Sliders
            if self.slider_r.handle_event(event):
                self.physics.R = self.slider_r.value
            if self.slider_c.handle_event(event):
                self.physics.C = self.slider_c.value

            # SPDT switch
            self.spdt.handle_event(event)

            # Buttons
            if self.btn_play.handle_event(event):
                self.paused = not self.btn_play.active
            if self.btn_reset.handle_event(event):
                self.physics.reset()
                self.graph.reset()
                self.particles.reset()

    def update(self, dt):
        if not self.paused:
            # Update physics based on switch mode
            if self.spdt.mode == SPDT_Switch.MODE_CHARGE:
                self.physics.update_charge(dt)
            else:
                self.physics.update_discharge(dt)

            # Update graph
            current = (self.physics.current if self.spdt.mode == SPDT_Switch.MODE_CHARGE
                       else self.physics.discharge_current)
            self.graph.push(self.physics.VC, current)

            # Update particles
            self.particles.update(current, dt)

    def draw(self):
        self.screen.fill(BG_DARK)

        # Sliders
        self.slider_r.draw(self.screen, self.font)
        self.slider_c.draw(self.screen, self.font)

        # Buttons
        self.btn_play.draw(self.screen, self.font)
        self.btn_reset.draw(self.screen, self.font)

        # Info panel
        current = (self.physics.current if self.spdt.mode == SPDT_Switch.MODE_CHARGE
                   else self.physics.discharge_current)
        self.info_panel.update(self.physics.VC, current,
                               self.physics.tau, self.physics.elapsed_time)
        self.info_panel.draw(self.screen)

        # Graph
        self.graph.draw(self.screen)

        # Circuit schematic
        self.circuit.draw_schematic(self.screen, self.big_font,
                                    self.spdt.mode, self.physics.VC,
                                    self.physics.V0, self.physics.R, self.physics.C)

        # Particles (transformed to circuit panel coordinates)
        self._draw_particles_on_circuit()

        # Paused indicator
        if self.paused:
            pause_text = self.big_font.render("PAUSED", True, ACCENT_ORANGE)
            self.screen.blit(pause_text, (SCREEN_WIDTH // 2 - 40, 5))

        # FPS / debug info
        fps_text = self.font.render(f"FPS: {self.clock.get_fps():.0f}", True, TEXT_WHITE)
        self.screen.blit(fps_text, (SCREEN_WIDTH - 80, 5))

        # ESC hint
        esc_text = self.font.render("ESC to exit", True, TEXT_WHITE)
        self.screen.blit(esc_text, (SCREEN_WIDTH - 100, SCREEN_HEIGHT - 20))

        pygame.display.flip()

    def _draw_particles_on_circuit(self):
        """Draw particles transformed to circuit panel coordinates."""
        tx = self.circuit.transform_point

        for pos in self.particles.particles:
            px, py = self.particles.position_at_distance(pos)
            sx, sy = tx(px, py)
            pygame.draw.circle(self.screen, (255, 220, 80), (sx, sy), 4)
            pygame.draw.circle(self.screen, (255, 255, 200), (sx, sy), 2)

    def run(self):
        """Main game loop — 60 FPS, dt-scaled."""
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0  # convert ms to seconds
            self.handle_events()
            self.update(dt)
            self.draw()
        pygame.quit()
        sys.exit()


if __name__ == "__main__":
    app = SimulationApp()
    app.run()