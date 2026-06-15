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
$routeReadinessProbePath = Join-Path $distDir 'patch-layer\route-readiness-probe.js'
$storeModuleVisibilityProbePath = Join-Path $distDir 'patch-layer\store-module-visibility-probe.js'
$ipcSurfacePresenceProbePath = Join-Path $distDir 'patch-layer\ipc-surface-presence-probe.js'
$patchLayerSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-patch-layer-smoke.js'
$rendererReadinessSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-renderer-readiness-smoke.js'
$routeCatalogSmokeScriptPath = Join-Path $repoRoot 'scripts\refactor\check-route-catalog-smoke.js'

$expectedMainHash = 'AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F'
$legacyRendererHash = '7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B'
$expectedRendererHash = 'E0A54DC7914C441880BD12B84A91F91979CA128CED9886C4EFDCCBA545BE0E5C'
$expectedPackageMain = './dist/electron/main.js'
$expectedRendererPatchSrc = 'patch-layer/renderer-patch.js'
$expectedRuntimeSmokeProbeSrc = 'patch-layer/runtime-smoke-probe.js'
$expectedRendererReadinessProbeSrc = 'patch-layer/renderer-readiness-probe.js'
$expectedRouteCatalogSrc = 'patch-layer/routes/route-catalog.js'
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
    $routeReadinessProbePath,
    $storeModuleVisibilityProbePath,
    $ipcSurfacePresenceProbePath,
    $patchLayerSmokeScriptPath,
    $rendererReadinessSmokeScriptPath,
    $routeCatalogSmokeScriptPath,
    (Join-Path $distDir 'renderer.js.LICENSE.txt'),
    (Join-Path $distDir '287.js'),
    (Join-Path $distDir '295.js'),
    (Join-Path $distDir '585.js'),
    (Join-Path $distDir 'editor.worker.js')
)

foreach ($file in $requiredFiles) {
    Test-RequiredFile -Path $file
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

    if (($rendererReadinessProbeIndex -ge 0) -and ($routeCatalogIndex -ge 0) -and ($routeReadinessProbeIndex -ge 0) -and ($rendererIndex -ge 0)) {
        if (($rendererReadinessProbeIndex -lt $routeCatalogIndex) -and ($routeCatalogIndex -lt $routeReadinessProbeIndex) -and ($routeReadinessProbeIndex -lt $rendererIndex)) {
            Add-Pass "route catalog loads after readiness probe and before route readiness probe."
        } else {
            Add-Failure "route catalog must load after renderer readiness probe and before route readiness probe."
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
Test-FileContains -Path $rendererPatchPath -Needle '006-enforced-route-delegation' -Description "renderer patch layer records Session 006 version."
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
Test-FileNotContains -Path $rendererJsPath -Needle 'menuItems: [{' -Description "renderer.js no longer contains the old inline menuItems block."
Test-FileNotContains -Path $rendererJsPath -Needle 'routes: [{' -Description "renderer.js no longer contains the old inline routes block."
Test-FileNotContains -Path $rendererJsPath -Needle 'component: o(42016).Z' -Description "renderer.js no longer directly owns the /home route component mapping."
Test-FileNotContains -Path $rendererJsPath -Needle 'path: "general"' -Description "renderer.js no longer directly owns the general child route literal."
Test-FileContains -Path $patchLayerSmokeScriptPath -Needle 'Patch layer smoke check passed.' -Description "patch layer smoke script has a stable pass signal."
Test-FileContains -Path $rendererReadinessSmokeScriptPath -Needle 'Renderer readiness smoke check passed.' -Description "renderer readiness smoke script has a stable pass signal."
Test-FileContains -Path $routeCatalogSmokeScriptPath -Needle 'Route catalog smoke check passed.' -Description "route catalog smoke script has a stable pass signal."
Test-FileContains -Path $routeCatalogSmokeScriptPath -Needle 'matchRouteFromLocation' -Description "route catalog smoke verifies matching rules."

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Baseline check failed with $($failures.Count) issue(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Baseline check passed." -ForegroundColor Green
exit 0
