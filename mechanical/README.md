# Mechanical — Scale Controller Rev-A

CAD for the parts around the PCB: load-cell pucks, cable strain relief, enclosure.
STEP is the reference format (exact geometry); export STL alongside it only for printing.

## Load-cell puck

Holds one 3-wire half-bridge load cell. Four per scale.

- Cable: 3-core jacketed, 24 AWG stranded, conductor insulation 0.9–1.5 mm (JST PH crimp range).
- PCB end: JST **PHR-3** housing + **SPH-002T-P0.5S** contacts → board socket B3B-PH-K-S.
  Pin 1 = white, 2 = red (signal / centre tap), 3 = black. All four cables are identical.
- Puck end: thin cell leads spliced to the cable in a pocket in the puck, potted once tested.
- Strain relief grips the cable jacket and is anchored to the **fixed** half of the puck;
  the cell leads keep a slack loop so cable tension cannot load the cell.

### Files

- `LoadCell_Puck.step` — Fusion 360 assembly (Y up, mm): Puck_Bottom, Puck_Top and the
  50 kg half-bridge cell. Ø78 mm; bottom 12 mm + three Ø8.5 guide posts; top 10 mm, floats
  on the cell button with a 4.75 mm gap to the bottom, retained by screw + washer on each post
  (Ø14.5 counterbore, 1.5 mm lift). Lead channel 5 × 1.5 mm from the cell pocket to the rim.
