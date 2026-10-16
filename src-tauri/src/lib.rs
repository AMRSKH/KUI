use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct AppState {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PtyOutputPayload {
    pub session_id: String,
    pub data: String,
}

#[tauri::command]
fn spawn_pty(
    session_id: String,
    shell: Option<String>,
    cols: u16,
    rows: u16,
    app_handle: AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine shell to launch
    let (shell_cmd, shell_args) = match shell {
        Some(s) if !s.trim().is_empty() => (s, vec![]),
        _ => {
            if cfg!(target_os = "windows") {
                let ps_path = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
                let exe = if std::path::Path::new(ps_path).exists() {
                    ps_path.to_string()
                } else if let Ok(comspec) = std::env::var("COMSPEC") {
                    comspec
                } else {
                    "powershell.exe".to_string()
                };

                let args = if exe.to_lowercase().ends_with("powershell.exe") {
                    vec![
                        "-NoLogo".to_string(),
                        "-NoExit".to_string(),
                        "-Command".to_string(),
                        "[Console]::InputEncoding = [Console]::OutputEncoding = $OutputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 | Out-Null".to_string(),
                    ]
                } else {
                    vec![]
                };

                (exe, args)
            } else {
                (
                    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()),
                    vec![],
                )
            }
        }
    };

    let mut cmd = CommandBuilder::new(&shell_cmd);
    for arg in &shell_args {
        cmd.arg(arg);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "KUI");
    cmd.env("LANG", "en_US.UTF-8");
    cmd.env("LC_ALL", "en_US.UTF-8");

    // Spawn child shell
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell '{}': {}", shell_cmd, e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take master writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone master reader: {}", e))?;

    let session = PtySession {
        master: pair.master,
        writer,
        child,
    };

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(session_id.clone(), session);
    }

    // Spawn reader thread with UTF-8 boundary safe buffer
    let sid = session_id.clone();
    let app_handle_clone = app_handle.clone();
    let sessions_ref = state.sessions.clone();

    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut remainder: Vec<u8> = Vec::new();

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // PTY closed / process terminated
                    // Drain any remaining bytes as lossy before exiting
                    if !remainder.is_empty() {
                        let text = String::from_utf8_lossy(&remainder).to_string();
                        let _ = app_handle_clone.emit(
                            "pty-output",
                            PtyOutputPayload {
                                session_id: sid.clone(),
                                data: text,
                            },
                        );
                        remainder.clear();
                    }
                    // Clean up session from registry
                    if let Ok(mut map) = sessions_ref.lock() {
                        map.remove(&sid);
                    }
                    let _ = app_handle_clone.emit(
                        "pty-closed",
                        PtyOutputPayload {
                            session_id: sid.clone(),
                            data: String::new(),
                        },
                    );
                    break;
                }
                Ok(n) => {
                    remainder.extend_from_slice(&buf[..n]);

                    // UTF-8 Safe Streaming:
                    // Only emit valid UTF-8 sequences and keep incomplete multi-byte characters
                    // (such as 3-byte Khmer script) in remainder until the next chunk arrives.
                    loop {
                        if remainder.is_empty() {
                            break;
                        }

                        match std::str::from_utf8(&remainder) {
                            Ok(valid_str) => {
                                let _ = app_handle_clone.emit(
                                    "pty-output",
                                    PtyOutputPayload {
                                        session_id: sid.clone(),
                                        data: valid_str.to_string(),
                                    },
                                );
                                remainder.clear();
                                break;
                            }
                            Err(e) => {
                                let valid_up_to = e.valid_up_to();
                                if valid_up_to > 0 {
                                    let valid_str = unsafe {
                                        std::str::from_utf8_unchecked(&remainder[..valid_up_to])
                                    };
                                    let _ = app_handle_clone.emit(
                                        "pty-output",
                                        PtyOutputPayload {
                                            session_id: sid.clone(),
                                            data: valid_str.to_string(),
                                        },
                                    );
                                    remainder.drain(..valid_up_to);
                                }

                                if let Some(error_len) = e.error_len() {
                                    // True invalid UTF-8 byte(s) (not end-of-buffer boundary)
                                    // Discard the invalid bytes and continue processing remainder
                                    remainder.drain(..error_len);
                                } else {
                                    // Incomplete multi-byte sequence at buffer tail (e.g. Khmer char)
                                    // Keep remaining bytes in remainder to combine with next read chunk
                                    break;
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    // Read error (e.g. pipe broken upon exit)
                    if let Ok(mut map) = sessions_ref.lock() {
                        map.remove(&sid);
                    }
                    let _ = app_handle_clone.emit(
                        "pty-closed",
                        PtyOutputPayload {
                            session_id: sid.clone(),
                            data: String::new(),
                        },
                    );
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn write_to_pty(
    session_id: String,
    data: String,
    state: State<AppState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get_mut(&session_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY session '{}' not found", session_id))
    }
}

#[tauri::command]
fn resize_pty(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<AppState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get_mut(&session_id) {
        session
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY session '{}' not found", session_id))
    }
}

#[tauri::command]
fn kill_pty(session_id: String, state: State<AppState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
        Ok(())
    } else {
        // Already closed or does not exist
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running KUI application");
}
