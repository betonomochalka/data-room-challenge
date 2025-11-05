"""
Database initialization
"""
from flask_sqlalchemy import SQLAlchemy
from config import Config

# Initialize SQLAlchemy with connection pool settings
db = SQLAlchemy()

def init_db():
    """Initialize database tables"""
    # Import all models here to ensure they're registered
    import models
    
    # Create all tables
    db.create_all()

