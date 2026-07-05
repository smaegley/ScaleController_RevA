Scale Controller Rev-A — Project TODO

A running checklist of tasks for hardware, firmware, and documentation.
Updated 2026-07-05.

⸻

🖥️ KiCad / Hardware Design
	•	[x] Add HX711 child sheet (HX711_LoadCell_Summing.kicad_sch)
	•	[x] Wire 4× JST-PH-3 load cell connectors → HX711 (E+/E-, S± summing into INA±)
	•	[x] Add JST-PH-4 OLED header (SDA=GPIO4, SCL=GPIO3)
	•	[x] BOOT (SW1) + EN (SW2) buttons — tare reuses BOOT (GPIO9), no dedicated button needed
	•	[x] Run ERC — 0 errors (only benign lib-config warnings)
	•	[ ] Add status LED on GPIO19 (optional; or defer to Rev-B and show status on OLED)
	•	[ ] Resolve 3 lib_symbol_mismatch warnings (ESP32-C3, LM1117, SS-52400) — sync symbols
	•	[ ] Route the PCB — see docs/pcb-routing-plan.md (analog HX711 away from antenna + LDO)
	•	[ ] Run DRC, fix violations (target 0 errors)
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
	•	[ ] Rev-B: minor tweaks (if needed)
	•	[ ] Prepare kit version: PCB + load cell mounts
	•	[ ] Write blog/guide on building an ESPHome Scale with this PCB
