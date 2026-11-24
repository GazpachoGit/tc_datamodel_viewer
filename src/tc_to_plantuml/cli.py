import argparse
from datetime import datetime
from pathlib import Path
import sys
from xml.etree import ElementTree

import yaml

from .reader import load_mapping, mapping_path, read_model
from .renderer import render_model


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert Teamcenter XML files to PlantUML")
    parser.add_argument("directory", type=Path, help="directory containing XML files")
    parser.add_argument("--mapping", type=Path, help="path to the YAML mapping file")
    args = parser.parse_args()

    try:
        directory: Path = args.directory
        if not directory.is_dir():
            raise ValueError(f"Not a directory: {directory}")
        paths = sorted(
            (path for path in directory.iterdir() if path.is_file() and path.suffix.lower() == ".xml"),
            key=lambda path: path.name,
        )
        if not paths:
            raise ValueError(f"No XML files found in {directory}")
        selected_mapping = args.mapping if args.mapping is not None else mapping_path()
        model = read_model(paths, load_mapping(selected_mapping))
        output = directory / f"model_{datetime.now():%Y%m%d_%H%M%S}.puml"
        output.write_text(render_model(model), encoding="utf-8")
    except (OSError, ValueError, ElementTree.ParseError, yaml.YAMLError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(output)
    return 0
