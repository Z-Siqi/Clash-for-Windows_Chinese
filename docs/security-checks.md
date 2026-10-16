# Security verification

The `Tests` workflow runs the canonical `npm test` gate on Windows and Linux.
Windows helper integration tests deliberately use an 8.3 temporary-directory
alias when available and compare native filesystem identities, since Go can
return the long spelling of the same path.

The `CodeQL` workflow runs on pushes and pull requests to `main` and `test`.
It can also be started manually from GitHub Actions. Its JavaScript/TypeScript,
Go, and GitHub Actions jobs use the `security-extended` queries and retain SARIF
reports as workflow artifacts. The repository's existing default CodeQL setup
continues to own code-scanning uploads; GitHub rejects advanced-configuration
uploads while default setup is enabled. This supplemental workflow does not
change that repository setting.

`.github/codeql-config.yml` includes `app/main/dist/electron`: these files are
maintained executable source, despite the `dist` directory name. Build products
and vendored dependencies are excluded. Go is built explicitly from
`scripts/native/linux-service-helper`; no service is installed during analysis.

Use the commit SHA in a workflow run to identify the version verified. A green
CodeQL job requires a generated SARIF report, executed queries, zero findings,
and no extraction errors. `scripts/security/check-codeql-results.js` enforces
this gate because the analyzer itself can exit successfully with findings or
incomplete extraction. Inspect the artifacts for the actual results and coverage.

CodeQL does not analyze the Windows PowerShell helper, audit dependency CVEs,
or prove operating-system ACLs and application-specific authentication policies.
Keep the service protocol, unauthorized IPC, navigation, download, and filesystem
regression tests alongside static analysis. Native platform checks are evidence
only for the platforms where they ran; zero CodeQL findings are not a proof that
the entire application is vulnerability-free.

## Network and dependency checks

Controller REST clients connect directly to loopback, bypass environment proxies,
and refuse redirects. HTTP response caching stays disabled for controller and
GeoIP transports. By default, subscriptions and explicitly enabled remote parsers have a
16 MiB limit after decompression and a 60-second HTTP timeout; profile workers
also have a two-minute wall-clock deadline. Failed downloads must not log Axios
objects, which retain authorization headers and proxy credentials.

Settings → Security's Core Secret rotates the controller REST/WebSocket credential
in `config.yaml` and relaunches after a successful save. It does not set the
HTTP/SOCKS proxy password. Allow Unsafe URLs grants certificate exceptions only
to explicitly listed HTTPS URLs, including their paths and query strings. The
same matching policy applies to dashboard resources and subscription downloads
in utility workers, both directly and through Clash. Redirect destinations are
checked independently; invalid settings and removed entries grant no exception.
Certificate Origin Exceptions is a separate, empty-by-default list for trusted
self-signed services whose URL paths or query strings change. Each entry must
be an exact HTTPS origin, including a non-default port when present. All paths
on that origin are covered; subdomains, other ports and wildcards are excluded.
It does not change the native core's TLS verification or run remote parser code.
Disable Loading Ads Link defaults to enabled. Changes apply while running:
disabled advertisement requests are skipped, cached advertisements are cleared,
and responses arriving after disabling are discarded.

Subscription Download Exceptions can raise resource limits for a trusted, exact
download URL and its redirect chain. Other initial URLs retain the defaults.
The editor validates the following YAML before saving; invalid manual settings
also fall back to the default limits:

```yaml
exceptions:
  - url: https://trusted.example/profile.yaml
    maxSizeMiB: 64
    timeoutSeconds: 180
    processingTimeoutSeconds: 600
```

Allowed ranges are 16–256 MiB after decompression, 60–1800 seconds per HTTP
request and 120–3600 seconds total download/processing time. The total deadline
is at least the HTTP timeout plus 60 seconds. Omitted fields use defaults; the
host derives the deadline from saved settings, never from download IPC fields.
Long-running local parsers can use the same total-processing exception. Remote
parser downloads can have their own URL entries, while the enclosing job still
uses the subscription URL's overall deadline. Size and time limits remain finite.
Download workers use the saved policy captured when each job starts. Changes to
download limits, certificate exceptions and remote-parser permission apply to new
jobs; cancel and retry an in-flight download to apply a change to that operation.

Allow Remote JavaScript Parsers exposes the existing compatibility setting in
Security. It defaults to off, requires a warning confirmation when enabled and
preserves an explicitly saved `true`. It grants configured remote parsers the
current user's file/network capabilities; ordinary YAML subscriptions, inline
scripts and local parser files do not require it.

Allow HTTP Links in Browser also defaults to off and requires confirmation to
enable. It permits legacy HTTP subscription homepages and LAN pages in the
system browser, retaining existing link-opening confirmations. Both renderer
and host check the current permission. HTTPS and loopback HTTP retain their
normal behavior; executable/file URL schemes remain blocked. This permission
does not change TLS verification or control API authentication.

Run both dependency audits when changing packages:

```sh
npm audit
npm audit --prefix app/main --omit=dev
```

Review actual versions in the packaged dependency tree as well as the lockfile.
An audit's version range alone does not prove a code path is safe. Keep Monaco's
DOMPurify override, its installed version check, and the generated asset manifest
in agreement. Monaco embeds its own sanitizer, so its build must explicitly use
the patched package and record the actual source inputs; an npm override alone
does not replace the embedded code. Obtain Electron security updates by updating the central release
configuration and verifying a matching stock runtime with the isolation fixture.

Vue 2's template-parser advisory remains reported for Vue/Vuex. The production
renderer uses Vue's runtime-only build and named render functions; architecture
tests exclude the template compiler and source-map tooling from its inputs.
Never compile templates supplied by profiles, network responses, or users.
Saved JavaScript parsers, mixins, and action scripts intentionally retain Node
capabilities in utility workers. Remote JavaScript parsers are disabled by
default; enabling them grants the remote source those capabilities.

## Native core verification

npm audits do not cover the packaged Clash, Mihomo, or service-helper binaries.
Inspect their embedded Go build information and scan each shipped target against
the Go vulnerability database:

```sh
go version -m <packaged-binary>
govulncheck -mode=binary <packaged-binary>
```

Binary scans identify vulnerable package versions and symbols; they do not prove
that a particular configuration exposes every reported function to an attacker.
Review HTTP, HTTP/2, TLS, DNS, and configured proxy-protocol paths before accepting
or dismissing a finding. Loopback controller binding does not protect outbound
protocol parsers from malicious remote peers. A matching SHA-256 manifest proves
asset identity, not that its dependencies are free of known vulnerabilities.
Core replacements must update all platform assets, source/license records and
Service Mode allow-lists together, followed by the native compatibility tests.
