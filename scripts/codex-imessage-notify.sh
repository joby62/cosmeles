#!/bin/zsh

set -euo pipefail

PROGRAM_NAME="${0:t}"
DEFAULT_PREFIX="${CODEX_NOTIFY_PREFIX:-[Codex]}"
DEFAULT_SERVICE="${CODEX_NOTIFY_SERVICE:-imessage}"

usage() {
  cat <<'EOF'
Usage:
  codex-imessage-notify.sh --check
  codex-imessage-notify.sh [--direct-only] [--to <phone-or-email>] [--service <imessage|auto>] [--prefix <text>] --message <text>
  codex-imessage-notify.sh [--direct-only] [--to <phone-or-email>] [--service <imessage|auto>] [--prefix <text>] [message words...]

Environment:
  CODEX_NOTIFY_TO        Default recipient. Use an iMessage phone number or Apple ID email.
  CODEX_NOTIFY_SERVICE   Optional. Defaults to "imessage". "auto" maps to "imessage" in V1.
  CODEX_NOTIFY_PREFIX    Optional. Defaults to "[Codex]".

Notes:
  AppleScript V1 sends via Messages directly first, then falls back to UI automation if needed.
  It does not support SMS routing.
  Message text is normalized to a single line before sending.

Examples:
  CODEX_NOTIFY_TO="+8613812345678" ./scripts/codex-imessage-notify.sh --check
  CODEX_NOTIFY_TO="+8613812345678" ./scripts/codex-imessage-notify.sh --message "Task finished"
  ./scripts/codex-imessage-notify.sh --to you@example.com --message "Approval needed"
EOF
}

fail() {
  print -u2 -- "$PROGRAM_NAME: $1"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

normalize_service() {
  local raw="${1:l}"
  if [[ -z "$raw" || "$raw" == "auto" ]]; then
    print -- "imessage"
    return 0
  fi
  if [[ "$raw" == "imessage" ]]; then
    print -- "$raw"
    return 0
  fi
  fail "AppleScript V1 only supports iMessage. Unsupported service: $1"
}

normalize_message() {
  print -rn -- "$1" | tr '\r\n\t' '   ' | tr -s ' ' | sed -e 's/^ //' -e 's/ $//'
}

build_default_message() {
  local prefix="$1"
  local now cwd branch
  now="$(date '+%Y-%m-%d %H:%M:%S')"
  cwd="$PWD"

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch="$(git branch --show-current 2>/dev/null || true)"
  else
    branch=""
  fi

  if [[ -n "$branch" ]]; then
    normalize_message "${prefix} task finished at ${now} :: ${cwd} :: ${branch}"
  else
    normalize_message "${prefix} task finished at ${now} :: ${cwd}"
  fi
}

run_osascript() {
  local -a osa_args
  osa_args=("$@")
  osascript "${osa_args[@]}"
}

print_permission_help() {
  local output="$1"

  if [[ "$output" == *"Not authorized to send Apple events to Messages"* || "$output" == *"(-1743)"* ]]; then
    cat >&2 <<'EOF'
AppleScript is not allowed to control Messages.

Allow the automation request when macOS prompts. If it was denied before:
  System Settings -> Privacy & Security -> Automation

Then enable control of "Messages" for the app or terminal process running this script.
EOF
    return 0
  fi

  if [[ "$output" == *"Not authorized to send Apple events to System Events"* ]]; then
    cat >&2 <<'EOF'
AppleScript is not allowed to control System Events.

Allow the automation request when macOS prompts. If it was denied before:
  System Settings -> Privacy & Security -> Automation

Then enable control of "System Events" for the app or terminal process running this script.
EOF
    return 0
  fi

  if [[ "$output" == *"not allowed assistive access"* || "$output" == *"(-25211)"* || "$output" == *"UI element scripting is not enabled"* ]]; then
    cat >&2 <<'EOF'
UI automation is not enabled for this script runner.

Enable Accessibility access for the app or terminal process running this script:
  System Settings -> Privacy & Security -> Accessibility
EOF
    return 0
  fi

  if [[ "$output" == *"Messages process is not available."* ]]; then
    cat >&2 <<'EOF'
Messages did not become available for UI automation.

Open Messages manually, confirm you are signed in to iMessage, then retry.
EOF
    return 0
  fi

  if [[ "$output" == *"Messages UI is not available."* ]]; then
    cat >&2 <<'EOF'
Messages launched, but its UI was not accessible yet.

Bring Messages to the foreground once, confirm it is signed in to iMessage, then retry.
EOF
    return 0
  fi

  if [[ "$output" == *"Application can't be found"* || "$output" == *"(-2700)"* || "$output" == *"(-10827)"* ]]; then
    cat >&2 <<'EOF'
This process could not reach macOS GUI automation APIs.

Retry the script from a normal GUI-capable runner first, such as Terminal.app or iTerm,
then grant the requested Automation and Accessibility permissions there.
EOF
    return 0
  fi

  return 1
}

print_service_help() {
  local output="$1"

  if [[ "$output" == *"No signed-in iMessage service is available."* ]]; then
    cat >&2 <<'EOF'
No signed-in iMessage service is available in Messages.

Open Messages, confirm this Mac is signed in to iMessage, then retry.
EOF
    return 0
  fi

  if [[ "$output" == *"Can’t get buddy"* || "$output" == *"Can't get buddy"* || "$output" == *"Can’t get participant"* || "$output" == *"Can't get participant"* ]]; then
    cat >&2 <<'EOF'
The recipient was not resolved as an iMessage target in Messages.

This script only supports iMessage, not plain SMS. If this number shows as a green SMS target
in Messages, direct sending will not work. Try one of these:
  1. Use the recipient's Apple ID email instead of the phone number
  2. Manually send one blue iMessage to this recipient in Messages first
  3. Confirm the target is actually registered to iMessage on Apple's network
EOF
    return 0
  fi

  return 1
}

probe_messages_access() {
  local output=""
  local exit_code=0

  set +e
  output="$(
    run_osascript \
      -e 'tell application "Messages"' \
      -e 'set availableServices to every service whose service type is iMessage' \
      -e 'if (count of availableServices) is 0 then error "No signed-in iMessage service is available."' \
      -e 'return id of item 1 of availableServices' \
      -e 'end tell' 2>&1
  )"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    return 0
  fi

  if ! print_service_help "$output" && ! print_permission_help "$output"; then
    [[ -n "$output" ]] && print -u2 -- "$output"
  fi
  return 1
}

direct_send_message() {
  local recipient="$1"
  local message="$2"
  local output=""
  local exit_code=0

  set +e
  output="$(
    run_osascript \
      -e 'on run argv' \
      -e 'set recipientHandle to item 1 of argv' \
      -e 'set messageText to item 2 of argv' \
      -e 'tell application "Messages"' \
      -e 'set availableServices to every service whose service type is iMessage' \
      -e 'if (count of availableServices) is 0 then error "No signed-in iMessage service is available."' \
      -e 'set targetService to item 1 of availableServices' \
      -e 'set targetBuddy to buddy recipientHandle of targetService' \
      -e 'send messageText to targetBuddy' \
      -e 'return "sent-direct to " & recipientHandle' \
      -e 'end tell' \
      -e 'end run' \
      -- "$recipient" "$message" 2>&1
  )"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    print -- "$output"
    return 0
  fi

  [[ -n "$output" ]] && print -u2 -- "$output"
  return 1
}

ui_send_message() {
  local recipient="$1"
  local message="$2"
  local output=""
  local exit_code=0

  set +e
  output="$(
    run_osascript \
      -e 'on run argv' \
      -e 'set recipientHandle to item 1 of argv' \
      -e 'set messageText to item 2 of argv' \
      -e 'set priorClipboard to missing value' \
      -e 'try' \
      -e 'set priorClipboard to the clipboard' \
      -e 'end try' \
      -e 'try' \
      -e 'tell application "Messages" to activate' \
      -e 'delay 0.8' \
      -e 'tell application "System Events"' \
      -e 'if not (exists process "Messages") then error "Messages process is not available."' \
      -e 'tell process "Messages"' \
      -e 'set frontmost to true' \
      -e 'if not (exists menu bar 1) then error "Messages UI is not available."' \
      -e 'end tell' \
      -e 'keystroke "n" using command down' \
      -e 'delay 0.6' \
      -e 'set the clipboard to recipientHandle' \
      -e 'keystroke "v" using command down' \
      -e 'delay 0.8' \
      -e 'key code 36' \
      -e 'delay 0.8' \
      -e 'set the clipboard to messageText' \
      -e 'keystroke "v" using command down' \
      -e 'delay 0.4' \
      -e 'key code 36' \
      -e 'end tell' \
      -e 'if priorClipboard is not missing value then set the clipboard to priorClipboard' \
      -e 'return "sent-ui to " & recipientHandle' \
      -e 'on error errMsg number errNum' \
      -e 'try' \
      -e 'if priorClipboard is not missing value then set the clipboard to priorClipboard' \
      -e 'end try' \
      -e 'error errMsg number errNum' \
      -e 'end try' \
      -e 'end run' \
      -- "$recipient" "$message" 2>&1
  )"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    print -- "$output"
    return 0
  fi

  if ! print_service_help "$output" && ! print_permission_help "$output"; then
    [[ -n "$output" ]] && print -u2 -- "$output"
  fi
  return 1
}

send_message() {
  local recipient="$1"
  local message="$2"
  local direct_only="$3"
  local output=""

  set +e
  output="$(direct_send_message "$recipient" "$message" 2>&1)"
  local direct_exit_code=$?
  set -e

  if [[ $direct_exit_code -eq 0 ]]; then
    print -- "$output"
    return 0
  fi

  if [[ "$direct_only" == "1" ]]; then
    if ! print_service_help "$output" && ! print_permission_help "$output"; then
      cat >&2 <<'EOF'
Direct iMessage send failed.
EOF
    fi
    if [[ -n "$output" ]]; then
      print -u2 -- ""
      print -u2 -- "Underlying AppleScript error:"
      print -u2 -- "$output"
    fi
    return 1
  fi

  if [[ "$output" == *"No signed-in iMessage service is available."* ]]; then
    print_service_help "$output" >/dev/null
    return 1
  fi

  if [[ "$output" == *"Not authorized to send Apple events to Messages"* || "$output" == *"(-1743)"* ]]; then
    print_permission_help "$output" >/dev/null
    return 1
  fi

  if [[ "$output" == *"Can’t get buddy"* || "$output" == *"Can't get buddy"* || "$output" == *"Can’t get participant"* || "$output" == *"Can't get participant"* ]]; then
    ui_send_message "$recipient" "$message"
    return $?
  fi

  ui_send_message "$recipient" "$message"
}

main() {
  require_command osascript

  local recipient="${CODEX_NOTIFY_TO:-}"
  local service="$DEFAULT_SERVICE"
  local prefix="$DEFAULT_PREFIX"
  local message=""
  local mode="send"
  local direct_only="0"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check)
        mode="check"
        shift
        ;;
      --direct-only)
        direct_only="1"
        shift
        ;;
      --to)
        [[ $# -ge 2 ]] || fail "--to requires a value"
        recipient="$2"
        shift 2
        ;;
      --service)
        [[ $# -ge 2 ]] || fail "--service requires a value"
        service="$2"
        shift 2
        ;;
      --prefix)
        [[ $# -ge 2 ]] || fail "--prefix requires a value"
        prefix="$2"
        shift 2
        ;;
      --message)
        [[ $# -ge 2 ]] || fail "--message requires a value"
        message="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      --)
        shift
        break
        ;;
      *)
        if [[ -z "$message" ]]; then
          message="$1"
        else
          message="${message} $1"
        fi
        shift
        ;;
    esac
  done

  service="$(normalize_service "$service")"
  [[ "$service" == "imessage" ]] || fail "unexpected normalized service: $service"

  if [[ "$mode" == "check" ]]; then
    probe_messages_access
    print -- "Messages iMessage service looks available."
    exit 0
  fi

  [[ -n "$recipient" ]] || fail "missing recipient. Set CODEX_NOTIFY_TO or pass --to"

  if [[ -z "$message" ]]; then
    message="$(build_default_message "$prefix")"
  elif [[ -n "$prefix" ]]; then
    message="$(normalize_message "${prefix} ${message}")"
  else
    message="$(normalize_message "$message")"
  fi

  [[ -n "$message" ]] || fail "message is empty after normalization"

  probe_messages_access
  send_message "$recipient" "$message" "$direct_only"
}

main "$@"
