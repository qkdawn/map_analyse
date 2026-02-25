import asyncio
import logging
from main import app, lifespan
from core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)

async def test_run():
    print("Testing full app startup...")
    try:
        async with lifespan(app):
            print("Lifespan started successfully.")
            print("Database initialized.")
            print("Static files mounted.")
            
            # Simulate a request if needed, or just exit successfully
            print("Startup simulation complete.")
    except Exception as e:
        print(f"CRITICAL ERROR DURING STARTUP: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_run())
