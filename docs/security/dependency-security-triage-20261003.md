# CarMazium dependency-security triage — independent of the ten-block valuation release

**Read-only source:** GitHub Actions `Independent Dependency Security Triage`, 3 October 2026; `npm audit --package-lock-only --omit=dev --json` against the actual backend, website and native `package-lock.json` trees. Audits report package/advisory reachability, **not confirmed exploitation**. The same vulnerable transitive module may be counted separately across products and multiple advisories may affect one package. The valuation release remains draft PR #367, unmerged and undeployed.

| Surface | Critical | High | Moderate | Low | Action |
|---|---:|---:|---:|---:|---|
| Backend | 3 | 29 | 23 | 1 | Block release; treat backend as highest priority |
| Website | 1 | 5 | 3 | 1 | Block release; update pinned Next.js and dependency tree in a separate PR |
| Native app | 1 | 20 | 18 | 0 | Block release; fix transitive critical `tar` and test against supported Expo SDK |

## Actionable findings

### 1. Direct website framework
- `next`: critical. Package audit offers a non-major update to **16.3.8**, including `postcss` and `sharp` transitive fixes. Existing `package.json` pins Next.js and `eslint-config-next` at **16.1.3**. Update them **together** under an isolated *website security* review branch; regenerate its lockfile and test `npx tsc --noEmit`, `npm run build`, CSP/image optimisation, login/auth and rewrites in an isolated preview. The npm audit's fix suggestion is not proof the newer version integrates safely.
- `nanoid`, `socket.io-parser` and `ws` have compatible patch paths reported by npm audit. `postcss` and `sharp` need the reviewed Next dependency upgrade; avoid global `overrides` that silently force incompatible ABI or build versions.
- Relevant examples: [Next framework advisories](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) and [Socket.IO parser](https://github.com/advisories/GHSA-2m8v-j782-fhvr). Security impact depends on how the application exposes the affected functionality.

### 2. Backend critical and directly maintained packages
- Critical transitive `@xhmikosr/decompress`, `piscina` and `tar`. Audit reports compatible updates for the first two; trace their root dependency chains before setting any `overrides` or installing new packages. It reports a major `bcrypt` 6.0.0 route for the vulnerable transitive `tar` tree from `@mapbox/node-pre-gyp`; **do not auto-force** a bcrypt migration without verifying stored-password compatibility, native module builds and auth regression.
- High directly maintained `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `axios` and `nodemailer` have compatible patch paths. Resolve underlying `multer`, `path-to-regexp`, `js-yaml`, `lodash`, `ws`, `engine.io` and `socket.io-parser` with tests for file uploads, routing, authorization, email and sockets.
- `prisma` is flagged through `@prisma/config` and `deepmerge-ts`/`effect`; the audit's suggested `prisma@6.12.0` is a **downgrade** relative to the existing declared `prisma@^6.19.2`. Reject that blind suggestion; check for an independently validated compatible fix and Prisma Client/generator coherence instead.
- Advisory references include [tar](https://github.com/advisories/GHSA-r292-9mhp-454m), [axios](https://github.com/advisories/GHSA-3p68-rc4w-qgx5), and relevant individual entries in the timestamped CI log. Audit URLs should be rechecked before selecting final package versions.

### 3. Native dependencies
- Critical transitive `tar` has a non-major fix path. Trial compatible lockfile updates first, but test Expo install, Android Gradle resolution, EAS production config, native iOS compilation and OTA compatibility before accepting. A passing TypeScript check alone cannot certify native-package upgrades.
- Expo-related high findings span `expo`, `expo-updates`, `@expo/cli`, `@expo/code-signing-certificates`, `node-forge`, `postcss`, `@stripe/stripe-react-native` and `@react-native-community/datetimepicker`. Several `npm audit fix --force` proposals would **downgrade to Expo SDK 44 or older module versions**, breaking native compatibility. Explicitly **prohibit force and major downgrade**; investigate maintained fixes within the project's current supported Expo SDK, then separately plan a tested SDK upgrade only if required.
- High non-major transitive fix candidates: `@xmldom/xmldom`, `brace-expansion`, `browserslist`, `fast-uri`, `image-size`, `js-yaml`, `nanoid`, `shell-quote`, `socket.io-parser`, `undici` and `ws`. Review whether each is only build tooling versus code handling customer-controlled input.

## Evidence collection and change rules

The new workflow independently inventories **the exact high/critical package names and advisory references** and then runs `npm audit fix --package-lock-only --omit=dev --ignore-scripts` **only inside a disposable GitHub Actions runner**. It rescans and publishes proposed before/after counts without pushing any lockfile or changing the GitHub repository. If the CI dependency registry is unavailable, the parser fails closed rather than reporting an artificial clean result.

Follow-up implementation should be a **different, independently tested and deployed security PR**, not part of the 51-file valuation release manifest. For each candidate dependency update: pin intended package constraints, generate actual lockfiles reproducibly, inspect dependency-tree diffs, rerun audits and all six standard CI workflows, then perform staging auth/payment/vehicle-image/file-upload/socket/native tests. Never merge a red or unverified security update.

**Rollbacks must preserve security:** if dependency fixes reach main before the ten-block valuation release, rebase the consolidated valuation candidate from the updated main, run the ten-block rollback simulation again and refresh expected legacy anchor checks where needed. Subsequent rollback of the valuation release must not revert the independent security patches.

**Current status:** precise advisory inventory collected, remediation simulation automated, production dependency fixes **not yet applied**, and the valuation release **not authorised**. Compatible staging database, real UK valuation source validation and native version rollback checks remain additional separate release blockers.
