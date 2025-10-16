#!/usr/bin/env python3
"""Setup script for PAWS Python CLI (backwards compatibility)"""

from setuptools import setup, find_packages

setup(
    name="paws-cli",
    version="3.0.0",
    packages=find_packages(),
    python_requires=">=3.8",
)
