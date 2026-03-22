$params = @{
    Uri = "http://localhost:8788/api/admin/login"
    Method = "POST"
    Headers = @{
        "Content-Type" = "application/json"
    }
    Body = @{
        username = "admin"
        password = "senha123"
    } | ConvertTo-Json
}

# Use WebRequestSession to capture cookies
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$response = Invoke-RestMethod @params -WebSession $session

Write-Host "=== LOGIN Response ==="
Write-Host "Login Response: $($response | ConvertTo-Json)"
Write-Host ""

# Check if cookie was captured
Write-Host "=== Cookies captured ==="
$session.Cookies.GetCookies([Uri]"http://localhost:8788") | ForEach-Object {
    Write-Host "Cookie: $($_.Name) = $($_.Value)"
}
Write-Host ""

# Now test config endpoint with the captured session
Write-Host "=== Testing /api/admin/config with captured session ==="
try {
    $configResponse = Invoke-RestMethod -Uri "http://localhost:8788/api/admin/config" `
        -Method GET `
        -WebSession $session
    Write-Host "✅ Config access SUCCEEDED!"
    Write-Host "Config response (first 200 chars):"
    $jsonStr = $configResponse | ConvertTo-Json
    Write-Host $jsonStr.Substring(0, [math]::Min(200, $jsonStr.Length))
} catch {
    Write-Host "❌ Config access FAILED!"
    Write-Host "Error: $($_.Exception.Response.StatusCode)"
    Write-Host "Message: $($_.Exception.Message)"
}
