"use strict";

function configureRendererTransports({ axios }) {
    // The privileged renderer now runs in an isolated preload world. Force Axios
    // to retain its former Node transport semantics instead of selecting XHR from
    // the DOM globals and becoming subject to page-origin CORS restrictions.
    axios.defaults.adapter = "http";
    return axios;
}

module.exports = { configureRendererTransports };
