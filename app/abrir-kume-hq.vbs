' Abre Küme HQ: levanta el servidor local (si no está corriendo) y abre la app en su propia ventana.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' ¿Ya está corriendo en el puerto 4747?
running = False
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://127.0.0.1:4747/api/agents", False
http.Send
If Err.Number = 0 Then If http.Status = 200 Then running = True
Err.Clear
On Error GoTo 0

If Not running Then
  sh.CurrentDirectory = appDir
  sh.Run "cmd /c node server.mjs", 0, False
  WScript.Sleep 1500
End If

' Abrir en Chrome (ventana propia, como una app). Si no está, Edge; si no, el navegador por defecto.
chrome = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe"
edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If fso.FileExists(chrome) Then
  sh.Run """" & chrome & """ --app=http://localhost:4747 --window-size=1440,900", 1, False
ElseIf fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=http://localhost:4747 --window-size=1360,860", 1, False
Else
  sh.Run "http://localhost:4747", 1, False
End If
