!macro customInstall
  NSISdl::download https://aka.ms/vs/17/release/vc_redist.x64.exe "$INSTDIR\vc_redist.x64.exe"  
  
  ${If} ${FileExists} `$INSTDIR\vc_redist.x64.exe`
    ExecWait '$INSTDIR\vc_redist.x64.exe /passive /norestart' $1

    ${If} $1 != '0' 
      ${If} $1 != '3010'
        ${If} $1 != '1638'
          MessageBox MB_OK|MB_ICONEXCLAMATION 'WARNING: Warcraft Recorder was unable to install the latest Visual C++ Redistributable package from Microsoft.'
        ${EndIf}
      ${EndIf}
    ${EndIf}

    # ${If} $1 == '3010'
    #     MessageBox MB_OK|MB_ICONEXCLAMATION 'You must restart your computer to complete the installation.'
    # ${EndIf}

  ${Else}
      MessageBox MB_OK|MB_ICONEXCLAMATION 'WARNING: Warcraft Recorder was unable to download the latest Visual C++ Redistributable package from Microsoft.'
  ${EndIf}

  FileOpen $0 "$INSTDIR\installername" w
  FileWrite $0 $EXEFILE
  FileClose $0
!macroend

# This is a big copy paste job from here: 
#   https://github.com/electron-userland/electron-builder/blob/v23.6.0/packages/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh
# 
# There are two key changes. 
#   1. We wait for longer before forcibly killing the process, as shutting down OBS takes longer than the default 2000ms.
#   2. We include the /t switch on taskkill to forcibly kill child processes if OBS fails to shutdown in time.
!ifndef nsProcess::FindProcess
    !include "nsProcess.nsh"
!endif

!ifmacrondef customCheckAppRunning
  !include "getProcessInfo.nsh"
  Var pid
!endif


!macro customCheckAppRunning
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
    ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
      ${if} ${isUpdated}
        # allow app to exit without explicit kill
        Sleep 300
      ${endIf}

      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
        ${if} ${isUpdated}
          # allow app to exit without explicit kill
          Sleep 1000
          Goto doStopProcess
        ${endIf}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK doStopProcess
        Quit

        doStopProcess:

        DetailPrint `Closing running "${PRODUCT_NAME}"...`

        # https://github.com/electron-userland/electron-builder/issues/2516#issuecomment-372009092
        !ifdef INSTALL_MODE_PER_ALL_USERS
          nsExec::Exec `taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"`
        !else
          nsExec::Exec `cmd /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid" /fi "USERNAME eq %USERNAME%"`
        !endif
        # to ensure that files are not "in-use"
        Sleep 300

        # Retry counter
        StrCpy $R1 0

        loop:
          IntOp $R1 $R1 + 1

          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            # wait to give a chance to exit gracefully
            # Warcraft Recorder Change 1 (2000 -> 1000)
            Sleep 10000 
            !ifdef INSTALL_MODE_PER_ALL_USERS
              # Warcraft Recorder Change 2 (add /t)
              nsExec::Exec `taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"` 
            !else
              # Warcraft Recorder Change 2 (add /t)
              nsExec::Exec `cmd /c taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid" /fi "USERNAME eq %USERNAME%"`
            !endif
            !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
            ${If} $R0 == 0
              DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
              Sleep 2000
            ${else}
              Goto not_running
            ${endIf}
          ${else}
            Goto not_running
          ${endIf}

          # App likely running with elevated permissions.
          # Ask user to close it manually
          ${if} $R1 > 1
            MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
            Quit
          ${else}
            Goto loop
          ${endIf}
        not_running:
      ${endIf}
    ${endIf}
!macroend