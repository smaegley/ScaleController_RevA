# Schematic review — Scale Controller Rev-A, 18 September 2026

Method: every pin of every part checked from the exported netlist (`kicad-cli sch export
netlist`, commit 83b06ee) against the part datasheets — ESP32-C3-WROOM-02 v1.4,
CP2102N rev 1.5, HX711, LM1117, USBLC6-2SC6. Not a visual review; wiring only.

## Verdict

The board will power up, boot from flash and run. Two real design errors were found, both
in the programming path, plus a handful of robustness items. None require holding the
PCB order if the Rev-A workarounds below are acceptable.

## Findings

### F1 — Auto-program circuit is driven from a CTS input; the CP2102N QFN20 has no DTR  (design error)

`U4` is the **QFN20** CP2102N. Its pin 15 is **CTS (input)** and pin 16 is RTS; the QFN20
package has no DTR/DSR/DCD/RI (datasheet §5.3, Table 5.3). The classic ESP auto-reset
circuit (Q2/Q3, R33/R34) needs DTR *and* RTS as host-driven outputs. Here the net named
"DTS" is wired to CTS, which the host cannot drive.

Consequences, in order of importance:

1. **A host that asserts RTS holds the ESP32 in reset.** CTS floats high (CP2102N inputs
   default to weak pull-up, §4.3.1), so Q2's base is high; when the host asserts RTS the pin
   goes low, Q2 conducts and pulls EN low. Generic terminals (`screen`, `minicom`, pyserial
   defaults on Linux) assert RTS on open, so the board appears dead while the monitor is
   open. `esptool` and `esphome logs` de-assert RTS after opening, so those work.
2. **Automatic entry into download mode cannot work.** Q3 needs its emitter (DTS) driven
   low; nothing ever does. Flashing requires holding **BOOT (SW1)** while the tool resets
   the chip (esptool's RTS toggle still resets it, so hold BOOT, start esptool, release).

Rev-A: **do not populate Q2, Q3, R33, R34.** Program with BOOT + EN; use ESPHome OTA after
the first flash. This also removes consequence 1.
Rev-B: drop the CP2102N entirely and use the C3's native USB-Serial/JTAG on GPIO18/19
(already on J6), keeping U5 for ESD — or move to the QFN24/QFN28 CP2102N which has DTR.
Either way, rename the net.

### F2 — GPIO8 floats; it must be high to enter download boot  (design error)

ESP32-C3 Table 4: GPIO8 default **floating** (no internal pull). Table 6: Joint Download
Boot requires GPIO2 = 1, **GPIO8 = 1**, GPIO9 = 0. On this board GPIO8 goes only to J6
pin 2. With it floating, download mode is undefined — flashing may fail or be intermittent.

Rev-A: 10 kΩ between **J6 pin 1 (3.3 V) and J6 pin 2 (GPIO8)** — a resistor across two
adjacent header pins, no board rework. Rev-B: add the pull-up on the board.

### F3 — GPIO2 floats; datasheet recommends a pull-up  (robustness)

Table 6 note 2: "GPIO2 does not determine the boot mode, but it is recommended to pull this
pin up due to glitches." Module pin 16 is unconnected. Most boards run fine without it.
Rev-A: accept, or solder 10 kΩ from pad 16 to 3.3 V if boot proves flaky. Rev-B: add it.

### F4 — No I2C pull-ups on SDA/SCL  (robustness)

`/SDA` and `/SCL` contain only U3 and J9. The bus relies on the OLED module's on-board
pull-ups (most SSD1306 modules carry 4.7–10 kΩ; confirm on the Hosyond board) or the
C3's ~45 kΩ internal pull-ups. Rev-B: 4.7 kΩ pair on the board so J9 works with any module.

### F5 — BOOT (GPIO9) has no external pull-up  (robustness)

Relies on the C3's internal weak pull-up (~45 kΩ, Table 4 says default 1). With C21
(0.1 µF) that is a 4.5 ms rise, versus the 10 ms EN delay from R32/C22 — OK, but 10 kΩ to
3.3 V is the Espressif reference and makes the latch timing comfortable. Rev-B.

### F6 — HX711 input filter corner is very high  (optional)

R15/R16 100 Ω with C12/C13 4.7 nF gives f_c ≈ 340 kHz — nearly no filtering of the bridge
signal. Harmless (many HX711 boards have none). Rev-B option: 1 kΩ + 10 nF C0G ≈ 16 kHz.
Keep the parts matched between channels.

### F7 — HX711 AGND pin is on GND, everything else analogue is on AGND  (note)

U6 pin 5 → GND directly; C12–C17, VFB, INB±, RATE → AGND, tied to GND at NT1. Electrically
identical; only the physical tie point matters. Layout was done with this in mind (17 Sept
note). No action.

### F8 — TX/RX LEDs need one-time CP2102N configuration  (note)

D5/D6 hang off GPIO.2/GPIO.3. Datasheet §4.3.1: GPIO pins default to GPIO input
(open-drain, weak pull-up), so the LEDs stay off until TXT/RXT alternate functions are
enabled with Simplicity Studio's Xpress Configurator over USB. Not a fault.

## Verified correct

- **USB-C**: VBUS A4/A9/B4/B9 → /VBUS; D+/D− both rows paired; CC1/CC2 each 5.1 kΩ to GND
  (Rd, sink); SBU NC; shield and GND to GND.
- **ESD**: USBLC6-2SC6 pins 1/6 and 3/4 are the same internal line; connector side on
  6/4, chip side on 1/3; VBUS on 5, GND on 2.
- **Power path**: VBUS → F1 (1.1 A PPTC) → FB1 → +5V → U2 VIN. LM1117 SOT-223 pinout
  (1 GND, 2/4 VOUT, 3 VIN) correct. 10 µF tantalum in, 3 × 10 µF tantalum + ceramics out —
  meets the ESR requirement. Dissipation ≈ 0.25 W average, 0.6 W at Wi-Fi TX peaks: fine
  with the pour.
- **CP2102N**: regulator-bypassed mode (VDD = VREGIN = 3.3 V, datasheet Fig. 2.3);
  RSTb 1 kΩ pull-up (Fig. 2.1 recommends exactly 1 kΩ); VBUS sense divider 22.1 k / 47.5 k
  matches Fig. 2.6; 1 µF on the VBUS pin. UART correctly crossed: U4 TXD → U3 RXD, U4 RXD
  ← U3 TXD.
- **ESP32-C3 module**: pin map matches the WROOM-02 table; EN has 10 kΩ + 1 µF + button;
  3V3 and all 21 GND pins connected. IO3/IO4 (I2C), IO5/IO6 (HX711), IO18/19/8 to J6.
- **HX711 external-supply configuration**: VSUP = AVDD = DVDD = 3.3 V, VFB → AGND, BASE NC
  (regulator disabled, per datasheet application circuit); VBG 0.1 µF; RATE low = 10 SPS;
  XI grounded = internal oscillator; channel B inputs tied to AGND. Bridge excitation E+/E−
  is the same 3.3 V rail as AVDD, so the measurement is ratiometric.
- **Load-cell wiring**: J3/J7 feed S+, J5/J8 feed S−, and the S− pair has E+/E− swapped on
  the board, so all four half-bridge cells plug in identically (white/red/black) and every
  corner produces a same-sign output. This is the standard 4-cell parallel Wheatstone.
  For the most even corner response, mount the S+ pair (LC1/LC3 = J3/J7) diagonally.
- **Firmware pins** (`firmware/scale-controller.yaml`) match the netlist: DOUT GPIO6,
  PD_SCK GPIO5, SDA GPIO4, SCL GPIO3, tare on GPIO9.
- **OLED J9**: GND, 3V3, SCL, SDA — matches the module's pin order.
- No unintended shorts: every named net has the expected members; only intended pins are
  unconnected (IO0/1/2/7/10, SBU1/2, CP2102N GPIO/suspend/wakeup, HX711 BASE/XO).

## Recommended actions

| when | action |
|---|---|
| Rev-A order | Order as is. Mark **Q2, Q3, R33, R34 DNP** on the assembly BOM (or don't fit them). |
| Rev-A bring-up | 10 kΩ across J6 pins 1–2 (GPIO8 pull-up). Flash with BOOT held; OTA afterwards. |
| Rev-B | Native USB (GPIO18/19) instead of CP2102N; pull-ups on GPIO2, GPIO8, GPIO9; 4.7 kΩ I2C pull-ups; optional 1 kΩ/10 nF HX711 filter; status LED on a free GPIO. |
