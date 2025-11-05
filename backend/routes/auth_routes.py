"""
Authentication routes
"""
from flask import Blueprint, jsonify, g
from middleware.auth import authenticate_token

bp = Blueprint('auth', __name__)

@bp.route('/me', methods=['GET'])
@authenticate_token
def get_current_user():
    """Get current user profile"""
    return jsonify({
        'success': True,
        'data': g.user.to_dict()
    }), 200

