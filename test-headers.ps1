$uri = "http://localhost:8788/api/admin/login"
$body = @{
    username = "admin"
    password = "senha123"
} | ConvertTo-Json

# Create HttpRequestMessage to get full headers
$request = [System.Net.HttpRequestMessage]::new()
$request.Method = [System.Net.Http.HttpMethod]::Post
$request.RequestUri = $uri
$request.Content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, "application/json")

$handler = [System.Net.Http.HttpClientHandler]::new()
$client = [System.Net.Http.HttpClient]::new($handler)

try {
    $response = $client.SendAsync($request).Result
    
    Write-Host "=== Response Status ==="
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host ""
    
    Write-Host "=== Response Headers ==="
    $response.Headers | ForEach-Object {
        Write-Host "$_"
    }
    
    Write-Host ""
    Write-Host "=== Content (Response Body) ==="
    $contentString = $response.Content.ReadAsStringAsync().Result
    Write-Host $contentString
    
    Write-Host ""
    Write-Host "=== Set-Cookie in Headers ==="
    if ($response.Headers.Contains("Set-Cookie")) {
        $response.Headers.GetValues("Set-Cookie") | ForEach-Object {
            Write-Host "Found: $_"
        }
    } else {
        Write-Host "No Set-Cookie header found!"
        Write-Host ""
        Write-Host "All headers:"
        $response.Content.Headers | ForEach-Object {
            Write-Host "$_"
        }
    }
} finally {
    $response?.Dispose()
    $request?.Dispose()
    $client?.Dispose()
    $handler?.Dispose()
}
