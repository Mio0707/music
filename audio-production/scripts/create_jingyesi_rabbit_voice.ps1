$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputDirectory = Join-Path $root 'output\jingyesi-rabbit-rule-v1\syllables'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

# Unicode code points avoid encoding differences in the 32-bit Windows speech host.
$characters = @(
    0x5E8A, 0x524D, 0x660E, 0x6708, 0x5149,
    0x7591, 0x662F, 0x5730, 0x4E0A, 0x971C,
    0x4E3E, 0x5934, 0x671B, 0x660E, 0x6708,
    0x4F4E, 0x5934, 0x601D, 0x6545, 0x4E61
)

# Relative pitch follows the rule-based contour rather than copying every sung note.
$pitchOffsets = @(
    8, -1, 3, 6, 8,
    8, 6, 3, -1, 1,
    1, 8, 6, 8, 9,
    8, 4, 3, -1, -1
)

$voice = New-Object -ComObject SAPI.SpVoice
$token = $voice.GetVoices() |
    Where-Object { $_.GetDescription() -like '*Huihui*' } |
    Select-Object -First 1
if ($null -eq $token) {
    throw 'Microsoft Huihui Chinese voice is not installed.'
}
$voice.Voice = $token
$voice.Rate = -1
$voice.Volume = 100

for ($index = 0; $index -lt $characters.Count; $index++) {
    $character = [char]$characters[$index]
    $offset = $pitchOffsets[$index]
    $offsetText = if ($offset -ge 0) { "+$offset" } else { "$offset" }
    $xml = '<pitch absmiddle="' + $offsetText + '">' + $character + '</pitch>'
    $path = Join-Path $outputDirectory ('{0:D2}.wav' -f ($index + 1))
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Open($path, 3, $false)
    $voice.AudioOutputStream = $stream
    [void]$voice.Speak($xml, 8)
    $stream.Close()
}

Write-Output $outputDirectory
