#pragma once

// Weighing logic for the Scale Controller. Behaviour is specified in docs/firmware-spec.md
// (section numbers in the comments below refer to it).

#include <string>

#include "esphome/core/component.h"
#include "esphome/core/preferences.h"
#include "esphome/components/binary_sensor/binary_sensor.h"
#include "esphome/components/event/event.h"
#include "esphome/components/number/number.h"
#include "esphome/components/output/binary_output.h"
#include "esphome/components/select/select.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/switch/switch.h"
#include "esphome/components/text_sensor/text_sensor.h"

namespace esphome {
namespace scale {

class Scale : public Component {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::DATA; }

  // Called with every HX711 reading (raw counts).
  void add_raw(float raw);
  // Buttons (6.1, 6.2). Both wait for a stable reading.
  void request_zero();
  void request_calibrate();
  // Rev-B button long press (6.2).
  void toggle_display_unit();

  // For the OLED and web page: weight in the Display unit, NAN if not calibrated.
  float display_weight() const;
  const char *display_unit() const { return this->display_lb_() ? "lb" : "kg"; }
  bool is_stable() const { return this->stable_; }
  const std::string &status() const { return this->status_; }

  void set_weight_sensor(sensor::Sensor *s) { this->weight_ = s; }
  void set_stable_weight_sensor(sensor::Sensor *s) { this->stable_weight_ = s; }
  void set_last_weigh_in_sensor(sensor::Sensor *s) { this->last_weigh_in_ = s; }
  void set_raw_counts_sensor(sensor::Sensor *s) { this->raw_counts_ = s; }
  void set_problem_sensor(binary_sensor::BinarySensor *s) { this->problem_ = s; }
  void set_status_sensor(text_sensor::TextSensor *s) { this->status_sensor_ = s; }
  void set_weigh_in_event(event::Event *e) { this->weigh_in_event_ = e; }
  void set_led(output::BinaryOutput *o) { this->led_ = o; }
  void set_calibration_weight_number(number::Number *n) { this->cal_weight_ = n; }
  void set_calibration_factor_number(number::Number *n) { this->cal_factor_ = n; }
  void set_display_unit_select(select::Select *s) { this->display_unit_ = s; }
  void set_report_mode_select(select::Select *s) { this->report_mode_ = s; }
  void set_report_threshold_number(number::Number *n) { this->report_threshold_ = n; }
  void set_report_interval_number(number::Number *n) { this->report_interval_ = n; }
  void set_stability_band_number(number::Number *n) { this->stability_band_ = n; }
  void set_min_weigh_in_number(number::Number *n) { this->min_weigh_in_ = n; }
  void set_capacity_number(number::Number *n) { this->capacity_ = n; }
  void set_auto_zero_switch(switch_::Switch *s) { this->auto_zero_ = s; }
  void set_led_mode_select(select::Select *s) { this->led_mode_ = s; }

 protected:
  // 8 readings/s (update_interval 125 ms): 12 readings = 1.5 s stability window,
  // 4 readings = 0.5 s average for the live weight.
  static constexpr int WINDOW = 12;
  static constexpr int LIVE = 4;

  enum class WeighIn { UNKNOWN, ARMED, LOADING, DONE };
  enum class Pending { NONE, ZERO, CALIBRATE };

  struct ZeroPref {
    float zero;
    bool valid;
  };

  float factor_() const;
  bool calibrated_() const;
  bool display_lb_() const;
  float setting_(number::Number *n, float fallback) const;
  size_t index_(select::Select *s) const;

  void run_pending_(uint32_t now);
  void update_weigh_in_(float live_kg, float stable_kg, uint32_t now);
  void track_zero_(float stable_kg, uint32_t now);
  void report_weight_(float live_kg, uint32_t now);
  void save_zero_(bool now);
  void set_message_(const std::string &msg, uint32_t now, bool hold);
  void update_status_(uint32_t now);
  void update_led_(uint32_t now);

  // readings
  float buf_[WINDOW]{};
  int head_{0};
  int count_{0};
  float mean_raw_{NAN};
  float live_raw_{NAN};
  bool stable_{false};
  bool saturated_{false};
  uint32_t last_sample_ms_{0};

  // zero (6.2, 6.5)
  ESPPreferenceObject zero_pref_;
  float zero_{0};
  bool zero_valid_{false};
  uint32_t last_zero_save_ms_{0};
  bool zero_dirty_{false};

  // pending Zero / Calibrate (6.1, 6.2)
  Pending pending_{Pending::NONE};
  uint32_t pending_since_ms_{0};

  // weigh-ins (6.3)
  WeighIn weigh_in_{WeighIn::UNKNOWN};
  float last_stable_published_{NAN};

  // reporting (6.4)
  float last_reported_{NAN};
  uint32_t last_report_ms_{0};
  bool reported_unavailable_{false};
  uint32_t last_raw_publish_ms_{0};

  // status (6.6) and LED (6.7)
  std::string message_;
  uint32_t message_until_ms_{0};
  bool message_hold_{false};
  std::string status_;
  bool problem_state_{false};
  bool fault_{false};
  uint32_t last_status_ms_{0};
  uint32_t flash_until_ms_{0};
  bool led_on_{false};
  bool led_written_{false};

  sensor::Sensor *weight_{nullptr};
  sensor::Sensor *stable_weight_{nullptr};
  sensor::Sensor *last_weigh_in_{nullptr};
  sensor::Sensor *raw_counts_{nullptr};
  binary_sensor::BinarySensor *problem_{nullptr};
  text_sensor::TextSensor *status_sensor_{nullptr};
  event::Event *weigh_in_event_{nullptr};
  output::BinaryOutput *led_{nullptr};
  number::Number *cal_weight_{nullptr};
  number::Number *cal_factor_{nullptr};
  select::Select *display_unit_{nullptr};
  select::Select *report_mode_{nullptr};
  number::Number *report_threshold_{nullptr};
  number::Number *report_interval_{nullptr};
  number::Number *stability_band_{nullptr};
  number::Number *min_weigh_in_{nullptr};
  number::Number *capacity_{nullptr};
  switch_::Switch *auto_zero_{nullptr};
  select::Select *led_mode_{nullptr};
};

}  // namespace scale
}  // namespace esphome
