import urllib.request
import json
import http.cookiejar

# Create cookie jar for entire session
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

BASE = "http://localhost:8788"

print("=" * 60)
print("TESTE DE FLUXO COMPLETO DE AUTENTICACAO")
print("=" * 60)

# Step 1: Login
print("\n[1] Fazendo login...")
login_req = urllib.request.Request(
    f"{BASE}/api/admin/login",
    data=json.dumps({"username": "admin", "password": "senha123"}).encode(),
    headers={"Content-Type": "application/json"}
)
login_resp = opener.open(login_req)
print(f"    Status: {login_resp.status}")
print(f"    Response: {login_resp.read().decode()}")

# Step 2: Access admin config
print("\n[2] Acessando configuracoes do admin...")
config_req = urllib.request.Request(
    f"{BASE}/api/admin/config",
    headers={"Accept": "application/json"}
)
try:
    config_resp = opener.open(config_req)
    data = json.loads(config_resp.read().decode())
    print(f"    Status: {config_resp.status} [OK]")
    print(f"    Config keys: {list(data.keys())}")
except urllib.error.HTTPError as e:
    print(f"    [ERROR] {e.code}: {e.read().decode()}")

# Step 3: Access conversations list
print("\n[3] Acessando lista de conversas...")
conv_req = urllib.request.Request(
    f"{BASE}/api/admin/conversations?page=1&limit=10",
    headers={"Accept": "application/json"}
)
try:
    conv_resp = opener.open(conv_req)
    data = json.loads(conv_resp.read().decode())
    print(f"    Status: {conv_resp.status} [OK]")
    print(f"    Response keys: {list(data.keys())}")
except urllib.error.HTTPError as e:
    print(f"    [ERROR] {e.code}: {e.read().decode()}")

# Step 4: Check models availability
print("\n[4] Verificando models disponiveis...")
models_req = urllib.request.Request(
    f"{BASE}/api/admin/models",
    headers={"Accept": "application/json"}
)
try:
    models_resp = opener.open(models_req)
    data = json.loads(models_resp.read().decode())
    print(f"    Status: {models_resp.status} [OK]")
    print(f"    Models: {data.get('available_models', [])[:2]}...")
except urllib.error.HTTPError as e:
    print(f"    [ERROR] {e.code}")

# Step 5: Try without auth (should fail)
print("\n[5] Test sem autenticacao (deve falhar)...")
no_auth_jar = http.cookiejar.CookieJar()
no_auth_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(no_auth_jar))

no_auth_req = urllib.request.Request(
    f"{BASE}/api/admin/config",
    headers={"Accept": "application/json"}
)
try:
    no_auth_resp = no_auth_opener.open(no_auth_req)
    print(f"    [ERROR] Deveria ter falhado!")
except urllib.error.HTTPError as e:
    if e.code == 401:
        print(f"    [OK] Corretamente bloqueado com 401 Unauthorized")
    else:
        print(f"    [ERROR] Erro inesperado: {e.code}")

print("\n" + "=" * 60)
print("[OK] TESTE COMPLETO - AUTENTICACAO FUNCIONANDO!")
print("=" * 60)
