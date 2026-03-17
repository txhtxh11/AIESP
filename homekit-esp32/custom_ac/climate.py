import esphome.codegen as cg
import esphome.config_validation as cv
# 引入需要的依赖: globals 和 remote_transmitter
from esphome.components import climate, globals as globals_, remote_transmitter
from esphome.const import (
    CONF_ID,
    CONF_NAME,
    CONF_DISABLED_BY_DEFAULT,
    CONF_ENTITY_CATEGORY,
    CONF_ICON,
    CONF_INTERNAL,
    CONF_VISUAL,
    CONF_MIN_TEMPERATURE,
    CONF_MAX_TEMPERATURE,
    CONF_TEMPERATURE_STEP,
    CONF_TARGET_TEMPERATURE,
)

# 声明组件依赖
DEPENDENCIES =['remote_transmitter', 'globals']

custom_ac_ns = cg.esphome_ns.namespace("custom_ac")
CustomAC = custom_ac_ns.class_("CustomAC", climate.Climate, cg.Component)

# 定义我们的自定义键名
CONF_STORED_IR = "stored_ir"
CONF_TRANSMITTER = "transmitter"

TEMP_STEP_SCHEMA = cv.Schema({
    cv.Optional(CONF_TARGET_TEMPERATURE, default=1): cv.temperature,
    cv.Optional("current_temperature", default=1): cv.temperature,
})

VISUAL_SCHEMA = cv.Schema({
    cv.Optional(CONF_MIN_TEMPERATURE, default=16): cv.temperature,
    cv.Optional(CONF_MAX_TEMPERATURE, default=30): cv.temperature,
    cv.Optional(CONF_TEMPERATURE_STEP, default={}): TEMP_STEP_SCHEMA,
})

CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(CustomAC),
    cv.Required(CONF_NAME): cv.string,
    cv.Optional(CONF_DISABLED_BY_DEFAULT, default=False): cv.boolean,
    cv.Optional(CONF_ENTITY_CATEGORY): cv.entity_category,
    cv.Optional(CONF_ICON): cv.icon,
    cv.Optional(CONF_INTERNAL, default=False): cv.boolean,
    cv.Optional(CONF_VISUAL, default={}): VISUAL_SCHEMA,
    
    # ------------------ 新增的依赖配置 ------------------
    # 强制要求在 YAML 中必须填入这两个 ID
    cv.Required(CONF_STORED_IR): cv.use_id(globals_.GlobalsComponent),
    cv.Required(CONF_TRANSMITTER): cv.use_id(remote_transmitter.RemoteTransmitterComponent),
    # ----------------------------------------------------
}).extend(cv.COMPONENT_SCHEMA)

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await climate.register_climate(var, config)
    
    # ------------------ 新增的依赖注入逻辑 ------------------
    # 获取 YAML 中配置的全局变量对象，并传给 C++ 类的 set_stored_ir 方法
    stored_ir = await cg.get_variable(config[CONF_STORED_IR])
    cg.add(var.set_stored_ir(stored_ir))

    # 获取 YAML 中配置的红外发射器对象，并传给 C++ 类的 set_transmitter 方法
    transmitter = await cg.get_variable(config[CONF_TRANSMITTER])
    cg.add(var.set_transmitter(transmitter))
    # --------------------------------------------------------