#include "scale.h"

#include <algorithm>
#include <cmath>

#include "esphome/core/defines.h"
#include "esphome/core/hal.h"
#include "esphome/core/helpers.h"
#include "esphome/core/log.h"

#ifdef USE_WIFI
#include "esphome/components/wifi/wifi_component.h"
#endif
#ifdef USE_API
#include "esphome/components/api/api_server.h"
#endif

namespace esphome {
namespace scale {

static const char *const TAG = "scale";

static constexpr float KG_PER_LB = 0.45359237f;
static constexpr float SATURATION_COUNTS = 8380000.0f;  // within 0.1% of the 24-bit limit
static constexpr float UNCALIBRATED_STABLE_COUNTS = 500.0f;  // ~10x the noise floor
static constexpr float MIN_CALIBRATION_COUNTS = 1000.0f;
static constexpr float AUTO_ZERO_ALPHA = 0.02f;  // per stable reading, ~6 s time constant
static constexpr uint32_t ADC_TIMEOUT_MS = 2000;
static constexpr uint32_t PENDING_TIMEOUT_MS = 15000;
static constexpr uint32_t MESSAGE_MS = 15000;
static constexpr uint32_t MIN_REPORT_GAP_MS = 500;
static constexpr uint32_t RAW_PUBLISH_MS = 5000;
static constexpr uint32_t LIVE_PUBLISH_MS = 250;     // web page refresh rate
static constexpr uint32_t LIVE_HEARTBEAT_MS = 5000;
static constexpr float LIVE_MIN_CHANGE_KG = 0.002f;
static constexpr uint32_t AUTO_ZERO_SAVE_MS = 10 * 60 * 1000;
static constexpr uint32_t STATUS_PERIOD_MS = 500;
static constexpr uint32_t STARTUP_GRACE_MS = 5000;

// Option order of the selects in scale-core.yaml
static constexpr size_t REPORT_FIXED = 1;
static constexpr size_t UNIT_LB = 1;
enum LedMode : size_t { LED_OFF = 0, LED_STATUS = 1, LED_HEARTBEAT = 2, LED_WEIGH_IN = 3 };

void Scale::setup() {
  this->zero_pref_ = global_preferences->make_preference<ZeroPref>(fnv1_hash("scale_zero_v1"));
  ZeroPref pref{};
  if (this->zero_pref_.load(&pref) && pref.valid && std::isfinite(pref.zero)) {
    this->zero_ = pref.zero;
    this->zero_valid_ = true;
  }
}

void Scale::dump_config() {
  ESP_LOGCONFIG(TAG, "Scale:");
  if (this->zero_valid_) {
    ESP_LOGCONFIG(TAG, "  Zero: %.0f counts", this->zero_);
  } else {
    ESP_LOGCONFIG(TAG, "  Zero: not set");
  }
  ESP_LOGCONFIG(TAG, "  Calibration factor: %.2f counts/kg", this->factor_());
}

void Scale::loop() {
  const uint32_t now = millis();
  if (now - this->last_status_ms_ >= STATUS_PERIOD_MS) {
    this->last_status_ms_ = now;
    this->update_status_(now);
  }
  // 6.5: auto-zero changes are written at most every 10 min; catch the last one
  if (this->zero_dirty_ && now - this->last_zero_save_ms_ >= AUTO_ZERO_SAVE_MS)
    this->save_zero_(false);
  this->update_led_(now);
}

// ---- settings ----

float Scale::factor_() const { return this->cal_factor_ != nullptr ? this->cal_factor_->state : NAN; }

bool Scale::calibrated_() const {
  const float f = this->factor_();
  return this->zero_valid_ && std::isfinite(f) && std::fabs(f) >= 1.0f;
}

float Scale::setting_(number::Number *n, float fallback) const {
  return (n != nullptr && std::isfinite(n->state)) ? n->state : fallback;
}

size_t Scale::index_(select::Select *s) const { return s != nullptr ? s->active_index().value_or(0) : 0; }

bool Scale::display_lb_() const { return this->index_(this->display_unit_) == UNIT_LB; }

float Scale::display_weight() const {
  if (!this->calibrated_() || std::isnan(this->live_raw_))
    return NAN;
  const float kg = (this->live_raw_ - this->zero_) / this->factor_();
  return this->display_lb_() ? kg / KG_PER_LB : kg;
}

void Scale::toggle_display_unit() {
  if (this->display_unit_ == nullptr)
    return;
  auto call = this->display_unit_->make_call();
  call.select_next(true);
  call.perform();
}

// ---- readings ----

void Scale::add_raw(float raw) {
  if (!std::isfinite(raw))
    return;
  const uint32_t now = millis();
  this->last_sample_ms_ = now;
  this->saturated_ = std::fabs(raw) >= SATURATION_COUNTS;

  this->buf_[this->head_] = raw;
  this->head_ = (this->head_ + 1) % WINDOW;
  if (this->count_ < WINDOW)
    this->count_++;

  float sum = 0, lo = raw, hi = raw, live_sum = 0;
  const int live_n = std::min(LIVE, this->count_);
  for (int i = 0; i < this->count_; i++) {
    const float v = this->buf_[(this->head_ - 1 - i + WINDOW) % WINDOW];
    sum += v;
    lo = std::min(lo, v);
    hi = std::max(hi, v);
    if (i < live_n)
      live_sum += v;
  }
  this->mean_raw_ = sum / this->count_;
  this->live_raw_ = live_sum / live_n;

  // 6.3: stable = every reading in the window within the Stability band
  const float f = this->factor_();
  const bool have_factor = std::isfinite(f) && std::fabs(f) >= 1.0f;
  const float band = this->setting_(this->stability_band_, 0.1f);
  const float spread = hi - lo;
  this->stable_ = this->count_ == WINDOW && !this->saturated_ &&
                  (have_factor ? spread / std::fabs(f) <= band : spread <= UNCALIBRATED_STABLE_COUNTS);

  this->run_pending_(now);

  if (this->stable_sensor_ != nullptr &&
      (!this->stable_sensor_->has_state() || this->stable_sensor_->state != this->stable_))
    this->stable_sensor_->publish_state(this->stable_);

  if (this->raw_counts_ != nullptr && now - this->last_raw_publish_ms_ >= RAW_PUBLISH_MS) {
    this->last_raw_publish_ms_ = now;
    this->raw_counts_->publish_state(this->mean_raw_);
  }

  if (!this->calibrated_()) {
    if (!this->reported_unavailable_) {
      this->weight_->publish_state(NAN);
      this->live_weight_->publish_state(NAN);
      this->last_live_published_ = NAN;
      this->reported_unavailable_ = true;
    }
    this->weigh_in_ = WeighIn::UNKNOWN;
    return;
  }
  this->reported_unavailable_ = false;

  const float live_kg = (this->live_raw_ - this->zero_) / f;
  const float stable_kg = (this->mean_raw_ - this->zero_) / f;

  this->track_zero_(stable_kg, now);

  if (this->stable_ &&
      (std::isnan(this->last_stable_published_) || std::fabs(stable_kg - this->last_stable_published_) > band / 2)) {
    this->last_stable_published_ = stable_kg;
    this->stable_weight_->publish_state(stable_kg);
  }

  this->update_weigh_in_(live_kg, stable_kg, now);
  this->report_weight_(live_kg, now);
  this->publish_live_(live_kg, now);
}

// Fast weight for the web page and OLED; disabled by default in HA (spec 6.9).
void Scale::publish_live_(float live_kg, uint32_t now) {
  if (this->live_weight_ == nullptr || now - this->last_live_ms_ < LIVE_PUBLISH_MS)
    return;
  if (!std::isnan(this->last_live_published_) &&
      std::fabs(live_kg - this->last_live_published_) < LIVE_MIN_CHANGE_KG &&
      now - this->last_live_ms_ < LIVE_HEARTBEAT_MS)
    return;
  this->last_live_published_ = live_kg;
  this->last_live_ms_ = now;
  this->live_weight_->publish_state(live_kg);
}

// ---- Zero and Calibrate (6.1, 6.2) ----

void Scale::request_zero() {
  this->pending_ = Pending::ZERO;
  this->pending_since_ms_ = millis();
  this->set_message_("Zeroing: keep the scale still", this->pending_since_ms_, true);
}

void Scale::request_calibrate() {
  const uint32_t now = millis();
  if (!this->zero_valid_) {
    this->set_message_("Calibration failed: press Zero with the scale empty first", now, false);
    return;
  }
  this->pending_ = Pending::CALIBRATE;
  this->pending_since_ms_ = now;
  this->set_message_("Calibrating: keep the scale still", now, true);
}

void Scale::run_pending_(uint32_t now) {
  if (this->pending_ == Pending::NONE)
    return;
  const bool zeroing = this->pending_ == Pending::ZERO;
  if (now - this->pending_since_ms_ > PENDING_TIMEOUT_MS) {
    this->pending_ = Pending::NONE;
    this->set_message_(zeroing ? "Zero failed: reading not stable" : "Calibration failed: reading not stable", now,
                       false);
    return;
  }
  if (!this->stable_)
    return;
  this->pending_ = Pending::NONE;

  if (zeroing) {
    this->zero_ = this->mean_raw_;
    this->zero_valid_ = true;
    this->save_zero_(true);
    this->last_stable_published_ = NAN;
    this->last_reported_ = NAN;
    this->weigh_in_ = WeighIn::UNKNOWN;
    this->set_message_("Zeroed", now, false);
    return;
  }

  const float mass = this->setting_(this->cal_weight_, 0.0f);
  const float delta = this->mean_raw_ - this->zero_;
  if (mass <= 0) {
    this->set_message_("Calibration failed: enter the calibration weight", now, false);
    return;
  }
  if (std::fabs(delta) < MIN_CALIBRATION_COUNTS) {
    this->set_message_("Calibration failed: no weight detected", now, false);
    return;
  }
  const float factor = delta / mass;
  auto call = this->cal_factor_->make_call();
  call.set_value(factor);
  call.perform();
  this->last_stable_published_ = NAN;
  this->last_reported_ = NAN;
  this->weigh_in_ = WeighIn::UNKNOWN;
  char msg[64];
  snprintf(msg, sizeof(msg), "Calibrated: %.1f counts/kg", factor);
  this->set_message_(msg, now, false);
}

void Scale::save_zero_(bool sync) {
  ZeroPref pref{this->zero_, this->zero_valid_};
  this->zero_pref_.save(&pref);
  this->last_zero_save_ms_ = millis();
  this->zero_dirty_ = false;
  if (sync)
    global_preferences->sync();
}

// ---- weigh-ins (6.3) ----

void Scale::update_weigh_in_(float live_kg, float stable_kg, uint32_t now) {
  const float min_kg = this->setting_(this->min_weigh_in_, 2.0f);
  const float low_kg = min_kg / 2;
  switch (this->weigh_in_) {
    case WeighIn::UNKNOWN:
      // Don't fire for whatever is already on the scale at boot or after Zero/Calibrate
      if (this->stable_)
        this->weigh_in_ = stable_kg < low_kg ? WeighIn::ARMED : WeighIn::DONE;
      break;
    case WeighIn::ARMED:
      if (live_kg > min_kg)
        this->weigh_in_ = WeighIn::LOADING;
      break;
    case WeighIn::LOADING:
      if (live_kg < low_kg) {
        this->weigh_in_ = WeighIn::ARMED;
      } else if (this->stable_ && stable_kg > min_kg) {
        ESP_LOGI(TAG, "Weigh-in: %.2f kg", stable_kg);
        this->last_weigh_in_->publish_state(stable_kg);
        this->weigh_in_event_->trigger("weigh_in");
        this->flash_until_ms_ = now + 1500;
        this->weigh_in_ = WeighIn::DONE;
      }
      break;
    case WeighIn::DONE:
      if (live_kg < low_kg)
        this->weigh_in_ = WeighIn::ARMED;
      break;
  }
}

// ---- auto-zero (6.5) ----

void Scale::track_zero_(float stable_kg, uint32_t now) {
  if (this->auto_zero_ == nullptr || !this->auto_zero_->state || !this->stable_ ||
      this->weigh_in_ != WeighIn::ARMED)
    return;
  const float band = this->setting_(this->stability_band_, 0.1f);
  if (std::fabs(stable_kg) > 2 * band)
    return;
  this->zero_ += (this->mean_raw_ - this->zero_) * AUTO_ZERO_ALPHA;
  this->zero_dirty_ = true;
  if (now - this->last_zero_save_ms_ >= AUTO_ZERO_SAVE_MS)
    this->save_zero_(false);
}

// ---- reporting (6.4) ----

void Scale::report_weight_(float live_kg, uint32_t now) {
  const uint32_t since = now - this->last_report_ms_;
  const uint32_t interval_ms = static_cast<uint32_t>(this->setting_(this->report_interval_, 300.0f) * 1000.0f);
  bool due;
  if (std::isnan(this->last_reported_)) {
    due = true;
  } else if (this->index_(this->report_mode_) == REPORT_FIXED) {
    due = since >= interval_ms;
  } else {
    const float threshold = this->setting_(this->report_threshold_, 0.1f);
    due = (std::fabs(live_kg - this->last_reported_) >= threshold && since >= MIN_REPORT_GAP_MS) ||
          since >= interval_ms;
  }
  if (!due)
    return;
  this->last_reported_ = live_kg;
  this->last_report_ms_ = now;
  this->weight_->publish_state(live_kg);
}

// ---- status (6.6) ----

void Scale::set_message_(const std::string &msg, uint32_t now, bool hold) {
  ESP_LOGI(TAG, "%s", msg.c_str());
  this->message_ = msg;
  this->message_hold_ = hold;
  this->message_until_ms_ = now + MESSAGE_MS;
  this->update_status_(now);
}

void Scale::update_status_(uint32_t now) {
  const char *fault = nullptr;
  if (now > STARTUP_GRACE_MS && now - this->last_sample_ms_ > ADC_TIMEOUT_MS) {
    fault = "ADC not responding";
  } else if (this->saturated_) {
    fault = "Reading at limit: check the load-cell wiring";
  } else if (!this->calibrated_()) {
    fault = "Not calibrated";
  } else if (!std::isnan(this->live_raw_) &&
             (this->live_raw_ - this->zero_) / this->factor_() > this->setting_(this->capacity_, 200.0f)) {
    fault = "Overload";
  }
  this->fault_ = fault != nullptr;

  const bool show_message = this->message_hold_ || (int32_t) (this->message_until_ms_ - now) > 0;
  const std::string status = show_message && !this->message_.empty() ? this->message_ : (fault ? fault : "OK");
  if (status != this->status_ || !this->status_sensor_->has_state()) {
    this->status_ = status;
    this->status_sensor_->publish_state(status);
  }
  if (this->fault_ != this->problem_state_ || !this->problem_->has_state()) {
    this->problem_state_ = this->fault_;
    this->problem_->publish_state(this->fault_);
  }
}

// ---- status LED (6.7) ----

void Scale::update_led_(uint32_t now) {
  if (this->led_ == nullptr)
    return;
  const size_t mode = this->index_(this->led_mode_);
  bool issue = this->fault_;
#ifdef USE_WIFI
  if (wifi::global_wifi_component != nullptr && !wifi::global_wifi_component->is_connected())
    issue = true;
#endif
#ifdef USE_API
  if (api::global_api_server != nullptr && !api::global_api_server->is_connected())
    issue = true;
#endif
  bool on = false;
  if (mode == LED_OFF) {
    on = false;
  } else if (issue) {
    on = (now / 250) % 2 == 0;
  } else if (mode == LED_HEARTBEAT) {
    on = now % 3000 < 60;
  } else if (mode == LED_WEIGH_IN && (int32_t) (this->flash_until_ms_ - now) > 0) {
    on = ((this->flash_until_ms_ - now) / 150) % 2 == 0;
  }
  if (on != this->led_on_ || !this->led_written_) {
    this->led_on_ = on;
    this->led_written_ = true;
    this->led_->set_state(on);
  }
}

}  // namespace scale
}  // namespace esphome
