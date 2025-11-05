"""Vercel serverless entrypoint for the Flask app."""
import sys
import os

# Add the parent directory to the path so we can import from backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the Flask app instance that's already created in app.py
from app import app

# Vercel's Python runtime looks for a module-level variable named "app"
# The app instance is already created in app.py, so we just import it here
# No need to initialize database here - it's handled in app.py or during first request

