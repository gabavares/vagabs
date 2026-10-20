; Vagabs: mensagem ao desinstalar (não em atualização). A pasta com os dados fica em outro
; lugar, escolhida no setup, e nunca é apagada pelo desinstalador.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_OK|MB_ICONINFORMATION "O Vagabs foi removido.$\r$\n$\r$\nSeus dados continuam na pasta do Vagabs que você escolheu no setup (por padrão, Documentos\Vagabs). Se quiser apagar, apague essa pasta.$\r$\n$\r$\nCom amor, Gab <3"
  ${endIf}
!macroend
