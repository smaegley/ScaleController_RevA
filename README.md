Scale Controller Rev-A

A custom ESP32-based scale controller PCB derived from the KLP-5e ESP32 Sensor Board. This design integrates an HX711 24-bit ADC and supports 4× half-bridge load cells, with output to a 1.3” SSD1306 OLED display over I²C. The board is designed to run ESPHome, making it easy to integrate into Home Assistant or other IoT ecosystems.

⸻

✨ Features
	•	ESP32-WROOM-32E module (Wi-Fi + Bluetooth)
	•	USB-C connector for power and flashing
	•	Onboard buck regulator (5V → 3.3V)
	•	HX711 ADC for load cell integration
	•	4× JST-PH-3 connectors for half-bridge load cells
	•	1× JST-PH-4 header for I²C OLED (SSD1306 128×64, 1.3”)
	•	Tare button (GPIO33)
	•	Status LED (GPIO2)
	•	Test pads for debug (3V3, GND, SDA, SCL, SCK, DOUT)

⸻

🛠️ Getting Started

Hardware Bring-Up Checklist
	1.	Power via USB-C → check +3.3V rail is stable.
	2.	I²C scan → OLED should respond at 0x3C.
	3.	HX711 baseline → confirm stable raw counts with no load.
	4.	Add load cells one by one → verify diagonal pairs add/subtract as expected.
	5.	Tare with empty platform.
	6.	Calibrate using a known mass (e.g. 1000 g). Compute calibration factor.

Example ESPHome Config

i2c:
  sda: 21
  scl: 22

sensor:
  - platform: hx711
    id: hx
    name: "Scale Raw"
    dout_pin: 26
    clk_pin: 25
    gain: 128
    update_interval: 100ms

  - platform: template
    id: weight_g
    name: "Weight"
    unit_of_measurement: "g"
    accuracy_decimals: 1
    lambda: |-
      static const float cal = 1.0f;  # replace with your calibration factor
      return id(hx).state * cal;

binary_sensor:
  - platform: gpio
    pin: 33
    name: "Tare Button"
    on_press:
      then:
        - lambda: |-
            id(hx).set_offset(id(hx).state);

display:
  - platform: ssd1306_i2c
    model: "SSD1306 128x64"
    address: 0x3C
    lambda: |-
      it.printf(0, 0, id(font_large), "%6.1f g", id(weight_g).state);

font:
  - file: "fonts/Roboto-Bold.ttf"
    id: font_large
    size: 24


⸻

📂 Repo Structure
	•	ScaleController_RevA.kicad_pro — main KiCad project
	•	*.kicad_sch — schematics (ESP32 core, HX711, load cell headers, OLED header)
	•	*.kicad_pcb — PCB layout
	•	fabrication/ — Gerbers, BOM, pick-and-place (to be added)
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
	•	Finalize HX711 child sheet in KiCad
	•	Route load cell connectors + OLED header
	•	Generate fabrication files
	•	Build Rev-A prototype and validate
	•	Document calibration workflow with photos