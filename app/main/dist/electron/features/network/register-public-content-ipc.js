"use strict";

function registerPublicContentIpc({ ipcMain, getMainWindow, axios }) {
    let pending = 0;
    ipcMain.handle("public-content", async (event, operation, section) => {
        const owner = getMainWindow()?.webContents;
        if (!owner || event.sender !== owner || event.senderFrame !== owner.mainFrame) throw new Error("Invalid public content sender");
        let url;
        if (operation === "update") url = "https://raw.githubusercontent.com/Z-Siqi/Clash-for-Windows_Chinese/main/update";
        else if (operation === "ads") url = "https://raw.githubusercontent.com/Fndroid/ads/master/ads_v2.json";
        else if (operation === "snippets" && typeof section === "string" && /^[a-z-]{1,64}$/.test(section)) url = `https://raw.githubusercontent.com/Fndroid/clash-vscode/master/snippets/${section}.code-snippets`;
        else throw new Error("Unsupported public content");
        if (pending >= 16) throw new Error("Public content requests are busy");
        pending++;
        try {
            const response = await axios.get(url, { timeout: 20000, maxRedirects: 0, maxContentLength: 2097152, responseType: "json", validateStatus: () => true });
            return { status: response.status, data: response.data };
        } catch { throw new Error("Public content request failed"); }
        finally { pending--; }
    });
}

module.exports = { registerPublicContentIpc };
