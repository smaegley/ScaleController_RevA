"""Scale logic for the Scale Controller (docs/firmware-spec.md).

The entities themselves are declared in YAML (firmware/packages/scale-core.yaml); this
component only holds the weighing logic and is handed references to them.
"""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import (
    binary_sensor,
    event,
    number,
    output,
    select,
    sensor,
    switch,
    text_sensor,
)
from esphome.const import CONF_ID

CODEOWNERS = ["@smaegley"]
DEPENDENCIES = [
    "binary_sensor",
    "event",
    "number",
    "output",
    "select",
    "sensor",
    "switch",
    "text_sensor",
]

scale_ns = cg.esphome_ns.namespace("scale")
Scale = scale_ns.class_("Scale", cg.Component)

# config key -> (entity type, setter)
LINKS = {
    # outputs
    "weight": (sensor.Sensor, "set_weight_sensor"),
    "stable_weight": (sensor.Sensor, "set_stable_weight_sensor"),
    "last_weigh_in": (sensor.Sensor, "set_last_weigh_in_sensor"),
    "raw_counts": (sensor.Sensor, "set_raw_counts_sensor"),
    "live_weight": (sensor.Sensor, "set_live_weight_sensor"),
    "stable": (binary_sensor.BinarySensor, "set_stable_sensor"),
    "problem": (binary_sensor.BinarySensor, "set_problem_sensor"),
    "status": (text_sensor.TextSensor, "set_status_sensor"),
    "weigh_in_event": (event.Event, "set_weigh_in_event"),
    "led": (output.BinaryOutput, "set_led"),
    # settings
    "calibration_weight": (number.Number, "set_calibration_weight_number"),
    "calibration_factor": (number.Number, "set_calibration_factor_number"),
    "display_unit": (select.Select, "set_display_unit_select"),
    "report_mode": (select.Select, "set_report_mode_select"),
    "report_threshold": (number.Number, "set_report_threshold_number"),
    "report_interval": (number.Number, "set_report_interval_number"),
    "stability_band": (number.Number, "set_stability_band_number"),
    "min_weigh_in": (number.Number, "set_min_weigh_in_number"),
    "capacity": (number.Number, "set_capacity_number"),
    "auto_zero": (switch.Switch, "set_auto_zero_switch"),
    "led_mode": (select.Select, "set_led_mode_select"),
}

CONFIG_SCHEMA = cv.Schema(
    {cv.GenerateID(): cv.declare_id(Scale)}
    | {cv.Required(key): cv.use_id(cls) for key, (cls, _) in LINKS.items()}
).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    for key, (_, setter) in LINKS.items():
        ref = await cg.get_variable(config[key])
        cg.add(getattr(var, setter)(ref))
