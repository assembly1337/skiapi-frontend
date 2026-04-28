#!/usr/bin/env python3
"""
Build and deploy the frontend to VPS.

Usage:
    python deploy.py              # build + deploy SKIAPI frontend to test VPS
    python deploy.py --no-build   # skip build, deploy existing dist/
    python deploy.py --nginx      # also re-write nginx config
    python deploy.py --legacy     # build + deploy old NewAPI frontend at /legacy/
    python deploy.py --link-ui    # inject "SKIAPI" button into legacy frontend footer
    python deploy.py --prod       # deploy to production (skiapi.dev)
    python deploy.py --all        # deploy to both test VPS and production
"""
import os
import posixpath
import shlex
import sys
import subprocess
import tarfile
import tempfile

# Allow running from any directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

from config import HOST, REMOTE_DIR, FRONTEND_PORT, BACKEND_PORT
try:
    from config import NGINX_CONF
except ImportError:
    NGINX_CONF = '/etc/nginx/sites-enabled/skiapi-new-frontend'
try:
    from config import FRONTEND_EXTRA_PORTS
except ImportError:
    FRONTEND_EXTRA_PORTS = ()
try:
    from config import BACKEND_CONTAINER, BACKEND_DB_PATH
except ImportError:
    BACKEND_CONTAINER = 'newapi-app-skiapi'
    BACKEND_DB_PATH = '/opt/skiapi-newapi/data/one-api.db'
try:
    from config import PROD_HOST, PROD_PORT, PROD_USER, PROD_PASSWORD, PROD_REMOTE_DIR
except ImportError:
    PROD_HOST = PROD_PORT = PROD_USER = PROD_PASSWORD = PROD_REMOTE_DIR = None
try:
    from config import PROD_HOST_KEY_SHA256, PROD_KNOWN_HOSTS_PATH, PROD_ALLOW_UNKNOWN_HOST
except ImportError:
    PROD_HOST_KEY_SHA256 = ''
    PROD_KNOWN_HOSTS_PATH = ''
    PROD_ALLOW_UNKNOWN_HOST = False
from vps import get_ssh, run, upload_file

DIST_DIR = os.path.join(PROJECT_DIR, 'dist')
NO_BUILD = '--no-build' in sys.argv
WRITE_NGINX = '--nginx' in sys.argv
LINK_UI = '--link-ui' in sys.argv
DEPLOY_LEGACY = '--legacy' in sys.argv
DEPLOY_PROD = '--prod' in sys.argv or '--all' in sys.argv
DEPLOY_TEST = '--prod' not in sys.argv or '--all' in sys.argv

LEGACY_PROJECT_DIR = os.path.join(os.path.dirname(PROJECT_DIR), 'new-api-main', 'web')
LEGACY_DIST_DIR = os.path.join(LEGACY_PROJECT_DIR, 'dist')
LEGACY_REMOTE_DIR = '/var/www/newapi-legacy-frontend'


def shq(value):
    return shlex.quote(str(value))


def safe_remote_dir(path):
    normalized = posixpath.normpath(str(path or ''))
    allowed_prefixes = ('/var/www/', '/www/sites/')
    blocked = {'/', '/var', '/var/www', '/www', '/www/sites', '/root', '/tmp'}
    if normalized in blocked or not normalized.startswith(allowed_prefixes):
        raise RuntimeError(f'Unsafe remote deploy directory: {path}')
    return normalized


def remote_replace_command(remote_tarball, remote_dir, owner=None):
    target = safe_remote_dir(remote_dir)
    parent = posixpath.dirname(target)
    name = posixpath.basename(target)
    staging = f'{parent}/.{name}.staging'
    previous = f'{parent}/.{name}.previous'
    owner_cmd = f' && chown -R {shq(owner)} {shq(target)}' if owner else ''
    return (
        f'rm -rf -- {shq(staging)} {shq(previous)} && '
        f'mkdir -p {shq(staging)} {shq(parent)} && '
        f'tar xzf {shq(remote_tarball)} -C {shq(staging)} && '
        f'if [ -d {shq(target)} ]; then mv {shq(target)} {shq(previous)}; fi && '
        f'mv {shq(staging)} {shq(target)}'
        f'{owner_cmd} && '
        f'rm -rf -- {shq(previous)}'
    )


def frontend_ports():
    ports = [int(FRONTEND_PORT)]
    extra_ports = FRONTEND_EXTRA_PORTS or ()
    if isinstance(extra_ports, (str, int)):
        extra_ports = [extra_ports]
    for port in extra_ports:
        port = int(port)
        if port not in ports:
            ports.append(port)
    return ports


def nginx_listen_directives():
    lines = []
    for port in frontend_ports():
        lines.append(f'    listen {port};')
        lines.append(f'    listen [::]:{port};')
    return '\n'.join(lines)


def require_prod_config():
    missing = [
        name for name, value in {
            'PROD_HOST': PROD_HOST,
            'PROD_PORT': PROD_PORT,
            'PROD_USER': PROD_USER,
            'PROD_PASSWORD': PROD_PASSWORD,
            'PROD_REMOTE_DIR': PROD_REMOTE_DIR,
        }.items()
        if value in (None, '')
    ]
    if missing:
        raise RuntimeError(f'Missing production config values: {", ".join(missing)}')


def build():
    print('==> Building...')
    result = subprocess.run(
        ['npm', 'run', 'build'],
        cwd=PROJECT_DIR,
        shell=True,
    )
    if result.returncode != 0:
        print('Build failed!')
        sys.exit(1)
    print('==> Build complete.')


def make_tarball(source_dir=DIST_DIR):
    f = tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False)
    tmp = f.name
    f.close()
    with tarfile.open(tmp, 'w:gz') as tar:
        tar.add(source_dir, arcname='.')
    return tmp


NGINX_CONF_CONTENT = r"""server {
{listen_directives}
    server_name _;

    root {remote_dir};
    index index.html;

    client_max_body_size 100m;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; form-action 'self' https:" always;

    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; form-action 'self' https:" always;
    }

    location = /site.webmanifest {
        default_type application/manifest+json;
        try_files $uri =404;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; form-action 'self' https:" always;
    }

    location ~* \.(?:js|mjs|css|map|json|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|txt|xml)$ {
        try_files $uri =404;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; form-action 'self' https:" always;
    }

    location = /api/setup {
        limit_except GET {
            deny all;
        }
        proxy_pass http://127.0.0.1:{backend};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:{backend};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location ^~ /v1/ {
        proxy_pass http://127.0.0.1:{backend};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        chunked_transfer_encoding on;
    }

    # Legacy (old NewAPI) frontend at /legacy/
    location ^~ /legacy/ {
        alias /var/www/newapi-legacy-frontend/;
        try_files $uri $uri/ /legacy/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; form-action 'self' https:" always;
    }
}
""".replace('{listen_directives}', nginx_listen_directives()).replace('{remote_dir}', REMOTE_DIR).replace('{backend}', str(BACKEND_PORT))


def deploy():
    print('==> Connecting to VPS...')
    ssh = get_ssh()

    print('==> Creating tarball...')
    tarball = make_tarball()

    print(f'==> Uploading ({os.path.getsize(tarball) // 1024} KB)...')
    remote_tarball = '/root/skiapi-new-frontend.tar.gz'
    upload_file(ssh, tarball, remote_tarball)
    os.unlink(tarball)

    print('==> Extracting...')
    run(ssh, remote_replace_command(remote_tarball, REMOTE_DIR, owner='www-data:www-data'), check=True)

    if WRITE_NGINX:
        print('==> Writing nginx config...')
        sftp = ssh.open_sftp()
        with sftp.open(NGINX_CONF, 'w') as f:
            f.write(NGINX_CONF_CONTENT)
        sftp.close()

    print('==> Reloading nginx...')
    run(ssh, 'nginx -t 2>&1 && nginx -s reload 2>&1')

    print('==> Verifying...')
    out, _, _ = run(ssh, f'curl -s -o /dev/null -w "%{{http_code}}" http://127.0.0.1:{FRONTEND_PORT}/')
    if '200' in out:
        print(f'\n[OK] Deployed: http://{HOST}:{FRONTEND_PORT}')
    else:
        print(f'\n[FAIL] HTTP check returned: {out}')

    ssh.close()


FOOTER_HTML = (
    '<div id="skiapi-switch" style="position:fixed;bottom:20px;right:20px;z-index:9999">'
    '<a href="/" '
    'style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;'
    'background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;'
    'font-size:13px;font-weight:600;box-shadow:0 4px 15px rgba(99,102,241,0.4);transition:all .3s">'
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
    '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
    'SKIAPI</a></div>'
)


def inject_link_ui(ssh):
    """Set backend Footer option to show a 'Try New UI' floating button in legacy frontend."""
    print('==> Injecting New UI link into legacy frontend...')
    sql = "INSERT OR REPLACE INTO options (key, value) VALUES ('Footer', '{}');".format(
        FOOTER_HTML.replace("'", "''")
    )
    sftp = ssh.open_sftp()
    with sftp.open('/tmp/skiapi_footer.sql', 'w') as f:
        f.write(sql)
    sftp.close()
    run(ssh, f'sqlite3 {shq(BACKEND_DB_PATH)} < /tmp/skiapi_footer.sql && rm /tmp/skiapi_footer.sql', check=True)
    # Restart backend to reload options from DB
    run(ssh, f'docker restart {shq(BACKEND_CONTAINER)} 2>&1 || true')
    print('==> Legacy frontend now links to New UI.')


def deploy_prod():
    """Deploy to production (skiapi.dev) via 1Panel OpenResty."""
    print('==> [PROD] Connecting to skiapi.dev...')
    require_prod_config()
    ssh = get_ssh(
        PROD_HOST,
        PROD_PORT,
        PROD_USER,
        PROD_PASSWORD,
        host_key_sha256=PROD_HOST_KEY_SHA256,
        known_hosts_path=PROD_KNOWN_HOSTS_PATH,
        allow_unknown_host=PROD_ALLOW_UNKNOWN_HOST,
    )

    print('==> [PROD] Creating tarball...')
    tarball = make_tarball()

    print(f'==> [PROD] Uploading ({os.path.getsize(tarball) // 1024} KB)...')
    remote_tarball = '/root/skiapi-frontend.tar.gz'
    sftp = ssh.open_sftp()
    sftp.put(tarball, remote_tarball)
    sftp.close()
    os.unlink(tarball)

    print('==> [PROD] Extracting...')
    run(ssh, remote_replace_command(remote_tarball, PROD_REMOTE_DIR), check=True)

    print('==> [PROD] Verifying...')
    code, _, _ = run(
        ssh,
        'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/ -H "Host: skiapi.dev"'
    )
    code = code.strip()
    if code == '200':
        print('[OK] Production deployed: https://skiapi.dev')
    else:
        print(f'[WARN] HTTP check returned: {code}')

    ssh.close()


def build_legacy():
    """Build the legacy NewAPI frontend with /legacy/ base path."""
    print('==> Building legacy frontend...')
    env = os.environ.copy()
    env['MSYS_NO_PATHCONV'] = '1'
    env['VITE_BASE_PATH'] = '/legacy/'
    result = subprocess.run(['bun', 'run', 'build'], cwd=LEGACY_PROJECT_DIR, shell=True, env=env)
    if result.returncode != 0:
        print('Legacy build failed!')
        sys.exit(1)
    print('==> Legacy build complete.')


def deploy_legacy():
    """Deploy legacy frontend to VPS at /legacy/ path."""
    print('==> Deploying legacy frontend...')
    ssh = get_ssh()
    tmp = make_tarball(LEGACY_DIST_DIR)
    print(f'==> Uploading legacy ({os.path.getsize(tmp) // 1024} KB)...')
    remote_tarball = '/root/newapi-legacy-frontend.tar.gz'
    upload_file(ssh, tmp, remote_tarball)
    os.unlink(tmp)
    run(ssh, remote_replace_command(remote_tarball, LEGACY_REMOTE_DIR, owner='www-data:www-data'), check=True)
    print(f'[OK] Legacy frontend deployed at /legacy/')
    ssh.close()


if __name__ == '__main__':
    if DEPLOY_LEGACY:
        if not NO_BUILD:
            build_legacy()
        deploy_legacy()
    else:
        if not NO_BUILD:
            build()
        if DEPLOY_TEST:
            deploy()
        if DEPLOY_PROD:
            deploy_prod()
    if LINK_UI:
        ssh = get_ssh()
        inject_link_ui(ssh)
        ssh.close()
