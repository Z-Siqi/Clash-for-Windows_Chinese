"use strict";

const { writeAtomic } = require("../../core/storage/atomic-file");

function createProfilesRepository({ fs, path, yaml }) {
    return {
        initialize(profilesPath) {
            fs.mkdirSync(profilesPath, { recursive: true });
            const file = path.join(profilesPath, "list.yml");
            if (!fs.existsSync(file)) fs.writeFileSync(file, "files: []\nindex: -1", { flag: "wx" });
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
