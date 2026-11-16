' F1 AERO launcher: run start.cmd hidden (no console flash).
' start.cmd is idempotent: it skips if the server is already up, otherwise it
' starts serve.mjs, waits for 127.0.0.1:8141, then opens the page in a browser.
Option Explicit
Dim fso, sh, root, cmdPath, q
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
q = Chr(34)
root = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = root & "\start.cmd"
If Not fso.FileExists(cmdPath) Then
  MsgBox "start.cmd not found: " & cmdPath, 16, "F1 AERO"
  WScript.Quit 1
End If
sh.Run "cmd /c " & q & cmdPath & q, 0, False
