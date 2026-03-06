#!/bin/zsh

set -euo pipefail

PROGRAM_NAME="${0:t}"
DEFAULT_PREFIX="${CODEX_NOTIFY_PREFIX:-[Codex]}"
DEFAULT_SERVICE="${CODEX_NOTIFY_SERVICE:-imessage}"

usage() {
  cat <<'EOF'
Usage:
  codex-imessage-notify.sh --check
  codex-imessage-notify.sh [--to <phone-or-email>] [--service <imessage|auto>] [--prefix <text>] --message <text>
  codex-imessage-notify.sh [--to <phone-or-email>] [--service <imessage|auto>] [--prefix <text>] [message words...]

Environment:
  CODEX_NOTIFY_TO        Default recipient. Use an iMessage phone number or Apple ID email.
  CODEX_NOTIFY_SERVICE   Optional. Defaults to "imessage". "auto" maps to "imessage" in V1.
  CODEX_NOTIFY_PREFIX    Optional. Defaults to "[Codex]".

Notes:
  AppleScript V1 uses Messages UI automation. It does not support SMS routing.
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

  if [[ "$output" == *"Accessibility access for the script runner is not enabled."* || "$output" == *"UI element scripting is not enabled"* ]]; then
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

  if [[ "$output" == *"Application can't be found"* || "$output" == *"(-2700)"* || "$output" == *"(-1728)"* || "$output" == *"(-10827)"* ]]; then
    cat >&2 <<'EOF'
This process could not reach macOS GUI automation APIs.

Retry the script from a normal GUI-capable runner first, such as Terminal.app or iTerm,
then grant the requested Automation and Accessibility permissions there.
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
      -e 'tell application "Messages" to activate' \
      -e 'delay 0.5' \
      -e 'tell application "System Events"' \
      -e 'if UI elements enabled is false then error "Accessibility access for the script runner is not enabled."' \
      -e 'if not (exists process "Messages") then error "Messages process is not available."' \
      -e 'end tell' 2>&1
  )"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    return 0
  fi

  if ! print_permission_help "$output"; then
    [[ -n "$output" ]] && print -u2 -- "$output"
  fi
  return 1
}

send_message() {
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
      -e 'tell application "Messages" to activate' \
      -e 'delay 0.8' \
      -e 'tell application "System Events"' \
      -e 'if UI elements enabled is false then error "Accessibility access for the script runner is not enabled."' \
      -e 'if not (exists process "Messages") then error "Messages process is not available."' \
      -e 'keystroke "n" using command down' \
      -e 'delay 0.5' \
      -e 'keystroke recipientHandle' \
      -e 'delay 0.5' \
      -e 'key code 36' \
      -e 'delay 0.5' \
      -e 'key code 48' \
      -e 'delay 0.3' \
      -e 'keystroke messageText' \
      -e 'delay 0.3' \
      -e 'key code 36' \
      -e 'end tell' \
      -e 'return "sent to " & recipientHandle' \
      -e 'end run' \
      -- "$recipient" "$message" 2>&1
  )"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    print -- "$output"
    return 0
  fi

  if ! print_permission_help "$output"; then
    [[ -n "$output" ]] && print -u2 -- "$output"
  fi
  return 1
}

main() {
  require_command osascript

  local recipient="${CODEX_NOTIFY_TO:-}"
  local service="$DEFAULT_SERVICE"
  local prefix="$DEFAULT_PREFIX"
  local message=""
  local mode="send"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check)
        mode="check"
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
    print -- "Messages UI automation looks available for iMessage notifications."
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
  send_message "$recipient" "$message"
}

main "$@"
