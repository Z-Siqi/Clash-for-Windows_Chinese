#pragma once

// Needs to go first because of winsock issues
#include <uv.h>
#include <mutex>
#include <iostream>

class ThreadSafeCallback::Impl
{
    public:
        Impl(Napi::Reference<Napi::Value> &&receiver, Napi::FunctionReference &&callback)
            : receiver_(std::move(receiver)), callback_(std::move(callback)), close_(false)
        {
            if (receiver_.IsEmpty())
                receiver_ = Napi::Persistent(static_cast<Napi::Value>(Napi::Object::New(callback_.Env())));
            uv_async_init(uv_default_loop(), &handle_, &static_async_callback);
            handle_.data = this;
        }

        void unref()
        {
            uv_unref(reinterpret_cast<uv_handle_t *>(&handle_));
        }

        void call(arg_func_t arg_function, completion_func_t completion_function)
        {
            std::lock_guard<std::mutex> lock(mutex_);
            function_pairs_.push_back({arg_function, completion_function});
            uv_async_send(&handle_);
        }

        void close()
        {
            std::lock_guard<std::mutex> lock(mutex_);
            close_ = true;
            uv_async_send(&handle_);
        }

    protected:
        using func_pair_t = std::pair<arg_func_t, completion_func_t>;

        static void static_async_callback(uv_async_t *handle)
        {
            try
            {
                static_cast<Impl *>(handle->data)->async_callback();
            }
            catch (std::exception& e)
            {
                Napi::Error::Fatal("", e.what());
            }
            catch (...) 
            {
                Napi::Error::Fatal("", "ERROR: Unknown exception during async callback");
            }
        }

        void async_callback()
        {
            auto env = callback_.Env();
            while (true)
            {
                std::vector<func_pair_t> func_pairs;
                {
                    std::lock_guard<std::mutex> lock(mutex_);
                    if (function_pairs_.empty())
                        break;
                    else
                        func_pairs.swap(function_pairs_);
                }

                for (const auto &function_pair : func_pairs)
                {
                    Napi::HandleScope scope(env);
                    std::vector<napi_value> args;
                    if (function_pair.first)
                        function_pair.first(env, args);
                    Napi::Value result(env, nullptr);
                    Napi::Error error(env, nullptr);
                    try
                    {
                        result = callback_.MakeCallback(receiver_.Value(), args);
                    }
                    catch (Napi::Error& err)
                    {
                        error = std::move(err);
                    }
                    if (function_pair.second)
                        function_pair.second(result, error);
                    else if (!error.IsEmpty())
                        throw std::runtime_error(error.Message());
                }
            }

            if (close_)
                uv_close(reinterpret_cast<uv_handle_t *>(&handle_), [](uv_handle_t *handle) {
                    delete static_cast<Impl *>(handle->data);
                });
        }

        Napi::Reference<Napi::Value> receiver_;
        Napi::FunctionReference      callback_;

        uv_async_t                   handle_;

        std::mutex                   mutex_;
        std::vector<func_pair_t>     function_pairs_;
        bool                         close_;
};

// public API

inline ThreadSafeCallback::ThreadSafeCallback(const Napi::Function &callback)
    : ThreadSafeCallback(Napi::Value(), callback)
{}

inline ThreadSafeCallback::ThreadSafeCallback(const Napi::Value& receiver, const Napi::Function& callback)
    : impl(nullptr)
{
    if (!receiver.IsEmpty() && !(receiver.IsObject() || receiver.IsFunction()))
        throw Napi::Error::New(callback.Env(), "Callback receiver must be an object or function");
    if (!callback.IsFunction())
        throw Napi::Error::New(callback.Env(), "Callback must be a function");
    impl = new Impl(Napi::Persistent(receiver), Napi::Persistent(callback));
}

inline void ThreadSafeCallback::unref()
{
    impl->unref();
}

inline ThreadSafeCallback::ThreadSafeCallback(ThreadSafeCallback&& other)
: impl(other.impl)
{
    other.impl = nullptr;
}

inline ThreadSafeCallback::~ThreadSafeCallback()
{
    // Destruction of the impl is defered because:
    // 1) uv_async_close may only be called on nodejs main thread
    // 2) uv_async_t memory may only be freed in close callback
    if (impl)
        impl->close();
}

inline std::future<void> ThreadSafeCallback::operator()()
{
    return operator()(arg_func_t(nullptr));
}

inline std::future<void> ThreadSafeCallback::operator()(arg_func_t arg_function)
{
    auto promise = std::make_shared<std::promise<void>>();
    operator()(arg_function, [promise](const Napi::Value &value, const Napi::Error &error)
    {
        try
        {
            if (error.IsEmpty())
                promise->set_value();
            else
                throw std::runtime_error(error.Message());
        }
        catch (...)
        {
            try
            {
                promise->set_exception(std::current_exception());
            }
            catch (...)
            {
                Napi::Error::Fatal("", "Unable to set exception on promise");
            }
        }
    });
    return promise->get_future();
}

inline std::future<void> ThreadSafeCallback::error(const std::string& message)
{
    return operator()([message](napi_env env, std::vector<napi_value>& args) {
        args.push_back(Napi::Error::New(env, message).Value());    
    });
}

inline void ThreadSafeCallback::operator()(completion_func_t completion_function)
{
    operator()(nullptr, completion_function);
}

inline void ThreadSafeCallback::operator()(arg_func_t arg_function, completion_func_t completion_function)
{
    if (impl)
        impl->call(arg_function, completion_function);
    else
        throw std::runtime_error("Callback called after move");
}

inline void ThreadSafeCallback::error(const std::string& message, completion_func_t completion_function)
{
    operator()([message](napi_env env, std::vector<napi_value>& args) {
        args.push_back(Napi::Error::New(env, message).Value());    
    }, completion_function);
}

inline std::future<std::string> ThreadSafeCallback::callStringify()
{
    return callStringify(nullptr);
}

inline std::future<std::string> ThreadSafeCallback::callStringify(arg_func_t arg_function)
{
    return call<std::string>(arg_function, [](const Napi::Value& value)
    {
        auto JSON = value.Env().Global().Get("JSON").As<Napi::Object>();
        auto stringify = JSON.Get("stringify").As<Napi::Function>();
        return stringify.Call(JSON, {value}).As<Napi::String>().Utf8Value();
    });
}

inline std::future<std::string> ThreadSafeCallback::errorStringify(const std::string& message)
{
    return callStringify([message](napi_env env, std::vector<napi_value>& args)
    {
        args.push_back(Napi::Error::New(env, message).Value());
    });
}

template <typename T>
inline std::future<T> ThreadSafeCallback::call(std::function<T(const Napi::Value &)> completion_function)
{
    return call<T>(nullptr, completion_function);
}

template <typename T>
inline std::future<T> ThreadSafeCallback::call(arg_func_t arg_function, std::function<T(const Napi::Value &)> completion_function)
{
    auto promise = std::make_shared<std::promise<T>>();
    operator()(arg_function, [promise, completion_function](const Napi::Value &value, const Napi::Error& error)
    {
        try
        {
            if (error.IsEmpty())
                promise->set_value(completion_function(value));
            else
                throw std::runtime_error(error.Message());
        }
        catch (...)
        {
            try
            {
                promise->set_exception(std::current_exception());
            }
            catch (...)
            {
                Napi::Error::Fatal("", "Unable to set exception on promise");
            }
        }
    });
    return promise->get_future();
}

inline void ThreadSafeCallback::call()
{
    operator()(nullptr, nullptr);
}

inline void ThreadSafeCallback::call(arg_func_t arg_function)
{
    operator()(arg_function, nullptr);
}

inline void ThreadSafeCallback::callError(const std::string& message)
{
    error(message, nullptr);
}