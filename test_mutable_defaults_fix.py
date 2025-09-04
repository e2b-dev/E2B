#!/usr/bin/env python3
"""
Test script to verify that the mutable default values fix works correctly.
This script tests that TemplateBase instances don't share state.
"""

import sys
import os

# Add the packages/python-sdk directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'packages', 'python-sdk'))

from e2b.template.main import TemplateBase

def test_mutable_defaults_fix():
    """Test that TemplateBase instances don't share mutable state."""
    print("Testing mutable defaults fix...")
    
    # Create two TemplateBase instances
    template1 = TemplateBase()
    template2 = TemplateBase()
    
    # Verify that _instructions are separate lists
    print(f"template1._instructions id: {id(template1._instructions)}")
    print(f"template2._instructions id: {id(template2._instructions)}")
    assert id(template1._instructions) != id(template2._instructions), "Instances share _instructions list!"
    
    # Verify that _ignore_file_paths are separate lists
    print(f"template1._ignore_file_paths id: {id(template1._ignore_file_paths)}")
    print(f"template2._ignore_file_paths id: {id(template2._ignore_file_paths)}")
    assert id(template1._ignore_file_paths) != id(template2._ignore_file_paths), "Instances share _ignore_file_paths list!"
    
    # Test that modifying one instance doesn't affect the other
    template1._instructions.append("test_instruction")
    assert len(template1._instructions) == 1, "template1 should have 1 instruction"
    assert len(template2._instructions) == 0, "template2 should have 0 instructions"
    
    template1._ignore_file_paths.append("test_file")
    assert len(template1._ignore_file_paths) == 1, "template1 should have 1 ignore file"
    assert len(template2._ignore_file_paths) == 0, "template2 should have 0 ignore files"
    
    print("✅ All tests passed! Mutable defaults fix is working correctly.")
    return True

if __name__ == "__main__":
    test_mutable_defaults_fix()
