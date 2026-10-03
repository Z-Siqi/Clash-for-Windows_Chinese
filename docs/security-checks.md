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
