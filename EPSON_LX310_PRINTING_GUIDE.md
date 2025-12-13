# Epson LX-310 Dot Matrix Printer Setup Guide
## For 5.5" × 9.5" Continuous Form Paper (2-ply)

### Printer Specifications
- **Model**: Epson LX-310
- **Paper Size**: 5.5" × 9.5" (139.7mm × 241.3mm)
- **Paper Type**: Continuous Form (2-ply)
- **Characters Per Inch (CPI)**: 10 CPI (default)
- **Font**: Monospace (Courier New, Lucida Console, or Epson ESC/P default)

---

## Browser-Based Printing Setup

### Step 1: Configure Windows Printer Settings

1. **Open Windows Settings** → **Devices** → **Printers & scanners**
2. **Select Epson LX-310** → **Manage** → **Printer properties**
3. **Go to "Advanced" tab** and set:
   - **Paper Size**: Custom (5.5" × 9.5" or 139.7mm × 241.3mm)
   - **Paper Type**: Continuous Form
   - **Orientation**: Portrait
   - **Print Quality**: Draft or Normal (for faster printing)

4. **Go to "Preferences" tab**:
   - **Paper Size**: Custom: 5.5" × 9.5"
   - **Margins**: Minimum or Custom (0.25" top/bottom, 0.2" left/right)
   - **Scale**: 100% (DO NOT use "Fit to page")

### Step 2: Print Dialog Settings

When printing from the browser:

1. **Select Epson LX-310** as the printer
2. **Paper Size**: Custom 5.5" × 9.5" (or 139.7mm × 241.3mm)
3. **Scale**: 100% (NOT "Fit to page" or "Shrink to fit")
4. **Margins**: Minimum or Custom
5. **Background graphics**: Enable (if available)
6. **Color**: Black & White (for dot matrix)

### Step 3: Test Print

1. Click "Print Receipt" button in Sales History
2. Review the print preview
3. Adjust margins if needed (typically 0.25" top/bottom, 0.2" left/right)
4. Print and verify alignment with perforations

---

## Direct ESC/P Command Printing (Advanced)

If you want to send commands directly to the printer (bypassing browser print dialog), you can use ESC/P commands. Here's a C# example for Windows:

### C# ESC/P Printing Example

```csharp
using System;
using System.IO;
using System.Text;
using System.Drawing.Printing;

public class EpsonLX310Printer
{
    private string printerName;
    
    public EpsonLX310Printer(string printerName = "Epson LX-310")
    {
        this.printerName = printerName;
    }
    
    public void PrintReceipt(ReceiptData receipt)
    {
        // ESC/P commands for Epson LX-310
        StringBuilder escp = new StringBuilder();
        
        // Initialize printer
        escp.Append((char)27); // ESC
        escp.Append("@");      // Initialize printer
        
        // Set 10 CPI (Characters Per Inch)
        escp.Append((char)27); // ESC
        escp.Append("P");      // Select 10 CPI pitch
        
        // Set paper size: 5.5" × 9.5" (139.7mm × 241.3mm)
        // Note: ESC/P uses dots as units (180 DPI for LX-310)
        // 5.5" = 990 dots, 9.5" = 1710 dots
        
        // Set left margin (0.2" = 36 dots at 180 DPI)
        escp.Append((char)27); // ESC
        escp.Append("l");      // Set left margin
        escp.Append((char)36); // 36 dots
        
        // Set top margin (0.25" = 45 dots at 180 DPI)
        escp.Append((char)27); // ESC
        escp.Append((char)100); // Set top margin
        escp.Append((char)45);  // 45 dots
        
        // Set continuous paper mode
        escp.Append((char)27); // ESC
        escp.Append("C");      // Set page length in lines
        escp.Append((char)0);  // Continuous form
        
        // Print header
        escp.Append((char)27); // ESC
        escp.Append("E");      // Emphasized (bold) ON
        escp.Append("DELODUR CORPORATION\r\n");
        escp.Append((char)27); // ESC
        escp.Append("F");      // Emphasized OFF
        escp.Append("==========================================\r\n");
        
        // Print customer info
        escp.Append($"TO: {receipt.CustomerName}\r\n");
        escp.Append($"Date: {receipt.Date}\r\n");
        escp.Append($"Receipt No: {receipt.ReceiptNumber}\r\n");
        escp.Append("------------------------------------------\r\n");
        
        // Print items table header
        escp.Append((char)27); // ESC
        escp.Append("E");      // Bold ON
        escp.Append("BRAND    DESCRIPTION          QTY  PRICE    AMOUNT\r\n");
        escp.Append((char)27); // ESC
        escp.Append("F");      // Bold OFF
        escp.Append("------------------------------------------\r\n");
        
        // Print items
        foreach (var item in receipt.Items)
        {
            string brand = item.Brand.PadRight(8).Substring(0, 8);
            string desc = item.Description.PadRight(20).Substring(0, 20);
            string qty = item.Qty.ToString().PadLeft(3);
            string price = item.Price.ToString("F2").PadLeft(8);
            string amount = item.Amount.ToString("F2").PadLeft(10);
            
            escp.Append($"{brand} {desc} {qty} {price} {amount}\r\n");
        }
        
        escp.Append("==========================================\r\n");
        
        // Print total
        escp.Append((char)27); // ESC
        escp.Append("E");      // Bold ON
        escp.Append($"TOTAL: {receipt.TotalAmount.ToString("F2")}\r\n");
        escp.Append((char)27); // ESC
        escp.Append("F");      // Bold OFF
        
        // Footer
        escp.Append("\r\n");
        escp.Append("Items received in good condition:\r\n");
        escp.Append("------------------------------------------\r\n");
        
        // Cut paper (if auto-cutter is installed)
        escp.Append((char)27); // ESC
        escp.Append("i");      // Partial cut
        
        // Feed paper
        escp.Append("\r\n\r\n\r\n");
        
        // Send to printer
        RawPrinterHelper.SendStringToPrinter(printerName, escp.ToString());
    }
}

// Helper class for raw printing
public class RawPrinterHelper
{
    [System.Runtime.InteropServices.DllImport("winspool.drv", CharSet = System.Runtime.InteropServices.CharSet.Ansi, ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool OpenPrinter([System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", CharSet = System.Runtime.InteropServices.CharSet.Ansi, ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", CharSet = System.Runtime.InteropServices.CharSet.Ansi, ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [System.Runtime.InteropServices.In, System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStruct)] DOCINFOA di);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    
    [System.Runtime.InteropServices.DllImport("winspool.drv", CharSet = System.Runtime.InteropServices.CharSet.Ansi, ExactSpelling = true, CallingConvention = System.Runtime.InteropServices.CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    
    public static bool SendStringToPrinter(string szPrinterName, string szString)
    {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;
        int dwWritten = 0;
        
        di.pDocName = "Receipt Print";
        di.pDataType = "RAW";
        
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    byte[] bytes = Encoding.ASCII.GetBytes(szString);
                    IntPtr pUnmanagedBytes = System.Runtime.InteropServices.Marshal.AllocHGlobal(bytes.Length);
                    System.Runtime.InteropServices.Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    System.Runtime.InteropServices.Marshal.FreeHGlobal(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        
        return bSuccess;
    }
}

[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential, CharSet = System.Runtime.InteropServices.CharSet.Ansi)]
public class DOCINFOA
{
    [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStr)]
    public string pDocName;
    [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStr)]
    public string pOutputFile;
    [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStr)]
    public string pDataType;
}
```

---

## ESC/P Command Reference for Epson LX-310

### Common Commands

| Command | Hex | Description |
|---------|-----|-------------|
| ESC @ | 1B 40 | Initialize printer |
| ESC P | 1B 50 | Select 10 CPI (pica) |
| ESC M | 1B 4D | Select 12 CPI (elite) |
| ESC E | 1B 45 | Emphasized (bold) ON |
| ESC F | 1B 46 | Emphasized (bold) OFF |
| ESC l | 1B 6C | Set left margin (in dots) |
| ESC C 0 | 1B 43 00 | Continuous form mode |
| ESC i | 1B 69 | Partial cut (if cutter installed) |
| LF | 0A | Line feed |
| CR | 0D | Carriage return |

### Paper Size Calculation

- **Printer Resolution**: 180 DPI (dots per inch)
- **5.5" width**: 990 dots
- **9.5" height**: 1710 dots
- **Left margin (0.2")**: 36 dots
- **Right margin (0.2")**: 36 dots
- **Printable width**: 918 dots (5.1")
- **At 10 CPI**: ~51 characters per line (accounting for margins)

---

## Troubleshooting

### Problem: Text is cut off
**Solution**: 
- Check margins in print dialog (set to Minimum or Custom)
- Ensure scale is 100% (not "Fit to page")
- Verify paper size is exactly 5.5" × 9.5"

### Problem: Text doesn't align with perforations
**Solution**:
- Adjust top margin (try 0.25" to 0.3")
- Use printer's "Top of Form" button to set reference point
- Check paper alignment in printer

### Problem: Font looks compressed or stretched
**Solution**:
- Ensure monospace font is used (Courier New)
- Disable "Fit to page" scaling
- Set CPI to 10 in printer settings

### Problem: Print is too small/large
**Solution**:
- Verify paper size is set correctly (5.5" × 9.5")
- Check font size (should be 10-12pt for 10 CPI)
- Ensure no scaling is applied

---

## Testing Checklist

- [ ] Printer is set to Continuous Form mode
- [ ] Paper size is configured as 5.5" × 9.5"
- [ ] Margins are set correctly (0.25" / 0.2")
- [ ] Scale is set to 100%
- [ ] Font is monospace (Courier New)
- [ ] Text aligns with perforations
- [ ] No text is cut off
- [ ] Receipt fits on one page (9.5" height)
- [ ] All columns are visible and readable

---

## Additional Notes

1. **2-ply paper**: The receipt will print on both copies simultaneously
2. **Continuous form**: No need to manually feed paper
3. **Perforations**: Align print with perforation lines for easy tearing
4. **Dot matrix**: Text may appear slightly pixelated - this is normal
5. **Speed**: Draft mode prints faster but may be lighter

---

## Support

If you encounter issues:
1. Check printer driver is up to date
2. Verify paper is loaded correctly
3. Test with a simple text document first
4. Check printer's DIP switch settings (if applicable)
5. Consult Epson LX-310 manual for specific settings







