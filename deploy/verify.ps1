$ErrorActionPreference = 'Stop'
$base = 'https://webarchive.localhost'
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.UseProxy = $false
$handler.AllowAutoRedirect = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(30)
$results = [System.Collections.Generic.List[string]]::new()

function Check-Response([string]$path, [int]$status = 200, [string]$method = 'GET') {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($method), "$base$path")
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne $status) {
        throw "$method $path returned $([int]$response.StatusCode), expected $status"
    }
    $results.Add("PASS $method $path -> $status")
    return $response
}

try {
    $redirect = $client.GetAsync('http://webarchive.localhost/game/2').GetAwaiter().GetResult()
    if ([int]$redirect.StatusCode -ne 301 -or $redirect.Headers.Location.AbsoluteUri -ne "$base/game/2") {
        throw 'HTTP redirect is incorrect'
    }
    $results.Add('PASS HTTP -> HTTPS redirect preserves path')
    $homeResponse = Check-Response '/'
    if (!$homeResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult().Contains('OurArchive')) { throw 'Frontend HTML missing' }
    $health = Check-Response '/api/health'
    $healthData = $health.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($healthData.database -ne 'ok') { throw 'Database health failed' }
    $catalog = Check-Response '/api/games'
    if (($catalog.Headers.GetValues('X-Robots-Tag') -join ',') -ne 'noindex, nofollow') { throw 'API robots header missing' }
    $games = $catalog.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($games.total -ne 7 -or $games.items.Count -ne 7) { throw 'Expected seven seeded games' }
    foreach ($game in $games.items) {
        $null = Check-Response "/api/games/$($game.id)"
        $null = Check-Response "/game/$($game.id)"
        $null = Check-Response $game.imageURL 200 'HEAD'
        $null = Check-Response "/games/$($game.sfwURL)" 200 'HEAD'
    }
    $search = Check-Response '/api/games?q=Jacksmith'
    $searchData = $search.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($searchData.total -ne 1 -or $searchData.items[0].title -ne 'Jacksmith') { throw 'Search failed' }
    $pagination = Check-Response '/api/games?page=2&limit=2'
    $pageData = $pagination.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($pageData.page -ne 2 -or $pageData.items.Count -ne 2 -or $pageData.total -ne 7) { throw 'Pagination failed' }
    $filtered = Check-Response '/api/games?filters=Puzzle'
    $filterData = $filtered.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($filterData.total -ne 1 -or $filterData.items[0].title -ne 'Rock Garden') { throw 'API filters failed' }
    $null = Check-Response '/api/filters'
    $null = Check-Response '/api/games/999999' 404
    $results.Add('PASS TLS certificate validated by Windows/.NET; no validation bypass')
    $results
    Write-Host "Completed: $($results.Count) checks."
} finally {
    $client.Dispose()
    $handler.Dispose()
}
