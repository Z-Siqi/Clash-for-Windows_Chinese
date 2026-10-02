"use strict";

const { createCoreConfigRepository } = require("../../features/settings/core-config-repository");
const { createProfilesRepository } = require("../../features/profiles/profiles-repository");

function createRendererConfiguration(vm, dependencies) {
    const config = dependencies.coreConfigRepository || createCoreConfigRepository(dependencies);
    return {
        async load() {
            try { vm.setConfData({ data: await config.load(vm.clashPath) }); }
            catch (error) {
                const position = error.linePos && error.linePos.start;
                const location = position ? `, on line: ${position.line}, at column: ${position.col}` : "";
                vm.appendError({ error: `Error: ${error.message}${location}` });
            }
        },
        initialize() { return config.initialize(vm.clashPath, vm.filesPath); },
        initializeProfiles() { return (dependencies.profilesRepository || createProfilesRepository(dependencies)).initialize(vm.profilesPath); },
        randomizePorts(lightweightMode) {
            return config.randomizePorts({
                clashPath: vm.clashPath, confData: vm.confData, settings: vm.settings,
                devMode: vm.devMode, lightweightMode, getPort: dependencies.getPort,
                onChange: data => vm.setConfData({ data })
            });
        }
    };
}

module.exports = { createRendererConfiguration };
