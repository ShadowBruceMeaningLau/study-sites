' ===========================================================================
'  start-tray.vbs -- start the five study sites in the system tray.
'
'  Double-click this file: the servers start in the background with NO console
'  window and NO browser tab. Open the sites from the tray icon (right-click
'  for the menu, double-click to open all five).
'
'  This file is also the auto-start target registered by the tray menu:
'      wscript.exe "<this file>"
'  so it must stay 100% ASCII and must never open a browser by itself.
'
'  Options (normally not needed):
'      wscript.exe start-tray.vbs -OpenBrowser   ' also open the five sites
'      wscript.exe start-tray.vbs -SelfTest      ' run the built-in self test
' ===========================================================================
Option Explicit

Dim fso, shell, here, ps1, psExe, cmd, i, extra

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1  = fso.BuildPath(here, "tools\tray.ps1")

' Folder moved or deleted: quit silently instead of showing an error dialog
' at every logon.
If Not fso.FileExists(ps1) Then WScript.Quit

psExe = shell.ExpandEnvironmentStrings("%SystemRoot%") & _
        "\System32\WindowsPowerShell\v1.0\powershell.exe"
If Not fso.FileExists(psExe) Then psExe = "powershell.exe"

extra = ""
For i = 0 To WScript.Arguments.Count - 1
  extra = extra & " " & WScript.Arguments(i)
Next

cmd = """" & psExe & """ -NoProfile -ExecutionPolicy Bypass -STA" & _
      " -WindowStyle Hidden -File """ & ps1 & """" & extra

' 0 = hidden window, False = do not wait for it to finish
shell.Run cmd, 0, False
