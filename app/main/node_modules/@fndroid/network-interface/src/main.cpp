// Copyright (c) 2020 xudafeng

#include <napi.h>
#include <winsock2.h>
#include <windows.h>
#include <wlanapi.h>
#include "napi-thread-safe-callback.hpp"

#pragma comment(lib, "wlanapi.lib")

static std::shared_ptr<ThreadSafeCallback> notifyCallbackForJsFn = nullptr;

void OnNotificationCallback(PWLAN_NOTIFICATION_DATA data, PVOID context) {
  if (data != NULL
      && data -> NotificationSource == WLAN_NOTIFICATION_SOURCE_ACM) {
    switch (data -> NotificationCode) {
      case wlan_notification_acm_connection_complete: {
        notifyCallbackForJsFn -> call(
          [](Napi::Env env,
          std::vector<napi_value>& args) {
          // will run in main thread
          Napi::Object obj = Napi::Object::New(env);
          obj.Set("type", "wlan");
          obj.Set("code", "wlan_notification_acm_connection_complete");
          args = { env.Null(), obj };
        });
      } break;
      case wlan_notification_acm_disconnected: {
        notifyCallbackForJsFn -> call(
          [](Napi::Env env,
          std::vector<napi_value>& args) {
          Napi::Object obj = Napi::Object::New(env);
          obj.Set("type", "wlan");
          obj.Set("code", "wlan_notification_acm_disconnected");
          args = { env.Null(), obj };
        });
      } break;
      case wlan_notification_acm_scan_complete: {
        notifyCallbackForJsFn -> call([](
          Napi::Env env,
          std::vector<napi_value>& args) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("type", "wlan");
        obj.Set("code", "wlan_notification_acm_scan_complete");
          args = { env.Null(), obj };
        });
      } break;
    }
  }
}

void RunCallback(const Napi::CallbackInfo& info) {
  // TODO(xudafeng) info[0] is the event name
  notifyCallbackForJsFn = std::make_shared<ThreadSafeCallback>(
    info[1].As<Napi::Function>());

  HANDLE hClient = NULL;
  DWORD dwMaxClient = 2;
  DWORD dwCurVersion = 0;
  DWORD dwResult = 0;
  dwResult = WlanOpenHandle(dwMaxClient, NULL, &dwCurVersion, &hClient);

  if (dwResult != ERROR_SUCCESS) {
      notifyCallbackForJsFn -> call(
        [](Napi::Env env,
        std::vector<napi_value>& args) {
        auto err = Napi::Object::New(env);
        err.Set("message",  Napi::String::New(env, "wlan open handle error"));
        args = { err };
      });
      return;
  }
  dwResult = WlanRegisterNotification(
    hClient,
    WLAN_NOTIFICATION_SOURCE_ACM,
    TRUE,
    WLAN_NOTIFICATION_CALLBACK(OnNotificationCallback),
    NULL,
    NULL,
    NULL);

  if (dwResult != ERROR_SUCCESS) {
      notifyCallbackForJsFn -> call(
        [](Napi::Env env,
        std::vector<napi_value>& args) {
        auto err = Napi::Object::New(env);
        err.Set(
          "message",
          Napi::String::New(env, "wlan rigister notification error"));
        args = { err };
      });
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(
    Napi::String::New(env, "addEventListener"),
    Napi::Function::New(env, RunCallback));
  return exports;
}

NODE_API_MODULE(main, Init);
