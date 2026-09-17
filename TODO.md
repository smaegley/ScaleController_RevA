Scale Controller Rev-A — Project TODO

A running checklist of tasks for hardware, firmware, and documentation.
Updated 2026-09-15. See docs/status-2026-09-15.md for the current summary.

⸻

🖥️ KiCad / Hardware Design
	•	[x] Add HX711 child sheet (HX711_LoadCell_Summing.kicad_sch)
	•	[x] Wire 4× JST-PH-3 load cell connectors → HX711 (E+/E-, S± summing into INA±)
	•	[x] Add JST-PH-4 OLED header (SDA=GPIO4, SCL=GPIO3)
	•	[x] BOOT (SW1) + EN (SW2) buttons — tare reuses BOOT (GPIO9), no dedicated button needed
	•	[x] Run ERC — 0 errors (only benign lib-config warnings)
	•	[x] Status LED — deferred to Rev-B; Rev-A shows status on OLED / Home Assistant
	•	[x] Unified the three 3.3V power nets (2026-09-14). Root/C3/UI sheets use SparkFun-PowerSymbol:3.3V (net "3.3V"),
		HX711 sheet uses power:+3.3V (net "+3.3V", 7 pins incl. U6 VSUP/AVDD/DVDD), OLED sheet uses power:+3V3 (J9 pin 1).
		The three are separate nets — HX711 and OLED are unpowered. ERC is silent because power symbols self-drive.
		Change the 5 orphan symbols to SparkFun-PowerSymbol:3.3V, then Update PCB from Schematic (expect 138 unconnected).
	•	[x] PCB zones: deleted the 8 stale F.Cu micro-pours and 2 duplicate In1.Cu GND zones (2026-09-14)
	•	[ ] Pre-routing prep (found 2026-09-14 from render + file audit):
		[x] purged 104 board-level F.SilkS items inherited from KLP-5e (Charger, Sound sensor, MISO/MOSI, …); redo labels at silkscreen step
		[x] added 4× M3 mounting holes H1–H4 (board-only footprints)
		[x] moved FB1 from the bottom edge (133.7,123) to beside F1 (~133.0,107.3 rot 0) so VBUS→F1→FB1→U2 runs straight
		[x] net classes: Default and 5V_USB vias are 0.3/0.3 (zero annular ring) → 0.5/0.3; add "+5V" pattern to 5V_USB; widen 5V_USB track to 0.5 mm
		[x] deleted the In2.Cu VBUS and +5V_USB islands → solid 3.3V plane; route those nets on F.Cu
	•	[x] FIXED (7408cba): HX711 input filter was wired as a SERIES cap — S+ → R15 → C12 → INA+ (A+ net has only C12.2 + U6.8), same for R16/C13/INA-.
		A 4.7 nF in series blocks the DC bridge signal. Rewire so R15.1 goes straight to INA+ and C12 shunts that node to AGND (mirror for C13).
	•	[x] Deleted stale KLP-5e test points TP2 (on DOUT) and TP4 (on PD_SCK) from the schematic
	•	[x] Re-ordered the HX711 cap column (7f945fc); analog section routed so each cap sits beside its pin: C15/C14 by pins 1/3, C17 by pin 6, C13/C12 by pins 7/8, C16 last
	•	[x] Load-cell connectors → JST PH B3B-PH-K (friction lock) and on-board inversion of one cell pair (2026-09-17)
	•	[x] E+/E- naming tidied: E+ is the 3.3V-side excitation (NT2), E- the GND side (NT3)
	•	[ ] Silkscreen: label load-cell sockets by wire colour (all four plug identically: pin 1 / red centre / pin 3)
	•	[ ] Resolve 3 lib_symbol_mismatch warnings (ESP32-C3, LM1117, SS-52400) — sync symbols
	•	[x] Route the PCB — all 141 connections routed 2026-09-14/15 (power, 3.3V, GND, analog, digital); 0 unrouted
	•	[x] Run DRC — 0 errors, 0 unrouted; footprints refreshed from KiCad 9 libs. 4 warnings left: J1/U3 lib mismatch (intentional: bridged mask + solid zone connect) and 2 U3-outline-vs-edge silk notes
	•	[ ] Silkscreen: load-cell wiring + corner placement, test points, button labels

⸻

🔌 Fabrication
	•	[ ] Generate schematic PDF for review (kicad-cli sch export pdf)
	•	[ ] Export BOM (CSV + LCSC/JLC part numbers)
	•	[ ] Generate Gerbers + drill files
	•	[ ] Create pick-and-place (position) files for assembly
	•	[ ] Upload to JLC/PCBWay for prototype quote

⸻

⚙️ Firmware (ESPHome)
	•	[x] Create ESPHome YAML with verified pins — firmware/scale-controller.yaml (validated)
	•	[x] Tare action (physical BOOT button + Home Assistant button, persistent offset)
	•	[x] OLED UI (weight readout)
	•	[ ] Flash to a real prototype and confirm boot + Wi-Fi
	•	[ ] Calibrate with known weights; set calibration_factor
	•	[ ] Optional: auto-dim OLED, Wi-Fi status indicator, units toggle (g/oz)

⸻

🧪 Bring-Up & Testing
	•	[ ] Power test (USB-C, check 3.3 V rail)
	•	[ ] I²C scan → detect OLED at 0x3C
	•	[ ] HX711 baseline counts stable (no load)
	•	[ ] Add load cells one by one → confirm diagonal behavior
	•	[ ] Calibrate with 1000 g mass
	•	[ ] Corner test: ±200 g per corner, <1% error
	•	[ ] Wi-Fi test → confirm stable readings under RF load

⸻

📚 Documentation
	•	[x] PCB routing/layout plan — docs/pcb-routing-plan.md
	•	[x] README corrected for ESP32-C3 (module, LDO, USB bridge, verified pin map)
	•	[ ] Expand docs/bringup.md with photos/screenshots
	•	[ ] Add calibration instructions (step-by-step)
	•	[ ] Annotated PCB silkscreen screenshot
	•	[ ] Update README with assembly photo once built

⸻

🚀 Roadmap
	•	[ ] Rev-A prototype bring-up → fix issues
	•	[ ] Rev-B: add physical status LED (GPIO19) + any minor tweaks
	•	[ ] Prepare kit version: PCB + load cell mounts
	•	[ ] Write blog/guide on building an ESPHome Scale with this PCB
