#pragma once
#include "esphome.h"
#include "esphome/components/globals/globals_component.h"
#include "esphome/components/remote_transmitter/remote_transmitter.h"

namespace custom_ac {

class CustomAC : public esphome::Component, public esphome::climate::Climate {
 protected:
  // 使用正确的类型：RestoringGlobalStringComponent
  esphome::globals::RestoringGlobalStringComponent<std::string, 64> *storage_global_{nullptr};
  esphome::remote_transmitter::RemoteTransmitterComponent *transmitter_{nullptr};

 public:
  // 修改参数类型以匹配
  void set_stored_ir(esphome::globals::RestoringGlobalStringComponent<std::string, 64> *storage) { 
    this->storage_global_ = storage; 
  }
  
  void set_transmitter(esphome::remote_transmitter::RemoteTransmitterComponent *tx) { 
    this->transmitter_ = tx; 
  }

  void setup() override {
    this->target_temperature = 24.0;
    this->current_temperature = 25.0;
    this->mode = esphome::climate::CLIMATE_MODE_OFF;
    this->fan_mode = esphome::climate::CLIMATE_FAN_AUTO;
  }

  esphome::climate::ClimateTraits traits() override {
    auto traits = esphome::climate::ClimateTraits();
    traits.set_supports_current_temperature(true);
    traits.set_supports_two_point_target_temperature(false);
    traits.set_supports_action(false);
    
    traits.set_supported_modes({
      esphome::climate::CLIMATE_MODE_OFF,
      esphome::climate::CLIMATE_MODE_COOL,
      esphome::climate::CLIMATE_MODE_HEAT,
      esphome::climate::CLIMATE_MODE_DRY,
      esphome::climate::CLIMATE_MODE_FAN_ONLY,
    });
    
    traits.set_supported_fan_modes({
      esphome::climate::CLIMATE_FAN_AUTO,
      esphome::climate::CLIMATE_FAN_LOW,
      esphome::climate::CLIMATE_FAN_MEDIUM,
      esphome::climate::CLIMATE_FAN_HIGH,
    });
    
    traits.set_visual_min_temperature(16);
    traits.set_visual_max_temperature(30);
    traits.set_visual_temperature_step(1);
    return traits;
  }

  void control(const esphome::climate::ClimateCall &call) override {
    bool changed = false;
    
    if (call.get_mode().has_value()) {
      this->mode = *call.get_mode();
      changed = true;
      ESP_LOGI("custom_ac", "Mode: %d", this->mode);
    }
    
    if (call.get_target_temperature().has_value()) {
      this->target_temperature = *call.get_target_temperature();
      changed = true;
      ESP_LOGI("custom_ac", "Temp: %.1f", this->target_temperature);
    }
    
    if (call.get_fan_mode().has_value()) {
      this->fan_mode = *call.get_fan_mode();
      changed = true;
    }
    
    if (changed) {
      send_ir_code();
    }
    
    this->publish_state();
  }

  void send_ir_code() {
    if (!this->storage_global_ || !this->transmitter_) {
        ESP_LOGE("custom_ac", "IR storage or transmitter not configured!");
        return;
    }

    // 通过指针读取数据
    std::string saved = this->storage_global_->value();
    
    if (saved.length() < 5) {
      ESP_LOGW("custom_ac", "No IR code stored");
      return;
    }
    
    std::vector<int> timings;
    std::string num = "";
    for (char c : saved) {
      if (c == '-' || (c >= '0' && c <= '9')) {
        num += c;
      } else if (!num.empty()) {
        timings.push_back(std::stoi(num));
        num = "";
      }
    }
    if (!num.empty()) timings.push_back(std::stoi(num));
    if (timings.empty()) return;
    
    // 修复：移除 set_carrier_frequency 调用
    // 载波频率应该在 YAML 配置中设置，或者使用 transmit_raw 方法
    auto call = this->transmitter_->transmit();
    auto *data = call.get_data();
    data->reset();
    for (size_t i = 0; i < timings.size(); i++) {
      if (i % 2 == 0) 
        data->mark(std::abs(timings[i]));
      else 
        data->space(std::abs(timings[i]));
    }
    call.perform();
    
    ESP_LOGI("custom_ac", "IR sent: mode=%d temp=%.1f", this->mode, this->target_temperature);
  }
};

}  // namespace custom_ac
