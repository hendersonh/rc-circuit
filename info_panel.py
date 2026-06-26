# info_panel.py
"""Numeric readout panel showing VC, I, τ, and elapsed time."""

import pygame

TEXT_WHITE = (220, 220, 230)
ACCENT_CYAN = (0, 200, 220)
ACCENT_GREEN = (0, 220, 140)
ACCENT_ORANGE = (240, 160, 40)
ACCENT_RED = (220, 60, 60)
BG_DARK = (30, 30, 35)
PANEL_DARK = (40, 42, 48)


class InfoPanel:
    """Displays four live readouts in a horizontal row."""

    def __init__(self, x, y, font):
        self.x = x
        self.y = y
        self.font = font
        self.values = {
            "vc": "0.00 V",
            "current": "0.00 mA",
            "tau": "0.00 s",
            "time": "0.0 s",
        }

    def update(self, vc, current, tau, elapsed_time):
        """Update displayed values from physics engine state."""
        self.values["vc"] = f"{vc:.2f} V"
        # Convert amps to milliamps for readability
        self.values["current"] = f"{current * 1000:.2f} mA"
        self.values["tau"] = f"{tau:.3f} s"
        self.values["time"] = f"{elapsed_time:.1f} s"

    def draw(self, surface):
        """Draw readouts left to right in a single row."""
        labels = [
            ("Vc =", self.values["vc"], ACCENT_CYAN),
            ("I =", self.values["current"], ACCENT_GREEN),
            ("τ =", self.values["tau"], ACCENT_ORANGE),
            ("t =", self.values["time"], TEXT_WHITE),
        ]
        x = self.x
        for label, value, color in labels:
            lbl = self.font.render(label, True, TEXT_WHITE)
            surface.blit(lbl, (x, self.y))
            x += lbl.get_width() + 2
            val = self.font.render(value, True, color)
            surface.blit(val, (x, self.y))
            x += val.get_width() + 20