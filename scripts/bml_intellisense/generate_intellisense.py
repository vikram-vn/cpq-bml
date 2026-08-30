import os
import sys
import time

# Add the parent directory of this package to sys.path so we can import from bml_intellisense package
script_dir = os.path.dirname(os.path.abspath(__file__))
package_parent = os.path.abspath(os.path.join(script_dir, ".."))
sys.path.append(package_parent)

from bml_intellisense.functions import generate_bml_functions
from bml_intellisense.variables import generate_bml_variables
from bml_intellisense.attributes import generate_bml_attributes
from bml_intellisense.util_attributes import generate_bml_util_attributes
from bml_intellisense.data_types import generate_bml_data_types
from bml_intellisense.cpq_js import generate_cpq_js
from bml_intellisense.category_labels import generate_category_labels
from bml_intellisense.custom_snippets import generate_custom_snippets
from bml_intellisense.best_practices import generate_best_practices
from bml_intellisense.keyword_hovers import generate_keyword_hovers
from bml_intellisense.curated_params import generate_curated_params

def main():
    start_time = time.time()
    # Project root is two levels up from scripts/bml_intellisense/generate_intellisense.py
    root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
    
    failed = 0
    generators = [
        {"name": "generateBmlFunctions", "func": generate_bml_functions},
        {"name": "generateBmlVariables", "func": generate_bml_variables},
        {"name": "generateBmlAttributes", "func": generate_bml_attributes},
        {"name": "generateBmlUtilAttributes", "func": generate_bml_util_attributes},
        {"name": "generateBmlDataTypes", "func": generate_bml_data_types},
        {"name": "generateCpqJs", "func": generate_cpq_js},
        {"name": "generateCategoryLabels", "func": generate_category_labels},
        {"name": "generateCustomSnippets", "func": generate_custom_snippets},
        {"name": "generateBestPractices", "func": generate_best_practices},
        {"name": "generateKeywordHovers", "func": generate_keyword_hovers},
        {"name": "generateCuratedParams", "func": generate_curated_params}
    ]
    
    for g in generators:
        try:
            g["func"](root_dir)
        except Exception as e:
            print(f"\n[FAILED] [{g['name']}]: {e}\n")
            failed += 1
            
    elapsed = time.time() - start_time
    if failed == 0:
        print(f"\nSUCCESS: All {len(generators)} scripts completed successfully in {elapsed:.2f}s")
    else:
        print(f"\nSTATUS: {len(generators) - failed}/{len(generators)} scripts succeeded, {failed} failed ({elapsed:.2f}s)")
        exit(1)

if __name__ == '__main__':
    main()
