# ScaleController Rev-A — PCB Routing & Layout Plan

Status as of 2026-07-05: **55 footprints placed, 0 tracks routed.** Board is
~90 × 53 mm, 4-layer. This document is the routing strategy — the actual work
happens in the KiCad PCB editor. It is grounded in the current placement and
the verified netlist (68 nets), not generic advice.

The single most important idea for this board: **it is a mixed-signal design.**
The HX711 measures the load cell bridge at the **microvolt** level, sitting a
few cm from a 2.4 GHz Wi-Fi radio and a switching USB bridge. Most of the plan
below exists to keep that tiny analog signal clean.

---

## 1. Layer stackup (4-layer)

Current layers: `F.Cu` (signal), `In1.Cu` (power), `In2.Cu` (power), `B.Cu` (signal).

**Recommended assignment:**

| Layer   | Use                                                        |
|---------|------------------------------------------------------------|
| F.Cu    | Primary signal routing + component side                    |
| In1.Cu  | **Solid, unbroken GND plane** (change type from power→ground in Board Setup) |
| In2.Cu  | Power pours: +3.3V (main), with +5V/VBUS islands as needed |
| B.Cu    | Secondary signal routing + GND fill                        |

Why: a continuous ground plane directly under the signal layers gives every
trace a clean, low-impedance return path — this is the biggest single lever for
both analog noise and Wi-Fi/USB EMI. **Do not split or slot In1.Cu**, especially
not under the HX711, the ESP32, or the USB pair. (See §5 for how analog ground
is handled *without* cutting the plane.)

Set the board thickness/stackup so the F.Cu↔In1.Cu spacing is small (thin
prepreg) — it tightens return-path coupling and helps controlled impedance for
the USB pair.

---

## 2. Placement zones (already mostly good)

From current coordinates (mm), the board self-organizes into two zones:

```
     LEFT / CENTER  (power + digital + USB)        RIGHT (analog + RF)
   ┌───────────────────────────────────┬──────────────────────────────┐
   │ J6 expansion (far left)            │              U3 ESP32-C3 (top)│  <- antenna to top edge
   │ U2 LM1117 LDO   D4/5/6 LEDs        │                               │
   │ U4 CP2102N   U5 USBLC6             │   J3 ┐                        │
   │ F1 fuse  FB1 ferrite               │   J5 ├ load cells   U6 HX711  │
   │ SW1 BOOT  SW2 EN                   │   J7 │             C12-C17 dcpl│
   │ J1 USB-C (bottom edge)             │   J8 ┘                        │
   └───────────────────────────────────┴──────────────────────────────┘
```

**Keep this separation.** The mixed-signal boundary runs roughly vertically
through the middle. Route so that digital/USB/switching currents stay left, and
analog stays right.

Placement tweaks to check before routing:
- **U6 (HX711) decoupling caps** C12–C17 are in a column at x≈181.8 — good, keep
  each cap's ground via right at the pad.
- **Load-cell connectors J3/J5/J7/J8** feed `E+/E-` and `S_PLUS_GRP/S_MINUS_GRP`
  into the summing network → HX711 INA±. Keep them close and grouped (they are).
- Confirm **U3's PCB antenna overhangs the top board edge** (U3 is at y≈82.8,
  top edge y≈72.2). See §6.

---

## 3. Net classes (already defined — good)

The project already has sensible classes. Confirm these before routing:

| Class        | Track  | Clearance | Notes                                   |
|--------------|--------|-----------|-----------------------------------------|
| GND          | 0.50mm | 0.20mm    | plus plane                              |
| 3.3V         | 0.50mm | 0.20mm    | wide for current + low drop             |
| VBUS         | 0.60mm | 0.15mm    | USB power in                            |
| 5V_USB       | 0.25mm | 0.20mm    | consider widening to ~0.4mm             |
| USB_data     | 0.20mm | 0.15mm    | **differential pair — see §7**          |
| I2C          | 0.30mm | 0.15mm    | SDA/SCL to OLED header                  |
| SPI          | 0.30mm | 0.15mm    | HX711 DOUT/PD_SCK live here             |
| sensor_data  | 0.25mm | 0.15mm    | assign the analog A+/A- nets here (§4)  |
| GPIO/control | 0.25mm | 0.15mm    | general I/O                             |

**Action:** assign the analog bridge nets `A+`, `A-`, `E+`, `E-`,
`S_PLUS_GRP`, `S_MINUS_GRP`, `AGND` to a dedicated class (e.g. `sensor_data`)
so they're easy to see and rule-check.

---

## 4. Analog front end — the critical part

The sensitive nets (from the netlist):
- `A+` / `A-`  → HX711 INA+ (pin 8) / INA- (pin 7): the differential measurement input.
- `E+` / `E-`  → load-cell excitation (bridge drive).
- `S_PLUS_GRP` / `S_MINUS_GRP` → connector signal lines into the summing network.
- `AGND` → analog ground / reference (VFB, RATE, INB± tie here).
- `Net-(U6-VBG)` → bandgap reference bypass.

Rules:
1. **Route `A+`/`A-` as a tight differential pair**, matched length, as **short
   as possible**, entirely within the analog zone. Never run them near the
   antenna, the USB pair, the LEDs, or the LDO.
2. **Keep `A+`/`A-` on one layer over the solid ground plane** — avoid vias on
   these nets if you can; each via is a small discontinuity and a coupling point.
3. **Guard the analog input**: flood the analog zone with GND copper on F.Cu and
   B.Cu, and stitch it to the In1 ground plane with vias around (not through) the
   `A+`/`A-` route. This forms a shield.
4. **`E+`/`E-`** carry more current (they drive the bridge) — a bit wider, still
   kept as a pair alongside the signal pair from the connectors.
5. Put the **HX711 AVDD/DVDD/VSUP decoupling caps** (C12–C17) hard against the
   pins with the shortest possible ground return.
6. Keep the **VBG bypass cap** right at pin 6.
7. Nothing switching (LED lines, USB, buck/LDO feedback, GPIO toggling) crosses
   the analog zone.

---

## 5. Grounding strategy (single-point analog/digital tie)

`AGND` (HX711 analog ground) and `GND` (system ground) are separate nets in the
schematic but must meet at **exactly one point**.

- Use the **solid In1 ground plane as the system ground.**
- Create the analog ground as a **local pour in the HX711 region** tied to the
  main plane at a **single stitching point** directly under the HX711's AGND
  pin (pin 5). In KiCad, place the AGND zone and connect it to GND with one via
  / one short bridge near U6 pin 5.
- **Do not** create a long slot in In1.Cu to "separate" grounds — a moat under
  the analog signals does more harm (broken return path) than good. Single-point
  tie + local pour is enough at HX711 speeds.

---

## 6. RF / antenna keepout (ESP32-C3 module, U3)

- The WROOM module's PCB antenna **must overhang the board edge** with a
  **copper keepout on ALL layers** (F.Cu, In1.Cu, In2.Cu, B.Cu) beneath and
  around it — no ground pour, no traces. Follow the ESP32-C3-WROOM-02 datasheet
  keep-out dimensions (in `KiCad project/Datasheets/`).
- Verify U3 is oriented so the antenna points off the top edge (y≈72), away from
  the HX711 and load-cell area.
- Ground-stitch vias in a "fence" around the module's ground pad and along the
  board edges near the antenna (but outside the keepout) to contain RF.
- Keep the HX711 and its analog traces on the opposite side of U3 from the
  antenna.

---

## 7. USB routing (J1 → U5 → U4)

- Route `USB_DP`/`USB_DN` (connector side) and `USB_D+`/`USB_D-` (bridge side) as
  a **90 Ω differential pair**, length-matched, short.
- **U5 (USBLC6 ESD array) goes right at the USB-C connector (J1)** so transients
  are clamped before reaching anything else. Signal flows J1 → U5 → U4.
- Keep the USB pair over solid ground; avoid vias/stubs. Don't route the pair
  near the analog zone or under the antenna.
- `VBUS` is wide (0.6mm class) — fuse F1 and ferrite FB1 are already in the power
  path; keep that inline.

---

## 8. Power routing

- `VBUS` (5V from USB-C) → F1 fuse → FB1 ferrite → `+5V` → U2 (LM1117) → `+3.3V`.
  Use the wide VBUS/3.3V classes; keep the LDO input/output caps close to U2.
- Flood `+3.3V` as a pour on In2.Cu; drop vias to each IC's supply pins.
- The LM1117 is a linear LDO — it dissipates (5-3.3)V × I as heat. Give U2 some
  copper area / a small pour on its tab net for heat spreading.
- Keep the LDO and its ripple **out of the analog zone** — feed the HX711's 3.3V
  from a quiet branch, ideally with a small series ferrite/RC into AVDD if noise
  shows up in bring-up.

---

## 9. Suggested routing order

1. **Board Setup**: set In1.Cu = ground, In2.Cu = power; confirm net classes (§3);
   assign analog nets to `sensor_data`.
2. Pour **In1 solid ground** plane.
3. Place/verify **antenna keepout** (§6).
4. Route the **USB differential pair** (§7) — constrained, do it early.
5. Route the **analog front end** `A+/A-`, `E+/E-`, `S±_GRP`, AGND pour (§4, §5).
6. Route **power**: VBUS/5V/3.3V, decoupling (§8).
7. Route the **digital** nets: SPI (HX711 DOUT/PD_SCK), I2C (OLED), GPIO, BOOT/EN.
8. Pour **F.Cu and B.Cu ground fills**; add **stitching vias** across the board
   and around the analog guard + antenna fence.
9. **Silkscreen**: label load-cell connectors (E+/E-/S) and corner placement,
   test points, tare(BOOT)/reset(EN) buttons.

---

## 10. Verification workflow (kicad-cli, headless-friendly)

After routing, from `KiCad project/`:

```bash
# Design Rule Check → report
kicad-cli pcb drc --severity-all --exit-code-violations \
  -o /tmp/drc.rpt ScaleController_RevA.kicad_pcb

# Board render for review (top + bottom)
kicad-cli pcb render --side top -o /tmp/pcb_top.png ScaleController_RevA.kicad_pcb
kicad-cli pcb render --side bottom -o /tmp/pcb_bottom.png ScaleController_RevA.kicad_pcb

# When ready to fabricate:
kicad-cli pcb export gerbers -o fabrication/ ScaleController_RevA.kicad_pcb
kicad-cli pcb export drill   -o fabrication/ ScaleController_RevA.kicad_pcb
kicad-cli sch export bom     -o fabrication/bom.csv ScaleController_RevA.kicad_sch
```

Target: **0 DRC errors** before generating fab files. `fabrication/` is
gitignored (regenerated output).

---

## 11. Open items to resolve before/while routing

- **Status LED**: deferred to Rev-B — no change needed for Rev-A routing.
- Confirm the **antenna keepout dimensions** against the ESP32-C3-WROOM-02 datasheet.
- Decide whether the HX711 3.3V needs a **dedicated filtered branch** (can be a
  bring-up-time decision; leave footprints for a series ferbead + cap near AVDD).
