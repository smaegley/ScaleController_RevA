Scale Controller Rev-A — Project TODO

A running checklist of tasks for hardware, firmware, and documentation. Update as you make progress.

⸻

🖥️ KiCad / Hardware Design
	•	Add HX711 child sheet (HX711_LoadCell_Summing.sch)
	•	Wire 4× JST-PH-3 load cell connectors → HX711 nets
	•	Add JST-PH-4 OLED header (SDA=GPIO21, SCL=GPIO22)
	•	Place tare button (GPIO33) + status LED (GPIO2)
	•	Test pads for debug nets (3V3, GND, SDA, SCL, PD_SCK, DOUT)
	•	Run ERC/DRC, fix warnings
	•	Board layout — keep HX711 analog away from ESP32 antenna + buck
	•	Add silkscreen diagrams for load cell wiring & corner placement

⸻

🔌 Fabrication
	•	Generate schematic PDF for review
	•	Export BOM (CSV + LCSC/JLC part numbers)
	•	Generate Gerbers + drill files
	•	Create pick-and-place files for assembly
	•	Upload to JLC/PCBWay for prototype quote

⸻

⚙️ Firmware (ESPHome)
	•	Create initial ESPHome YAML (pins mapped)
	•	Implement tare button action
	•	Add OLED UI (weight + tare indicator)
	•	Test with simulated load cells (loopback)
	•	Calibrate with known weights
	•	Add optional features: auto-dim OLED, Wi-Fi status indicator, units toggle (g/oz)

⸻

🧪 Bring-Up & Testing
	•	Power test (USB-C, check 3.3 V rail)
	•	I²C scan → detect OLED at 0x3C
	•	HX711 baseline counts stable
	•	Add cells one by one → confirm diagonal behavior
	•	Calibrate with 1000 g mass
	•	Corner test: ±200 g per corner, <1% error
	•	Wi-Fi test → confirm stable readings under RF load

⸻

📚 Documentation
	•	Expand docs/bringup.md with photos/screenshots
	•	Add calibration instructions (step-by-step)
	•	Annotated PCB silkscreen screenshot
	•	Update README with assembly photo once built

⸻

🚀 Roadmap
	•	Rev-A prototype bring-up → fix issues
	•	Rev-B: minor tweaks (if needed)
	•	Prepare kit version: PCB + load cell mounts
	•	Write blog/guide on building an ESPHome Scale with this PCB