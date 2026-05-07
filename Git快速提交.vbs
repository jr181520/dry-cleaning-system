' Git 快速提交工具 (VBScript版本)
' 可直接双击运行，无需配置PowerShell策略

Option Explicit

Dim objShell, objFSO, objExec
Dim strPath, strStatus, strConfirm, strMsg, strLine
Dim arrStatus(), intCount, objOutput
Dim gitAvailable

' 创建对象
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' 设置工作目录为脚本所在目录
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = strPath

' 显示标题
WScript.Echo ""
WScript.Echo "========================================"
WScript.Echo "       Git 快速提交工具"
WScript.Echo "========================================"
WScript.Echo ""

' 检查Git
Set objExec = objShell.Exec("git --version")
If objExec.ExitCode <> 0 Then
    WScript.Echo "[错误] 未检测到Git，请先安装Git"
    WScript.Echo ""
    WScript.Echo "按回车退出..."
    WScript.StdIn.ReadLine()
    WScript.Quit
End If

' 检查修改
Set objExec = objShell.Exec("git status --porcelain")
strStatus = objExec.StdOut.ReadAll()

If Len(Trim(strStatus)) = 0 Then
    WScript.Echo "[信息] 没有检测到任何修改"
    WScript.Echo ""
    WScript.Echo "按回车退出..."
    WScript.Echo ""
    WScript.StdIn.ReadLine()
    WScript.Quit
End If

' 显示修改
WScript.Echo "[检测] 发现以下文件有修改："
WScript.Echo ""
objExec = objShell.Exec("git status --short")
WScript.Echo objExec.StdOut.ReadAll()
WScript.Echo ""

' 确认操作
WScript.StdIn.ReadLine()  ' 暂停让用户查看
strConfirm = "Y"

' 添加修改
WScript.Echo "[进度] 正在添加修改的文件..."
objShell.Run "git add -A", 0, True

' 获取默认提交信息
Dim strDate, strTime
strDate = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2)
strTime = Right("0" & Hour(Now), 2) & ":" & Right("0" & Minute(Now), 2)
Dim strDefaultMsg
strDefaultMsg = "自动提交 " & strDate & " " & strTime

' 询问提交信息
WScript.Echo ""
WScript.Echo "[提示] 默认提交信息: " & strDefaultMsg
WScript.Echo "直接回车使用默认，或输入自定义信息："
strMsg = WScript.StdIn.ReadLine()

If Len(Trim(strMsg)) = 0 Then
    strMsg = strDefaultMsg
End If

' 执行提交
WScript.Echo ""
WScript.Echo "[进度] 正在提交..."
Set objExec = objShell.Exec("git commit -m """ & strMsg & """")

If objExec.ExitCode = 0 Then
    WScript.Echo ""
    WScript.Echo "========================================"
    WScript.Echo "[成功] 提交完成！"
    WScript.Echo "========================================"
    WScript.Echo ""
    
    ' 显示最近提交
    Set objExec = objShell.Exec("git log --oneline -1")
    WScript.Echo "最近提交："
    WScript.Echo objExec.StdOut.ReadAll()
    WScript.Echo ""
    
    ' 询问是否推送
    WScript.Echo "是否推送到远程仓库? (Y/N)"
    strConfirm = WScript.StdIn.ReadLine()
    
    If strConfirm = "Y" Or strConfirm = "y" Then
        WScript.Echo ""
        WScript.Echo "[进度] 正在推送到远程..."
        objShell.Run "git push", 1, True
        WScript.Echo ""
        WScript.Echo "[成功] 推送完成！"
    End If
    
Else
    WScript.Echo "[错误] 提交失败！"
    WScript.Echo objExec.StdErr.ReadAll()
End If

WScript.Echo ""
WScript.Echo "按回车退出..."
WScript.StdIn.ReadLine()
