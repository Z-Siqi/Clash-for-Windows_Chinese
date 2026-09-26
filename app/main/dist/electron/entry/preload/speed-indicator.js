"use strict";

const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
    ipcRenderer.on("speed-update-win", (_event, imageUrl, backgroundColor) => {
        document.getElementById("img").src = imageUrl;
        document.body.style.backgroundColor = backgroundColor;
    });
    document.getElementById("click-target").addEventListener("click", () => {
        ipcRenderer.send("enhanced-tray-click");
    });
}, { once: true });
