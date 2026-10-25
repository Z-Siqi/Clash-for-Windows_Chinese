"use strict";

function createCoreStatusPoller(vm, { CONNECTED, DISCONNECTED }) {
    const identity = () => [vm.coreRunRevision, vm.controllerPort, vm.profileApplyRevision];
    const same = (left, right) => left.every((value, index) => value === right[index]);
    let observed = identity(), failures = 0, probing = false;
    return async function pollCoreStatus() {
        const current = identity();
        if (!same(current, observed)) { observed = current; failures = 0; }
        // Startup and accepted reloads own readiness until their bounded operation
        // settles. A controller probe during that interval is not a failure signal.
        if (vm.coreStatusPending) { failures = 0; return; }
        if (probing || (vm.clashStatus === CONNECTED && !vm.isWindowShow) || vm.clashAxiosFlyingRequestCount >= 5) return;
        probing = true;
        try {
            const status = await vm.getClashStatus();
            if (!same(current, identity()) || vm.coreStatusPending) { failures = 0; return; }
            if (status === CONNECTED) {
                failures = 0;
                vm.setClashStatus({ status });
            } else if (status === DISCONNECTED && ++failures >= 5) {
                failures = 0;
                vm.setClashStatus({ status });
            }
        } finally { probing = false; }
    };
}

module.exports = { createCoreStatusPoller };
