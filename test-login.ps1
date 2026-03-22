$response = Invoke-WebRequest -Uri 'http://localhost:8787/api/admin/login' `
  -Method POST `
  -Headers @{'Content-Type' = 'application/json'} `
  -Body (@{'username' = 'admin'; 'password' = 'senha123'} | ConvertTo-Json)

Write-Host 'Status Code:' $response.StatusCode
Write-Host 'Response:' $response.Content

if ($response.Headers['Set-Cookie']) {
    Write-Host 'Set-Cookie:' $response.Headers['Set-Cookie']
}
