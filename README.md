Scale Controller Rev-A

A custom ESP32-based scale controller PCB derived from the KLP-5e ESP32 Sensor Board. This design integrates an HX711 24-bit ADC and supports 4× half-bridge load cells, with output to a 1.3” SSD1306 OLED display over I²C. The board is designed to run ESPHome, making it easy to integrate into Home Assistant or other IoT ecosystems.

⸻

✨ Features
	•	ESP32-C3-WROOM-02-H4 module (RISC-V, Wi-Fi + BLE)
	•	USB-C connector for power and flashing (via on-board CP2102N USB-UART bridge, with USBLC6 ESD protection)
	•	Onboard LM1117 LDO regulator (5V → 3.3V)
	•	HX711 24-bit ADC for load cell integration
	•	4× JST-PH-3 connectors for half-bridge load cells
	•	1× JST-PH-4 header for I²C OLED (SSD1306 128×64, 1.3”)
	•	Tare via the on-board BOOT button (SW1, GPIO9) — no extra hardware needed
	•	Status LED (GPIO19) — planned, to be added to the schematic
	•	J6 expansion header (5-pin): 3V3, GPIO8, GPIO18, GPIO19, GND

Verified pin map (from the KiCad netlist):

| Function        | ESP32-C3 GPIO | Notes                             |
|-----------------|---------------|-----------------------------------|
| HX711 DOUT      | GPIO6         |                                   |
| HX711 PD_SCK    | GPIO5         |                                   |
| I²C SDA (OLED)  | GPIO4         |                                   |
| I²C SCL (OLED)  | GPIO3         |                                   |
| Tare button     | GPIO9         | reuses BOOT button SW1 (on board) |
| Status LED *    | GPIO19        | to be added to the schematic      |

\* The status LED is not yet wired in the current schematic. Tare reuses the existing BOOT button, so no hardware change is needed for it.

⸻

🛠️ Getting Started

Hardware Bring-Up Checklist
	1.	Power via USB-C → check +3.3V rail is stable.
	2.	I²C scan → OLED should respond at 0x3C.
	3.	HX711 baseline → confirm stable raw counts with no load.
	4.	Add load cells one by one → verify diagonal pairs add/subtract as expected.
	5.	Tare with empty platform.
	6.	Calibrate using a known mass (e.g. 1000 g). Compute calibration factor.

ESPHome Config

The full, ready-to-build configuration lives in firmware/scale-controller.yaml
(targets the ESP32-C3 with the verified pin map above). To use it:

	1.	Install ESPHome (pip install esphome or the Home Assistant add-on).
	2.	cp firmware/secrets.yaml.example firmware/secrets.yaml and fill in your Wi-Fi/API/OTA values.
	3.	esphome run firmware/scale-controller.yaml (first flash over USB-C, then OTA).

Key pins (see firmware/scale-controller.yaml for the complete config):

i2c:
  sda: GPIO4
  scl: GPIO3

sensor:
  - platform: hx711
    id: hx711_raw
    dout_pin: GPIO6
    clk_pin: GPIO5
    gain: 128


⸻

📂 Repo Structure
	•	KiCad project/ScaleController_RevA.kicad_pro — main KiCad project
	•	KiCad project/*.kicad_sch — schematics (root + ESP32-C3, HX711 load-cell summing, OLED header; user_interface is nested under the ESP32-C3 sheet)
	•	KiCad project/ScaleController_RevA.kicad_pcb — PCB layout (footprints placed; routing not yet started)
	•	firmware/scale-controller.yaml — ESPHome configuration
	•	fabrication/ — Gerbers, BOM, pick-and-place (generated; gitignored)
	•	docs/ — bring-up notes, calibration steps

⸻

⚖️ License & Attribution

This project is licensed under the CERN Open Hardware Licence Version 2 – Strongly Reciprocal (CERN-OHL-S v2).

Derived from futureshocked/KLP-5e-ESP32-sensor-board.
Copyright © 2025 Steve Maegley
Copyright © 2022–2023 futureshocked

You are free to use, modify, manufacture, and distribute this design, provided that you release your modifications under the same license.

⸻

🚀 Next Steps
	•	Add tare button (GPIO18) + status LED (GPIO19) to the schematic
	•	Route the PCB (keep HX711 analog away from the antenna + regulator)
	•	Run DRC and fix violations
	•	Generate fabrication files (Gerbers, BOM, pick-and-place)
	•	Build Rev-A prototype and validate
	•	Document calibration workflow with photos