import subprocess
import threading
import os
import re
import sys
import time
from http.server import HTTPServer
import server

# Set directory to general-assessment-viewer
web_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(web_dir)

PORT = 8088

# 1. Start Assessment REST API & Static Server in background thread
def run_server():
    httpd = HTTPServer(("127.0.0.1", PORT), server.AssessmentRequestHandler)
    print(f"[OK] Assessment Server running on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

# 2. Cloudflare Tunnel with Continuous Output Draining & Auto-Restart
cloudflared_path = os.path.abspath(os.path.join(web_dir, "..", "cloudflared.exe"))
if not os.path.exists(cloudflared_path):
    cloudflared_path = "cloudflared"

url_file = os.path.join(web_dir, "CLOUDFLARE_URL.txt")
remote_txt_path = os.path.join(web_dir, "..", "REMOTE_ACCESS_URLS.txt")

def update_url_files(url):
    print("\n" + "="*60, flush=True)
    print(f"  CLOUDFLARE PUBLIC TUNNEL ACTIVE:", flush=True)
    print(f"  {url}", flush=True)
    print("="*60 + "\n", flush=True)
    try:
        with open(url_file, "w", encoding="utf-8") as f:
            f.write(url)
    except Exception:
        pass
    try:
        with open(remote_txt_path, "w", encoding="utf-8") as rf:
            rf.write("=====================================================================\n")
            rf.write("          CLOUDFLARE REMOTE ACCESS LINKS (ACTIVE NOW)\n")
            rf.write("=====================================================================\n")
            rf.write(f"URL: {url}\n")
            rf.write("=====================================================================\n")
    except Exception:
        pass

while True:
    print(f"[*] Starting Cloudflare Tunnel using {cloudflared_path}...", flush=True)
    cmd = [cloudflared_path, "tunnel", "--url", f"http://127.0.0.1:{PORT}"]
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    
    # Read output continuously so stdout pipe never fills up or blocks
    try:
        for line in iter(process.stdout.readline, ''):
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match:
                url_found = match.group(0)
                update_url_files(url_found)
    except Exception as e:
        print(f"[!] Error reading tunnel stdout: {e}", flush=True)
        
    process.wait()
    print("[!] Cloudflare tunnel process exited. Reconnecting in 3 seconds...", flush=True)
    time.sleep(3)
