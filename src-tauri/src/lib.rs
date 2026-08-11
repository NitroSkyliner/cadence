use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

struct ServerProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let (mut rx, child) = app
                .shell()
                .sidecar("cadence-server")
                .expect("failed to create sidecar")
                .spawn()
                .expect("failed to spawn cadence-server");
            app.state::<ServerProcess>().0.lock().unwrap().replace(child);
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(b) | CommandEvent::Stderr(b) = event {
                        print!("[server] {}", String::from_utf8_lossy(&b));
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building Cadence")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(child) = app.state::<ServerProcess>().0.lock().unwrap().take() {
                    let _ = child.kill();          // stop the backend when the app quits
                }
            }
        });
}