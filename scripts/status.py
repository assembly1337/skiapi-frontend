#!/usr/bin/env python3
"""
Check VPS status: nginx, docker containers, disk, ports.

Usage:
    python status.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import FRONTEND_PORT, BACKEND_PORT
try:
    from config import FRONTEND_EXTRA_PORTS
except ImportError:
    FRONTEND_EXTRA_PORTS = ()
from vps import get_ssh, run

ssh = get_ssh()

print('=== Docker containers ===')
run(ssh, 'docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"')

print('\n=== Nginx status ===')
run(ssh, 'nginx -t 2>&1')

print('\n=== SKIAPI listening ports ===')
ports = {80, 443, int(FRONTEND_PORT), int(BACKEND_PORT)}
extra_ports = FRONTEND_EXTRA_PORTS or ()
if isinstance(extra_ports, (str, int)):
    extra_ports = [extra_ports]
ports.update(int(port) for port in extra_ports)
pattern = '|'.join(str(port) for port in sorted(ports))
run(ssh, f'ss -tlnp | grep -E ":({pattern}) "')

print('\n=== Neighbor ports (not SKIAPI health) ===')
run(ssh, 'ss -tlnp | grep -E ":(3002|8080) " || true')

print(f'\n=== Frontend health (:{FRONTEND_PORT}) ===')
run(ssh, f'curl -s -o /dev/null -w "HTTP %{{http_code}}" http://127.0.0.1:{FRONTEND_PORT}/')

print(f'\n\n=== Backend API health (:{BACKEND_PORT}) ===')
run(ssh, f'curl -s http://127.0.0.1:{BACKEND_PORT}/api/status | python3 -c "import sys,json; d=json.load(sys.stdin); print(\'OK\' if \'data\' in d else \'FAIL\')" 2>&1')

print('\n=== Disk usage ===')
run(ssh, 'df -h / | tail -1')

ssh.close()
