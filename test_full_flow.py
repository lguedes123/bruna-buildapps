import urllib.request
import json
import http.cookiejar

# Create cookie jar
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

url = "http://localhost:8788/api/admin/login"
body = json.dumps({
    "username": "admin",
    "password": "senha123"
}).encode('utf-8')

print("=== 1. Logging in ===")
req = urllib.request.Request(
    url,
    data=body,
    headers={"Content-Type": "application/json"}
)

response = opener.open(req)
print(f"Login Status: {response.status}")
print(f"Response: {response.read().decode('utf-8')}")

print("\n=== 2. Initializing Database ===")
init_req = urllib.request.Request(
    "http://localhost:8788/api/admin/init-db",
    data=b"",
    headers={"Accept": "application/json"},
    method="POST"
)

try:
    init_response = opener.open(init_req)
    print(f"Init Status: {init_response.status}")
    init_body = init_response.read().decode('utf-8')
    print(f"Response: {init_body}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(f"Response: {e.read().decode('utf-8')}")

print("\n=== 3. Accessing Config ===")
config_req = urllib.request.Request(
    "http://localhost:8788/api/admin/config",
    headers={"Accept": "application/json"}
)

try:
    config_response = opener.open(config_req)
    print(f"Config Status: {config_response.status}")
    config_body = config_response.read().decode('utf-8')
    data = json.loads(config_body)
    print(f"✅ Config access SUCCEEDED!")
    print(f"Response keys: {list(data.keys())}")
except urllib.error.HTTPError as e:
    print(f"❌ HTTP Error: {e.code}")
    print(f"Response: {e.read().decode('utf-8')}")
