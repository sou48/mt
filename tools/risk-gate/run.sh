#!/usr/bin/env bash
set -euo pipefail

MODE="local"
SCOPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --scope)
      SCOPE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [[ -f ".risk-gate.conf" ]]; then
  # shellcheck source=/dev/null
  source ".risk-gate.conf"
fi

RISK_GATE_NAME="${RISK_GATE_NAME:-$(basename "$REPO_ROOT")}"
export RISK_GATE_MODE="$MODE"
RISK_GATE_EXCLUDE_DIRS=("${RISK_GATE_EXCLUDE_DIRS[@]:-.git}")
RISK_GATE_SCAN_EXCLUDE_PATHS=("${RISK_GATE_SCAN_EXCLUDE_PATHS[@]:-}")
RISK_GATE_SECRET_PATTERNS=("${RISK_GATE_SECRET_PATTERNS[@]:-}")
RISK_GATE_FAIL_PATTERNS=("${RISK_GATE_FAIL_PATTERNS[@]:-}")
RISK_GATE_WARN_PATTERNS=("${RISK_GATE_WARN_PATTERNS[@]:-}")
RISK_GATE_REVIEW_PATHS=("${RISK_GATE_REVIEW_PATHS[@]:-}")
RISK_GATE_REQUIRED_COMMANDS=("${RISK_GATE_REQUIRED_COMMANDS[@]:-}")
RISK_GATE_OPTIONAL_COMMANDS=("${RISK_GATE_OPTIONAL_COMMANDS[@]:-}")

FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

print_section() {
  printf '\n[%s] %s\n' "$1" "$2"
}

pass() {
  printf 'PASS  %s\n' "$1"
}

warn() {
  printf 'WARN  %s\n' "$1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
  printf 'SKIP  %s\n' "$1"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

default_scope_for_mode() {
  case "$MODE" in
    ci) echo "all" ;;
    pre-push) echo "branch" ;;
    *)
      if git diff --cached --quiet --ignore-submodules --; then
        echo "changes"
      else
        echo "staged"
      fi
      ;;
  esac
}

SCOPE="${SCOPE:-$(default_scope_for_mode)}"

collect_files() {
  local -a raw=()

  case "$SCOPE" in
    staged)
      mapfile -t raw < <(git diff --cached --name-only --diff-filter=ACMR)
      ;;
    changes)
      mapfile -t raw < <(
        {
          git diff --name-only --diff-filter=ACMR HEAD
          git ls-files --others --exclude-standard
        } | awk 'NF' | sort -u
      )
      ;;
    branch)
      if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
        mapfile -t raw < <(git diff --name-only --diff-filter=ACMR '@{upstream}'...HEAD)
      else
        mapfile -t raw < <(git ls-files)
      fi
      ;;
    all)
      mapfile -t raw < <(git ls-files)
      ;;
    *)
      echo "Unknown scope: $SCOPE" >&2
      exit 2
      ;;
  esac

  local -a filtered=()
  local item excluded dir
  for item in "${raw[@]}"; do
    [[ -z "$item" ]] && continue
    [[ -f "$item" ]] || continue
    excluded=0
    for dir in "${RISK_GATE_EXCLUDE_DIRS[@]}"; do
      [[ -z "$dir" ]] && continue
      if [[ "$item" == "$dir"/* || "$item" == */"$dir"/* ]]; then
        excluded=1
        break
      fi
    done
    [[ $excluded -eq 1 ]] && continue
    filtered+=("$item")
  done

  printf '%s\n' "${filtered[@]}"
}

mapfile -t TARGET_FILES < <(collect_files)

collect_review_files() {
  local original_scope="$SCOPE"

  if [[ "$SCOPE" == "all" ]]; then
    if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
      SCOPE="branch"
    else
      SCOPE="changes"
    fi
  fi

  collect_files
  SCOPE="$original_scope"
}

mapfile -t REVIEW_FILES < <(collect_review_files)

filter_scan_files() {
  local -a filtered=()
  local item exclude_path is_excluded
  for item in "${TARGET_FILES[@]}"; do
    is_excluded=0
    for exclude_path in "${RISK_GATE_SCAN_EXCLUDE_PATHS[@]}"; do
      [[ -z "$exclude_path" ]] && continue
      if [[ "$item" == "$exclude_path" || "$item" == "$exclude_path"/* ]]; then
        is_excluded=1
        break
      fi
    done
    [[ $is_excluded -eq 1 ]] && continue
    filtered+=("$item")
  done
  printf '%s\n' "${filtered[@]}"
}

mapfile -t SCAN_FILES < <(filter_scan_files)

print_section "risk-gate" "project=$RISK_GATE_NAME mode=$MODE scope=$SCOPE"
if [[ ${#TARGET_FILES[@]} -eq 0 ]]; then
  pass "No files matched the selected scope; command checks only"
else
  pass "Scanning ${#TARGET_FILES[@]} file(s)"
fi

run_pattern_checks() {
  local severity="$1"
  shift
  local -a rules=("$@")
  local spec label pattern
  local hit_output

  for spec in "${rules[@]}"; do
    [[ -z "$spec" ]] && continue
    label="${spec%%:::*}"
    pattern="${spec#*:::}"
    [[ "$pattern" == "$spec" ]] && continue

    if [[ ${#SCAN_FILES[@]} -eq 0 ]]; then
      continue
    fi

    hit_output="$(rg -n -I -e "$pattern" "${SCAN_FILES[@]}" 2>/dev/null || true)"
    if [[ -n "$hit_output" ]]; then
      if [[ "$severity" == "fail" ]]; then
        fail "$label"
      else
        warn "$label"
      fi
      printf '%s\n' "$hit_output" | sed 's/^/  > /'
    else
      pass "$label"
    fi
  done
}

run_review_path_checks() {
  local spec path note file
  for spec in "${RISK_GATE_REVIEW_PATHS[@]}"; do
    [[ -z "$spec" ]] && continue
    path="${spec%%:::*}"
    note="${spec#*:::}"
    for file in "${REVIEW_FILES[@]}"; do
      if [[ "$file" == "$path" || "$file" == "$path"/* ]]; then
        warn "$note ($file)"
      fi
    done
  done
}

run_command_checks() {
  local severity="$1"
  shift
  local -a commands=("$@")
  local spec label prereq command

  for spec in "${commands[@]}"; do
    [[ -z "$spec" ]] && continue
    label="${spec%%:::*}"
    prereq="${spec#*:::}"
    prereq="${prereq%%:::*}"
    command="${spec##*:::}"

    if [[ "$label" == "$spec" || "$prereq" == "$command" ]]; then
      skip "$label (invalid command spec)"
      continue
    fi

    if ! bash -lc "$prereq" >/dev/null 2>&1; then
      skip "$label (prerequisite not met)"
      continue
    fi

    if bash -lc "$command" >/tmp/risk-gate-command.log 2>&1; then
      pass "$label"
    else
      if [[ "$severity" == "fail" ]]; then
        fail "$label"
      else
        warn "$label"
      fi
      sed 's/^/  > /' /tmp/risk-gate-command.log
    fi
  done
}

print_section "scan" "secret / risky pattern checks"
run_pattern_checks fail "${RISK_GATE_SECRET_PATTERNS[@]}"
run_pattern_checks fail "${RISK_GATE_FAIL_PATTERNS[@]}"
run_pattern_checks warn "${RISK_GATE_WARN_PATTERNS[@]}"
run_review_path_checks

print_section "commands" "required and optional command checks"
run_command_checks fail "${RISK_GATE_REQUIRED_COMMANDS[@]}"
run_command_checks warn "${RISK_GATE_OPTIONAL_COMMANDS[@]}"

print_section "summary" "fail=$FAIL_COUNT warn=$WARN_COUNT skip=$SKIP_COUNT"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "risk-gate result: FAIL"
  exit 1
fi

if [[ $WARN_COUNT -gt 0 ]]; then
  echo "risk-gate result: WARN"
  exit 0
fi

echo "risk-gate result: PASS"
