#!/usr/bin/env python3
"""
CLI entry point for the clinical triage pipeline (two agents: triage → care plan).

Usage:
    python triage_agents.py "Patient is a 54yo male with chest pain, HR 110 bpm, BP 145/92..."
    python triage_agents.py --debug "..."
    echo "paragraph..." | python triage_agents.py

Output: single JSON with vitals, news2, triage, care_plan.

The pipeline uses Mistral only. Pull the model before running or using the API:
    ollama pull mistral
"""
import os
import sys

# Run from backend so app is importable
_backend = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from app.services.triage_pipeline import main

if __name__ == "__main__":
    main()
