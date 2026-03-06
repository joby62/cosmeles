# Codex iMessage Notify

This repo includes a minimal AppleScript V1 notifier for Codex task completion:

`/Users/lijiabo/Documents/New project/scripts/codex-imessage-notify.sh`

It uses `osascript` plus macOS UI automation against `Messages` and `System Events`. This replaces the earlier `imsg/chat.db` idea and avoids `Full Disk Access`.

## What V1 does

V1 is only:

`task finished -> send me an iMessage`

It does not watch Codex approval dialogs or app state. Approval reminders still need a separate watcher outside this script.

## Requirements

1. `Messages` must already be signed in to iMessage on this Mac.
2. The app or terminal process running the script must be allowed to control `Messages`.
3. The app or terminal process running the script must have Accessibility access so `System Events` can drive the UI.

On first use, macOS may prompt for both Automation and Accessibility permissions.

## Setup

Set the default recipient before calling the script:

```bash
export CODEX_NOTIFY_TO="+8613812345678"
```

Optional:

```bash
export CODEX_NOTIFY_SERVICE="imessage"
export CODEX_NOTIFY_PREFIX="[Codex]"
```

`auto` currently maps to `imessage` in V1. `sms` is intentionally unsupported in this AppleScript version.

## Health Check

Run:

```bash
./scripts/codex-imessage-notify.sh --check
```

If macOS prompts:

- allow control of `Messages`
- allow control of `System Events`
- allow Accessibility access for the runner

If permissions were denied before, fix them in:

- `System Settings -> Privacy & Security -> Automation`
- `System Settings -> Privacy & Security -> Accessibility`

If a heavily sandboxed runner cannot reach Apple events at all, verify once from `Terminal.app` or `iTerm` first.

## Send a Test Message

```bash
CODEX_NOTIFY_TO="+8613812345678" ./scripts/codex-imessage-notify.sh --message "test notification"
```

Or rely on the default message:

```bash
CODEX_NOTIFY_TO="+8613812345678" ./scripts/codex-imessage-notify.sh
```

The default body is normalized to one line and includes:

- timestamp
- current working directory
- current git branch when available

## Notes

- This V1 uses keyboard-driven UI automation. It is intentionally simple and is meant for one-way self-notifications.
- Message text is normalized to a single line before sending. Keep the payload short.
- If recipient resolution is inconsistent, test with the exact iMessage phone number or Apple ID email you use in `Messages`.

## How to Use with Codex

For V1, Codex should call this script at the end of a task:

```bash
CODEX_NOTIFY_TO="+8613812345678" ./scripts/codex-imessage-notify.sh --message "Task finished"
```
