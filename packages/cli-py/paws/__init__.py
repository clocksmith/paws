"""PAWS Python CLI - Context bundler and change applier"""
__version__ = "3.0.0"

import os
import sys
from pathlib import Path

# Resolve core resources path
_CORE_PKG = Path(__file__).parent.parent.parent / 'core'
PERSONAS_PATH = _CORE_PKG / 'personas'
SYS_PATH = _CORE_PKG / 'sys'
CONFIGS_PATH = _CORE_PKG / 'configs'
