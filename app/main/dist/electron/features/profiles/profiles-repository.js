"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");

function createProfilesRepository({ fs, path, yaml }) {
    return {
        initialize(profilesPath, readDefaultProfile) {
            fs.mkdirSync(profilesPath, { recursive: true });
            const file = path.join(profilesPath, "list.yml");
            try { fs.writeFileSync(file, "files: []\nindex: -1", { flag: "wx" }); }
            catch (error) { if (error.code !== "EEXIST") throw error; }
            if (!readDefaultProfile || this.load(profilesPath).files.length) return;
            // Startup owns the first selection; visiting Profiles must not be
            // required before Mixin or TUN can apply a configuration.
            const source = readDefaultProfile();
            let timestamp = Date.now(), time;
            for (;;) {
                time = `${timestamp++}.yml`;
                try { fs.writeFileSync(path.join(profilesPath, time), source, { encoding: "utf8", flag: "wx", mode: 0o600 }); break; }
                catch (error) { if (error.code !== "EEXIST") throw error; }
            }
            try { this.save(profilesPath, { files: [{ name: "config.yaml", url: "", time, selected: [] }], index: 0 }); }
            catch (error) { fs.unlinkSync(path.join(profilesPath, time)); throw error; }
        },
        load(profilesPath) {
            const profiles = yaml.parse(fs.readFileSync(path.join(profilesPath, "list.yml"), "utf8"), { merge: true, schema: "yaml-1.1" });
            if (!profiles || !Array.isArray(profiles.files)) throw new Error("Invalid profiles list");
            return { files: profiles.files, index: profiles.index };
        },
        save(profilesPath, profiles) {
            if (!profilesPath) throw new Error("Profiles directory is not initialized");
            writeAtomic({ fs, path, file: path.join(profilesPath, "list.yml"), content: yaml.stringify(profiles) });
        }
    };
}

module.exports = { createProfilesRepository };
