import urllib.request, json, time, http.cookiejar

print("Testando autenticação com API key recarregada...\n")

passwords = ['Bruna@1212', 'senha123', 'admin']

for tentativa in range(3):
  for pw in passwords:
    try:
      # Login
      req = urllib.request.Request('http://localhost:8788/api/admin/login', 
        data=json.dumps({'username': 'admin', 'password': pw}).encode(), 
        headers={'Content-Type': 'application/json'})
      resp = urllib.request.urlopen(req, timeout=3)
      print(f"[OK] Login com senha '{pw}' funcionou!")
      
      # Chat
      cj = http.cookiejar.CookieJar()
      o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
      req2 = urllib.request.Request('http://localhost:8788/api/admin/login', 
        data=json.dumps({'username': 'admin', 'password': pw}).encode(), 
        headers={'Content-Type': 'application/json'})
      o.open(req2)
      
      chat_req = urllib.request.Request('http://localhost:8788/api/chat',
        data=json.dumps({'message': 'Ola API key test', 'session_id': 'test-key'}).encode(),
        headers={'Content-Type': 'application/json'})
      chat_resp = o.open(chat_req)
      result = json.loads(chat_resp.read().decode())
      
      if 'response' in result:
        print("[OK] Chat API funcionando com API key recarregada!")
        resp_text = result.get("response", "")[:150]
        print(f"    Resposta: {resp_text}")
        exit(0)
      break
      
    except urllib.error.HTTPError as e:
      if e.code != 401 or pw != passwords[-1]:
        continue
      print(f"Tentativa {tentativa+1}: HTTP 401 - nenhuma senha funcionou")
      time.sleep(2)
      break
    except Exception as e:
      continue

