"""
Tkinter dialog helper - runs file/folder dialogs in a fresh subprocess.
This avoids the "main thread is not in main loop" error when calling from asyncio threads.
"""
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from tkinter import Tk, filedialog


def browse_file(title="Select File", filetypes=None):
    """Run file dialog and print result path to stdout."""
    root = Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    root.focus_force()

    types = filetypes if filetypes else [("Mathcad Prime", "*.mcdx"), ("All files", "*.*")]
    result = filedialog.askopenfilename(title=title, filetypes=types)

    root.destroy()
    # Print result to stdout for parent process to capture
    print(result, flush=True)


def browse_folder(title="Select Folder"):
    """Run folder dialog and print result path to stdout."""
    root = Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    root.focus_force()

    result = filedialog.askdirectory(title=title)

    root.destroy()
    # Print result to stdout for parent process to capture
    print(result, flush=True)


if __name__ == "__main__":
    import json

    if len(sys.argv) < 2:
        print("Usage: tk_helper.py <browse_file|browse_folder> [args...]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "browse_file":
        title = sys.argv[2] if len(sys.argv) > 2 else "Select File"
        filetypes_json = sys.argv[3] if len(sys.argv) > 3 else "null"
        filetypes = json.loads(filetypes_json) if filetypes_json != "null" else None
        browse_file(title=title, filetypes=filetypes)
    elif cmd == "browse_folder":
        title = sys.argv[2] if len(sys.argv) > 2 else "Select Folder"
        browse_folder(title=title)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
