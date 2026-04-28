"""
Shared SSH/SFTP helpers.
"""
import base64
import hashlib
import hmac
import os

import paramiko
from config import HOST, PORT, USER, PASSWORD

try:
    from config import HOST_KEY_SHA256, KNOWN_HOSTS_PATH, ALLOW_UNKNOWN_HOST
except ImportError:
    HOST_KEY_SHA256 = ''
    KNOWN_HOSTS_PATH = ''
    ALLOW_UNKNOWN_HOST = False


def _normalize_sha256(value):
    return str(value or '').strip().removeprefix('SHA256:')


def _key_sha256(key):
    return base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode('ascii').rstrip('=')


class PinnedHostKeyPolicy(paramiko.MissingHostKeyPolicy):
    def __init__(self, expected_sha256):
        self.expected_sha256 = _normalize_sha256(expected_sha256)

    def missing_host_key(self, client, hostname, key):
        actual_sha256 = _key_sha256(key)
        if not hmac.compare_digest(actual_sha256, self.expected_sha256):
            raise paramiko.SSHException(
                f'Host key mismatch for {hostname}: expected SHA256:{self.expected_sha256}, got SHA256:{actual_sha256}'
            )
        client.get_host_keys().add(hostname, key.get_name(), key)


def _configure_host_key_policy(ssh, host_key_sha256=None, known_hosts_path=None, allow_unknown_host=None):
    ssh.load_system_host_keys()
    known_hosts = known_hosts_path or KNOWN_HOSTS_PATH
    if known_hosts:
        expanded = os.path.expanduser(known_hosts)
        if os.path.exists(expanded):
            ssh.load_host_keys(expanded)

    expected_sha256 = host_key_sha256 if host_key_sha256 is not None else HOST_KEY_SHA256
    if expected_sha256:
        ssh.set_missing_host_key_policy(PinnedHostKeyPolicy(expected_sha256))
        return

    trust_unknown = allow_unknown_host if allow_unknown_host is not None else ALLOW_UNKNOWN_HOST
    if trust_unknown:
        ssh.set_missing_host_key_policy(paramiko.WarningPolicy())
        return

    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())


def get_ssh(
    host=HOST,
    port=PORT,
    username=USER,
    password=PASSWORD,
    host_key_sha256=None,
    known_hosts_path=None,
    allow_unknown_host=None,
):
    ssh = paramiko.SSHClient()
    _configure_host_key_policy(ssh, host_key_sha256, known_hosts_path, allow_unknown_host)
    ssh.connect(host, port=port, username=username, password=password, timeout=15)
    return ssh


def run(ssh, cmd, check=False):
    """Run a command, print output, return (stdout_str, stderr_str, exit_code)."""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    if out:
        print(out.encode('ascii', errors='replace').decode(), end='')
    if err:
        print('[stderr]', err.encode('ascii', errors='replace').decode(), end='')
    if check and code != 0:
        raise RuntimeError(f'Command failed (exit {code}): {cmd}')
    return out, err, code


def upload_file(ssh, local_path, remote_path):
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
