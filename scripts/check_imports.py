import sys
import os
import traceback

print("Starting import test...")
try:
    from main import app
    print("Main app imported successfully.")
    
    from router.analysis import router
    print("Analysis router imported successfully.")
    
    print("All checks passed.")
except Exception:
    traceback.print_exc()
    sys.exit(1)
