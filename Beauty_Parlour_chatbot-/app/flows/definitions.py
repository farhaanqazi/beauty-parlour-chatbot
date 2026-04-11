from __future__ import annotations

from copy import deepcopy
from typing import Any


BASE_FLOW_CONFIG: dict[str, Any] = {
    "greeting": "Welcome to {salon_name}! I can help you book your appointment.",
    "languages": [
        {"id": "english", "label": "English", "aliases": ["english", "en"]},
        {"id": "hindi", "label": "Hindi", "aliases": ["hindi", "hi", "hindi please"]},
        {"id": "hinglish", "label": "Hinglish", "aliases": ["hinglish", "roman hindi"]},
        {"id": "telugu", "label": "Telugu", "aliases": ["telugu", "te"]},
    ],
    "marriage_types": [
        {"id": "hindu", "label": "Hindu", "aliases": ["hindu"]},
        {"id": "christian", "label": "Christian", "aliases": ["christian"]},
        {"id": "muslim", "label": "Muslim", "aliases": ["muslim"]},
    ],
    "ask_sample_images": True,
    "confirmation_template": (
        "Please confirm your appointment:\n"
        "Service: {service}\n"
        "Date: {date}\n"
        "Time: {time}\n"
        "Reply YES to confirm or NO to cancel."
    ),
}

YES_TOKENS = {
    "yes",
    "y",
    "haan",
    "ha",
    "show",
    "ok",
    "okay",
    "sure",
    "send",
    "yes please",
}
NO_TOKENS = {
    "no",
    "n",
    "nahi",
    "nah",
    "skip",
    "dont",
    "don't",
    "no thanks",
}
RESET_TOKENS = {"restart", "start", "menu", "reset", "start over", "hi", "hello"}


def build_flow_config(salon_flow_config: dict[str, Any] | None) -> dict[str, Any]:
    merged = deepcopy(BASE_FLOW_CONFIG)
    if not salon_flow_config:
        return merged

    for key, value in salon_flow_config.items():
        merged[key] = value
    return merged
