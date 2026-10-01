# Puck mod C — Fusion checklist

Reference model: `LoadCell_Puck_modC.step` (cut bodies alone: `LoadCell_Puck_modC_cutters.step`).
Parameters: `CableMod_Parameters.csv`, built on the puck's own parameters.

- **out** = distance from the puck centre along the lead-channel centreline.
- **face** = the flat top face of Puck_Bottom (Y = `lc_frame_t` = 2.6), the face the cell pocket is cut into.
- Design is Y-up with the puck centre on the origin; the lead channel runs along +Z.
- Every value below is a parameter name — type the name into the dimension box, not the number.
- "Channel axis" = the axis through the origin along the lead channel (Z in this Y-up design). Use it for every Symmetry constraint.

## 0. Setup
- [ ] File → Save As a copy (e.g. `LoadCell_Puck modC`)
- [ ] Import `CableMod_Parameters.csv` (ParameterIO add-in)
- [ ] Check in Change Parameters: `pad_h` = 4.25, `clamp_depth` = 2.60, `wire_ch_end` = 41.00, `splice_start` = 19.75 (proves the expressions resolved)

## 1. Wire channel (edit the existing sketch)
- [ ] Edit the channel sketch; delete the 14.083 length dimension
- [ ] Width: `wire_slot_w` (already 5), centred on the channel centreline
- [ ] Near edge: keep it constrained to the cell pocket edge (17.25 out); `wire_ch_start` mirrors that value for `splice_start`
- [ ] Far edge: distance from the origin = `wire_ch_end` (2 mm past the rim)
- [ ] Sketch fully constrained (lines turn black), finish; the existing cut keeps depth `wire_ch_d`
- [ ] Check: channel unchanged from the cell pocket to the rim, floor at Y = 1.1

## 2. Splice pocket
- [ ] Sketch on the **face**
- [ ] 2-Point Rectangle roughly over the channel, past the slack zone
- [ ] Near edge from origin = `splice_start`; far edge from origin = `splice_end`; width = `splice_w`
- [ ] Symmetry: the two long sides about the channel axis (Z axis, or a construction line from the origin along the channel)
- [ ] Extrude → Cut, depth `splice_depth`
- [ ] Check: pocket floor at Y = −2.0; the existing 5 mm channel still runs from the cell pocket into it

## 3. Clamp recess
- [ ] Sketch on the **face**
- [ ] 2-Point Rectangle: near edge from origin = `clamp_start`, far edge from origin = `wire_ch_end` (past the rim), width = `clamp_w`
- [ ] Symmetry: the two long sides about the channel axis
- [ ] Extrude → Cut, depth `clamp_depth`
- [ ] Check: recess floor at Y = 0, opens out through the rim

## 4. Cable groove
- [ ] Construct → Offset Plane from the **XY plane**, distance `groove_start`, toward the rim
- [ ] Sketch on that plane: circle Ø `cable_d`, centre on the channel centreline, `cable_depth` below the face (Y = −2.3)
- [ ] Same sketch: rectangle `cable_d` wide from the circle centre up to the face (U-shape, open on top)
- [ ] Extrude → Cut both profiles **toward the rim**, ≥ 12 mm or To Object = outer cylinder
- [ ] Check: groove exits the rim (not cut back toward the cell); floor at Y = −4.6; open into the recess and the pocket

## 5. Insert holes
- [ ] Sketch on the **recess floor**: two points at ±`clamp_ins_x` from the centreline, `clamp_ins_r` out
- [ ] Hole → Simple, Ø `clamp_ins_d`, depth `clamp_ins_depth`
- [ ] Check: holes don't break into the groove, the pocket or the rim

## 6. Stop pads
- [ ] Sketch on the **face**; construction line from the centre along the channel (0° reference)
- [ ] One pad: two lines from the centre at `pad_a1 - pad_span / 2` and `pad_a1 + pad_span / 2` (20°, 40°) from the reference; arcs about the puck centre at `pad_r_in` and `pad_r_out`; trim to a closed shape
- [ ] Extrude → Join, upward, distance `pad_h`
- [ ] Create → Pattern → Circular Pattern (features): the pad extrude, axis = Y axis (through the puck centre), quantity `pad_count`, full 360°
- [ ] Check: six pads every 60°, the two nearest the cable at ±30° either side of it
- [ ] Check: pad tops at Y = 6.85, `stop_gap` (0.5) below the top's underside
- [ ] Check (top visible, view from below): pads clear the post holes and the three countersunk holes

## 7. Clamp bar (own component)
- [ ] New Component `Clamp_Bar`, activate it
- [ ] Sketch on the **recess floor**: rectangle width `clamp_w - 2 * clr` (19.5), starting `clamp_start + clr` out (32.25); close the outer end with an arc about the puck centre, radius `puck_d / 2 - clr` (38.75)
- [ ] Extrude → New Body, upward, `bar_t`
- [ ] Check: bar top flush with the face; 0.25 mm gap to the recess walls
- [ ] Ridges: sketch on the bar underside, two rectangles `ridge_len` across × `ridge_w` along, centred at `ridge_r1` and `ridge_r2` out
- [ ] Extrude → Join, `ridge_h` downward (into the groove)
- [ ] Screw holes (directly above the two insert holes from step 5): sketch on the bar's top face; Project the insert-hole edges and use their centres, or place two points `clamp_ins_x` either side of the channel axis and `clamp_ins_r` out from the origin
- [ ] Hole → From Sketch Points, Simple, Ø `bar_hole_d`, extent `bar_t`; **Objects to Cut = Clamp_Bar only** (otherwise it drills through the puck bottom)
- [ ] Optional: counterbore Ø4.4 × 1 mm (no deeper than 1 mm)

## 8. Wrap-up
- [ ] Inspect → Interference across Clamp_Bar, Puck_Bottom and Puck_Top: expect **none**
- [ ] Export STEP to `mechanical/LoadCell_Puck_v2.step`
- [ ] Tell Claude it's there, for a comparison against `LoadCell_Puck_modC.step`

## After the first print
- [ ] Inserts: pressed in slowly, no bulging on the rim side
- [ ] Clamp pull test on scrap cable (2–3 kg): no slip, cores not crushed → else adjust `ridge_h`
- [ ] Feeler gauge at all six pads, unloaded: gap present everywhere
- [ ] Heaviest normal load, also off-centre: **nothing touches** the pads
- [ ] Measure the top's drop under a known load → set `stop_gap` ≈ 1.3 × the deflection at 50 kg
