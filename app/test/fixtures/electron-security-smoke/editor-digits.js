"use strict";

async function verifyEditorDigits(window) {
    const evaluate = code => window.webContents.executeJavaScriptInIsolatedWorld(999, [{ code }]);
    await evaluate(`(async () => {
        const root = document.querySelector('#app').__vue__;
        root.$code({ code: '# digits: ', language: 'yaml' }).catch(() => {});
        await root.$nextTick();
        await root.$nextTick();
        let editor = document.querySelector('.main-code-view').__vue__;
        while (editor && editor.$options.name !== 'CodeView') editor = editor.$parent;
        if (!editor?.editor) throw Error('Code editor did not open');
        const descendants = vm => [vm, ...vm.$children.flatMap(descendants)];
        const home = descendants(root).find(vm => typeof vm.menuKeyboardClickTimes === 'number');
        globalThis.__digitSmoke = { editor, route: root.$route.path, root, home,
            navigationCount: home.menuKeyboardClickTimes };
        editor.editor.setPosition({ lineNumber: 1, column: 11 });
        editor.editor.focus();
    })()`);
    for (const keyCode of "0123456789") {
        window.webContents.sendInputEvent({ type: "keyDown", keyCode });
        window.webContents.sendInputEvent({ type: "char", keyCode });
        window.webContents.sendInputEvent({ type: "keyUp", keyCode });
    }
    return evaluate(`(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const { editor, root, route, home, navigationCount } = globalThis.__digitSmoke;
        const checks = { digits: editor.editor.getValue() === '# digits: 0123456789',
            route: root.$route.path === route,
            navigationCount: home.menuKeyboardClickTimes === navigationCount };
        editor.save();
        delete globalThis.__digitSmoke;
        const failed = Object.keys(checks).filter(key => !checks[key]);
        if (failed.length) throw Error('Monaco keyboard failed: ' + failed.join(', '));
        return true;
    })()`);
}

module.exports = { verifyEditorDigits };
