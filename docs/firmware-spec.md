# Scale Controller firmware — specification (draft 1, 9 November 2026)

From the spec interview with Steve on 9 November 2026. Supersedes the feature set implied by
`firmware/scale-controller.yaml`, which becomes the first user of these packages.

## 1. Purpose and users

A general-purpose load-cell scale for Home Assistant users to build into their own setups:
bathroom scale, dog kennel, food bin, beer keg, whole bed, and anything similar. One firmware
serves all of these; nothing use-specific is hard-coded, and **everything a user needs to change
is a setting in HA, not a YAML edit.**

Primary target: ESPHome/HA users. Later: pre-flashed boards, and an OLED for standalone use.

## 2. Distribution (priority order)

1. **ESPHome package** — users write a short YAML that pulls the config from GitHub,
   pinned to a release tag:
   ```yaml
   packages:
     scale:
       url: https://github.com/smaegley/ScaleController_RevA
       ref: v1.0.0
       files: [firmware/packages/board-rev-a.yaml, firmware/packages/scale-core.yaml]
   ```
2. **Web installer** — GitHub Pages + ESP Web Tools: plug in, Install, Wi-Fi over USB (Improv).
   HA then discovers the board; `dashboard_import` lets the user "take control" in ESPHome.
3. **Copy the YAML** — the full example config in the repo still works stand-alone.
4. **Pre-flashed boards** — same image as the web installer; device name gets a MAC suffix so
   several scales on one network don't collide.

## 3. Hardware assumptions

- ESP32-C3, HX711 at gain 128 and 10 samples/s (RATE tied low in hardware), four half-bridge
  cells summed on the board. **There is one channel: the firmware cannot see individual cells or
  corners.**
- Rev-A: no buttons (SW1/SW2 removed, bring-up finding B1). Rev-B: BOOT button usable.
- Status LED D5 on GPIO7 (active-low). Optional SSD1306 128×64 OLED on I²C (J9).
- Board differences live in a board package (`board-rev-a.yaml`, later `board-rev-b.yaml`).

## 4. Home Assistant entities

Main (shown on dashboards):

| entity | type | notes |
|---|---|---|
| Weight | sensor, kg, device_class weight | live, filtered; reported per §6.4 |
| Stable weight | sensor, kg | updates only when the reading has settled (§6.3) |
| Last weigh-in | sensor, kg | set once per weigh-in (§6.3) |
| Weigh-in | event | fires on each weigh-in, for automations |
| Problem | binary_sensor, device_class problem | any active fault (§6.6) |
| Status | text_sensor | `OK`, or the fault reason |
| Zero | button | tare |
| Calibrate | button | uses Calibration weight (§6.1) |

Settings (entity_category config; all saved on the device and survive reboots and updates):

| setting | type | default |
|---|---|---|
| Calibration weight | number, kg | 1.0 |
| Calibration factor | number, counts per kg | set by Calibrate; editable to restore a known value |
| Display unit | select kg / lb | kg (OLED, web page, button) |
| Report mode | select: on change + heartbeat / fixed interval | on change + heartbeat |
| Report threshold | number, kg | 0.1 |
| Report interval | number, s | 300 (heartbeat, or the fixed interval) |
| Stability band | number, kg | 0.1 — TBD on the rig |
| Minimum weigh-in | number, kg | 2.0 |
| Rated capacity | number, kg | 200 (four 50 kg cells) |
| Auto-zero | switch | off |
| Status LED | select: off / status only / heartbeat / flash on weigh-in | status only |

Diagnostics (entity_category diagnostic, hidden by default): raw ADC counts, chip temperature,
Wi-Fi signal, uptime, firmware version.

## 5. Units

**Everything sent to HA is in kg.** ESPHome fixes a sensor's unit at compile time, so a
runtime kg/lb switch would mislabel HA history. HA converts weight sensors itself: users pick
lb in the entity's settings and HA shows and stores the conversion correctly. The device's
**Display unit** setting therefore controls only what the device shows (OLED, web page) and is
what the Rev-B long press toggles.

## 6. Behaviour

### 6.1 Calibration (no recompile)

1. Empty scale → **Zero**.
2. Place a known mass, enter it in **Calibration weight**, press **Calibrate**.
3. Firmware waits for a stable reading, sets factor = (raw − zero) / weight, saves it.

Refuse (Status explains why) if not zeroed, not stable, or the change is under ~1000 counts
(nothing on the scale, or a cell not loaded). The sign is whatever the hardware gives (load
reads negative on Rev-A). Until calibrated, Problem = on with reason "not calibrated" and
Weight is unavailable.

### 6.2 Zero

**Zero** stores the current stable raw value as the offset (saved). Rev-B: BOOT short press does
the same; a 3 s hold toggles the display unit.

### 6.3 Stable weight and weigh-ins

- Stable = all readings over the last ~1.5 s within **Stability band**. Stable weight publishes
  when the reading becomes stable at a new value.
- Weigh-in: the weight rises from near zero to above **Minimum weigh-in**, then becomes stable →
  set Last weigh-in and fire the Weigh-in event once. Re-arms when the weight returns near zero.
- Works for people (step on, step off) and for slow loads (a keg never weighs in again until it
  is lifted off; use Weight / Stable weight for those).
- Who stepped on is left to HA: ship an example automation/blueprint that assigns a weigh-in to
  a person by weight range.

### 6.4 Reporting to HA

- **On change + heartbeat** (default): send Weight when it moves by more than Report threshold
  since the last report, and at least every Report interval.
- **Fixed interval**: send every Report interval.
- Diagnostics report at fixed slow rates (temperature 60 s, Wi-Fi 60 s).

### 6.5 Auto-zero (optional, off by default)

When on: while the weight is within ±(a small band) of zero and stable, nudge the zero offset
slowly toward the reading. Never acts on a loaded scale. Saves to flash at most every 10 min.
Meant for bathroom use; leave off for kegs, food bins, beds.

### 6.6 Faults (Problem + Status)

| reason | condition |
|---|---|
| ADC not responding | no HX711 reading for > 2 s |
| Reading at limit | raw within 0.1% of ±8,388,607 (cell unplugged/shorted, wiring) |
| Overload | weight > Rated capacity |
| Not calibrated | no saved factor |

### 6.7 Status LED (setting)

- off
- status only — blink while Wi-Fi/HA are down or a fault is active, otherwise off
- heartbeat — short blink every few seconds
- flash on weigh-in — status only, plus a flash per weigh-in

### 6.8 OLED (optional package `oled.yaml`)

Weight in large digits in the Display unit, small Wi-Fi/HA status icon, "Not calibrated" or
the fault reason when relevant. Dims after inactivity (no weight change), wakes on change.

### 6.9 Web page

On by default, for setup and for users without HA. **It must look like a current consumer
product, not a generic entity table.** ESPHome's built-in page (even `web_server` version 3)
is an auto-generated list of entities, so the scale ships its own page.

Requirements:

- **A designed, scale-specific UI**, not a list of entities:
  - main view: the weight in large digits in the Display unit, a stable/settling indicator,
    and a big Zero button
  - Status: OK, or the fault reason
  - Calibrate as a guided step-by-step flow (empty → Zero → place weight → enter it → Calibrate,
    each step showing what it is waiting for)
  - settings grouped on their own screen, diagnostics tucked away
- Mobile-first (it will mostly be opened on a phone next to the scale), works on desktop.
  Light and dark mode following the system setting. Clean type, generous spacing, touch-sized
  controls, smooth live updates without flicker.
- **Served entirely from the device** — no CDN or internet access needed; the scale may sit
  on a network with no internet access.
- Small: plain JS/CSS, gzipped into the firmware, target ≤ 60 KB (v0.1: ~8 KB).
  Live updates come from two extra entities, hidden in HA by default: Live weight (4/s)
  and Stable.
- Talks to ESPHome's own web-server API (the `/events` stream and the REST endpoints), so it
  needs no extra component on the device. The stock ESPHome page stays reachable from
  Settings → Diagnostics as a fallback for debugging (that one loads from the internet).
- Same look reused for the web installer page (§2), so the product feels consistent.

Cost: re-testing the page when ESPHome changes its web-server API.

## 7. Package layout

```
firmware/
  packages/
    scale-core.yaml      HX711, weight logic, settings, faults, LED, diagnostics, web page
    board-rev-a.yaml     pins, no button
    board-rev-b.yaml     pins + BOOT button actions (when Rev-B exists)
    oled.yaml            optional display
  scale-controller.yaml  example top-level config (copy-the-YAML users)
  web-installer.yaml     build for ESP Web Tools / pre-flashed boards
  smoke-test.yaml        bring-up only
  components/scale/      weighing logic (C++ external component)
  web/
    scale-ui.js          scale web page (§6.9), one self-contained file; ESPHome gzips it
                         into the firmware (`web_server: js_include`), no build step
```

Logic beyond a few lines goes in a small C++ header (`firmware/packages/scale.h`) rather than
long YAML lambdas.

## 8. Open items — to settle on the rig

- **Range and resolution**: counts per kg is unknown until calibration. Noise is ±50 counts;
  resolution follows from that (and from drift).
- **Zero drift**: ~10k counts over 21 h unloaded. Log against chip temperature; decide whether
  temperature compensation is worth adding.
- Default Stability band, Minimum weigh-in and settle time: tune with a person stepping on.
- Corner test: the same mass over each cell should read within ~1%.
- Confirm HA's own kg→lb conversion behaves as described in §5 on Steve's HA version.
