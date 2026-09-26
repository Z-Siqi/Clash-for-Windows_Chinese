"use strict";

function createIntervalScheduler({
    isActive,
    createId,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
}) {
    let tasks = [];

    function find(id) {
        return tasks.find(task => task.id === id);
    }

    function add(callback, interval) {
        const id = createId();
        tasks.push({
            id,
            intervalId: isActive() ? setIntervalFn(callback, interval) : -1,
            callback,
            interval
        });
        return id;
    }

    function pause(id) {
        const task = find(id);
        if (task && task.intervalId !== -1) {
            clearIntervalFn(task.intervalId);
            task.intervalId = -1;
        }
    }

    function resume(id) {
        const task = find(id);
        if (task && task.intervalId === -1) {
            task.intervalId = setIntervalFn(task.callback, task.interval);
        }
    }

    function stop(id) {
        const task = find(id);
        if (!task) return;
        if (task.intervalId !== -1) clearIntervalFn(task.intervalId);
        // A paused task must also be removed or it will resume after its page is gone.
        tasks = tasks.filter(entry => entry.id !== id);
    }

    return {
        add,
        stop,
        stopAll() { for (const task of [...tasks]) stop(task.id); },
        pause,
        pauseAll() { for (const task of tasks) pause(task.id); },
        resume,
        resumeAll() { for (const task of tasks) resume(task.id); },
        getAll() { return tasks; }
    };
}

module.exports = { createIntervalScheduler };
