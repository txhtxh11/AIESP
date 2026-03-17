#pragma once
#include <esphome/core/defines.h>
#ifdef USE_SENSOR
#include <map>
#include <string>
#include "const.h"
#include <esphome/core/application.h>
#include <hap.h>
#include <hap_apple_servs.h>
#include <hap_apple_chars.h>
#include "hap_entity.h"

namespace esphome
{
  namespace homekit
  {
    class SensorEntity : public HAPEntity
    {
    private:
      static constexpr const char* TAG = "SensorEntity";
      sensor::Sensor* sensorPtr;

      // 传感器数值更新回调
      static void on_sensor_update(sensor::Sensor* obj, float v) {
        ESP_LOGD(TAG, "%s value: %.2f", obj->get_name().c_str(), v);
        hap_acc_t* acc = hap_acc_get_by_aid(hap_get_unique_aid(std::to_string(obj->get_object_id_hash()).c_str()));
        
        if (acc) {
          // 获取第一个服务
          hap_serv_t* hs = hap_serv_get_next(hap_acc_get_first_serv(acc));
          if (hs) {
            // 获取该服务下的第一个特征（通常就是主数值，如温度/湿度）
            hap_char_t* on_char = hap_serv_get_first_char(hs);
            
            // === 关键修复开始 ===
            // 之前的逻辑是判断如果是整数就发整数，这是错误的。
            // HomeKit 的温度、湿度、光照、PM2.5 等全部强制要求 Float 格式。
            hap_val_t state;
            state.f = v; // 强制使用浮点数
            // ===================
            
            ESP_LOGD(TAG, "HAP UPDATE %s -> %.2f", obj->get_name().c_str(), state.f);
            hap_char_update_val(on_char, &state);
          }
        }
      }

      // HomeKit 主动读取回调
      static int sensor_read(hap_char_t* hc, hap_status_t* status_code, void* serv_priv, void* read_priv) {
        if (serv_priv) {
          sensor::Sensor* sensorPtr = (sensor::Sensor*)serv_priv;
          ESP_LOGD(TAG, "Read called for %s", sensorPtr->get_name().c_str());
          
          float v = sensorPtr->get_state();
          hap_val_t sensorValue;
          
          // === 关键修复开始 ===
          sensorValue.f = v; // 强制使用浮点数
          // ===================

          hap_char_update_val(hc, &sensorValue);
          *status_code = HAP_STATUS_SUCCESS;
          return HAP_SUCCESS;
        }
        return HAP_FAIL;
      }

      static int acc_identify(hap_acc_t* ha) {
        ESP_LOGI(TAG, "Accessory identified");
        return HAP_SUCCESS;
      }

    public:
      SensorEntity(sensor::Sensor* sensorPtr) : HAPEntity({{MODEL, "HAP-SENSOR"}}), sensorPtr(sensorPtr) {}
      
      void setup() {
        hap_serv_t* service = nullptr;
        std::string device_class = sensorPtr->get_device_class_ref();

        // 优化了字符串比较逻辑，移除了导致内存泄漏的 strdup
        if (device_class == "temperature") {
          service = hap_serv_temperature_sensor_create(sensorPtr->state);
        }
        else if (device_class == "humidity") {
          service = hap_serv_humidity_sensor_create(sensorPtr->state);
        }
        else if (device_class == "illuminance") {
          service = hap_serv_light_sensor_create(sensorPtr->state);
        }
        else if (device_class == "aqi") {
          // AQI 比较特殊，标准 HomeKit AQI 是枚举(1-5)，但这里暂时按原样传
          service = hap_serv_air_quality_sensor_create(sensorPtr->state);
        }
        else if (device_class == "carbon_dioxide") {
          service = hap_serv_carbon_dioxide_sensor_create(false);
        }
        else if (device_class == "carbon_monoxide") {
          service = hap_serv_carbon_monoxide_sensor_create(false);
        }
        else if (device_class == "pm10") {
          service = hap_serv_create(HAP_SERV_UUID_AIR_QUALITY_SENSOR);
          hap_serv_add_char(service, hap_char_pm_10_density_create(sensorPtr->state));
        }
        else if (device_class == "pm25") {
          service = hap_serv_create(HAP_SERV_UUID_AIR_QUALITY_SENSOR);
          hap_serv_add_char(service, hap_char_pm_2_5_density_create(sensorPtr->state));
        }
        else {
            // 如果遇到未知的，默认按温度处理，防止空指针崩溃
            ESP_LOGW(TAG, "Unknown sensor class '%s', fallback to Temperature", device_class.c_str());
            service = hap_serv_temperature_sensor_create(sensorPtr->state);
        }

        if (service) {
          hap_acc_cfg_t acc_cfg = {
              .model = strdup(accessory_info[MODEL]),
              .manufacturer = strdup(accessory_info[MANUFACTURER]),
              .fw_rev = strdup(accessory_info[FW_REV]),
              .hw_rev = NULL,
              .pv = strdup("1.1.0"),
              .cid = HAP_CID_BRIDGE,
              .identify_routine = acc_identify,
          };

          std::string accessory_name = sensorPtr->get_name();
          acc_cfg.name = accessory_info[NAME] ? strdup(accessory_info[NAME]) : strdup(accessory_name.c_str());
          acc_cfg.serial_num = accessory_info[SN] ? strdup(accessory_info[SN]) : strdup(std::to_string(sensorPtr->get_object_id_hash()).c_str());

          hap_acc_t* accessory = hap_acc_create(&acc_cfg);
          
          ESP_LOGD(TAG, "ID HASH: %lu", sensorPtr->get_object_id_hash());
          hap_serv_set_priv(service, sensorPtr);
          
          // 设置读取回调
          hap_serv_set_read_cb(service, sensor_read);

          hap_acc_add_serv(accessory, service);
          hap_add_bridged_accessory(accessory, hap_get_unique_aid(std::to_string(sensorPtr->get_object_id_hash()).c_str()));
          
          if (!sensorPtr->is_internal())
            sensorPtr->add_on_state_callback([this](float v) { SensorEntity::on_sensor_update(sensorPtr, v); });
            
          ESP_LOGI(TAG, "Sensor '%s' linked to HomeKit", accessory_name.c_str());
        }
      }
    };
  }
}
#endif