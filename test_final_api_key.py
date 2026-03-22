import urllib.request, json, http.cookiejar

print("=" * 60)
print("TESTE: API Key recarregada do .dev.vars")
print("=" * 60)

BASE = 'http://localhost:8788'
cj = http.cookiejar.CookieJar()
o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# 1. Login
print("\n[1] Fazendo login...")
try:
  req = urllib.request.Request(f'{BASE}/api/admin/login', 
    data=json.dumps({'username': 'admin', 'password': 'senha123'}).encode(), 
    headers={'Content-Type': 'application/json'})
  resp = o.open(req)
  print("    [OK] 200")
except Exception as e:
  print(f"    [ERROR] {e}")
  exit(1)

# 2. Enviar mensagem ao chat (testa API key)
print("\n[2] Testando Chat API com OpenAI API key...")
try:
  req = urllib.request.Request(f'{BASE}/api/chat',
    data=json.dumps({
      'messages': [{'role': 'user', 'content': 'Ola! Como você se chama?'}],
      'session_id': 'test-session-123'
    }).encode(),
    headers={'Content-Type': 'application/json'})
  resp = o.open(req)
  result = json.loads(resp.read().decode())
  
  if 'response' in result and result['response']:
    print(f"    [OK] Resposta recebida!")
    print(f"    Mensagem: {result['response'][:120]}")
    print("\n✅ API KEY FUNCIONANDO CORRETAMENTE!")
  else:
    print(f"    [ERROR] Resposta vazia: {result}")
    
except urllib.error.HTTPError as e:
  body = e.read().decode()
  print(f"    [ERROR] HTTP {e.code}")
  print(f"    Response: {body[:200]}")
  
except Exception as e:
  print(f"    [ERROR] {str(e)[:150]}")

print("=" * 60)
