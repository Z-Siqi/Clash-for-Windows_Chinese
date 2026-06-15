(function () {
    var root = typeof window !== "undefined" ? window : globalThis;
    var version = "006-enforced-route-delegation";
    var basePath = "/home";
    var fallbackPath = "/home/general";
    var parentRouteName = "landing-page";
    var parentChunkHint = "42016";
    var source = "app/main/dist/electron/patch-layer/routes/route-catalog.js";

    var routes = [
        {
            id: "general",
            path: "/home/general",
            childPath: "general",
            menuKey: "general",
            titleKey: "general",
            chunkHint: "72797",
            keepAlive: true,
            menuVisible: true
        },
        {
            id: "proxy",
            path: "/home/proxy",
            childPath: "proxy",
            menuKey: "proxies",
            titleKey: "proxies",
            chunkHint: "72094",
            keepAlive: true,
            menuVisible: true
        },
        {
            id: "provider",
            path: "/home/provider",
            childPath: "provider",
            menuKey: null,
            titleKey: null,
            chunkHint: "38585",
            keepAlive: true,
            menuVisible: false
        },
        {
            id: "log",
            path: "/home/log",
            childPath: "log",
            menuKey: "logs",
            titleKey: "logs",
            chunkHint: "11969",
            keepAlive: false,
            menuVisible: true
        },
        {
            id: "server",
            path: "/home/server",
            childPath: "server",
            menuKey: "profiles",
            titleKey: "profiles",
            chunkHint: "74775",
            keepAlive: true,
            menuVisible: true
        },
        {
            id: "connection",
            path: "/home/connection",
            childPath: "connection",
            menuKey: "connections",
            titleKey: "connections",
            chunkHint: "14196",
            keepAlive: true,
            menuVisible: true
        },
        {
            id: "router",
            path: "/home/router",
            childPath: "router",
            menuKey: null,
            titleKey: null,
            chunkHint: "28779",
            keepAlive: true,
            menuVisible: false
        },
        {
            id: "setting",
            path: "/home/setting",
            childPath: "setting",
            menuKey: "settings",
            titleKey: "settings",
            chunkHint: "99876",
            keepAlive: true,
            menuVisible: true
        },
        {
            id: "about",
            path: "/home/about",
            childPath: "about",
            menuKey: "feedback",
            titleKey: "feedback",
            chunkHint: "58323",
            keepAlive: true,
            menuVisible: true
        }
    ];

    function cloneRoute(route) {
        if (!route) {
            return null;
        }

        return {
            id: route.id,
            path: route.path,
            childPath: route.childPath,
            menuKey: route.menuKey,
            titleKey: route.titleKey,
            chunkHint: route.chunkHint,
            keepAlive: route.keepAlive,
            menuVisible: route.menuVisible
        };
    }

    function normalizePath(value) {
        var raw = typeof value === "string" ? value : "";
        var path = raw.trim();

        if (!path) {
            return "/";
        }

        if (path.charAt(0) !== "/") {
            path = "/" + path;
        }

        path = path.replace(/\/+/g, "/");

        if (path.length > 1 && path.charAt(path.length - 1) === "/") {
            path = path.slice(0, -1);
        }

        return path || "/";
    }

    function pathFromLocation(locationLike) {
        var value = locationLike || {};
        var hash = typeof value.hash === "string" ? value.hash : "";
        var pathname = typeof value.pathname === "string" ? value.pathname : "";
        var href = typeof value.href === "string" ? value.href : "";
        var hashPath = "";

        if (hash) {
            hashPath = hash.charAt(0) === "#" ? hash.slice(1) : hash;
        } else if (href.indexOf("#") >= 0) {
            hashPath = href.slice(href.indexOf("#") + 1);
        }

        if (hashPath) {
            if (hashPath.charAt(0) === "!") {
                hashPath = hashPath.slice(1);
            }

            return normalizePath(hashPath);
        }

        return normalizePath(pathname);
    }

    function findRouteByPath(path) {
        var normalizedPath = normalizePath(path);

        for (var index = 0; index < routes.length; index += 1) {
            if (routes[index].path === normalizedPath) {
                return routes[index];
            }
        }

        return null;
    }

    function matchRouteFromLocation(locationLike) {
        var observedPath = pathFromLocation(locationLike);
        var route = findRouteByPath(observedPath);
        var redirected = false;

        if (!route && (observedPath === "/" || observedPath === basePath)) {
            route = findRouteByPath(fallbackPath);
            redirected = true;
        }

        return {
            observedPath: observedPath,
            matched: !!route,
            redirected: redirected,
            fallbackPath: fallbackPath,
            route: cloneRoute(route)
        };
    }

    function getRoutes() {
        return routes.map(cloneRoute);
    }

    function getMenuRoutes() {
        return routes.filter(function (route) {
            return route.menuVisible;
        }).map(cloneRoute);
    }

    function resolveComponent(moduleResolver, chunkHint) {
        if (typeof moduleResolver !== "function") {
            throw new Error("route catalog requires the renderer module resolver");
        }

        var moduleValue = moduleResolver(Number(chunkHint));
        return moduleValue && moduleValue.Z ? moduleValue.Z : moduleValue;
    }

    function buildRouteChild(moduleResolver, route) {
        var child = {
            path: route.childPath,
            component: resolveComponent(moduleResolver, route.chunkHint)
        };

        if (route.keepAlive) {
            child.meta = {
                keepAlive: true
            };
        }

        return child;
    }

    function buildVueRouterRoutes(moduleResolver) {
        return [{
            path: basePath,
            name: parentRouteName,
            component: resolveComponent(moduleResolver, parentChunkHint),
            children: routes.map(function (route) {
                return buildRouteChild(moduleResolver, route);
            })
        }, {
            path: "*",
            redirect: fallbackPath
        }];
    }

    function buildMenuItem(language, route) {
        var title = route.id;

        if (language && route.titleKey && typeof language[route.titleKey] === "function") {
            title = language[route.titleKey]();
        }

        return {
            title: title,
            path: route.path
        };
    }

    function buildMenuItems(language) {
        return routes.filter(function (route) {
            return route.menuVisible;
        }).map(function (route) {
            return buildMenuItem(language, route);
        });
    }

    var catalog = {
        version: version,
        source: source,
        basePath: basePath,
        fallbackPath: fallbackPath,
        parentRouteName: parentRouteName,
        parentChunkHint: parentChunkHint,
        routes: getRoutes(),
        getRoutes: getRoutes,
        getMenuRoutes: getMenuRoutes,
        buildMenuItems: buildMenuItems,
        buildVueRouterRoutes: buildVueRouterRoutes,
        normalizePath: normalizePath,
        pathFromLocation: pathFromLocation,
        findRouteByPath: function (path) {
            return cloneRoute(findRouteByPath(path));
        },
        matchRouteFromLocation: matchRouteFromLocation
    };

    root.__CFW_ROUTE_CATALOG__ = catalog;

    if (root.__CFW_PATCH_LAYER__ && typeof root.__CFW_PATCH_LAYER__.recordScript === "function") {
        root.__CFW_PATCH_LAYER__.recordScript("route-catalog.js", {
            source: source,
            routeCount: routes.length,
            menuRouteCount: getMenuRoutes().length
        });
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = catalog;
    }
}());
