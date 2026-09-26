"use strict";

function registerSpeedIndicator({
    ipcMain,
    BrowserWindow,
    nativeImage,
    app,
    fs,
    path,
    staticRoot,
    preloadPath,
    getTray,
    platform = process.platform
}) {
    let indicatorWindow = null;
    let previousWidth = 0;

    ipcMain.on("speed-update", function(_event, dataUrl, width, backgroundColor = "#fff") {
        try {
            const tray = getTray();
            if (!tray) return;

            const image = nativeImage.createFromDataURL(dataUrl);
            if (platform === "win32") {
                if (width === 60) {
                    if (indicatorWindow) {
                        indicatorWindow.destroy();
                        indicatorWindow = null;
                        previousWidth = 0;
                    }
                    return;
                }

                const cropped = image.crop({ x: 0, y: 0, width: width + 8, height: 69 });
                const htmlPath = path.join(app.getPath("temp"), "cfw-sub.html");
                const size = cropped.getSize();
                fs.writeFileSync(htmlPath, createIndicatorHtml(cropped.toDataURL(), backgroundColor));

                if (!indicatorWindow) {
                    indicatorWindow = new BrowserWindow({
                        show: true,
                        alwaysOnTop: true,
                        closable: false,
                        focusable: false,
                        frame: false,
                        useContentSize: true,
                        maximizable: false,
                        transparent: true,
                        minimizable: false,
                        resizable: false,
                        webPreferences: {
                            nodeIntegration: false,
                            nodeIntegrationInWorker: false,
                            contextIsolation: true,
                            sandbox: true,
                            webSecurity: true,
                            preload: preloadPath
                        }
                    });
                    indicatorWindow.loadFile(htmlPath);
                }
                indicatorWindow.show();
                indicatorWindow.webContents.send(
                    "speed-update-win",
                    cropped.toDataURL(),
                    backgroundColor
                );
                if (previousWidth !== width) {
                    indicatorWindow.setBounds({
                        height: Math.ceil(size.height / 2.8),
                        width: Math.ceil(size.width / 2.8)
                    });
                }
                previousWidth = width;
            }

            if (platform === "darwin") {
                const trayImage = (dataUrl === ""
                    ? nativeImage.createFromPath(path.join(staticRoot, "imgs", "logo_64_eyes.png"))
                    : image.crop({ x: 0, y: 0, width, height: 69 })
                ).resize({ height: 23 });
                trayImage.setTemplateImage(true);
                tray.setImage(trayImage);
            }
        } catch (_error) {
            // Preserve the packaged app's best-effort indicator behavior.
        }
    });
}

function createIndicatorHtml(imageUrl, backgroundColor) {
    return `
          <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'">
          </head>
          <body style="position:relative;background-color:${backgroundColor};overflow:hidden;-webkit-app-region:drag;margin:0;width:100%;height:100%;box-sizing:border-box;">
            <img id="img" style="height:100%;width:100%;" src="${imageUrl}" />
            <div id="click-target" style="position:absolute;width:50%;height:100%;top:0;left:50%;-webkit-app-region:no-drag;"></div>
          </body>
          `;
}

module.exports = { registerSpeedIndicator };
