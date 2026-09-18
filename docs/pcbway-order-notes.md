# PCBWay order notes — Scale Controller Rev-A

Fab package: `fabrication/RevA-2026-09-18/ScaleController_RevA-gerbers.zip`
(regenerate with the kicad-cli commands in `docs/status-2026-09-18.md`).

## Board

| item | value |
|---|---|
| Size | 90.0 × 52.9 mm (outline incl. antenna notch, top right) |
| Layers | 4, KiCad order F.Cu / In1.Cu (GND) / In2.Cu (3.3 V) / B.Cu |
| Thickness | 1.6 mm, PCBWay standard 4-layer stackup: 7628 prepreg ≈0.19 mm, core 1.03 mm |
| Copper | 1 oz (35 µm) all four layers |
| Material | FR-4, TG ≥ 150 (PCBWay default is fine) |
| Surface finish | HASL lead-free or ENIG — choose at order time (ENIG recommended for the 0.5 mm QFN U4) |
| Mask / silk | green / white, or any standard colour; silkscreen on both sides |
| Min track / clearance | 0.20 mm track; net-class clearance 0.15 mm (Default), 3.3V/GND planes 0.2 mm |
| Vias | 0.55/0.30, 0.60/0.30 mm (diameter/drill) |
| PTH drills | 0.30, 0.60, 0.75, 1.00 mm |
| NPTH drills | 0.65, 3.20 mm (M3 mounting holes) |
| Copper to edge | 0.3 mm |
| Drill files | Excellon, mm, separate PTH / NPTH, absolute origin (same origin as Gerbers and pick-and-place) |
| Gerbers | RS-274X (X2 attributes), Protel extensions, solder mask subtracted from silkscreen |

## Notes to put in the "special requirements" box

1. **One 0.55 mm via** (0.30 mm drill, 0.125 mm annular ring) at U4 pin 8 / VBUS.
   All other vias are 0.60/0.30 mm. Please accept as designed.
2. **J1 (USB-C, HRO TYPE-C-31-M-12):** the spacing between the alignment-peg holes and the
   shell-leg holes is 0.35 mm. This is the connector manufacturer's footprint geometry;
   please do not flag or move these holes.
3. **J9 is a bottom-side through-hole part** (4-pin 2.54 mm socket for the OLED module).
   If ordering SMT assembly only, leave J9 unpopulated — it will be hand-soldered.
4. **Via-in-pad:** U4 pin 12 is tied to the exposed pad with a via in the pad. Standard
   (non-filled) via is acceptable for this prototype.
5. Silkscreen is intentionally drawn across the board edge at J1 and the U3 antenna
   notch; clip at the outline as usual.

## Assembly (if quoting SMT)

- Files: `ScaleController_RevA-BOM-PCBWay.csv` and `ScaleController_RevA-pos-top.csv`
  (`-pos-bottom.csv` lists only J9). Positions are in mm, KiCad absolute origin, Y axis up.
- 50 top-side parts, all SMD except the 4 JST PH sockets (J3/J5/J7/J8) and J6, which are
  through-hole on the top side.
- 13 of 27 BOM lines carry a manufacturer part number; the rest are generic 0805 R/C,
  the 2.54 mm header/socket and the HX711 (any HX711 SOIC-16 is acceptable).
- U3 (ESP32-C3-WROOM-02-H4) is moisture-sensitive; standard MSL handling.
