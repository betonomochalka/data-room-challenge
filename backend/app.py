"""
Main Flask application entry point
"""
import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from config import Config
from routes import auth_routes
from routes import data_room_routes
from routes import folder_routes
from routes import file_routes
from routes import google_drive_routes
from middleware.error_handler import error_handler
from database import db, init_db
from utils.performance_monitor import init_performance_monitoring

def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize database with connection pool settings
    db.init_app(app)
    
    # Initialize performance monitoring for SQLAlchemy queries
    init_performance_monitoring()
    
    # Warm up database connection pool on startup (after app context is created)
    def warm_up_db():
        """Warm up database connection pool"""
        try:
            # Execute a simple query to establish initial connections
            with app.app_context():
                from sqlalchemy import text
                db.session.execute(text('SELECT 1'))
                db.session.commit()
                print('Database connection pool warmed up')
        except Exception as e:
            print(f'Warning: Failed to warm up database connection pool: {e}')
    
    # Warm up immediately after app creation
    warm_up_db()
    
    # Configure SQLAlchemy engine options if specified
    if hasattr(Config, 'SQLALCHEMY_ENGINE_OPTIONS'):
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = Config.SQLALCHEMY_ENGINE_OPTIONS
    
    # Ensure connections are properly closed after requests
    @app.teardown_appcontext
    def close_db(error):
        """Close database connection after request"""
        try:
            # Rollback any uncommitted transactions on error
            # Routes should handle their own commits, so we only rollback on error
            if error:
                db.session.rollback()
            
            # Remove the session (returns connection to pool)
            # This ensures the connection is properly returned even if no commit/rollback was done
            db.session.remove()
        except Exception as e:
            # Log but don't fail if session cleanup fails
            print(f'Warning: Error closing database session: {e}')
    
    # Initialize CORS with preflight caching (600s = 10 minutes cache for OPTIONS requests)
    # This allows browsers to reuse preflight results instead of sending OPTIONS before every request
    allowed_origins = Config.ALLOWED_ORIGINS.split(',')
    CORS(app, 
         origins=[origin.strip() for origin in allowed_origins],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
         max_age=600)  # Cache preflight OPTIONS requests for 10 minutes (600 seconds)
    
    # Request timing middleware - measures time from request arrival to handler entry
    import time
    from flask import g, request
    
    @app.before_request
    def before_request():
        """Mark request arrival time for timing measurements"""
        g.request_start_time = time.perf_counter()
        # Only log for API routes to avoid noise
        if request.path.startswith('/api/'):
            g.log_request_timing = True
        else:
            g.log_request_timing = False
    
    # Register routes
    app.register_blueprint(auth_routes.bp, url_prefix='/api/auth')
    app.register_blueprint(data_room_routes.bp, url_prefix='/api/data-rooms')
    app.register_blueprint(folder_routes.bp, url_prefix='/api/folders')
    app.register_blueprint(file_routes.bp, url_prefix='/api/files')
    app.register_blueprint(google_drive_routes.bp, url_prefix='/api/google-drive')
    
    # Health check endpoints
    @app.route('/api/health', methods=['GET'])
    def health():
        from datetime import datetime
        return {
            'status': 'OK',
            'timestamp': datetime.utcnow().isoformat(),
            'environment': Config.NODE_ENV or 'development'
        }, 200
    
    @app.route('/', methods=['GET'])
    def root():
        return {'message': 'Hello, world!'}, 200
    
    @app.route('/api/test', methods=['GET'])
    def test():
        from datetime import datetime
        return {
            'message': 'Backend is working!',
            'timestamp': datetime.utcnow().isoformat()
        }, 200
    
    # Register error handler for all exceptions
    @app.errorhandler(Exception)
    def handle_exception(e):
        return error_handler(e)
    
    # 404 handler
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Route not found'}, 404
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    # Initialize database tables
    with app.app_context():
        init_db()
    
    port = int(os.getenv('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=Config.NODE_ENV == 'development')
