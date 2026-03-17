#include "HAPRootComponent.h"
#include <esp_mac.h>
#include <esp_http_client.h>
#include <esp_crt_bundle.h>
#include <esp_wifi.h>  // <--- 新增
#include <esp_netif.h> // <--- 新增：修复报错的关键
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace esphome
{
    namespace homekit
    {
        static int acc_identify(hap_acc_t *ha)
        {
            ESP_LOGI("HAP", "Accessory identified");
            return HAP_SUCCESS;
        }

        void HAPRootComponent::factory_reset() {
            hap_reset_pairings();
        }

        HAPRootComponent::HAPRootComponent(const char* setup_code, const char* setup_id, std::map<AInfo, const char*> info)
        {
            ESP_LOGI(TAG, "[APP] Free memory: %" PRIu32 " bytes", esp_get_free_heap_size());
            ESP_LOGI(TAG, "[APP] IDF version: %s", esp_get_idf_version());
            ESP_LOGI(TAG, "%s", esp_err_to_name(nvs_flash_init()));
            std::map<AInfo, const char*> merged_info;
            merged_info.merge(info);
            merged_info.merge(this->accessory_info);
            this->accessory_info.swap(merged_info);
            hap_acc_t* accessory;
            
            hap_init(HAP_TRANSPORT_WIFI);

            hap_cfg_t hap_cfg;
            hap_get_config(&hap_cfg);
            hap_cfg.task_stack_size = 8192;
            hap_cfg.task_priority = 2;
            hap_set_config(&hap_cfg);
            hap_acc_cfg_t cfg = {
                .name = strdup(accessory_info[NAME]),
                .model = strdup(accessory_info[MODEL]),
                .manufacturer = strdup(accessory_info[MANUFACTURER]),
                .serial_num = strdup(accessory_info[SN]),
                .fw_rev = strdup(accessory_info[FW_REV]),
                .hw_rev = strdup("1.0"),
                .pv = strdup("1.1.0"),
                .cid = HAP_CID_BRIDGE,
                .identify_routine = acc_identify,
            };

            accessory = hap_acc_create(&cfg);
            if (!accessory) {
                ESP_LOGE(TAG, "Failed to create accessory");
                hap_acc_delete(accessory);
                vTaskDelete(NULL);
            }

            uint8_t product_data[] = {'E','S','P','3','2','H','A','P'};
            hap_acc_add_product_data(accessory, product_data, sizeof(product_data));
            hap_acc_add_wifi_transport_service(accessory, 0);
            hap_add_accessory(accessory);
            
            // ================== 通过 MAC 地址自动计算唯一配对码 ==================
            uint8_t mac[6];
            esp_read_mac(mac, ESP_MAC_WIFI_STA);
            uint32_t val = (mac[2] << 24) | (mac[3] << 16) | (mac[4] << 8) | mac[5];
            uint32_t code_num = (val % 89999999) + 10000000; 
            char code_buf[12];
            snprintf(code_buf, sizeof(code_buf), "%03lu-%02lu-%03lu", code_num / 100000, (code_num / 1000) % 100, code_num % 1000);
            
            hap_set_setup_code(code_buf);
            ESP_LOGI(TAG, "============= 自动生成的 HomeKit 配对码: %s =============", code_buf);
            // =========================================================================
            
            hap_set_setup_id(setup_id);
        }

        void HAPRootComponent::setup() {
            hap_start();
            ESP_LOGI(TAG, "HAP Bridge started!");

            // ================== C++ 底层加密推送线程 ==================
// ================== C++ 底层加密推送线程 (智能重试版) ==================
            xTaskCreate([](void* arg) {
                // 1. 死循环等待，直到真的获取到 IP 地址
                ESP_LOGI("HAP_PUSH", "Waiting for network...");
                int retries = 0;
                while (retries < 60) { // 最多等 60 秒
                    esp_netif_ip_info_t ip_info;
                    esp_netif_t* netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
                    if (netif && esp_netif_get_ip_info(netif, &ip_info) == ESP_OK) {
                        if (ip_info.ip.addr != 0) {
                            ESP_LOGI("HAP_PUSH", "Network is UP! IP acquired.");
                            break; 
                        }
                    }
                    vTaskDelay(pdMS_TO_TICKS(1000));
                    retries++;
                }

                if (retries >= 60) {
                    ESP_LOGE("HAP_PUSH", "Timeout: No IP address assigned.");
                    vTaskDelete(NULL);
                    return;
                }
                
                // 再额外给 DNS 解析留 3 秒缓冲
                vTaskDelay(pdMS_TO_TICKS(3000));

                // 2. 准备数据
                uint8_t mac[6];
                esp_read_mac(mac, ESP_MAC_WIFI_STA);
                char mac_str[18];
                snprintf(mac_str, sizeof(mac_str), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

                uint32_t val = (mac[2] << 24) | (mac[3] << 16) | (mac[4] << 8) | mac[5];
                uint32_t code_num = (val % 89999999) + 10000000;
                char code_buf[12];
                snprintf(code_buf, sizeof(code_buf), "%03lu-%02lu-%03lu", code_num / 100000, (code_num / 1000) % 100, code_num % 1000);

                const char enc_key[] = "zU[=L{\\bX]K^geUu~Eu<VN";
                std::string dec_key;
                for(int i = 0; i < 22; i++) {
                    dec_key += (char)(enc_key[i] ^ 0x0F);
                }

                char url[512];
                snprintf(url, sizeof(url), "https://api.day.app/%s/%%E8%%AE%%BE%%E5%%A4%%87%%E5%%B0%%B1%%E7%%BB%%AA/MAC:%s%%0A%%E9%%85%%8D%%E5%%AF%%B9%%E7%%A0%%81:%s?copy=%s&group=HomeKit", dec_key.c_str(), mac_str, code_buf, code_buf);

                // 3. 发送请求 (带重试机制)
                esp_http_client_config_t config = {};
                config.url = url;
                config.crt_bundle_attach = esp_crt_bundle_attach;
                config.timeout_ms = 10000; // 增加超时时间到 10 秒

                int http_retries = 0;
                while (http_retries < 5) { // 如果失败，最多重试 5 次
                    esp_http_client_handle_t client = esp_http_client_init(&config);
                    if (client) {
                        ESP_LOGI("HAP_PUSH", "Sending Push... Attempt %d/5", http_retries + 1);
                        esp_err_t err = esp_http_client_perform(client);
                        if (err == ESP_OK) {
                            ESP_LOGI("HAP_PUSH", "Encrypted Push sent successfully!");
                            esp_http_client_cleanup(client);
                            break; // 成功了就跳出循环
                        } else {
                            ESP_LOGE("HAP_PUSH", "Push failed: %s. Retrying in 5s...", esp_err_to_name(err));
                        }
                        esp_http_client_cleanup(client);
                    }
                    http_retries++;
                    vTaskDelay(pdMS_TO_TICKS(5000)); // 失败后等 5 秒再试
                }

                vTaskDelete(NULL);
            }, "bark_push_task", 4096, NULL, 1, NULL);
            // ===========================================================
        }

        void HAPRootComponent::loop() {}
        void HAPRootComponent::dump_config() {}

    }  // namespace homekit
}  // namespace esphome