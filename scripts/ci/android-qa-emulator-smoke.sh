#!/usr/bin/env bash
# Boot-only smoke test for a separately installed, read-only CarMazium QA APK.
# Do not log in, send messages, click purchase controls, or call mutating APIs.
set -euo pipefail

cd "${GITHUB_WORKSPACE:?}"
readonly APK="$GITHUB_WORKSPACE/qa-apk/CarMazium-QA-Android.apk"
readonly APP_ID='uk.carmazium.qa'
readonly RESULTS="$GITHUB_WORKSPACE/qa-emulator-results"
mkdir -p "$RESULTS"

if [[ ! -s "$APK" ]]; then
  echo '::error::CarMazium QA APK not found in the preceding build artifact.'
  exit 1
fi

# A normal x86_64 GitHub emulator cannot install an ARM64-only APK.
if ! unzip -Z1 "$APK" | grep -E '^lib/x86_64/[^/]+[.]so$' > /dev/null; then
  echo '::error::The APK has no x86_64 JNI libraries; check the Gradle ABI selection.'
  exit 1
fi

adb wait-for-device
adb shell getprop sys.boot_completed | grep -q 1
adb install -r "$APK"
adb shell pm path "$APP_ID" | grep -q 'package:'
adb logcat -c || true

set +e
adb shell am start -W -n "$APP_ID/.MainActivity" > "$RESULTS/startup.txt" 2>&1
start_status=$?
set -e
if [[ "$start_status" != 0 ]]; then
  echo '::error::Android launch intent failed. See startup.txt artifact.'
  exit 1
fi

sleep 25
pid="$(adb shell pidof "$APP_ID" | tr -d '[:space:]' || true)"
if [[ -z "$pid" ]]; then
  echo '::error::CarMazium QA application did not remain running after 25 seconds.'
  # Never upload broad raw logcat: it can contain access tokens and user data.
  adb logcat -d -v brief -s AndroidRuntime:E ReactNativeJS:E | tail -60 || true
  exit 1
fi

# A running PID alone is NOT a usable screen. A launcher/system ANR dialog
# can appear above a live CarMazium Activity. Fail closed when another focused
# window is reported. On Android 15, 'dumpsys window windows' can omit
# mCurrentFocus even while the launched activity is visibly foreground.
# In that specific case, verify ActivityTaskManager's top resumed activity
# instead of incorrectly rejecting a working, visibly launched app.
focus="$(adb shell dumpsys window windows 2>/dev/null | grep -m 1 -E 'mCurrentFocus=|mFocusedWindow=' | tr -d '\r' || true)"
if [[ -z "$focus" ]]; then
  focus="$(adb shell dumpsys window 2>/dev/null | grep -m 1 -E 'mCurrentFocus=|mFocusedWindow=' | tr -d '\r' || true)"
fi
resumed="$(adb shell dumpsys activity activities 2>/dev/null | grep -m 1 -E 'topResumedActivity=|mResumedActivity:|ResumedActivity:' | tr -d '\r' || true)"
printf 'window: %s\nresumed: %s\n' "$focus" "$resumed" > "$RESULTS/focused-window.txt"
if [[ -n "$focus" && "$focus" != *"$APP_ID"* ]] ||
   [[ -z "$focus" && "$resumed" != *"$APP_ID"* ]]; then
  echo "::error::QA app process is alive but Android does not report CarMazium as the foreground activity."
  echo "::error::Expected foreground package $APP_ID. Window/activity details saved to the private emulator report."
  adb exec-out screencap -p > "$RESULTS/logged-out-launch.png" || true
  exit 1
fi

# Capture only the logged-out app launch screen. Artifacts remain private to
# authorised repository collaborators; do not capture authenticated sessions.
adb exec-out screencap -p > "$RESULTS/logged-out-launch.png"
python3 - "$RESULTS/logged-out-launch.png" <<'PY'
import sys
from pathlib import Path
image = Path(sys.argv[1]).read_bytes()
if not image.startswith(bytes.fromhex('89504e470d0a1a0a')) or len(image) < 6000:
    raise SystemExit('Emulator screenshot missing, too small, or not a PNG')
print(f"Captured logged-out emulator screenshot: {len(image)} bytes")
PY

echo "$GITHUB_SHA" > "$RESULTS/source-commit.txt"
adb shell getprop ro.build.version.release | tr -d '[:space:]' > "$RESULTS/emulator-android-version.txt"
sha256sum "$APK" > "$RESULTS/app-sha256.txt"

{
  echo '### CarMazium QA — Android emulator cold-launch smoke test'
  echo "- APK source commit: $GITHUB_SHA"
  echo '- Package: `uk.carmazium.qa`'
  echo '- ABI: x86_64 emulator; APK supports arm64 phones and x86_64 emulator'
  echo '- Installed: yes'
  echo '- MainActivity cold launch and foreground focus: passed'
  echo '- Process alive after 25s: yes'
  echo '- Screenshot: saved in private `CarMazium-QA-Emulator-Report` artifact'
  echo '- No sign-in, payment, bid, chat or seller transaction attempted'
  echo '- **Not** a certification of screen parity, customer workflows, or real Android/iOS phone QA.'
} >> "$GITHUB_STEP_SUMMARY"
