"""
VPS connection config — shared by all scripts.
Copy this file to config.py and fill in your credentials.
"""
HOST = 'your-vps-host'
PORT = 22
USER = 'root'
PASSWORD = 'your-password-here'

# SSH host-key verification. Prefer pinning the exact SHA256 fingerprint:
#   ssh-keygen -lf C:\Users\<you>\.ssh\known_hosts -E sha256
# Store only the value after SHA256:, or include the SHA256: prefix.
HOST_KEY_SHA256 = ''
KNOWN_HOSTS_PATH = ''
ALLOW_UNKNOWN_HOST = False

# Example side-load layout. Replace these values in local config.py.
REMOTE_DIR = '/var/www/skiapi-new-frontend'
NGINX_CONF = '/etc/nginx/sites-enabled/skiapi-new-frontend'
BACKEND_CONTAINER = 'newapi-app-skiapi'
BACKEND_DB_PATH = '/opt/skiapi-newapi/data/one-api.db'
BACKEND_PORT = 3001       # bound to 127.0.0.1 on the VPS
FRONTEND_PORT = 3003      # public side-load port
FRONTEND_EXTRA_PORTS = (18080,)  # local side-load listener; cloud firewall blocks it externally

# Optional production target. Required only for `python scripts/deploy.py --prod`.
PROD_HOST = ''
PROD_PORT = 22
PROD_USER = 'root'
PROD_PASSWORD = ''
PROD_REMOTE_DIR = '/www/sites/skiapi.dev/index'
PROD_HOST_KEY_SHA256 = ''
PROD_KNOWN_HOSTS_PATH = ''
PROD_ALLOW_UNKNOWN_HOST = False
