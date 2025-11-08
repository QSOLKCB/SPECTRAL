#!/usr/bin/env python3
"""
Script to add or update the unified QSOL IMC citation block in README.md files.
Reads metadata from .zenodo.json and generates the citation section.

Usage:
    python update_citation.py

This script will:
1. Read .zenodo.json for project metadata
2. Check if README.md has a citation section
3. Add or update the citation section with proper DOI badges
"""

import json
import re
from pathlib import Path
from typing import Optional, List, Dict


def load_zenodo_metadata(zenodo_path: Path) -> Optional[Dict]:
    """Load and parse .zenodo.json file."""
    if not zenodo_path.exists():
        return None
    
    with open(zenodo_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_dois_from_zenodo(metadata: Dict) -> List[str]:
    """Extract DOI identifiers from zenodo metadata."""
    dois = []
    
    if 'related_identifiers' in metadata:
        for identifier in metadata['related_identifiers']:
            id_str = identifier.get('identifier', '')
            # Extract DOI from URL or direct DOI string
            if 'doi.org' in id_str:
                doi_match = re.search(r'10\.\d+/[^\s]+', id_str)
                if doi_match:
                    dois.append(doi_match.group(0))
            elif id_str.startswith('10.'):
                dois.append(id_str)
    
    return dois


def generate_citation_block(metadata: Optional[Dict] = None) -> str:
    """Generate the unified citation block with dynamic metadata."""
    
    # Default values
    license_text = "Apache 2.0 (unless otherwise noted)"
    
    # Extract metadata if available
    if metadata:
        license_text = metadata.get('license', 'Apache-2.0').replace('-', ' ')
        if not license_text.startswith('Apache'):
            license_text = f"{license_text} (unless otherwise noted)"
    
    # Extract DOIs
    dois = extract_dois_from_zenodo(metadata) if metadata else []
    
    # Build badge lines
    badge_lines = [
        '[![DOI: 10.5281/zenodo.17510649](https://zenodo.org/badge/DOI/10.5281/zenodo.17510649.svg)](https://doi.org/10.5281/zenodo.17510649)',
        '[![QSOL IMC GitHub](https://img.shields.io/badge/QSOL-IMC-GitHub-000.svg?logo=github)](https://github.com/QSOLKCB)'
    ]
    
    # Add project-specific DOI badges
    # Check for Spectral Algebraics DOI
    spectral_doi = None
    aimm_doi = None
    
    for doi in dois:
        if doi and doi != '10.5281/zenodo.17510649':
            if not spectral_doi:
                spectral_doi = doi
            elif not aimm_doi:
                aimm_doi = doi
    
    # Add Spectral Algebraics badge (use placeholder if not found)
    if spectral_doi and spectral_doi != '10.xxxx/zenodo.xxxxx':
        badge_lines.append(f'[![Spectral Algebraics DOI](https://zenodo.org/badge/DOI/{spectral_doi}.svg)](https://doi.org/{spectral_doi})')
    else:
        badge_lines.append('[![Spectral Algebraics DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)')
    
    # Add AIMM badge (use placeholder if not found)
    if aimm_doi and aimm_doi != '10.xxxx/zenodo.xxxxx':
        badge_lines.append(f'[![AIMM DOI](https://zenodo.org/badge/DOI/{aimm_doi}.svg)](https://doi.org/{aimm_doi})')
    else:
        badge_lines.append('[![AIMM DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YYYYYYY.svg)](https://doi.org/10.5281/zenodo.YYYYYYY)')
    
    badges = '\n'.join(badge_lines)
    
    citation_block = f"""## 🧭 Cite This Work

All components of the **QSOL IMC Research Framework** — including *Spectral Algebraics*, *Unified Field Framework (UFF)*, *Quantum Error Correction (QEC)*, and *Artificial Intelligence Mind-Mapping (AIMM)* — are openly published and citable via Zenodo.  
If you use or reference these projects, please cite them as follows:

> **Slade, Trent (QSOL-IMC).**  
> *QSOL Research Suite: Unified Field, Spectral Algebraics, and Cognitive Instruments.*  
> Zenodo (2025). https://doi.org/10.5281/zenodo.17510649 *(and associated DOIs)*  
>  
> This suite includes:  
> • **Spectral Algebraics** — E8-based audio-visual synthesis toolkit.  
> • **Unified Field Framework (UFF)** — cosmological and field-theory modeling environment.  
> • **Quantum Error Correction (QEC)** — fault-tolerant codebench and spectral sonification library.  
> • **AIMM** — cognitive markup and AI reasoning framework (Cognitive Instruments v2.0.0).  

**License:** {license_text}  
**Author:** Trent Slade (ORCID 0009-0002-4515-9237)  
**Organization:** [QSOL IMC](https://qsolimc.site) — Quantum-Secure Optical Logic / Integrated Media Collective  

{badges}
"""
    
    return citation_block


def has_citation_section(readme_content: str) -> bool:
    """Check if README already has a citation section."""
    return '## 🧭 Cite This Work' in readme_content


def add_citation_to_readme(readme_path: Path, zenodo_path: Path) -> bool:
    """Add or update citation block in README.md."""
    
    # Load zenodo metadata
    metadata = load_zenodo_metadata(zenodo_path)
    
    # Generate citation block
    citation_block = generate_citation_block(metadata)
    
    # Read current README
    if not readme_path.exists():
        print(f"README.md not found at {readme_path}")
        return False
    
    with open(readme_path, 'r', encoding='utf-8') as f:
        readme_content = f.read()
    
    # Check if citation section already exists
    if has_citation_section(readme_content):
        print("Citation section already exists. Updating...")
        # Find and replace the existing section
        pattern = r'## 🧭 Cite This Work.*?(?=\n##|\Z)'
        updated_content = re.sub(pattern, citation_block.rstrip(), readme_content, flags=re.DOTALL)
    else:
        print("Adding new citation section...")
        # Ensure there's a blank line before the citation block
        if not readme_content.endswith('\n\n'):
            if readme_content.endswith('\n'):
                readme_content += '\n'
            else:
                readme_content += '\n\n'
        updated_content = readme_content + citation_block
    
    # Write updated README
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"Successfully updated {readme_path}")
    return True


def main():
    """Main function to add citation block to README."""
    # Determine repository root (script location)
    script_dir = Path(__file__).parent
    readme_path = script_dir / 'README.md'
    zenodo_path = script_dir / '.zenodo.json'
    
    print(f"Working directory: {script_dir}")
    print(f"README path: {readme_path}")
    print(f"Zenodo metadata path: {zenodo_path}")
    print()
    
    # Add citation block
    success = add_citation_to_readme(readme_path, zenodo_path)
    
    if success:
        print("\n✅ Citation block added successfully!")
    else:
        print("\n❌ Failed to add citation block")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
