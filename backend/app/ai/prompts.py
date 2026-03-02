import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.ai.errors import AIServiceError

PROMPTS_ROOT = Path(__file__).resolve().parent / "prompts"

DEFAULT_PROMPT_VERSIONS = {
    "doubao.stage1_vision": "v1",
    "doubao.stage2_struct": "v1",
    "doubao.ingredient_enrich": "v1",
    "doubao.image_json_consistency": "v1",
    "doubao.product_dedup_decision": "v1",
}

_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


@dataclass
class PromptBundle:
    key: str
    version: str
    text: str


def load_prompt(prompt_key: str, prompt_version: str | None = None) -> PromptBundle:
    version = prompt_version or DEFAULT_PROMPT_VERSIONS.get(prompt_key)
    if not version:
        raise AIServiceError(
            code="prompt_version_missing",
            message=f"Prompt version is missing for key '{prompt_key}'.",
            http_status=500,
        )

    key_path = Path(*prompt_key.split("."))
    md_path = PROMPTS_ROOT / key_path / f"{version}.md"
    txt_path = PROMPTS_ROOT / key_path / f"{version}.txt"
    path = md_path if md_path.exists() else txt_path
    if not path.exists():
        raise AIServiceError(
            code="prompt_not_found",
            message=f"Prompt not found: key={prompt_key}, version={version}.",
            http_status=500,
        )

    return PromptBundle(key=prompt_key, version=version, text=path.read_text(encoding="utf-8").strip())


def render_prompt(template: str, context: dict[str, Any]) -> str:
    def _replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in context:
            raise AIServiceError(
                code="prompt_param_missing",
                message=f"Prompt parameter '{name}' is missing.",
                http_status=400,
            )
        value = context[name]
        return str(value if value is not None else "")

    rendered = _PLACEHOLDER.sub(_replace, template)
    leftovers = _PLACEHOLDER.findall(rendered)
    if leftovers:
        raise AIServiceError(
            code="prompt_param_unresolved",
            message=f"Unresolved prompt parameters: {', '.join(sorted(set(leftovers)))}.",
            http_status=500,
        )
    return rendered
