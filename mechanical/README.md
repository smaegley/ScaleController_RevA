# Mechanical — Scale Controller Rev-A

CAD for the parts around the PCB: load-cell pucks, cable strain relief, enclosure.
STEP is the reference format (exact geometry); export STL alongside it only for printing.

## Load-cell puck

Holds one 3-wire half-bridge load cell. Four per scale.

- Cable: generic "24/3" low-voltage cable, 11 × 0.14 mm tinned strands per core (0.17 mm²),
  red/black/yellow cores, black PVC jacket Ø4.2 mm. Core insulation must be 0.9–1.5 mm
  (JST PH crimp range); assumed, not measured. Alpha Wire 5013C is the datasheet-grade
  equivalent (Ø4.14 mm, black/brown/red) but costs far more.
- PCB end: JST **PHR-3** housing + **SPH-002T-P0.5S** contacts → board socket B3B-PH-K-S.
  All four cables are identical:

  | PCB pin | load-cell lead | cable core |
  |---|---|---|
  | 1 | white | yellow |
  | 2 | red (signal / centre tap) | red |
  | 3 | black | black |

  Confirm the centre tap on each cell with an ohmmeter (red→white ≈ red→black ≈ ½ white→black).
- Puck end: thin cell leads spliced to the cable in a pocket in the puck, potted once tested.
- Strain relief grips the cable jacket and is anchored to the **fixed** half of the puck;
  the cell leads keep a slack loop so cable tension cannot load the cell.

### Files

- `LoadCell_Puck.step` — Fusion 360 assembly (Y up, mm): Puck_Bottom, Puck_Top and the
  50 kg half-bridge cell. Ø78 mm; bottom 12 mm + three Ø8 guide posts on a 56 mm circle; top 10 mm, floats
  on the cell button with a 4.75 mm gap to the bottom, retained by screw + washer on each post
  (Ø10 post holes, Ø14 counterbore, 1.5 mm lift). Lead channel 5 × 1.5 mm from the cell pocket to the rim.
- `LoadCell_Puck_ModC_Steve.step` — **the design of record**: mod C modelled parametrically in Fusion
  (2026-10-01). Matches the reference below to < 0.1 mm in sections through every feature;
  splice pocket starts at 19.5 mm out.
- `LoadCell_Puck_modC.step` — script-built reference for mod C (Puck_Bottom_modC, Clamp_Bar,
  unchanged Puck_Top and cell), used to check the Fusion model.
- `Fusion_ModC_Checklist.md` — step-by-step Fusion checklist for mod C.
- `LoadCell_Puck_modC_cutters.step` — the four cut bodies alone (pocket, groove, recess, insert
  holes), same coordinates, for overlaying on Puck_Bottom in Fusion.
- `scripts/puck_cable_mod.py` — regenerates both modC files from `LoadCell_Puck.step`
  (`pip install cadquery-ocp numpy`).
- `ExportedParameters.csv` — Fusion user parameters of the original puck (exported from Fusion).
- `CableMod_Parameters.csv` — new parameters for the cable/stop mod, same format, for import.

## Mod C — design notes

Distances "out" are from the puck centre along the lead channel; depths are below the bottom's top face.

| feature | geometry |
|---|---|
| Slack zone | existing 5 × 1.5 mm channel, 17 → 19.5 mm out — leave the cell leads loose, do not pot |
| Splice pocket | 10 wide × 4.6 deep, 19.5 → 32 mm out; three joints side by side, pot below 1.5 mm under the face |
| Cable groove | Ø4.6 U-groove, centre 4.9 mm deep, 29 mm out → rim |
| Clamp recess | 20 wide × 2.6 deep, 32 mm out → rim |
| Clamp inserts | M2 × 6 × Ø3.5 heat-set, hole Ø3.2 × 7, ±6 mm at 35 mm out |
| Clamp bar | recess minus `clr`, 2.6 thick, Ø2.4 holes, two 1.0 mm ridges (0.6 mm squeeze on a 4.2 mm cable); M2 × 6 SHCS, optional Ø4.4 × 1 counterbore |
| Stop pads | six, r 31–37, 20° wide, every 60° starting 30° off the cable line (circular pattern), height `puck_gap - stop_gap` |

- **Walls under the `wall` (2.5 mm) rule, accepted:** insert hole to rim 1.9 mm, to groove 2.1 mm,
  to the splice-pocket corner 1.6 mm. Print with ≥4 perimeters, set inserts slowly; check the rim
  side for bulging. If it fails, rework with the cable entering at ~30° for a longer clamp zone.
- **`stop_gap` 0.5 mm is a placeholder.** Nothing may touch the pads under the heaviest normal load,
  including off-centre. Measure the cell's deflection under a known load and set the gap to about
  1.3 × the deflection at 50 kg. Sand pads to open the gap, shim with tape to close it.
- **Clamp squeeze** depends on the real cable diameter: pull-test one bar on scrap cable (2–3 kg)
  before printing four; adjust `ridge_h`.
