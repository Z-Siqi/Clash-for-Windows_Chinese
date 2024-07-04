#include "napi-thread-safe-callback.hpp"
#import <CoreWLAN/CoreWLAN.h>
#include <napi.h>

static std::shared_ptr<ThreadSafeCallback> notifyCallbackForJsFn = nullptr;

@interface EventDelegate : NSObject <CWEventDelegate>
@end

@implementation EventDelegate
- (void)ssidDidChangeForWiFiInterfaceWithName:(NSString *)interfaceName {
  notifyCallbackForJsFn->call([](Napi::Env env, std::vector<napi_value> &args) {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("type", "wlan");
    obj.Set("code", "ssidDidChangeForWiFiInterfaceWithName");
    args = {env.Null(), obj};
  });
}
@end

void RunCallback(const Napi::CallbackInfo &info) {
  notifyCallbackForJsFn =
      std::make_shared<ThreadSafeCallback>(info[1].As<Napi::Function>());
  CWWiFiClient *client = [CWWiFiClient sharedWiFiClient];
  EventDelegate *delegate = [[EventDelegate alloc] init];
  client.delegate = delegate;
  NSError *error;
  [client startMonitoringEventWithType:CWEventTypeSSIDDidChange error:&error];
  if (error) {
    notifyCallbackForJsFn->call(
        [](Napi::Env env, std::vector<napi_value> &args) {
          auto err = Napi::Object::New(env);
          err.Set("message",
                  Napi::String::New(env, "wlan rigister notification error"));
          args = {err};
        });
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "addEventListener"),
              Napi::Function::New(env, RunCallback));
  return exports;
}

NODE_API_MODULE(main, Init);
