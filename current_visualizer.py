# current_visualizer.py
"""Animated dot particles moving along circuit wire paths.
Velocity scales with current — fast when I is high, slow near equilibrium,
reverses when switching charge/discharge."""

import pygame
import math

PARTICLE_COLOR = (255, 220, 80)   # yellow glow
PARTICLE_RADIUS = 4
NUM_PARTICLES = 20
MULTIPLIER = 80  # pixels per amp per second (tuning constant)


class CurrentVisualizer:
    """Distributes particles along a list of wire path waypoints."""

    def __init__(self, path_points):
        """path_points: list of (x, y) tuples defining the circuit loop."""
        self.path = path_points
        # Pre-compute segment lengths and total path length
        self.seg_lengths = []
        self.total_length = 0
        for i in range(len(self.path)):
            p1 = self.path[i]
            p2 = self.path[(i + 1) % len(self.path)]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.sqrt(dx * dx + dy * dy)
            self.seg_lengths.append(length)
            self.total_length += length

        # Distribute particles evenly along path
        self.particles = []
        spacing = self.total_length / NUM_PARTICLES
        for i in range(NUM_PARTICLES):
            pos = i * spacing
            self.particles.append(pos)

    def reset(self):
        """Redistribute particles evenly back to starting positions."""
        self.particles = []
        spacing = self.total_length / NUM_PARTICLES
        for i in range(NUM_PARTICLES):
            pos = i * spacing
            self.particles.append(pos)

    def update(self, current, dt):
        """Move particles along the path proportional to current × dt."""
        displacement = current * MULTIPLIER * dt
        for i in range(len(self.particles)):
            self.particles[i] = (self.particles[i] + displacement) % self.total_length
            if self.particles[i] < 0:
                self.particles[i] += self.total_length

    def draw(self, surface):
        """Draw particles at their current positions along the path."""
        for pos in self.particles:
            x, y = self.position_at_distance(pos)
            # Glow effect (larger, semi-transparent)
            glow_surf = pygame.Surface((PARTICLE_RADIUS * 4, PARTICLE_RADIUS * 4), pygame.SRCALPHA)
            glow_color = (*PARTICLE_COLOR, 60)
            pygame.draw.circle(glow_surf, glow_color,
                               (PARTICLE_RADIUS * 2, PARTICLE_RADIUS * 2),
                               PARTICLE_RADIUS * 2)
            surface.blit(glow_surf, (x - PARTICLE_RADIUS * 2, y - PARTICLE_RADIUS * 2))
            # Core dot
            pygame.draw.circle(surface, PARTICLE_COLOR, (int(x), int(y)), PARTICLE_RADIUS)
            # Bright center
            pygame.draw.circle(surface, (255, 255, 240), (int(x), int(y)), PARTICLE_RADIUS // 2)

    def position_at_distance(self, d):
        """Convert a distance along the total path to (x, y) coordinates."""
        d = d % self.total_length
        accumulated = 0
        for i in range(len(self.path)):
            seg_len = self.seg_lengths[i]
            if accumulated + seg_len >= d:
                frac = (d - accumulated) / seg_len if seg_len > 0 else 0
                x1, y1 = self.path[i]
                x2, y2 = self.path[(i + 1) % len(self.path)]
                x = x1 + (x2 - x1) * frac
                y = y1 + (y2 - y1) * frac
                return x, y
            accumulated += seg_len
        # Fallback to last point
        return self.path[-1]