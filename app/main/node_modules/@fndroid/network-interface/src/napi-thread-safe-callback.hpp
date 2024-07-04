  
#pragma once

#include <napi.h>
#include <functional>
#include <future>
#include <string>
#include <vector>

#ifndef NAPI_CPP_EXCEPTIONS
#error ThreadSafeCallback needs napi exception support
#endif

#if defined(_MSC_VER) && !_HAS_EXCEPTIONS
#error Please define _HAS_EXCEPTIONS=1, otherwise exception handling will not work properly
#endif

class ThreadSafeCallback
{
    public:
        // The argument function is responsible for providing napi_values which will
        // be used for invoking the callback. Since this touches JS state it must run
        // in the NodeJS main loop.
        using arg_func_t = std::function<void(napi_env, std::vector<napi_value>&)>;

        // The completion function is reponsible for handling the return value and/or
        // raised exception from calling the callback. Since this touches JS state it
        // must run in the NodeJS main loop. Either the Value or Error will be empty.
        using completion_func_t = std::function<void(const Napi::Value&, const Napi::Error&)>;

        // Both functions will be called within the same HandleScope

        // Must be called from Node event loop because it calls napi_create_reference and uv_async_init
        ThreadSafeCallback(const Napi::Function& callback);
        ThreadSafeCallback(const Napi::Value& receiver, const Napi::Function& callback);

        // Must be called from Node event loop because it calls uv_unref
        void unref();

        // All other member functions can be called from any thread, including move constructor and destructor
        ThreadSafeCallback(ThreadSafeCallback&& other);
        ~ThreadSafeCallback();

        // Invoke JS callback from any thread. These functions are additionally thread-safe, i.e.
        // they can be invoked concurrently

        // - return future<void>, JS error is transformed to std::runtime_error
        std::future<void> operator()();
        std::future<void> operator()(arg_func_t arg_function);
        std::future<void> error(const std::string& message);

        // - handle result/error in NodeJS main thread
        void operator()(completion_func_t completion_function);
        void operator()(arg_func_t arg_function, completion_func_t completion_function);
        void error(const std::string& message, completion_func_t completion_function);

        // - return JSON result in future<string>
        std::future<std::string> callStringify();
        std::future<std::string> callStringify(arg_func_t arg_function);
        std::future<std::string> errorStringify(const std::string& message);

        // - return JS value in future<T>
        template<typename T>
        std::future<T> call(std::function<T(const Napi::Value &)> completion_function);
        template<typename T>
        std::future<T> call(arg_func_t arg_function, std::function<T(const Napi::Value &)> completion_function);

        // - ignore result, terminate on error
        void call();
        void call(arg_func_t arg_function);
        void callError(const std::string& message);
        
    protected:
        // Cannot be copied or assigned
        ThreadSafeCallback(const ThreadSafeCallback&) = delete;
        ThreadSafeCallback& operator=(const ThreadSafeCallback&) = delete;
        ThreadSafeCallback& operator=(ThreadSafeCallback&&) = delete;

        class Impl;
        Impl* impl;
};

#include "napi-thread-safe-callback-impl.hpp"