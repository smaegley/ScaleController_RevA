Scale Controller Rev-A

A custom ESP32-C3 scale controller PCB derived from the KLP-5e ESP32 Sensor Board. This design integrates an HX711 24-bit ADC and supports 4× half-bridge load cells, with output to a 0.96” SSD1306 OLED display over I²C. The board is designed to run ESPHome, making it easy to integrate into Home Assistant or other IoT ecosystems.

⸻

✨ Features
	•	ESP32-C3-WROOM-02-H4 module (RISC-V, Wi-Fi + BLE)
	•	USB-C connector for power, flashing and logs via the C3’s native USB-Serial/JTAG (USBLC6 ESD protection, no USB-UART bridge)
	•	Onboard LM1117 LDO regulator (5V → 3.3V)
	•	HX711 24-bit ADC for load cell integration
	•	4× JST-PH-3 connectors for half-bridge load cells (LC1/LC2 = S− pair, LC3/LC4 = S+ pair; any cell plugs into any socket)
	•	J9 4-pin header (back side) for an I²C OLED (SSD1306 128×64, 0.96”), 4.7k pull-ups on board
	•	Status LED D5 (green, GPIO7)
	•	Tare via the BOOT button (SW1, GPIO9) or Home Assistant — see the Rev-A button note below
	•	J6 expansion header (5-pin): 3V3, GPIO10, U0TXD, U0RXD, GND

Verified pin map (from the KiCad netlist):

| Function        | ESP32-C3 GPIO | Notes                             |
|-----------------|---------------|-----------------------------------|
| HX711 DOUT      | GPIO6         |                                   |
| HX711 PD_SCK    | GPIO5         |                                   |
| I²C SDA (OLED)  | GPIO4         |                                   |
| I²C SCL (OLED)  | GPIO3         |                                   |
| Tare button     | GPIO9         | reuses BOOT button SW1 (on board) |
| Status LED      | GPIO7         | D5, active-low                    |
| USB D−/D+       | GPIO18/GPIO19 | native USB, not usable as GPIO    |

⚠️ Rev-A boards: SW1 (BOOT) and SW2 (RESET) are wired across the switches’ internally
joined pins and short GPIO9 and EN to GND — the board will not start with them fitted.
Remove both (or cut one diagonal pair of legs on each). Details: docs/bringup-2026-11-01.md.

⸻

🛠️ Getting Started

Hardware Bring-Up Checklist
	1.	Power via USB-C → check +3.3V rail is stable.
	2.	Flash firmware/smoke-test.yaml (no Wi-Fi needed) → status LED blinks, logs on USB.
	3.	I²C scan → OLED should respond at 0x3C.
	4.	HX711 baseline → confirm stable raw counts with no load.
	5.	Plug one cell into LC1/LC2 and one into LC3/LC4 → pressing either moves the reading the same way.
	6.	Tare with empty platform.
	7.	Calibrate using a known mass (e.g. 1000 g). Compute calibration factor.

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
	•	KiCad project/ScaleController_RevA.kicad_pcb — PCB layout (4-layer, routed, fabricated by PCBWay Sept 2026)
	•	firmware/scale-controller.yaml — ESPHome configuration
	•	firmware/smoke-test.yaml — bring-up firmware (USB logs only, no Wi-Fi)
	•	mechanical/ — load-cell puck models
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
	•	Rev-A boards built and smoke-tested (Nov 2026): boot, USB, Wi-Fi and HX711 confirmed; button wiring error found
	•	Build the load-cell pucks and a test rig; calibrate and corner-test
	•	Rev-B: fix the button wiring; display mount; optional HX711 input filter
	•	Document calibration workflow with photos