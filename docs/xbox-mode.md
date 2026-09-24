# Xbox Full Screen Experience (Xbox Mode)

The installer and portable EXE can run *inside* Windows 11's Gaming Full Screen Experience (Xbox Mode), but neither registers Xbox Preview UI directly in the Windows Home-app dropdown. That requires a separately packaged and signed gaming-home identity. Until such a bridge is built and tested, use an opt-in third-party bridge; do not mistake the installer for native FSE registration.

## Use the installed or portable app with AnyFSE

1. Install `Xbox-Preview-UI-Setup-*.exe`, or put the portable EXE in a stable folder. Pointing the bridge at a moved or renamed file will break the launch path.
2. Review and install [AnyFSE](https://github.com/ashpynov/AnyFSE) using its own instructions. This is independent third-party software. Review its installer, permissions, and security notes before proceeding.
3. In AnyFSE settings, select **Custom executable** and point it at the installed `Xbox Preview UI.exe` or portable EXE.
4. In Windows **Settings → Gaming → Full Screen Experience**, select **AnyFSE** as Home. Windows starts AnyFSE, which starts Xbox Preview UI.
5. To undo it, switch Home back to **Xbox** in Windows Settings; then remove AnyFSE if you no longer need it.

This is not the same as seeing “Xbox Preview UI” directly in the Windows dropdown. A native selectable Home app requires a separate, signed MSIX gaming-home bridge with Windows' `windows.gamingApp` registration and associated capability. We do not silently install a bridge, certificate, service, or change your Windows Home setting. The [AnyFSE project](https://github.com/ashpynov/AnyFSE) documents its own permissions and optional device-button service; review those before choosing it.

The app's **Fullscreen on launch** setting should be enabled. Controller navigation still belongs to the launcher; Xbox Game Bar and hardware Guide-button behavior can depend on Windows and your device.
