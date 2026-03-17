#pragma once
#include <esphome/core/defines.h>
#ifdef USE_FAN
#include <esphome/core/application.h>
#include <hap.h>
#include <hap_apple_servs.h>
#include <hap_apple_chars.h>
#include "hap_entity.h"
#include <cmath>

namespace esphome
{
  namespace homekit
  {
    class FanEntity : public HAPEntity
    {
    private:
      static constexpr const char* TAG = "FanEntity";
      fan::Fan* fanPtr;

      // 辅助函数：将 HomeKit 的 0-100 映射到 ESPHome 的档位
      static int map_hk_to_speed_level(float hk_val, int speed_count) {
        if (hk_val <= 0) return 0;
        int level = (int)std::round((hk_val * speed_count) / 100.0f);
        if (level == 0 && hk_val > 0) level = 1; 
        if (level > speed_count) level = speed_count;
        return level;
      }

      // 辅助函数：将 ESPHome 的档位映射回 HomeKit 的 0-100
      static float map_speed_level_to_hk(int level, int speed_count) {
        if (level <= 0) return 0.0f;
        return (float)((level * 100.0f) / speed_count);
      }

      static int fanwrite(hap_write_data_t write_data[], int count, void* serv_priv, void* write_priv) {
        fan::Fan* fanPtr = (fan::Fan*)serv_priv;
        ESP_LOGD(TAG, "Write called for Accessory %s", fanPtr->get_name().c_str());
        
        int i, ret = HAP_SUCCESS;
        hap_write_data_t* write;
        
        for (i = 0; i < count; i++) {
          write = &write_data[i];
          
          if (!strcmp(hap_char_get_type_uuid(write->hc), HAP_CHAR_UUID_ON)) {
            ESP_LOGD(TAG, "Write Fan On/Off: %s", write->val.b ? "On" : "Off");
            if (write->val.b) {
                fanPtr->turn_on().perform();
            } else {
                fanPtr->turn_off().perform();
            }
            hap_char_update_val(write->hc, &(write->val));
            *(write->status) = HAP_STATUS_SUCCESS;
          }
          else if (!strcmp(hap_char_get_type_uuid(write->hc), HAP_CHAR_UUID_ROTATION_SPEED)) {
            float hk_val = write->val.f;
            // 修正1：只修改这里，获取档位总数的方法
            int speed_count = fanPtr->get_traits().supported_speed_count();
            
            ESP_LOGD(TAG, "Write Fan Speed: %.2f (Levels: %d)", hk_val, speed_count);
            
            if (speed_count > 0) {
                // 修正2：改回 set_speed，因为你的库里 set_percentage 不存在
                int target_level = map_hk_to_speed_level(hk_val, speed_count);
                fanPtr->turn_on().set_speed(target_level).perform();
            } else {
                // 如果是无级调速，且没有 set_percentage，通常 set_speed 接受 0-100
                fanPtr->turn_on().set_speed((int)hk_val).perform();
            }
            
            hap_char_update_val(write->hc, &(write->val));
            *(write->status) = HAP_STATUS_SUCCESS;
          }
          else {
            *(write->status) = HAP_STATUS_RES_ABSENT;
          }
        }
        return ret;
      }

      static void on_fanupdate(fan::Fan* obj) {
        ESP_LOGD(TAG, "%s update state", obj->get_name().c_str());
        hap_acc_t* acc = hap_acc_get_by_aid(hap_get_unique_aid(std::to_string(obj->get_object_id_hash()).c_str()));
        
        if (acc) {
          hap_serv_t* hs = hap_acc_get_serv_by_uuid(acc, HAP_SERV_UUID_FAN);
          
          hap_char_t* on_char = hap_serv_get_char_by_uuid(hs, HAP_CHAR_UUID_ON);
          hap_val_t state;
          state.b = !!obj->state; 
          hap_char_update_val(on_char, &state);

          if (obj->get_traits().supports_speed()) {
             hap_char_t* speed_char = hap_serv_get_char_by_uuid(hs, HAP_CHAR_UUID_ROTATION_SPEED);
             if (speed_char) {
                 hap_val_t speed_val;
                 // 修正3：改回 obj->speed
                 int current_level = obj->speed; 
                 // 修正4：使用 supported_speed_count()
                 int speed_count = obj->get_traits().supported_speed_count();
                 
                 if (speed_count > 0) {
                    speed_val.f = map_speed_level_to_hk(current_level, speed_count);
                 } else {
                    speed_val.f = (float)current_level;
                 }
                 
                 hap_char_update_val(speed_char, &speed_val);
             }
          }
        }
      }

      static int acc_identify(hap_acc_t* ha) {
        ESP_LOGI(TAG, "Accessory identified");
        return HAP_SUCCESS;
      }

    public:
      FanEntity(fan::Fan* fanPtr) : HAPEntity({{MODEL, "HAP-FAN"}}), fanPtr(fanPtr) {}
      
      void setup() {
        hap_acc_cfg_t acc_cfg = {
            .model = strdup(accessory_info[MODEL]),
            .manufacturer = strdup(accessory_info[MANUFACTURER]),
            .fw_rev = strdup(accessory_info[FW_REV]),
            .hw_rev = NULL,
            .pv = strdup("1.1.0"),
            .cid = HAP_CID_BRIDGE,
            .identify_routine = acc_identify,
        };
        
        std::string accessory_name = fanPtr->get_name();
        acc_cfg.name = accessory_info[NAME] ? strdup(accessory_info[NAME]) : strdup(accessory_name.c_str());
        acc_cfg.serial_num = accessory_info[SN] ? strdup(accessory_info[SN]) : strdup(std::to_string(fanPtr->get_object_id_hash()).c_str());

        hap_acc_t* accessory = hap_acc_create(&acc_cfg);
        hap_serv_t* service = hap_serv_fan_create(fanPtr->state);

        if (fanPtr->get_traits().supports_speed()) {
             // 修正5：获取档位信息的正确方式
             int current_level = fanPtr->speed;
             int speed_count = fanPtr->get_traits().supported_speed_count();
             float initial_val = 0.0f;
             if (speed_count > 0) {
                 initial_val = map_speed_level_to_hk(current_level, speed_count);
             }
             hap_serv_add_char(service, hap_char_rotation_speed_create(initial_val));
             ESP_LOGI(TAG, "Added Rotation Speed characteristic for '%s'", accessory_name.c_str());
        }

        ESP_LOGD(TAG, "ID HASH: %lu", fanPtr->get_object_id_hash());
        hap_serv_set_priv(service, fanPtr);
        hap_serv_set_write_cb(service, fanwrite);
        hap_acc_add_serv(accessory, service);
        hap_add_bridged_accessory(accessory, hap_get_unique_aid(std::to_string(fanPtr->get_object_id_hash()).c_str()));
        
        if (!fanPtr->is_internal())
          fanPtr->add_on_state_callback([this]() { FanEntity::on_fanupdate(fanPtr); });
          
        ESP_LOGI(TAG, "Fan '%s' linked to HomeKit", accessory_name.c_str());
      }
    };
  }
}
#endif