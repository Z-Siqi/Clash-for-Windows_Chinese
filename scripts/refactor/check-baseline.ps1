# Read-only baseline verification for the packaged Electron app.

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$appMainDir = Join-Path $repoRoot 'app\main'
$distDir = Join-Path $appMainDir 'dist\electron'
$packageJsonPath = Join-Path $appMainDir 'package.json'
$indexHtmlPath = Join-Path $distDir 'index.html'
$mainJsPath = Join-Path $distDir 'main.js'
$rendererJsPath = Join-Path $distDir 'renderer.js'
$rendererPatchPath = Join-Path $distDir 'patch-layer\renderer-patch.js'
$runtimeSmokeProbePath = Join-Path $distDir 'patch-layer\runtime-smoke-probe.js'
$rendererReadinessProbePath = Join-Path $distDir 'patch-layer\renderer-readiness-probe.js'
$routeCatalogPath = Join-Path $distDir 'patch-layer\routes\route-catalog.js'
$packagesDir = Join-Path $distDir 'patch-layer\packages'
$routerPackageDir = Join-Path $packagesDir 'router'
$menuPackageDir = Join-Path $packagesDir 'menu'
$settingsPackageDir = Join-Path $packagesDir 'settings'
$ipcPackageDir = Join-Path $packagesDir 'ipc'
$runtimePackageDir = Join-Path $packagesDir 'runtime'
$mainPackageDir = Join-Path $packagesDir 'main'
$menuStatePath = Join-Path $menuPackageDir 'menu-state.js'
$menuOrderPath = Join-Path $menuPackageDir 'menu-order.js'
$settingsDefaultsPath = Join-Path $settingsPackageDir 'settings-defaults.js'
$ipcClientPath = Join-Path $ipcPackageDir 'ipc-client.js'
$appIpcPath = Join-Path $ipcPackageDir 'app-ipc.js'
$windowIpcPath = Join-Path $ipcPackageDir 'window-ipc.js'
$dialogIpcPath = Join-Path $ipcPackageDir 'dialog-ipc.js'
$globalShortcutIpcPath = Join-Path $ipcPackageDir 'global-shortcut-ipc.js'
$runtimeIpcPath = Join-Path $ipcPackageDir 'runtime-ipc.js'
$routeReadinessProbePath = Join-Path $distDir 'patch-layer\route-readiness-probe.js'
$storeModuleVisibilityProbePath = Join-Path $distDir 'patch-layer\store-module-visibility-probe.js'
$ipcSurfacePresenceProbePath = Join-Path $distDir 'patch-layer\ipc-surface-presence-probe.js'
$patchLayerSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-patch-layer-smoke.js'
$rendererReadinessSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-renderer-readiness-smoke.js'
$routeCatalogSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-route-catalog-smoke.js'
$menuStateSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-menu-state-smoke.js'
$settingsDefaultsSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-settings-defaults-smoke.js'
$menuOrderIpcSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-menu-order-ipc-smoke.js'
$ipcClustersSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-ipc-clusters-smoke.js'

$expectedMainHash = 'AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F'
$legacyRendererHash = '7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B'
$session006RendererHash = 'E0A54DC7914C441880BD12B84A91F91979CA128CED9886C4EFDCCBA545BE0E5C'
$session007RendererHash = '86D5A17606353E6CA0485F4C41B2DB7EE1A0C321EA7313595BF6A79FDFC99ADE'
$session008RendererHash = '4A44A113D996A69C3CEE85BC7E5F89C1F698D04BB861CEA3259C2E7667AD8E62'
$expectedRendererHash = '9CAF1DE5C36964F1147F07A30B8A3585318CD1CD44DC4BC7C96E984F7F073523'
$expectedPackageMain = './dist/electron/main.js'
$expectedRendererPatchSrc = 'patch-layer/renderer-patch.js'
$expectedRuntimeSmokeProbeSrc = 'patch-layer/runtime-smoke-probe.js'
$expectedRendererReadinessProbeSrc = 'patch-layer/renderer-readiness-probe.js'
$expectedRouteCatalogSrc = 'patch-layer/routes/route-catalog.js'
$expectedMenuStateSrc = 'patch-layer/packages/menu/menu-state.js'
$expectedMenuOrderSrc = 'patch-layer/packages/menu/menu-order.js'
$expectedSettingsDefaultsSrc = 'patch-layer/packages/settings/settings-defaults.js'
$expectedIpcClientSrc = 'patch-layer/packages/ipc/ipc-client.js'
$expectedAppIpcSrc = 'patch-layer/packages/ipc/app-ipc.js'
$expectedWindowIpcSrc = 'patch-layer/packages/ipc/window-ipc.js'
$expectedDialogIpcSrc = 'patch-layer/packages/ipc/dialog-ipc.js'
$expectedGlobalShortcutIpcSrc = 'patch-layer/packages/ipc/global-shortcut-ipc.js'
$expectedRuntimeIpcSrc = 'patch-layer/packages/ipc/runtime-ipc.js'
$expectedRouteReadinessProbeSrc = 'patch-layer/route-readiness-probe.js'
$expectedStoreModuleVisibilityProbeSrc = 'patch-layer/store-module-visibility-probe.js'
$expectedIpcSurfacePresenceProbeSrc = 'patch-layer/ipc-surface-presence-probe.js'

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $script:failures.Add($Message) | Out-Null
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Add-Pass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Test-RequiredFile {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Add-Pass "Found file: $Path"
    } else {
        Add-Failure "Missing file: $Path"
    }
}

function Test-RequiredDirectory {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path -PathType Container) {
        Add-Pass "Found directory: $Path"
    } else {
        Add-Failure "Missing directory: $Path"
    }
}

function Test-FileContains {
    param(
        [string]$Path,
        [string]$Needle,
        [string]$Description
    )

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $content = Get-Content -LiteralPath $Path -Raw
        if ($content.Contains($Needle)) {
            Add-Pass $Description
        } else {
            Add-Failure "$Description Missing text: $Needle"
        }
    }
}

function Test-FileNotContains {
    param(
        [string]$Path,
        [string]$Needle,
        [string]$Description
    )

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $content = Get-Content -LiteralPath $Path -Raw
        if ($content.Contains($Needle)) {
            Add-Failure "$Description Unexpected text: $Needle"
        } else {
            Add-Pass $Description
        }
    }
}

Write-Host "Checking Electron refactor baseline..."
Write-Host "Root: $repoRoot"

$requiredFiles = @(
    $indexHtmlPath,
    $mainJsPath,
    $rendererJsPath,
    $rendererPatchPath,
    $runtimeSmokeProbePath,
    $rendererReadinessProbePath,
    $routeCatalogPath,
    $menuStatePath,
    $menuOrderPath,
    $settingsDefaultsPath,
    $ipcClientPath,
    $appIpcPath,
    $windowIpcPath,
    $dialogIpcPath,
    $globalShortcutIpcPath,
    $runtimeIpcPath,
    $routeReadinessProbePath,
    $storeModuleVisibilityProbePath,
    $ipcSurfacePresenceProbePath,
    $patchLayerSmokeScriptPath,
    $rendererReadinessSmokeScriptPath,
    $routeCatalogSmokeScriptPath,
    $menuStateSmokeScriptPath,
    $settingsDefaultsSmokeScriptPath,
    $menuOrderIpcSmokeScriptPath,
    $ipcClustersSmokeScriptPath,
    (Join-Path $distDir 'renderer.js.LICENSE.txt'),
    (Join-Path $distDir '287.js'),
    (Join-Path $distDir '295.js'),
    (Join-Path $distDir '585.js'),
    (Join-Path $distDir 'editor.worker.js')
)

foreach ($file in $requiredFiles) {
    Test-RequiredFile -Path $file
}

$requiredDirectories = @(
    $packagesDir,
    $routerPackageDir,
    $menuPackageDir,
    $settingsPackageDir,
    $ipcPackageDir,
    $runtimePackageDir,
    $mainPackageDir
)

foreach ($directory in $requiredDirectories) {
    Test-RequiredDirectory -Path $directory
}

if (Test-Path -LiteralPath $mainJsPath -PathType Leaf) {
    $actualMainHash = (Get-FileHash -LiteralPath $mainJsPath -Algorithm SHA256).Hash
    if ($actualMainHash -eq $expectedMainHash) {
        Add-Pass "main.js SHA256 matches baseline."
    } else {
        Add-Failure "main.js SHA256 mismatch. Expected $expectedMainHash but found $actualMainHash."
    }
}

if (Test-Path -LiteralPath $rendererJsPath -PathType Leaf) {
    $actualRendererHash = (Get-FileHash -LiteralPath $rendererJsPath -Algorithm SHA256).Hash
    if ($actualRendererHash -eq $expectedRendererHash) {
        Add-Pass "renderer.js SHA256 matches enforced extraction baseline."
    } elseif ($actualRendererHash -eq $legacyRendererHash) {
        Add-Failure "renderer.js still matches the legacy pre-extraction hash. Expected enforced extraction hash $expectedRendererHash."
    } elseif ($actualRendererHash -eq $session006RendererHash) {
        Add-Failure "renderer.js still matches the Session 006 hash and has not delegated currentRoutePath to menu state. Expected $expectedRendererHash."
    } elseif ($actualRendererHash -eq $session007RendererHash) {
        Add-Failure "renderer.js still matches the Session 007 hash and has not delegated settings, menu order, and IPC helpers. Expected $expectedRendererHash."
    } elseif ($actualRendererHash -eq $session008RendererHash) {
        Add-Failure "renderer.js still matches the Session 008 hash and has not delegated the larger IPC clusters. Expected $expectedRendererHash."
    } else {
        Add-Failure "renderer.js SHA256 mismatch. Expected $expectedRendererHash but found $actualRendererHash."
    }
}

if (Test-Path -LiteralPath $packageJsonPath -PathType Leaf) {
    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    if ($packageJson.main -eq $expectedPackageMain) {
        Add-Pass "package.json main is $expectedPackageMain."
    } else {
        Add-Failure "package.json main mismatch. Expected $expectedPackageMain but found $($packageJson.main)."
    }
} else {
    Add-Failure "Missing package.json: $packageJsonPath"
}

if (Test-Path -LiteralPath $indexHtmlPath -PathType Leaf) {
    $indexHtml = Get-Content -LiteralPath $indexHtmlPath -Raw
    $rendererPatchIndex = $indexHtml.IndexOf($expectedRendererPatchSrc)
    $runtimeSmokeProbeIndex = $indexHtml.IndexOf($expectedRuntimeSmokeProbeSrc)
    $rendererReadinessProbeIndex = $indexHtml.IndexOf($expectedRendererReadinessProbeSrc)
    $routeCatalogIndex = $indexHtml.IndexOf($expectedRouteCatalogSrc)
    $menuStateIndex = $indexHtml.IndexOf($expectedMenuStateSrc)
    $menuOrderIndex = $indexHtml.IndexOf($expectedMenuOrderSrc)
    $settingsDefaultsIndex = $indexHtml.IndexOf($expectedSettingsDefaultsSrc)
    $ipcClientIndex = $indexHtml.IndexOf($expectedIpcClientSrc)
    $appIpcIndex = $indexHtml.IndexOf($expectedAppIpcSrc)
    $windowIpcIndex = $indexHtml.IndexOf($expectedWindowIpcSrc)
    $dialogIpcIndex = $indexHtml.IndexOf($expectedDialogIpcSrc)
    $globalShortcutIpcIndex = $indexHtml.IndexOf($expectedGlobalShortcutIpcSrc)
    $runtimeIpcIndex = $indexHtml.IndexOf($expectedRuntimeIpcSrc)
    $routeReadinessProbeIndex = $indexHtml.IndexOf($expectedRouteReadinessProbeSrc)
    $storeModuleVisibilityProbeIndex = $indexHtml.IndexOf($expectedStoreModuleVisibilityProbeSrc)
    $ipcSurfacePresenceProbeIndex = $indexHtml.IndexOf($expectedIpcSurfacePresenceProbeSrc)
    $rendererIndex = $indexHtml.IndexOf('renderer.js')

    if ($rendererIndex -ge 0) {
        Add-Pass "index.html loads renderer.js."
    } else {
        Add-Failure "index.html does not contain a renderer.js script reference."
    }

    if ($rendererPatchIndex -ge 0) {
        Add-Pass "index.html loads renderer patch layer."
    } else {
        Add-Failure "index.html does not contain a renderer patch layer script reference."
    }

    if ($runtimeSmokeProbeIndex -ge 0) {
        Add-Pass "index.html loads runtime smoke probe."
    } else {
        Add-Failure "index.html does not contain a runtime smoke probe script reference."
    }

    if ($rendererReadinessProbeIndex -ge 0) {
        Add-Pass "index.html loads renderer readiness probe."
    } else {
        Add-Failure "index.html does not contain a renderer readiness probe script reference."
    }

    if ($routeCatalogIndex -ge 0) {
        Add-Pass "index.html loads route catalog."
    } else {
        Add-Failure "index.html does not contain a route catalog script reference."
    }

    if ($menuStateIndex -ge 0) {
        Add-Pass "index.html loads menu state package."
    } else {
        Add-Failure "index.html does not contain a menu state package script reference."
    }

    if ($menuOrderIndex -ge 0) {
        Add-Pass "index.html loads menu order package."
    } else {
        Add-Failure "index.html does not contain a menu order package script reference."
    }

    if ($settingsDefaultsIndex -ge 0) {
        Add-Pass "index.html loads settings defaults package."
    } else {
        Add-Failure "index.html does not contain a settings defaults package script reference."
    }

    if ($ipcClientIndex -ge 0) {
        Add-Pass "index.html loads IPC client package."
    } else {
        Add-Failure "index.html does not contain an IPC client package script reference."
    }

    if ($appIpcIndex -ge 0) {
        Add-Pass "index.html loads app IPC package."
    } else {
        Add-Failure "index.html does not contain an app IPC package script reference."
    }

    if ($windowIpcIndex -ge 0) {
        Add-Pass "index.html loads window IPC package."
    } else {
        Add-Failure "index.html does not contain a window IPC package script reference."
    }

    if ($dialogIpcIndex -ge 0) {
        Add-Pass "index.html loads dialog IPC package."
    } else {
        Add-Failure "index.html does not contain a dialog IPC package script reference."
    }

    if ($globalShortcutIpcIndex -ge 0) {
        Add-Pass "index.html loads global shortcut IPC package."
    } else {
        Add-Failure "index.html does not contain a global shortcut IPC package script reference."
    }

    if ($runtimeIpcIndex -ge 0) {
        Add-Pass "index.html loads runtime IPC package."
    } else {
        Add-Failure "index.html does not contain a runtime IPC package script reference."
    }

    if ($routeReadinessProbeIndex -ge 0) {
        Add-Pass "index.html loads route readiness probe."
    } else {
        Add-Failure "index.html does not contain a route readiness probe script reference."
    }

    if ($storeModuleVisibilityProbeIndex -ge 0) {
        Add-Pass "index.html loads store/module visibility probe."
    } else {
        Add-Failure "index.html does not contain a store/module visibility probe script reference."
    }

    if ($ipcSurfacePresenceProbeIndex -ge 0) {
        Add-Pass "index.html loads IPC surface presence probe."
    } else {
        Add-Failure "index.html does not contain an IPC surface presence probe script reference."
    }

    if (($rendererPatchIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if ($rendererPatchIndex -lt $rendererIndex) {
            Add-Pass "renderer patch layer loads before renderer.js."
        } else {
            Add-Failure "renderer patch layer must load before renderer.js."
        }
    }

    if (($rendererPatchIndex -ge 0) -and ($runtimeSmokeProbeIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if (($rendererPatchIndex -lt $runtimeSmokeProbeIndex) -and ($runtimeSmokeProbeIndex -lt $rendererIndex)) {
            Add-Pass "runtime smoke probe loads after patch layer and before renderer.js."
        } else {
            Add-Failure "runtime smoke probe must load after the patch layer and before renderer.js."
        }
    }

    if (($runtimeSmokeProbeIndex -ge 0) -and ($rendererReadinessProbeIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if (($runtimeSmokeProbeIndex -lt $rendererReadinessProbeIndex) -and ($rendererReadinessProbeIndex -lt $rendererIndex)) {
            Add-Pass "renderer readiness probe loads after runtime smoke probe and before renderer.js."
        } else {
            Add-Failure "renderer readiness probe must load after runtime smoke probe and before renderer.js."
        }
    }

    if (($rendererReadinessProbeIndex -ge 0) -and ($routeCatalogIndex -ge 0) -and ($menuStateIndex -ge 0) -and ($menuOrderIndex -ge 0) -and ($settingsDefaultsIndex -ge 0) -and ($ipcClientIndex -ge 0) -and ($appIpcIndex -ge 0) -and ($windowIpcIndex -ge 0) -and ($dialogIpcIndex -ge 0) -and ($globalShortcutIpcIndex -ge 0) -and ($runtimeIpcIndex -ge 0) -and ($routeReadinessProbeIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if (($rendererReadinessProbeIndex -lt $routeCatalogIndex) -and ($routeCatalogIndex -lt $menuStateIndex) -and ($menuStateIndex -lt $menuOrderIndex) -and ($menuOrderIndex -lt $settingsDefaultsIndex) -and ($settingsDefaultsIndex -lt $ipcClientIndex) -and ($ipcClientIndex -lt $appIpcIndex) -and ($appIpcIndex -lt $windowIpcIndex) -and ($windowIpcIndex -lt $dialogIpcIndex) -and ($dialogIpcIndex -lt $globalShortcutIpcIndex) -and ($globalShortcutIpcIndex -lt $runtimeIpcIndex) -and ($runtimeIpcIndex -lt $routeReadinessProbeIndex) -and ($routeReadinessProbeIndex -lt $rendererIndex)) {
            Add-Pass "route catalog and package modules load after readiness probe and before route readiness probe."
        } else {
            Add-Failure "route catalog and package modules must load after renderer readiness probe and before route readiness probe."
        }
    }

    if (($routeReadinessProbeIndex -ge 0) -and ($storeModuleVisibilityProbeIndex -ge 0) -and ($ipcSurfacePresenceProbeIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if (($routeReadinessProbeIndex -lt $storeModuleVisibilityProbeIndex) -and ($storeModuleVisibilityProbeIndex -lt $ipcSurfacePresenceProbeIndex) -and ($ipcSurfacePresenceProbeIndex -lt $rendererIndex)) {
            Add-Pass "route/store/ipc probes load before renderer.js."
        } else {
            Add-Failure "route/store/ipc probes must load before renderer.js."
        }
    }
}

Test-FileContains -Path $rendererPatchPath -Needle '__CFW_PATCH_LAYER__' -Description "renderer patch layer exposes __CFW_PATCH_LAYER__."
Test-FileContains -Path $rendererPatchPath -Needle '009-large-ipc-settings-runtime-extraction' -Description "renderer patch layer records Session 009 version."
Test-FileContains -Path $rendererPatchPath -Needle 'getHealth' -Description "renderer patch layer exposes getHealth."
Test-FileContains -Path $rendererPatchPath -Needle 'recordScript' -Description "renderer patch layer exposes recordScript."
Test-FileContains -Path $rendererPatchPath -Needle 'recordEvent' -Description "renderer patch layer exposes recordEvent."
Test-FileContains -Path $rendererPatchPath -Needle 'eventCounts' -Description "renderer patch layer records event counts."
Test-FileContains -Path $rendererPatchPath -Needle 'scriptOrder' -Description "renderer patch layer records script order."
Test-FileContains -Path $rendererPatchPath -Needle 'probes: probes.slice()' -Description "renderer patch layer includes probes in health output."
Test-FileContains -Path $rendererPatchPath -Needle 'readyFlags' -Description "renderer patch layer records ready flags."
Test-FileContains -Path $rendererPatchPath -Needle 'routeReadinessProbeLoaded' -Description "renderer patch layer records route readiness flag."
Test-FileContains -Path $rendererPatchPath -Needle 'storeModuleVisibilityProbeLoaded' -Description "renderer patch layer records store/module visibility flag."
Test-FileContains -Path $rendererPatchPath -Needle 'ipcSurfacePresenceProbeLoaded' -Description "renderer patch layer records IPC surface flag."
Test-FileContains -Path $rendererPatchPath -Needle 'routeReadiness' -Description "renderer patch layer exposes route readiness health."
Test-FileContains -Path $rendererPatchPath -Needle 'storeModuleVisibility' -Description "renderer patch layer exposes store/module visibility health."
Test-FileContains -Path $rendererPatchPath -Needle 'ipcSurfacePresence' -Description "renderer patch layer exposes IPC surface health."
Test-FileContains -Path $rendererPatchPath -Needle 'appRootPresent' -Description "renderer patch layer records #app presence."
Test-FileContains -Path $rendererPatchPath -Needle 'document.documentElement.dataset.cfwPatchLayer' -Description "renderer patch layer sets the dataset marker."
Test-FileContains -Path $runtimeSmokeProbePath -Needle 'cfw:patch-layer-ready' -Description "runtime smoke probe dispatches cfw:patch-layer-ready."
Test-FileContains -Path $runtimeSmokeProbePath -Needle 'runtime-smoke-probe-loaded' -Description "runtime smoke probe registers a probe."
Test-FileContains -Path $rendererReadinessProbePath -Needle 'renderer-readiness-probe-loaded' -Description "renderer readiness probe registers its load probe."
Test-FileContains -Path $rendererReadinessProbePath -Needle 'renderer-readiness-sample' -Description "renderer readiness probe records bounded samples."
Test-FileContains -Path $rendererReadinessProbePath -Needle '__CFW_RENDERER_AFTER_PATCH_MARKER__' -Description "renderer readiness probe can observe a post-renderer marker."
Test-FileContains -Path $rendererReadinessProbePath -Needle 'DOMContentLoaded' -Description "renderer readiness probe observes DOMContentLoaded."
Test-FileContains -Path $rendererReadinessProbePath -Needle 'load' -Description "renderer readiness probe observes load."
Test-FileContains -Path $routeCatalogPath -Needle '__CFW_ROUTE_CATALOG__' -Description "route catalog exposes __CFW_ROUTE_CATALOG__."
Test-FileContains -Path $routeCatalogPath -Needle 'matchRouteFromLocation' -Description "route catalog exposes route matching."
Test-FileContains -Path $routeCatalogPath -Needle 'buildMenuItems' -Description "route catalog builds renderer menu items."
Test-FileContains -Path $routeCatalogPath -Needle 'buildVueRouterRoutes' -Description "route catalog builds Vue Router routes."
Test-FileContains -Path $routeCatalogPath -Needle '"/home/general"' -Description "route catalog includes /home/general."
Test-FileContains -Path $routeCatalogPath -Needle '"/home/proxy"' -Description "route catalog includes /home/proxy."
Test-FileContains -Path $routeCatalogPath -Needle '"/home/server"' -Description "route catalog includes /home/server."
Test-FileContains -Path $routeCatalogPath -Needle 'fallbackPath' -Description "route catalog records fallback path."
Test-FileContains -Path $menuStatePath -Needle '__CFW_MENU_STATE__' -Description "menu state package exposes __CFW_MENU_STATE__."
Test-FileContains -Path $menuStatePath -Needle 'getInitialCurrentRoutePath' -Description "menu state package owns current route initialization."
Test-FileContains -Path $menuStatePath -Needle 'currentRouteStorageKey' -Description "menu state package records the current route storage key."
Test-FileContains -Path $menuStatePath -Needle 'packages/menu/menu-state.js' -Description "menu state package records its package source."
Test-FileContains -Path $menuOrderPath -Needle '__CFW_MENU_ORDER__' -Description "menu order package exposes __CFW_MENU_ORDER__."
Test-FileContains -Path $menuOrderPath -Needle 'compareMenuItems' -Description "menu order package owns menu item comparison."
Test-FileContains -Path $menuOrderPath -Needle 'sortMenuItems' -Description "menu order package owns menu item sorting."
Test-FileContains -Path $settingsDefaultsPath -Needle '__CFW_SETTINGS_DEFAULTS__' -Description "settings defaults package exposes __CFW_SETTINGS_DEFAULTS__."
Test-FileContains -Path $settingsDefaultsPath -Needle 'mergeSettings' -Description "settings defaults package owns settings merge."
Test-FileContains -Path $settingsDefaultsPath -Needle 'defaultTrayOrders' -Description "settings defaults package owns tray order defaults."
Test-FileContains -Path $ipcClientPath -Needle '__CFW_IPC_CLIENT__' -Description "IPC client package exposes __CFW_IPC_CLIENT__."
Test-FileContains -Path $ipcClientPath -Needle 'invokeWindow' -Description "IPC client package owns window invoke helper."
Test-FileContains -Path $ipcClientPath -Needle 'invokeApp' -Description "IPC client package owns app invoke helper."
Test-FileContains -Path $appIpcPath -Needle '__CFW_APP_IPC__' -Description "app IPC package exposes __CFW_APP_IPC__."
Test-FileContains -Path $appIpcPath -Needle 'getPath' -Description "app IPC package owns getPath helper."
Test-FileContains -Path $appIpcPath -Needle 'setLoginItemSettings' -Description "app IPC package owns login-item helper."
Test-FileContains -Path $windowIpcPath -Needle '__CFW_WINDOW_IPC__' -Description "window IPC package exposes __CFW_WINDOW_IPC__."
Test-FileContains -Path $windowIpcPath -Needle 'invokeWindowControl' -Description "window IPC package owns window-control helper."
Test-FileContains -Path $dialogIpcPath -Needle '__CFW_DIALOG_IPC__' -Description "dialog IPC package exposes __CFW_DIALOG_IPC__."
Test-FileContains -Path $dialogIpcPath -Needle 'showOpenDialogSync' -Description "dialog IPC package owns open-dialog helper."
Test-FileContains -Path $globalShortcutIpcPath -Needle '__CFW_GLOBAL_SHORTCUT_IPC__' -Description "global shortcut IPC package exposes __CFW_GLOBAL_SHORTCUT_IPC__."
Test-FileContains -Path $globalShortcutIpcPath -Needle 'isRegistered' -Description "global shortcut IPC package owns registration helpers."
Test-FileContains -Path $runtimeIpcPath -Needle '__CFW_RUNTIME_IPC__' -Description "runtime IPC package exposes __CFW_RUNTIME_IPC__."
Test-FileContains -Path $runtimeIpcPath -Needle 'startPowerSaveBlocker' -Description "runtime IPC package owns power-save helper."
Test-FileContains -Path $runtimeIpcPath -Needle 'toggleDevTools' -Description "runtime IPC package owns webContent helper."
Test-FileContains -Path $routeReadinessProbePath -Needle 'route-readiness-probe-loaded' -Description "route readiness probe registers its load probe."
Test-FileContains -Path $routeReadinessProbePath -Needle 'route-readiness-sample' -Description "route readiness probe records samples."
Test-FileContains -Path $routeReadinessProbePath -Needle 'route-readiness:hashchange' -Description "route readiness probe records hashchange event name."
Test-FileContains -Path $routeReadinessProbePath -Needle 'matchRouteFromLocation' -Description "route readiness probe uses extracted route catalog."
Test-FileContains -Path $storeModuleVisibilityProbePath -Needle 'store-module-visibility-probe-loaded' -Description "store/module visibility probe registers its load probe."
Test-FileContains -Path $storeModuleVisibilityProbePath -Needle 'store-module-visibility-sample' -Description "store/module visibility probe records samples."
Test-FileContains -Path $storeModuleVisibilityProbePath -Needle '__VUE_DEVTOOLS_GLOBAL_HOOK__' -Description "store/module visibility probe checks Vue signals read-only."
Test-FileContains -Path $storeModuleVisibilityProbePath -Needle 'storeStateKeys' -Description "store/module visibility probe reports store keys."
Test-FileContains -Path $ipcSurfacePresenceProbePath -Needle 'ipc-surface-presence-probe-loaded' -Description "IPC surface presence probe registers its load probe."
Test-FileContains -Path $ipcSurfacePresenceProbePath -Needle 'ipcRendererMethods' -Description "IPC surface presence probe reports method metadata."
Test-FileContains -Path $ipcSurfacePresenceProbePath -Needle 'require("electron")' -Description "IPC surface presence probe checks Electron module presence."
Test-FileContains -Path $ipcSurfacePresenceProbePath -Needle 'electronVersion' -Description "IPC surface presence probe records Electron version metadata."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_ROUTE_CATALOG__.buildMenuItems(Lg)' -Description "renderer.js delegates menu item construction to route catalog."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_ROUTE_CATALOG__.buildVueRouterRoutes(o)' -Description "renderer.js delegates Vue Router construction to route catalog."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_MENU_STATE__.getInitialCurrentRoutePath(N.Z, D.Z.CURRENT_ROUTE_PATH)' -Description "renderer.js delegates currentRoutePath initialization to menu state package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_SETTINGS_DEFAULTS__.mergeSettings(settings)' -Description "renderer.js delegates settings defaults and merge to settings package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_MENU_ORDER__.compareMenuItems(e, t, N.Z, D.Z.MENU_ITEM_ORDER)' -Description "renderer.js delegates menu item comparison to menu order package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_MENU_ORDER__.sortMenuItems(r()(e.menuItems), N.Z, D.Z.MENU_ITEM_ORDER)' -Description "renderer.js delegates menu item sorting to menu order package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_IPC_CLIENT__.invokeApp(y.ipcRenderer, "quit")' -Description "renderer.js delegates app quit IPC invoke to IPC client package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_IPC_CLIENT__.invokeWindow(y.ipcRenderer, "minimize")' -Description "renderer.js delegates window minimize IPC invoke to IPC client package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_IPC_CLIENT__.invokeWindow(y.ipcRenderer, "setAlwaysOnTop", this.isPinned)' -Description "renderer.js delegates pinned window IPC invoke to IPC client package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_APP_IPC__.getPath(y.ipcRenderer, "home")' -Description "renderer.js delegates app getPath IPC calls to app IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_APP_IPC__.setLoginItemSettings(u.ipcRenderer' -Description "renderer.js delegates login item IPC to app IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_WINDOW_IPC__.showOrHide(y.ipcRenderer)' -Description "renderer.js delegates window-control IPC to window IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_WINDOW_IPC__.reload(require("electron").ipcRenderer)' -Description "renderer.js delegates window reload IPC to window IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_DIALOG_IPC__.showOpenDialogSync(W.ipcRenderer' -Description "renderer.js delegates dialog IPC to dialog IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_GLOBAL_SHORTCUT_IPC__.register(y.ipcRenderer, e)' -Description "renderer.js delegates globalShortcut IPC to global shortcut IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_RUNTIME_IPC__.shouldUseDarkColors(y.ipcRenderer)' -Description "renderer.js delegates nativeTheme IPC to runtime IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_RUNTIME_IPC__.startPowerSaveBlocker(h.ipcRenderer, "prevent-app-suspension")' -Description "renderer.js delegates powerSaveBlocker IPC to runtime IPC package."
Test-FileContains -Path $rendererJsPath -Needle 'window.__CFW_RUNTIME_IPC__.toggleDevTools(y.ipcRenderer)' -Description "renderer.js delegates webContent IPC to runtime IPC package."
Test-FileNotContains -Path $rendererJsPath -Needle 'menuItems: [{' -Description "renderer.js no longer contains the old inline menuItems block."
Test-FileNotContains -Path $rendererJsPath -Needle 'routes: [{' -Description "renderer.js no longer contains the old inline routes block."
Test-FileNotContains -Path $rendererJsPath -Needle 'component: o(42016).Z' -Description "renderer.js no longer directly owns the /home route component mapping."
Test-FileNotContains -Path $rendererJsPath -Needle 'path: "general"' -Description "renderer.js no longer directly owns the general child route literal."
Test-FileNotContains -Path $rendererJsPath -Needle 'currentRoutePath: N.Z.get(D.Z.CURRENT_ROUTE_PATH) || "/home/general"' -Description "renderer.js no longer directly owns currentRoutePath fallback initialization."
Test-FileNotContains -Path $rendererJsPath -Needle 'const showNewVersionIcon = settings.showNewVersionIcon !== false' -Description "renderer.js no longer directly owns showNewVersionIcon default merge."
Test-FileNotContains -Path $rendererJsPath -Needle 'const randomControllerPort = settings.randomControllerPort !== false' -Description "renderer.js no longer directly owns randomControllerPort default merge."
Test-FileNotContains -Path $rendererJsPath -Needle 'const trayOrders = settings.trayOrders || [["icon"], ["status", "traffic", "text"]]' -Description "renderer.js no longer directly owns tray order default merge."
Test-FileNotContains -Path $rendererJsPath -Needle 'var i, n = null !== (i = N.Z.get(D.Z.MENU_ITEM_ORDER))' -Description "renderer.js no longer directly owns menu order lookup."
Test-FileNotContains -Path $rendererJsPath -Needle 'return r()(e.menuItems).sort(E)' -Description "renderer.js no longer directly owns menu item sorting call."
Test-FileNotContains -Path $rendererJsPath -Needle 'y.ipcRenderer.invoke("app", "quit")' -Description "renderer.js no longer directly owns closeApp app quit invoke."
Test-FileNotContains -Path $rendererJsPath -Needle 'y.ipcRenderer.invoke("window", "minimize")' -Description "renderer.js no longer directly owns miniApp window minimize invoke."
Test-FileNotContains -Path $rendererJsPath -Needle 'y.ipcRenderer.invoke("window", e)' -Description "renderer.js no longer directly owns maxApp window action invoke."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("app"' -Description "renderer.js no longer directly invokes app IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("window"' -Description "renderer.js no longer directly invokes window IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("window-control"' -Description "renderer.js no longer directly invokes window-control IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("dialog"' -Description "renderer.js no longer directly invokes dialog IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("globalShortcut"' -Description "renderer.js no longer directly invokes globalShortcut IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("nativeTheme"' -Description "renderer.js no longer directly invokes nativeTheme IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("powerSaveBlocker"' -Description "renderer.js no longer directly invokes powerSaveBlocker IPC channel."
Test-FileNotContains -Path $rendererJsPath -Needle 'ipcRenderer.invoke("webContent"' -Description "renderer.js no longer directly invokes webContent IPC channel."
Test-FileContains -Path $patchLayerSmokeScriptPath -Needle 'Patch layer smoke check passed.' -Description "patch layer smoke script has a stable pass signal."
Test-FileContains -Path $rendererReadinessSmokeScriptPath -Needle 'Renderer readiness smoke check passed.' -Description "renderer readiness smoke script has a stable pass signal."
Test-FileContains -Path $routeCatalogSmokeScriptPath -Needle 'Route catalog smoke check passed.' -Description "route catalog smoke script has a stable pass signal."
Test-FileContains -Path $routeCatalogSmokeScriptPath -Needle 'matchRouteFromLocation' -Description "route catalog smoke verifies matching rules."
Test-FileContains -Path $menuStateSmokeScriptPath -Needle 'Menu state smoke check passed.' -Description "menu state smoke script has a stable pass signal."
Test-FileContains -Path $menuStateSmokeScriptPath -Needle 'getInitialCurrentRoutePath' -Description "menu state smoke verifies current route initialization."
Test-FileContains -Path $settingsDefaultsSmokeScriptPath -Needle 'Settings defaults smoke check passed.' -Description "settings defaults smoke script has a stable pass signal."
Test-FileContains -Path $settingsDefaultsSmokeScriptPath -Needle 'mergeSettings' -Description "settings defaults smoke verifies settings merge."
Test-FileContains -Path $menuOrderIpcSmokeScriptPath -Needle 'Menu order and IPC smoke check passed.' -Description "menu order and IPC smoke script has a stable pass signal."
Test-FileContains -Path $menuOrderIpcSmokeScriptPath -Needle 'invokeWindow' -Description "menu order and IPC smoke verifies IPC invoke helper."
Test-FileContains -Path $ipcClustersSmokeScriptPath -Needle 'IPC clusters smoke check passed.' -Description "IPC clusters smoke script has a stable pass signal."
Test-FileContains -Path $ipcClustersSmokeScriptPath -Needle '__CFW_GLOBAL_SHORTCUT_IPC__' -Description "IPC clusters smoke verifies global shortcut helper."

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Baseline check failed with $($failures.Count) issue(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Baseline check passed." -ForegroundColor Green
exit 0
