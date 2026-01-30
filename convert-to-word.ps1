# Convert HTML Resume to Word Document
$htmlPath = Join-Path $PSScriptRoot "RESUME_Janwel_Jigy_B_Castillo.html"
$docxPath = Join-Path $PSScriptRoot "RESUME_Janwel_Jigy_B_Castillo.docx"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    
    Write-Host "Opening HTML file..."
    $doc = $word.Documents.Open($htmlPath)
    
    Write-Host "Saving as Word document..."
    $doc.SaveAs([ref]"$docxPath", [ref]16)  # 16 = wdFormatDocumentDefault (.docx)
    
    $doc.Close()
    $word.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    
    Write-Host "Success! Word document created: $docxPath"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Alternative: Open the HTML file directly in Microsoft Word:"
    Write-Host "  1. Open Microsoft Word"
    Write-Host "  2. File > Open > Select 'RESUME_Janwel_Jigy_B_Castillo.html'"
    Write-Host "  3. File > Save As > Choose 'Word Document (.docx)'"
}
