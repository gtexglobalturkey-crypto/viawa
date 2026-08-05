$source = 'C:\Users\ahmet\Downloads\ChatGPT Image Aug 3, 2026, 01_54_14 PM.png'
$outputDir = 'C:\Projects\atlas\Atlas-Rebuild-v2\tmp\new-template'
New-Item -ItemType Directory -Force $outputDir | Out-Null
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($source)
try {
  $halfWidth = [int]($image.Width / 2)
  for ($index = 0; $index -lt 2; $index++) {
    $sourceX = [int]($index * $halfWidth)
    $bitmap = New-Object System.Drawing.Bitmap($halfWidth, $image.Height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.DrawImage(
          $image,
          (New-Object System.Drawing.Rectangle(0, 0, $halfWidth, $image.Height)),
          (New-Object System.Drawing.Rectangle($sourceX, 0, $halfWidth, $image.Height)),
          [System.Drawing.GraphicsUnit]::Pixel
        )
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save((Join-Path $outputDir "page-$($index + 1).png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $image.Dispose()
}
