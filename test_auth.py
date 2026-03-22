import urllib.request
import json
import http.cookiejar

url = "http://localhost:8788/api/admin/login"
body = json.dumps({
    "username": "admin",
    "password": "senha123"
}).encode('utf-8')

print("=== Testing Login ===")

# Create cookie jar to automatically handle cookies
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

# Make login request
req = urllib.request.Request(
    url,
    data=body,
    headers={"Content-Type": "application/json"}
)

try:
    response = opener.open(req)
    status = response.status
    body_text = response.read().decode('utf-8')
    
    print(f"Status Code: {status}")
    print(f"Response Body: {body_text}")
    
    print(f"\n=== Response Headers ===")
    for header, value in response.headers.items():
        print(f"{header}: {value}")
    
    print(f"\n=== Cookies Captured ===")
    for cookie in cookie_jar:
        print(f"Name: {cookie.name}")
        print(f"Value (length {len(cookie.value)}): {cookie.value}")
        print(f"Domain: {cookie.domain}")
        print(f"Path: {cookie.path}")
        print(f"Secure: {cookie.secure}")
        print(f"HttpOnly: {cookie.has_nonstandard_attr('HttpOnly')}")
        print()
    
    # Now test config endpoint with the cookie
    print(f"\n\n=== Testing Config Endpoint ===")
    config_req = urllib.request.Request(
        "http://localhost:8788/api/admin/config",
        headers={"Accept": "application/json"}
    )
    
    # Check what cookies will be sent
    print("Cookies to be sent:")
    for cookie in cookie_jar:
        print(f"  {cookie.name} = {cookie.value[:50]}...")
    
    config_response = opener.open(config_req)
    config_status = config_response.status
    config_body = config_response.read().decode('utf-8')
    
    print(f"Config Status: {config_status}")
    if config_status == 200:
        print("✅ Config access SUCCEEDED!")
        data = json.loads(config_body)
        print(f"Response keys: {list(data.keys())}")
    else:
        print(f"Response: {config_body}")
        
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(f"Response: {e.read().decode('utf-8')}")
